/**
 * WhatsApp Service — Baileys (WebSocket puro, sem Chrome/Puppeteer)
 *
 * Substitui whatsapp-web.js para resolver instabilidade no Render Starter
 * causada pelo Chrome a crashar após o scan do QR.
 */
import fs from "fs";
import path from "path";
import QRCode from "qrcode";
import { storage } from "../storage";

// Baileys imports
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  makeInMemoryStore,
  jidNormalizedUser,
  proto,
  WAMessageContent,
  downloadMediaMessage,
} from "@whiskeysockets/baileys";
import type { WASocket, ConnectionState, BaileysEventMap } from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import NodeCache from "node-cache";
import P from "pino";

interface WhatsAppConnection {
  connected: boolean;
  phoneNumber?: string;
  status: string;
  qrCode?: string;
  error?: string;
}

interface AntiBanState {
  timestamps: number[];
  sendQueue: Promise<void>;
}

const MAX_MSGS_PER_HOUR = 80;

function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((r) => setTimeout(r, ms));
}

// Logger silencioso para produção
const logger = P({ level: "silent" }) as any;

export class WhatsAppService {
  private sockets: Map<string, WASocket> = new Map();
  private initPromises: Map<string, Promise<void>> = new Map();
  private qrCodes: Map<string, string> = new Map();
  private connectionStatuses: Map<string, WhatsAppConnection> = new Map();
  private qrWaiters: Map<string, { resolve: (qr: string) => void; reject: (err: Error) => void }> = new Map();
  private antiBan: Map<string, AntiBanState> = new Map();
  private reconnectAttempts: Map<string, number> = new Map();
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map();
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private msgRetryCounterCache = new NodeCache();

  private static readonly MAX_RECONNECT_ATTEMPTS = 5;
  private static readonly RECONNECT_BASE_DELAY_MS = 15_000;

  constructor() {
    console.log("🚀 WhatsAppService (Baileys) inicializado");
    this.startHeartbeat();
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) return;
    this.heartbeatTimer = setInterval(async () => {
      for (const [userId, status] of this.connectionStatuses.entries()) {
        if (status.connected && !this.sockets.has(userId)) {
          console.warn(`💓 [HEARTBEAT] Socket ${userId} sumiu — reconectando...`);
          this.scheduleReconnect(userId);
        }
      }
    }, 120_000);
    if (this.heartbeatTimer.unref) this.heartbeatTimer.unref();
  }

  private scheduleReconnect(userId: string): void {
    if (this.reconnectTimers.has(userId)) return;
    const attempts = this.reconnectAttempts.get(userId) ?? 0;
    if (attempts >= WhatsAppService.MAX_RECONNECT_ATTEMPTS) {
      console.warn(`⚠️ Máximo de reconexões atingido para ${userId}`);
      return;
    }
    const delay = WhatsAppService.RECONNECT_BASE_DELAY_MS * Math.pow(2, attempts);
    console.log(`🔄 [RECONEXÃO] Tentativa ${attempts + 1} para ${userId} em ${delay / 1000}s`);
    const timer = setTimeout(async () => {
      this.reconnectTimers.delete(userId);
      this.reconnectAttempts.set(userId, (this.reconnectAttempts.get(userId) ?? 0) + 1);
      try {
        await this.ensureSocket(userId);
        this.reconnectAttempts.delete(userId);
      } catch (err: any) {
        console.error(`❌ Reconexão falhou para ${userId}:`, err?.message);
        this.scheduleReconnect(userId);
      }
    }, delay);
    if (timer.unref) timer.unref();
    this.reconnectTimers.set(userId, timer);
  }

  private cancelReconnect(userId: string): void {
    const timer = this.reconnectTimers.get(userId);
    if (timer) { clearTimeout(timer); this.reconnectTimers.delete(userId); }
    this.reconnectAttempts.delete(userId);
  }

  async destroy(): Promise<void> {
    if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; }
    for (const [userId, sock] of this.sockets.entries()) {
      this.cancelReconnect(userId);
      try { sock.end(undefined); } catch { }
    }
    this.sockets.clear();
    console.log("🛑 WhatsAppService encerrado.");
  }

  async getConnectionStatus(userId: string): Promise<WhatsAppConnection> {
    return this.connectionStatuses.get(userId) ?? { connected: false, status: "disconnected" };
  }

  async getQRCode(userId: string): Promise<string> {
    const status = this.connectionStatuses.get(userId);
    if (status?.connected) return "";

    // Limpar estado de falha anterior para permitir nova tentativa
    if (status?.status === "init_failed" || status?.status === "auth_failure") {
      console.log(`🔄 Limpando estado de falha (${status.status}) para ${userId}`);
      this.connectionStatuses.delete(userId);
      this.qrCodes.delete(userId);
      if (this.sockets.has(userId)) {
        try { this.sockets.get(userId)!.end(undefined); } catch { }
        this.sockets.delete(userId);
      }
    }

    try {
      await this.ensureSocket(userId);
    } catch (err: any) {
      const message = String(err?.message ?? "Falha ao inicializar WhatsApp");
      this.connectionStatuses.set(userId, { connected: false, status: "init_failed", error: message });
      this.qrCodes.delete(userId);
      throw new Error(message);
    }

    const existing = this.qrCodes.get(userId) ?? "";
    if (existing) return existing;

    const cur = this.connectionStatuses.get(userId);
    if (cur?.status === "init_failed" || cur?.status === "auth_failure") {
      throw new Error(cur.error ?? "Falha ao inicializar WhatsApp");
    }

    return await this.waitForQrCode(userId, 20_000);
  }

  private getAuthDataPath(userId: string): string {
    return path.join(process.cwd(), "auth_info", "baileys", userId);
  }

  private async ensureSocket(userId: string): Promise<void> {
    if (this.sockets.has(userId)) return;
    const inFlight = this.initPromises.get(userId);
    if (inFlight) return inFlight;
    const promise = this.initSocket(userId).finally(() => this.initPromises.delete(userId));
    this.initPromises.set(userId, promise);
    return promise;
  }

  private async initSocket(userId: string): Promise<void> {
    const authPath = this.getAuthDataPath(userId);
    if (!fs.existsSync(authPath)) fs.mkdirSync(authPath, { recursive: true });

    this.connectionStatuses.set(userId, { connected: false, status: "initializing" });

    const { state, saveCreds } = await useMultiFileAuthState(authPath);
    const { version } = await fetchLatestBaileysVersion();

    console.log(`🔗 [${userId}] Baileys v${version.join(".")} — conectando...`);

    const sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      logger,
      printQRInTerminal: false,
      msgRetryCounterCache: this.msgRetryCounterCache,
      generateHighQualityLinkPreview: false,
      // Não sincronizar histórico ao conectar — acelera muito a inicialização
      syncFullHistory: false,
      markOnlineOnConnect: false,
    });

    this.sockets.set(userId, sock);

    // ── Evento: QR Code ───────────────────────────────────────────────────────
    sock.ev.on("connection.update", async (update: Partial<ConnectionState>) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          const qrBase64 = await QRCode.toDataURL(qr);
          this.qrCodes.set(userId, qrBase64);
          this.connectionStatuses.set(userId, { connected: false, status: "qr_ready", qrCode: qrBase64 });
          console.log(`📱 [${userId}] QR Code gerado — aguardando scan`);

          const waiter = this.qrWaiters.get(userId);
          if (waiter) { this.qrWaiters.delete(userId); waiter.resolve(qrBase64); }

          // Atualizar DB
          const dbConn = await storage.getWhatsappConnection(userId);
          if (dbConn) {
            await storage.updateWhatsappConnection(dbConn.id, { qrCode: qrBase64, isConnected: false, updatedAt: new Date() });
          }
        } catch (err) {
          console.error("❌ Erro ao gerar QR:", err);
        }
      }

      if (connection === "close") {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const isLogout = statusCode === DisconnectReason.loggedOut;
        console.log(`🔌 [${userId}] Conexão fechada. Código: ${statusCode}. Logout: ${isLogout}`);

        this.connectionStatuses.set(userId, { connected: false, status: "disconnected" });
        this.qrCodes.delete(userId);
        this.sockets.delete(userId);

        // Atualizar DB
        try {
          const dbConn = await storage.getWhatsappConnection(userId);
          if (dbConn) {
            await storage.updateWhatsappConnection(dbConn.id, { isConnected: false, status: "disconnected", updatedAt: new Date() });
          }
        } catch { }

        if (isLogout) {
          // Apagar credenciais para forçar novo QR
          try { fs.rmSync(this.getAuthDataPath(userId), { recursive: true, force: true }); } catch { }
          this.cancelReconnect(userId);
        } else {
          // Reconectar automaticamente
          this.scheduleReconnect(userId);
        }
      }

      if (connection === "open") {
        const phone = sock.user?.id ? jidNormalizedUser(sock.user.id).split("@")[0] : undefined;
        console.log(`✅ [${userId}] WhatsApp conectado${phone ? `: ${phone}` : ""}`);

        this.connectionStatuses.set(userId, { connected: true, status: "connected", phoneNumber: phone });
        this.qrCodes.delete(userId);
        this.cancelReconnect(userId);

        const waiter = this.qrWaiters.get(userId);
        if (waiter) { this.qrWaiters.delete(userId); waiter.resolve(""); }

        // Atualizar DB
        try {
          const existingConn = await storage.getWhatsappConnection(userId);
          if (existingConn) {
            await storage.updateWhatsappConnection(existingConn.id, {
              isConnected: true, phoneNumber: phone, status: "connected",
              lastConnectedAt: new Date(), updatedAt: new Date(),
            });
          } else {
            await storage.createWhatsappConnection({
              userId, phoneNumber: phone ?? "unknown", name: "WhatsApp",
              isConnected: true, status: "connected",
            });
          }
        } catch (dbErr) {
          console.error("Erro ao atualizar DB na conexão:", dbErr);
        }
      }
    });

    // ── Guardar credenciais sempre que mudarem ────────────────────────────────
    sock.ev.on("creds.update", saveCreds);

    // ── Mensagens recebidas ───────────────────────────────────────────────────
    sock.ev.on("messages.upsert", async ({ messages, type }) => {
      if (type !== "notify") return;
      for (const msg of messages) {
        if (msg.key.fromMe) continue;
        await this.handleIncomingMessage(userId, sock, msg);
      }
    });
  }

  private async handleIncomingMessage(userId: string, sock: WASocket, msg: any): Promise<void> {
    try {
      const jid = msg.key.remoteJid ?? "";
      if (!jid || jid.endsWith("@g.us")) return; // Ignorar grupos

      const rawPhone = jid.split("@")[0];
      const phoneNumber = rawPhone.startsWith("258") ? rawPhone : rawPhone;
      const messageText = (
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        msg.message?.videoMessage?.caption ||
        ""
      ).trim();

      const pushName = msg.pushName ?? `Contato ${phoneNumber}`;

      if (!phoneNumber || !messageText) return;

      const normalizedIncoming = messageText
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\w\s]/gi, "");

      console.log(`[USER:${userId}] 📩 ${phoneNumber} (${pushName}): "${messageText}"`);

      const { funnelService } = await import("./funnelService");

      let contact = await storage.getContactByPhone(phoneNumber, userId);
      if (!contact) {
        contact = await storage.createContact({
          userId, phoneNumber, name: pushName, tags: [], isActive: true,
        });
      }

      await storage.createMessage({
        userId, contactId: contact.id, type: "text", content: messageText,
        status: "delivered", sentAt: new Date(), externalId: msg.key.id,
      });

      // Retomar funis pausados a aguardar resposta
      const waitingExecutions = await storage.getWaitingFunnelExecutions(contact.id);
      if (waitingExecutions?.length > 0) {
        for (const exec of waitingExecutions) {
          await funnelService.resumeFunnelExecution(exec.id, messageText, msg);
        }
        return;
      }

      // Disparar funis por trigger
      const funnels = await storage.getAllFunnels(userId);
      const triggeredFunnels = funnels.filter((f) => {
        if (f.status !== "active") return false;
        const isAny = f.triggerPhrases?.some((p) => {
          const t = p.trim().toLowerCase();
          return t === "*" || t === "__any__" || t === "qualquer mensagem" || t === "qualquer";
        });
        if (isAny) return true;
        return f.triggerPhrases?.some((phrase) => {
          const norm = phrase.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s]/gi, "");
          if (!norm) return false;
          const words = normalizedIncoming.split(/\s+/);
          return words.includes(norm) || normalizedIncoming.startsWith(norm);
        });
      });

      for (const funnel of triggeredFunnels) {
        const executions = await storage.getFunnelExecutions(funnel.id);
        const activeExec = executions.find((e) => e.contactId === contact!.id && e.status === "active");
        if (!activeExec) {
          console.log(`🚀 Disparando funil "${funnel.name}" para ${phoneNumber}`);
          await funnelService.executeFunnel(funnel.id, contact.id, messageText, msg);
        }
      }
    } catch (err) {
      console.error("❌ Erro ao processar mensagem (Baileys):", err);
    }
  }

  private async waitForQrCode(userId: string, timeoutMs: number): Promise<string> {
    const cached = this.qrCodes.get(userId) ?? "";
    if (cached) return cached;

    const existingWaiter = this.qrWaiters.get(userId);
    if (existingWaiter) {
      return new Promise<string>((resolve, reject) => {
        const prev = existingWaiter;
        existingWaiter.resolve = (v) => { prev.resolve(v); resolve(v); };
        existingWaiter.reject = (e) => { prev.reject(e); reject(e); };
      });
    }

    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.qrWaiters.delete(userId);
        resolve(this.qrCodes.get(userId) ?? "");
      }, timeoutMs);
      this.qrWaiters.set(userId, {
        resolve: (v) => { clearTimeout(timer); resolve(v); },
        reject: (e) => { clearTimeout(timer); reject(e); },
      });
    });
  }

  // ── Anti-ban ────────────────────────────────────────────────────────────────

  private getAntiBanState(userId: string): AntiBanState {
    if (!this.antiBan.has(userId)) {
      this.antiBan.set(userId, { timestamps: [], sendQueue: Promise.resolve() });
    }
    return this.antiBan.get(userId)!;
  }

  private checkRateLimit(state: AntiBanState): boolean {
    const now = Date.now();
    state.timestamps = state.timestamps.filter((t) => t > now - 3_600_000);
    return state.timestamps.length < MAX_MSGS_PER_HOUR;
  }

  private recordSend(state: AntiBanState): void {
    state.timestamps.push(Date.now());
  }

  // ── sendMessage ─────────────────────────────────────────────────────────────

  async sendMessage(
    phoneNumber: string,
    message: string,
    userId: string = "default-user",
    mediaUrl?: string,
    mediaFileName?: string,
    location?: { latitude: number; longitude: number; address: string },
    _quoted?: any,
  ): Promise<boolean> {
    const state = this.getAntiBanState(userId);
    const result = state.sendQueue.then(() =>
      this._sendMessageCore(phoneNumber, message, userId, mediaUrl, mediaFileName, location, state),
    );
    state.sendQueue = result.then(() => { }, () => { });
    return result;
  }

  private async _sendMessageCore(
    phoneNumber: string,
    message: string,
    userId: string,
    mediaUrl?: string,
    mediaFileName?: string,
    location?: { latitude: number; longitude: number; address: string },
    state?: AntiBanState,
  ): Promise<boolean> {
    try {
      await this.ensureSocket(userId);
      const sock = this.sockets.get(userId);
      if (!sock) { console.error("❌ Socket não encontrado para:", userId); return false; }

      const cleanPhone = phoneNumber.replace(/\D/g, "");
      if (cleanPhone.includes("843955854")) {
        console.warn(`🛑 Envio bloqueado para número proibido: ${phoneNumber}`);
        return false;
      }

      // Anti-ban: rate limit
      if (state && !this.checkRateLimit(state)) {
        console.warn(`🛡️ [ANTI-BAN] Limite atingido para ${userId}. Aguardando...`);
        await randomDelay(12000, 20000);
      }

      // Anti-ban: delay humano
      if (state && state.timestamps.length > 0) {
        const d = Math.floor(Math.random() * 3000) + 3000;
        console.log(`🛡️ [ANTI-BAN] Delay ${(d / 1000).toFixed(1)}s`);
        await new Promise((r) => setTimeout(r, d));
      }

      // Formatar JID
      const fullPhone = cleanPhone.length === 9 ? `258${cleanPhone}` : cleanPhone;
      const jid = phoneNumber.includes("@") ? phoneNumber : `${fullPhone}@s.whatsapp.net`;

      // Simular presença/digitação
      try {
        await sock.sendPresenceUpdate("composing", jid);
        const typingDelay = Math.min(Math.max((message || "").length * 40, 1500), 4000);
        await new Promise((r) => setTimeout(r, typingDelay));
        await sock.sendPresenceUpdate("paused", jid);
      } catch { }

      if (location) {
        await sock.sendMessage(jid, {
          location: { degreesLatitude: location.latitude, degreesLongitude: location.longitude, name: location.address },
        });
        if (state) this.recordSend(state);
        return true;
      }

      if (mediaUrl) {
        return await this._sendMedia(sock, jid, message, mediaUrl, mediaFileName, state);
      }

      await sock.sendMessage(jid, { text: message });
      console.log(`✅ [WHATSAPP] Mensagem enviada para ${jid}`);
      if (state) this.recordSend(state);
      return true;
    } catch (err: any) {
      console.error("❌ Erro ao enviar mensagem (Baileys):", err?.message ?? err);
      return false;
    }
  }

  private async _sendMedia(
    sock: WASocket,
    jid: string,
    caption: string,
    mediaUrl: string,
    mediaFileName?: string,
    state?: AntiBanState,
  ): Promise<boolean> {
    try {
      let url = mediaUrl.trim();
      let filename = mediaFileName;

      // Prefixos especiais
      if (url.startsWith("doc:")) {
        const raw = url.substring(4);
        const sep = raw.indexOf("|");
        if (sep !== -1) { filename = filename || raw.substring(0, sep); url = raw.substring(sep + 1); }
        else url = raw;
      } else if (url.startsWith("video:")) {
        url = url.substring(6);
      } else if (url.startsWith("audio:")) {
        url = url.substring(6);
      }

      if (url.startsWith("data:")) {
        // Base64 inline
        let mimeType = url.substring(5, url.indexOf(";"));
        if (mimeType === "audio/mp3") mimeType = "audio/mpeg";
        const base64Data = url.split(",")[1] ?? "";
        const buffer = Buffer.from(base64Data, "base64");

        if (mimeType.startsWith("image/")) {
          await sock.sendMessage(jid, { image: buffer, caption, mimetype: mimeType });
        } else if (mimeType.startsWith("audio/")) {
          const isPtt = mimeType.includes("ogg") || mimeType.includes("opus");
          await sock.sendMessage(jid, { audio: buffer, mimetype: mimeType, ptt: isPtt });
        } else if (mimeType.startsWith("video/")) {
          await sock.sendMessage(jid, { video: buffer, caption, mimetype: mimeType });
        } else {
          await sock.sendMessage(jid, { document: buffer, mimetype: mimeType, fileName: filename ?? "arquivo", caption });
        }
      } else if (url.startsWith("http://") || url.startsWith("https://")) {
        // URL remota — inferir tipo pelo mime ou extensão
        const ext = (filename ?? url).split(".").pop()?.toLowerCase() ?? "";
        const isImage = ["jpg", "jpeg", "png", "gif", "webp"].includes(ext);
        const isVideo = ["mp4", "mov", "avi", "mkv"].includes(ext);
        const isAudio = ["mp3", "ogg", "opus", "m4a", "wav"].includes(ext);

        if (isImage) {
          await sock.sendMessage(jid, { image: { url }, caption });
        } else if (isVideo) {
          await sock.sendMessage(jid, { video: { url }, caption });
        } else if (isAudio) {
          await sock.sendMessage(jid, { audio: { url }, ptt: ext === "ogg" || ext === "opus" });
        } else {
          await sock.sendMessage(jid, { document: { url }, fileName: filename ?? "arquivo", caption });
        }
      } else {
        throw new Error(`URL de mídia inválida: ${url.substring(0, 40)}`);
      }

      console.log(`✅ [WHATSAPP] Mídia enviada para ${jid}`);
      if (state) this.recordSend(state);
      return true;
    } catch (err: any) {
      console.error(`❌ Erro ao enviar mídia para ${jid}:`, err?.message ?? err);
      try { await sock.sendMessage(jid, { text: (caption ? caption + "\n\n" : "") + "⚠️ [Erro ao carregar arquivo de mídia]" }); } catch { }
      return false;
    }
  }

  async disconnect(userId: string): Promise<void> {
    const sock = this.sockets.get(userId);
    if (sock) {
      try { await sock.logout(); } catch { }
      try { sock.end(undefined); } catch { }
      this.sockets.delete(userId);
    }
    this.connectionStatuses.set(userId, { connected: false, status: "disconnected" });
    this.qrCodes.delete(userId);

    const waiter = this.qrWaiters.get(userId);
    if (waiter) { this.qrWaiters.delete(userId); waiter.resolve(""); }

    // Apagar sessão
    const authPath = this.getAuthDataPath(userId);
    if (fs.existsSync(authPath)) {
      try { fs.rmSync(authPath, { recursive: true, force: true }); } catch { }
    }

    try {
      const dbConn = await storage.getWhatsappConnection(userId);
      if (dbConn) {
        await storage.updateWhatsappConnection(dbConn.id, { isConnected: false, status: "disconnected", updatedAt: new Date() });
      }
    } catch { }

    this.cancelReconnect(userId);
  }

  async getAntiBanStats(userId: string = "default-user") {
    const state = this.antiBan.get(userId);
    const now = Date.now();
    const count = state ? state.timestamps.filter((t) => t > now - 3_600_000).length : 0;
    return {
      messagesThisHour: count,
      maxPerHour: MAX_MSGS_PER_HOUR,
      antiBanActive: true,
      safeDelayRange: "3s - 6s",
      typingSimulation: true,
    };
  }
}

export const whatsappService = new WhatsAppService();
