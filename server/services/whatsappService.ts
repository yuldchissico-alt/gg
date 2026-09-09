/**
 * WhatsApp Service — Baileys
 *
 * Usa @whiskeysockets/baileys (WebSocket directo) em vez de whatsapp-web.js (Puppeteer).
 * Vantagens: sem Chromium, sem timeouts de protocolo, muito mais leve no Render.
 */
import fs from "fs";
import path from "path";
import QRCode from "qrcode";
import { storage } from "../storage";

// ── Baileys ──────────────────────────────────────────────────────────────────
import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeInMemoryStore,
  downloadMediaMessage,
  proto,
  WASocket,
  ConnectionState,
  BaileysEventMap,
  Browsers,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import NodeCache from "node-cache";
import { pino } from "pino";

// ── Anti-ban ─────────────────────────────────────────────────────────────────
interface AntiBanState {
  timestamps: number[];
  sendQueue: Promise<void>;
}
const MAX_MSGS_PER_HOUR = 80;

function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((r) => setTimeout(r, ms));
}

// ── Tipos públicos ────────────────────────────────────────────────────────────
interface WhatsAppConnection {
  connected: boolean;
  phoneNumber?: string;
  status: string;
  qrCode?: string;
  error?: string;
}

// ── Serviço ───────────────────────────────────────────────────────────────────
export class WhatsAppService {
  private sockets: Map<string, WASocket> = new Map();
  private stores: Map<string, ReturnType<typeof makeInMemoryStore>> = new Map();
  private initPromises: Map<string, Promise<void>> = new Map();
  private connectionStatuses: Map<string, WhatsAppConnection> = new Map();
  private qrCodes: Map<string, string> = new Map();
  private qrWaiters: Map<string, { resolve: (v: string) => void; reject: (e: Error) => void }> = new Map();
  private antiBan: Map<string, AntiBanState> = new Map();
  private reconnectAttempts: Map<string, number> = new Map();
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map();
  private msgRetryCache = new NodeCache();
  private heartbeatTimer: NodeJS.Timeout | null = null;
  /** Mapa de JID @lid → número real (ex: "20182437245038@lid" → "258840123456") */
  private lidToPhone: Map<string, string> = new Map();

  private static readonly MAX_RECONNECT = 5;
  private static readonly RECONNECT_BASE_MS = 15_000;

  constructor() {
    console.log("🚀 WhatsAppService (Baileys) inicializado");
    this.startHeartbeat();
  }

  // ── Paths ────────────────────────────────────────────────────────────────────
  private getAuthDataPath(): string {
    // Usar o disco persistente do Render
    return path.join(process.cwd(), "auth_info", "baileys");
  }
  private getSessionPath(userId: string): string {
    return path.join(this.getAuthDataPath(), `session-${userId}`);
  }

  // ── Heartbeat ────────────────────────────────────────────────────────────────
  private startHeartbeat() {
    if (this.heartbeatTimer) return;
    this.heartbeatTimer = setInterval(async () => {
      for (const [userId, status] of this.connectionStatuses.entries()) {
        if (status.connected && !this.sockets.has(userId)) {
          console.warn(`💓 [HEARTBEAT] Socket ${userId} desapareceu — reconectando...`);
          this.scheduleReconnect(userId);
        }
      }
    }, 120_000);
    if (this.heartbeatTimer.unref) this.heartbeatTimer.unref();
  }

  // ── Reconexão ────────────────────────────────────────────────────────────────
  private scheduleReconnect(userId: string) {
    if (this.reconnectTimers.has(userId)) return;
    const attempts = this.reconnectAttempts.get(userId) ?? 0;
    if (attempts >= WhatsAppService.MAX_RECONNECT) {
      console.warn(`⚠️ [RECONEXÃO] Máximo de tentativas atingido para ${userId}`);
      return;
    }
    const delay = WhatsAppService.RECONNECT_BASE_MS * Math.pow(2, attempts);
    console.log(`🔄 [RECONEXÃO] Tentativa ${attempts + 1} para ${userId} em ${delay / 1000}s`);
    const t = setTimeout(async () => {
      this.reconnectTimers.delete(userId);
      this.reconnectAttempts.set(userId, (this.reconnectAttempts.get(userId) ?? 0) + 1);
      try {
        await this.ensureSocket(userId);
        this.reconnectAttempts.delete(userId);
      } catch {
        this.scheduleReconnect(userId);
      }
    }, delay);
    if (t.unref) t.unref();
    this.reconnectTimers.set(userId, t);
  }

  private cancelReconnect(userId: string) {
    const t = this.reconnectTimers.get(userId);
    if (t) { clearTimeout(t); this.reconnectTimers.delete(userId); }
    this.reconnectAttempts.delete(userId);
  }

  // ── destroy (graceful shutdown) ──────────────────────────────────────────────
  async destroy() {
    if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; }
    for (const [userId, sock] of this.sockets.entries()) {
      this.cancelReconnect(userId);
      try { sock.end(undefined); } catch { /* ignore */ }
    }
    this.sockets.clear();
    this.stores.clear();
    console.log("🛑 WhatsAppService encerrado.");
  }

  // ── API pública ───────────────────────────────────────────────────────────────
  async getConnectionStatus(userId: string): Promise<WhatsAppConnection> {
    return this.connectionStatuses.get(userId) ?? { connected: false, status: "disconnected" };
  }

  /** Reconecta usando sessão salva — chamado quando o DB diz conectado mas memória não tem socket */
  async reconnectFromDB(userId: string): Promise<void> {
    // Evitar múltiplas chamadas simultâneas
    if (this.initPromises.has(userId) || this.sockets.has(userId)) return;
    const sessionPath = this.getSessionPath(userId);
    // Só reconectar se houver sessão salva no disco
    if (!fs.existsSync(path.join(sessionPath, "creds.json"))) {
      console.log(`ℹ️ [RECONEXÃO DB] Sem sessão no disco para ${userId} — ignorar`);
      return;
    }
    console.log(`🔄 [RECONEXÃO DB] Reconectando com sessão existente para ${userId}`);
    try {
      await this.ensureSocket(userId);
    } catch (err: any) {
      console.error(`❌ [RECONEXÃO DB] Falha:`, err?.message);
    }
  }

  async getQRCode(userId: string): Promise<string> {
    const status = this.connectionStatuses.get(userId);
    if (status?.connected) return "";

    // Limpar estado de falha para permitir nova tentativa
    if (status?.status === "init_failed" || status?.status === "auth_failure") {
      console.log(`🔄 [QR] Limpando estado de falha (${status.status}) para ${userId}`);
      this.connectionStatuses.delete(userId);
      this.qrCodes.delete(userId);
      if (this.sockets.has(userId)) {
        try { this.sockets.get(userId)?.end(undefined); } catch { /* ignore */ }
        this.sockets.delete(userId);
      }
      // Limpar sessão corrompida do disco
      const sessionPath = this.getSessionPath(userId);
      if (fs.existsSync(sessionPath)) {
        try { fs.rmSync(sessionPath, { recursive: true, force: true }); } catch { /* ignore */ }
        console.log(`🧹 [QR] Sessão corrompida removida: ${sessionPath}`);
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

    return await this.waitForQrCode(userId, 30_000);
  }

  // ── Inicialização do socket Baileys ──────────────────────────────────────────
  private async ensureSocket(userId: string): Promise<void> {
    if (this.sockets.has(userId)) return;
    const inFlight = this.initPromises.get(userId);
    if (inFlight) return inFlight;
    const promise = this.initSocket(userId).finally(() => this.initPromises.delete(userId));
    this.initPromises.set(userId, promise);
    return promise;
  }

  private async initSocket(userId: string): Promise<void> {
    const sessionPath = this.getSessionPath(userId);
    if (!fs.existsSync(sessionPath)) fs.mkdirSync(sessionPath, { recursive: true });

    this.connectionStatuses.set(userId, { connected: false, status: "initializing" });

    // Versão fixada conhecida e estável — evita falha de rede no fetchLatestBaileysVersion
    let version: [number, number, number] = [2, 3000, 1023212357];
    try {
      const latest = await fetchLatestBaileysVersion();
      version = latest.version;
      console.log(`🔧 Baileys versão WA: ${version.join(".")}`);
    } catch {
      console.warn(`⚠️ Não foi possível obter versão WA online — usando versão fixa ${version.join(".")}`);
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

    const logger = pino({ level: "silent" }) as any;

    const sock = makeWASocket({
      version,
      auth: state,
      logger,
      printQRInTerminal: false,
      msgRetryCounterCache: this.msgRetryCache,
      generateHighQualityLinkPreview: false,
      connectTimeoutMs: 60_000,
      defaultQueryTimeoutMs: 60_000,
      keepAliveIntervalMs: 30_000,
      retryRequestDelayMs: 2_000,
      browser: Browsers.appropriate("Chrome"),
    });

    // Store em memória — mantém índice de contactos, mensagens e chats
    const store = makeInMemoryStore({ logger });
    store.bind(sock.ev);
    this.stores.set(userId, store);
    this.sockets.set(userId, sock);

    // ── Salvar credenciais sempre que actualizadas ───────────────────────────
    sock.ev.on("creds.update", saveCreds);

    // ── Evento principal de conexão ─────────────────────────────────────────
    sock.ev.on("connection.update", async (update: Partial<ConnectionState>) => {
      const { connection, lastDisconnect, qr } = update;

      // QR gerado — converter para base64 e disponibilizar
      if (qr) {
        try {
          const qrBase64 = await QRCode.toDataURL(qr);
          this.qrCodes.set(userId, qrBase64);
          this.connectionStatuses.set(userId, { connected: false, status: "qr_ready", qrCode: qrBase64 });

          const waiter = this.qrWaiters.get(userId);
          if (waiter) { this.qrWaiters.delete(userId); waiter.resolve(qrBase64); }

          console.log(`📱 [${userId}] QR Code gerado — aguardando scan`);

          // Persistir QR no banco
          try {
            const dbConn = await storage.getWhatsappConnection(userId);
            if (dbConn) {
              await storage.updateWhatsappConnection(dbConn.id, { qrCode: qrBase64, isConnected: false, updatedAt: new Date() });
            }
          } catch { /* ignore */ }
        } catch (err) {
          console.error("❌ Erro ao gerar QR base64:", err);
        }
      }

      if (connection === "open") {
        // ── CONECTADO ──────────────────────────────────────────────────────
        const phone = sock.user?.id?.split(":")[0] ?? sock.user?.id;
        this.connectionStatuses.set(userId, { connected: true, status: "connected", phoneNumber: phone });
        this.qrCodes.delete(userId);
        this.cancelReconnect(userId);

        const waiter = this.qrWaiters.get(userId);
        if (waiter) { this.qrWaiters.delete(userId); waiter.resolve(""); }

        console.log(`✅ WhatsApp conectado (${userId})${phone ? `: ${phone}` : ""}`);

        try {
          const existingConn = await storage.getWhatsappConnection(userId);
          if (existingConn) {
            await storage.updateWhatsappConnection(existingConn.id, {
              isConnected: true, phoneNumber: phone, status: "connected",
              lastConnectedAt: new Date(), updatedAt: new Date(),
            });
          } else {
            await storage.createWhatsappConnection({
              userId, phoneNumber: phone ?? "unknown", name: "WhatsApp", isConnected: true, status: "connected",
            });
          }
        } catch (dbErr) { console.error("Erro DB on connect:", dbErr); }
      }

      if (connection === "close") {
        // ── DESCONECTADO ───────────────────────────────────────────────────
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const reason = DisconnectReason;
        const shouldReconnect = statusCode !== reason.loggedOut && statusCode !== reason.banned;

        console.log(`⚠️ [${userId}] Conexão fechada. Código: ${statusCode}. Reconectar: ${shouldReconnect}`);

        this.connectionStatuses.set(userId, { connected: false, status: "disconnected" });
        this.sockets.delete(userId);

        try {
          const dbConn = await storage.getWhatsappConnection(userId);
          if (dbConn) await storage.updateWhatsappConnection(dbConn.id, { isConnected: false, status: "disconnected", updatedAt: new Date() });
        } catch { /* ignore */ }

        if (shouldReconnect) {
          // Verificar se há sessão salva (não foi logout)
          const hasCreds = fs.existsSync(path.join(sessionPath, "creds.json"));
          if (hasCreds) {
            console.log(`🔄 [${userId}] Sessão salva detectada — reconectando automaticamente...`);
            this.scheduleReconnect(userId);
          }
        } else {
          // Logout — limpar sessão
          console.log(`🚪 [${userId}] Logout detectado — a limpar sessão`);
          this.cancelReconnect(userId);
          try { fs.rmSync(sessionPath, { recursive: true, force: true }); } catch { /* ignore */ }
        }
      }
    });

    // ── Sincronização de contactos — mapeia @lid → número real ───────────────
    // O Baileys emite este evento ao conectar e quando o WA sincroniza contactos.
    // Cada entrada tem { id: "NÚMERO@s.whatsapp.net", lid: "LID@lid", ... }
    sock.ev.on("contacts.upsert", async (contacts) => {
      let mapped = 0;
      for (const c of contacts) {
        const lid = (c as any).lid as string | undefined;
        if (lid && c.id?.endsWith("@s.whatsapp.net")) {
          const phone = c.id.replace("@s.whatsapp.net", "");
          // Guardar mapeamento nos dois sentidos
          this.lidToPhone.set(lid, phone);
          this.lidToPhone.set(`jid:${lid}`, phone);
          // Também mapear sem sufixo @lid
          const lidNum = lid.replace("@lid", "");
          this.lidToPhone.set(lidNum, phone);
          this.lidToPhone.set(`jid:${lidNum}@lid`, phone);
          mapped++;
        }
      }
      if (mapped > 0) {
        console.log(`📒 [BAILEYS] ${mapped} mapeamentos LID→número actualizados`);
      }
    });

    // ── Mensagens recebidas ─────────────────────────────────────────────────
    sock.ev.on("messages.upsert", async ({ messages, type }) => {
      if (type !== "notify") return;
      for (const msg of messages) {
        if (msg.key.fromMe) continue;
        await this.handleIncomingMessage(userId, sock, msg);
      }
    });
  }

  // ── Processar mensagem recebida ───────────────────────────────────────────────
  private async handleIncomingMessage(userId: string, sock: WASocket, msg: proto.IWebMessageInfo) {
    try {
      const from = msg.key.remoteJid ?? "";
      if (!from || from.endsWith("@g.us") || from.endsWith("@broadcast")) return;

      console.log(`🔍 [BAILEYS] remoteJid recebido: ${from}`);

      // Resolver o número real de telefone a partir do JID
      // O Baileys pode entregar @s.whatsapp.net, @lid, ou número puro
      let phoneNumber: string;
      let sendJid: string; // JID que funciona para enviar de volta

      if (from.endsWith("@s.whatsapp.net")) {
        // Formato ideal — número directo
        phoneNumber = from.replace("@s.whatsapp.net", "");
        sendJid = from;
      } else if (from.endsWith("@lid")) {
        // Formato LID — tentar resolver via cache (populado pelo contacts.upsert)
        const cachedPhone = this.lidToPhone.get(from) || this.lidToPhone.get(from.replace("@lid", ""));
        if (cachedPhone) {
          phoneNumber = cachedPhone;
          sendJid = `${cachedPhone}@s.whatsapp.net`;
          console.log(`🔍 [BAILEYS] @lid ${from} → ${sendJid} (cache)`);
        } else {
          // Cache miss — tentar resolver via API
          try {
            const resolved = await sock.onWhatsApp(from);
            if (resolved?.[0]?.jid && resolved[0].jid.endsWith("@s.whatsapp.net")) {
              sendJid = resolved[0].jid;
              phoneNumber = sendJid.replace("@s.whatsapp.net", "");
              // Guardar no cache para uso futuro
              this.lidToPhone.set(from, phoneNumber);
              this.lidToPhone.set(from.replace("@lid", ""), phoneNumber);
              console.log(`🔍 [BAILEYS] @lid ${from} → ${sendJid} (API)`);
            } else {
              sendJid = from;
              phoneNumber = from.replace("@lid", "");
              console.warn(`⚠️ [BAILEYS] @lid ${from} não resolvido — usando LID numérico`);
            }
          } catch {
            sendJid = from;
            phoneNumber = from.replace("@lid", "");
          }
        }
      } else {
        // Número sem sufixo — adicionar @s.whatsapp.net
        phoneNumber = from;
        sendJid = `${from}@s.whatsapp.net`;
      }
      const messageText = (
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.buttonsResponseMessage?.selectedDisplayText ||
        msg.message?.listResponseMessage?.title ||
        ""
      ).trim();

      if (!messageText) return;

      const normalizedIncoming = messageText.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s]/gi, "");

      // Nome do contacto
      const pushName = msg.pushName ?? `Contato ${phoneNumber}`;

      console.log(`[USER:${userId}] 📩 Mensagem de ${phoneNumber} (${sendJid}) (${pushName}): "${messageText}"`);

      const { funnelService } = await import("./funnelService");

      // Procurar contacto pelo número real (phoneNumber) OU pelo sendJid (sem sufixo)
      let contact = await storage.getContactByPhone(phoneNumber, userId);
      if (!contact && sendJid !== `${phoneNumber}@s.whatsapp.net`) {
        // Tentar pelo número extraído do sendJid
        const jidPhone = sendJid.replace("@s.whatsapp.net", "").replace("@lid", "");
        contact = await storage.getContactByPhone(jidPhone, userId);
      }

      if (!contact) {
        contact = await storage.createContact({ userId, phoneNumber, name: pushName, tags: [], isActive: true });
      } else if (contact.phoneNumber !== phoneNumber && phoneNumber.length > 5 && !phoneNumber.includes("@")) {
        // Actualizar contacto com número real se estava guardado como LID
        console.log(`🔄 [BAILEYS] Actualizando contacto ${contact.id}: ${contact.phoneNumber} → ${phoneNumber}`);
        try {
          await storage.updateContact(contact.id, { phoneNumber });
          contact = { ...contact, phoneNumber };
        } catch { /* ignore */ }
      }

      await storage.createMessage({
        userId, contactId: contact.id, type: "text", content: messageText,
        status: "delivered", sentAt: new Date(), externalId: msg.key.id ?? undefined,
      });

      // Execuções pausadas aguardando resposta
      const waitingExecutions = await storage.getWaitingFunnelExecutions(contact.id);
      if (waitingExecutions?.length > 0) {
        for (const exec of waitingExecutions) {
          console.log(`💬 Retomando funil ${exec.id} para ${phoneNumber}`);
          await funnelService.resumeFunnelExecution(exec.id, messageText, msg);
        }
        return;
      }

      // Disparar funis correspondentes
      const funnels = await storage.getAllFunnels(userId);
      const triggered = funnels.filter(f => {
        if (f.status !== "active") return false;
        const anyMatch = f.triggerPhrases?.some(p => {
          const t = p.trim().toLowerCase();
          return t === "*" || t === "__any__" || t === "qualquer mensagem" || t === "qualquer";
        });
        if (anyMatch) return true;
        return f.triggerPhrases?.some(phrase => {
          const n = phrase.trim().toLowerCase().normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s]/gi, "");
          if (!n) return false;
          const words = normalizedIncoming.split(/\s+/);
          return words.includes(n) || normalizedIncoming.startsWith(n);
        });
      });

      for (const funnel of triggered) {
        const executions = await storage.getFunnelExecutions(funnel.id);
        const active = executions.find(e => e.contactId === contact!.id && e.status === "active");
        if (!active) {
          console.log(`🚀 Disparando funil "${funnel.name}" para ${phoneNumber}`);
          await funnelService.executeFunnel(funnel.id, contact.id, messageText, msg);
        }
      }
    } catch (err) {
      console.error("❌ Erro ao processar mensagem (Baileys):", err);
    }
  }

  // ── waitForQrCode ────────────────────────────────────────────────────────────
  private async waitForQrCode(userId: string, timeoutMs: number): Promise<string> {
    const cached = this.qrCodes.get(userId) ?? "";
    if (cached) return cached;

    const existing = this.qrWaiters.get(userId);
    if (existing) {
      return new Promise<string>((resolve, reject) => {
        const prev = { ...existing };
        existing.resolve = v => { prev.resolve(v); resolve(v); };
        existing.reject = e => { prev.reject(e); reject(e); };
      });
    }

    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.qrWaiters.delete(userId);
        resolve(this.qrCodes.get(userId) ?? "");
      }, timeoutMs);

      this.qrWaiters.set(userId, {
        resolve: v => { clearTimeout(timer); resolve(v); },
        reject: e => { clearTimeout(timer); reject(e); },
      });
    });
  }

  // ── Anti-ban ─────────────────────────────────────────────────────────────────
  private getAntiBanState(userId: string): AntiBanState {
    if (!this.antiBan.has(userId)) {
      this.antiBan.set(userId, { timestamps: [], sendQueue: Promise.resolve() });
    }
    return this.antiBan.get(userId)!;
  }

  private checkRateLimit(state: AntiBanState): boolean {
    const now = Date.now();
    state.timestamps = state.timestamps.filter(t => t > now - 3_600_000);
    return state.timestamps.length < MAX_MSGS_PER_HOUR;
  }

  private recordSend(state: AntiBanState) { state.timestamps.push(Date.now()); }

  // ── sendMessage ───────────────────────────────────────────────────────────────
  async sendMessage(
    phoneNumber: string,
    message: string,
    userId = "default-user",
    mediaUrl?: string,
    mediaFileName?: string,
    location?: { latitude: number; longitude: number; address: string },
    _quoted?: any,
  ): Promise<boolean> {
    const state = this.getAntiBanState(userId);
    const result = state.sendQueue.then(() =>
      this._sendCore(phoneNumber, message, userId, mediaUrl, mediaFileName, location, state)
    );
    state.sendQueue = result.then(() => {}, () => {});
    return result;
  }

  private async _sendCore(
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

      // Verificar se está realmente conectado antes de enviar
      const connStatus = this.connectionStatuses.get(userId);
      if (!connStatus?.connected) {
        console.error(`❌ [BAILEYS] Não conectado (status: ${connStatus?.status}) — impossível enviar para ${phoneNumber}`);
        return false;
      }

      const cleanPhone = phoneNumber.replace(/\D/g, "");
      if (cleanPhone.includes("843955854")) {
        console.warn(`🛑 Envio bloqueado para número proibido: ${phoneNumber}`);
        return false;
      }

      if (state && !this.checkRateLimit(state)) {
        console.warn(`🛡️ [ANTI-BAN] Limite atingido para ${userId} — pausa preventiva`);
        await randomDelay(12000, 20000);
      }

      if (state && state.timestamps.length > 0) {
        const delay = Math.floor(Math.random() * 3000) + 3000;
        await new Promise(r => setTimeout(r, delay));
      }

      // Montar JID — resolver LID para número real se necessário
      let jid: string;

      if (phoneNumber.endsWith("@s.whatsapp.net")) {
        jid = phoneNumber;
      } else if (phoneNumber.endsWith("@lid")) {
        // Tentar cache (populado pelo contacts.upsert e mensagens anteriores)
        const cached = this.lidToPhone.get(phoneNumber) || this.lidToPhone.get(phoneNumber.replace("@lid",""));
        if (cached) {
          jid = `${cached}@s.whatsapp.net`;
          console.log(`🔍 [BAILEYS] @lid → ${jid} (cache)`);
        } else {
          const num = phoneNumber.replace("@lid","");
          const full = num.length === 9 ? `258${num}` : num;
          jid = `${full}@s.whatsapp.net`;
          console.warn(`⚠️ [BAILEYS] @lid não resolvido — fallback ${jid}`);
        }
      } else {
        // Verificar se é um LID disfarçado (número muito longo sem prefixo 258)
        const cached = this.lidToPhone.get(phoneNumber) || this.lidToPhone.get(`${phoneNumber}@lid`);
        if (cached && cached !== phoneNumber) {
          jid = `${cached}@s.whatsapp.net`;
          console.log(`🔍 [BAILEYS] LID numérico → ${jid} (cache)`);
        } else {
          // Tentar via store do Baileys
          const store = this.stores.get(userId);
          if (store) {
            const storeContact = (store.contacts as any)?.[`${phoneNumber}@lid`] ||
                                 (store.contacts as any)?.[phoneNumber];
            if (storeContact?.lid || storeContact?.id?.endsWith("@s.whatsapp.net")) {
              const resolvedPhone = (storeContact.id || storeContact.lid || "").replace("@s.whatsapp.net","").replace("@lid","");
              if (resolvedPhone && resolvedPhone !== phoneNumber) {
                jid = `${resolvedPhone}@s.whatsapp.net`;
                this.lidToPhone.set(phoneNumber, resolvedPhone);
                console.log(`🔍 [BAILEYS] LID resolvido via store → ${jid}`);
              } else {
                const full = cleanPhone.length === 9 ? `258${cleanPhone}` : cleanPhone;
                jid = `${full}@s.whatsapp.net`;
              }
            } else {
              const full = cleanPhone.length === 9 ? `258${cleanPhone}` : cleanPhone;
              jid = `${full}@s.whatsapp.net`;
            }
          } else {
            const full = cleanPhone.length === 9 ? `258${cleanPhone}` : cleanPhone;
            jid = `${full}@s.whatsapp.net`;
          }
        }
      }

      console.log(`📤 [BAILEYS] Enviando para ${jid}: "${message?.slice(0, 50)}"`);

      // Verificar existência (opcional — não bloquear se falhar)
      try {
        const [result] = await sock.onWhatsApp(jid);
        if (result && !result.exists) {
          console.warn(`⚠️ [BAILEYS] ${jid} não encontrado no WhatsApp`);
        }
      } catch { /* ignorar */ }

      // Simulação de presença (typing)
      try {
        await sock.presenceSubscribe(jid);
        await sock.sendPresenceUpdate("composing", jid);
        const typingDelay = Math.min(Math.max((message || "").length * 40, 1500), 4000);
        await new Promise(r => setTimeout(r, typingDelay));
        await sock.sendPresenceUpdate("paused", jid);
      } catch { /* ignore */ }

      if (location) {
        await sock.sendMessage(jid, {
          location: { degreesLatitude: location.latitude, degreesLongitude: location.longitude }
        });
        if (state) this.recordSend(state);
        return true;
      }

      if (mediaUrl) {
        return await this._sendMedia(sock, jid, message, mediaUrl, mediaFileName, state);
      }

      await sock.sendMessage(jid, { text: message });
      console.log(`✅ [BAILEYS] Mensagem enviada para ${jid}`);
      if (state) this.recordSend(state);
      return true;
    } catch (err: any) {
      console.error(`❌ Erro ao enviar mensagem (Baileys) para ${phoneNumber}:`, err?.message ?? err);
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

      // Prefixos doc:/video:/audio:
      if (url.startsWith("doc:")) {
        const raw = url.slice(4);
        const sep = raw.indexOf("|");
        if (sep !== -1) { filename = filename ?? raw.slice(0, sep); url = raw.slice(sep + 1); }
        else url = raw;
      } else if (url.startsWith("video:")) url = url.slice(6);
      else if (url.startsWith("audio:")) url = url.slice(6);

      if (url.startsWith("data:")) {
        const mime = url.slice(5, url.indexOf(";")) as any;
        const b64 = url.split(",")[1] ?? "";
        const buffer = Buffer.from(b64, "base64");
        const isAudio = mime.startsWith("audio/");
        const isVideo = mime.startsWith("video/");
        const isImage = mime.startsWith("image/");

        if (isImage) {
          await sock.sendMessage(jid, { image: buffer, caption });
        } else if (isAudio) {
          await sock.sendMessage(jid, { audio: buffer, mimetype: mime, ptt: mime.includes("ogg") });
        } else if (isVideo) {
          await sock.sendMessage(jid, { video: buffer, caption });
        } else {
          await sock.sendMessage(jid, { document: buffer, mimetype: mime, fileName: filename ?? "arquivo", caption });
        }
      } else if (url.startsWith("http")) {
        // URL pública
        const isImage = /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url);
        const isVideo = /\.(mp4|mov|avi|webm)(\?|$)/i.test(url);
        const isAudio = /\.(mp3|ogg|wav|m4a|opus)(\?|$)/i.test(url);

        if (isImage) {
          await sock.sendMessage(jid, { image: { url }, caption });
        } else if (isAudio) {
          await sock.sendMessage(jid, { audio: { url }, ptt: url.includes("ogg") });
        } else if (isVideo) {
          await sock.sendMessage(jid, { video: { url }, caption });
        } else {
          await sock.sendMessage(jid, { document: { url }, fileName: filename ?? url.split("/").pop() ?? "arquivo", caption });
        }
      } else {
        throw new Error(`URL de mídia inválida: ${url.slice(0, 40)}`);
      }

      console.log(`✅ [BAILEYS] Mídia enviada para ${jid}`);
      if (state) this.recordSend(state);
      return true;
    } catch (err: any) {
      console.error(`❌ Erro ao enviar mídia para ${jid}:`, err?.message);
      // Fallback: enviar só o texto
      if (caption) {
        try { await sock.sendMessage(jid, { text: caption + "\n\n⚠️ [Erro ao carregar mídia]" }); } catch { /* ignore */ }
      }
      return false;
    }
  }

  // ── disconnect (logout) ───────────────────────────────────────────────────────
  async disconnect(userId: string): Promise<void> {
    const sock = this.sockets.get(userId);
    this.cancelReconnect(userId);

    if (sock) {
      try { await sock.logout(); } catch { /* ignore */ }
      try { sock.end(undefined); } catch { /* ignore */ }
      this.sockets.delete(userId);
    }

    this.connectionStatuses.set(userId, { connected: false, status: "disconnected" });
    this.qrCodes.delete(userId);

    const waiter = this.qrWaiters.get(userId);
    if (waiter) { this.qrWaiters.delete(userId); waiter.resolve(""); }

    // Limpar sessão salva
    const sessionPath = this.getSessionPath(userId);
    if (fs.existsSync(sessionPath)) {
      try { fs.rmSync(sessionPath, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  }

  // ── resetSession: limpa tudo e força novo QR ─────────────────────────────────
  async resetSession(userId: string): Promise<void> {
    console.log(`🔄 [RESET] Resetando sessão completa para ${userId}`);

    this.cancelReconnect(userId);

    // Fechar socket existente
    if (this.sockets.has(userId)) {
      try { this.sockets.get(userId)?.end(undefined); } catch { /* ignore */ }
      this.sockets.delete(userId);
    }

    // Cancelar init em curso
    this.initPromises.delete(userId);

    // Limpar estado em memória
    this.connectionStatuses.delete(userId);
    this.qrCodes.delete(userId);
    const waiter = this.qrWaiters.get(userId);
    if (waiter) { this.qrWaiters.delete(userId); waiter.resolve(""); }

    // Limpar AMBAS as sessões do disco (Baileys + legado whatsapp-web.js)
    const paths = [
      this.getSessionPath(userId),
      // Sessão legada do whatsapp-web.js
      path.join(process.cwd(), "auth_info", "wwebjs", `session-${userId}`),
    ];
    for (const p of paths) {
      if (fs.existsSync(p)) {
        try {
          fs.rmSync(p, { recursive: true, force: true });
          console.log(`🧹 [RESET] Sessão removida: ${p}`);
        } catch (e) { console.warn(`⚠️ [RESET] Erro ao remover ${p}:`, e); }
      }
    }

    console.log(`✅ [RESET] Sessão limpa para ${userId} — pronto para novo QR`);
  }

  // ── Anti-ban stats ────────────────────────────────────────────────────────────
  async getAntiBanStats(userId = "default-user") {
    const state = this.antiBan.get(userId);
    const count = state ? state.timestamps.filter(t => t > Date.now() - 3_600_000).length : 0;
    return { messagesThisHour: count, maxPerHour: MAX_MSGS_PER_HOUR, antiBanActive: true, safeDelayRange: "3s - 6s", typingSimulation: true };
  }
}

export const whatsappService = new WhatsAppService();
