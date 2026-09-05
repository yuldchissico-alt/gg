import fs from "fs";
import path from "path";
import QRCode from "qrcode";
import WAWebJS from "whatsapp-web.js";
import { storage } from "../storage";

type Message = WAWebJS.Message;

interface WhatsAppConnection {
  connected: boolean;
  phoneNumber?: string;
  status: string;
  qrCode?: string;
  error?: string;
}

// ── Anti-ban: contagem de mensagens por usuário ─────────────────────────────
interface AntiBanState {
  /** timestamps (ms) dos últimos envios para limitar rate */
  timestamps: number[];
  /** fila serial — cada envio aguarda o anterior terminar */
  sendQueue: Promise<void>;
}

const MAX_MSGS_PER_HOUR = 80; // máximo de mensagens por hora

/** Retorna um delay aleatório entre min e max (ms) */
function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((r) => setTimeout(r, ms));
}

export class WhatsAppService {
  private clients: Map<string, WAWebJS.Client> = new Map();
  private initPromises: Map<string, Promise<void>> = new Map();
  private qrCodes: Map<string, string> = new Map();
  private connectionStatuses: Map<string, WhatsAppConnection> = new Map();
  private qrWaiters: Map<
    string,
    { resolve: (qrCode: string) => void; reject: (err: Error) => void }
  > = new Map();
  /** Anti-ban state por userId */
  private antiBan: Map<string, AntiBanState> = new Map();
  /** Controle de auto-reconexão: evita loops infinitos */
  private reconnectAttempts: Map<string, number> = new Map();
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map();
  private heartbeatTimer: NodeJS.Timeout | null = null;

  private static readonly MAX_RECONNECT_ATTEMPTS = 5;
  private static readonly RECONNECT_BASE_DELAY_MS = 15_000; // 15s base, com backoff

  constructor() {
    console.log("🚀 WhatsAppService (whatsapp-web.js) inicializado");
    this.startHeartbeat();
  }

  /**
   * Heartbeat: verifica a cada 2 minutos se clientes que o DB marca como
   * conectados ainda estão vivos. Se não estiver, dispara reconexão.
   */
  private startHeartbeat(): void {
    if (this.heartbeatTimer) return;
    this.heartbeatTimer = setInterval(async () => {
      for (const [userId, status] of this.connectionStatuses.entries()) {
        if (status.connected) {
          const client = this.clients.get(userId);
          if (!client) {
            console.warn(`💓 [HEARTBEAT] Cliente ${userId} sumiu da memória — reconectando...`);
            this.scheduleReconnect(userId);
          }
        }
      }
    }, 120_000); // a cada 2 minutos
    // Não bloquear o processo ao fechar
    if (this.heartbeatTimer.unref) this.heartbeatTimer.unref();
  }

  /**
   * Agenda uma tentativa de reconexão com backoff exponencial.
   * Não cria nova tentativa se já houver uma agendada.
   */
  private scheduleReconnect(userId: string): void {
    if (this.reconnectTimers.has(userId)) return; // já agendado

    const attempts = this.reconnectAttempts.get(userId) ?? 0;
    if (attempts >= WhatsAppService.MAX_RECONNECT_ATTEMPTS) {
      console.warn(`⚠️ [RECONEXÃO] Máximo de ${WhatsAppService.MAX_RECONNECT_ATTEMPTS} tentativas atingido para ${userId}. Aguardando ação manual.`);
      return;
    }

    // Backoff: 15s, 30s, 60s, 120s, 240s
    const delay = WhatsAppService.RECONNECT_BASE_DELAY_MS * Math.pow(2, attempts);
    console.log(`🔄 [RECONEXÃO] Tentativa ${attempts + 1}/${WhatsAppService.MAX_RECONNECT_ATTEMPTS} para ${userId} em ${delay / 1000}s...`);

    const timer = setTimeout(async () => {
      this.reconnectTimers.delete(userId);
      this.reconnectAttempts.set(userId, (this.reconnectAttempts.get(userId) ?? 0) + 1);
      try {
        await this.ensureClient(userId);
        // Se chegou aqui sem exceção, reset o contador
        this.reconnectAttempts.delete(userId);
        console.log(`✅ [RECONEXÃO] Sucesso na reconexão para ${userId}`);
      } catch (err: any) {
        console.error(`❌ [RECONEXÃO] Falha ao reconectar ${userId}:`, err?.message || err);
        // Agenda nova tentativa
        this.scheduleReconnect(userId);
      }
    }, delay);

    if (timer.unref) timer.unref();
    this.reconnectTimers.set(userId, timer);
  }

  /** Cancela qualquer reconexão agendada e zera o contador */
  private cancelReconnect(userId: string): void {
    const timer = this.reconnectTimers.get(userId);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(userId);
    }
    this.reconnectAttempts.delete(userId);
  }

  /** Destrói todos os clientes e timers (usado no graceful shutdown) */
  async destroy(): Promise<void> {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    for (const [userId] of this.clients.entries()) {
      this.cancelReconnect(userId);
      try {
        await this.clients.get(userId)?.destroy();
      } catch { /* ignore */ }
    }
    this.clients.clear();
    console.log("🛑 WhatsAppService encerrado.");
  }

  async getConnectionStatus(userId: string): Promise<WhatsAppConnection> {
    const status = this.connectionStatuses.get(userId);
    if (status) return status;

    return {
      connected: false,
      status: "disconnected",
    };
  }

  async getQRCode(userId: string): Promise<string> {
    const status = this.connectionStatuses.get(userId);
    if (status?.connected) return "";

    // Se houve uma falha anterior, limpar o estado para permitir nova tentativa
    if (status?.status === "init_failed" || status?.status === "auth_failure") {
      console.log(`🔄 [QR] Limpando estado de falha anterior (${status.status}) para ${userId}`);
      this.connectionStatuses.delete(userId);
      this.qrCodes.delete(userId);
      // Garantir que o client foi removido
      if (this.clients.has(userId)) {
        try { await this.clients.get(userId)?.destroy(); } catch { /* ignore */ }
        this.clients.delete(userId);
      }
    }

    const existingConnections = await storage.getAllWhatsappConnections(userId);
    if (existingConnections.length > 1) {
      console.log(`🧹 Limpando conexões duplicadas para ${userId}`);
      for (let i = 1; i < existingConnections.length; i++) {
        await storage.updateWhatsappConnection(existingConnections[i].id, {
          isConnected: false,
        });
      }
    }

    try {
      await this.ensureClient(userId);
    } catch (err: any) {
      const message = err?.message ? String(err.message) : "Falha ao inicializar WhatsApp";
      this.connectionStatuses.set(userId, {
        connected: false,
        status: "init_failed",
        error: message,
      });
      this.qrCodes.delete(userId);
      throw new Error(message);
    }

    const existing = this.qrCodes.get(userId) || "";
    if (existing) return existing;

    const currentStatus = this.connectionStatuses.get(userId);
    if (currentStatus?.status === "init_failed" || currentStatus?.status === "auth_failure") {
      throw new Error(currentStatus.error || "Falha ao inicializar WhatsApp");
    }

    // Long-poll por alguns segundos para evitar retornos vazios em loop no frontend.
    return await this.waitForQrCode(userId, 15000);
  }

  private getAuthDataPath(): string {
    return path.join(process.cwd(), "auth_info", "wwebjs");
  }

  private getAuthSessionPath(userId: string): string {
    return path.join(this.getAuthDataPath(), `session-${userId}`);
  }

  /**
   * Resolve o caminho do executável Chrome/Chromium.
   * Ordem de prioridade:
   * 1. Variável WHATSAPP_CHROME_PATH (configuração manual)
   * 2. API do puppeteer (instalado via `browsers install chrome`)
   * 3. Scan manual de caches conhecidos (/opt/render, ~/.cache, /home)
   * 4. Binários do sistema (/usr/bin/chromium, etc.)
   * 5. Instalar na hora se nada funcionar (último recurso)
   */
  private async resolveChromePath(): Promise<string | undefined> {
    // 1. Variável de ambiente explícita
    const envPath = process.env.WHATSAPP_CHROME_PATH?.trim();
    if (envPath && fs.existsSync(envPath)) return envPath;

    if (process.platform !== "linux") return undefined;

    // 2. Usar a API do puppeteer para encontrar o executável instalado
    try {
      const puppeteer = await import("puppeteer");
      // executablePath() devolve o path se o browser estiver instalado
      const p = puppeteer.default.executablePath();
      if (p && fs.existsSync(p)) {
        console.log(`🌐 Chrome via puppeteer.executablePath(): ${p}`);
        return p;
      }
    } catch { /* puppeteer não disponível ou chrome não instalado */ }

    // 3. Scan de caches conhecidos
    const cacheDirs = [
      process.env.PUPPETEER_CACHE_DIR,
      "/opt/render/.cache/puppeteer",
      `${process.env.HOME || "/root"}/.cache/puppeteer`,
      "/root/.cache/puppeteer",
      "/home/.cache/puppeteer",
    ].filter(Boolean) as string[];

    for (const cacheDir of cacheDirs) {
      const chromeBase = `${cacheDir}/chrome`;
      if (!fs.existsSync(chromeBase)) continue;
      try {
        const versions = fs.readdirSync(chromeBase).sort().reverse(); // mais recente primeiro
        for (const ver of versions) {
          for (const sub of ["chrome-linux64", "chrome-linux"]) {
            const p = `${chromeBase}/${ver}/${sub}/chrome`;
            if (fs.existsSync(p)) {
              console.log(`🌐 Chrome encontrado em cache: ${p}`);
              return p;
            }
          }
        }
      } catch { /* ignore */ }
    }

    // 4. Binários do sistema
    const systemCandidates = [
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
      "/usr/bin/google-chrome-stable",
      "/usr/bin/google-chrome",
      "/usr/local/bin/chromium",
    ];
    for (const p of systemCandidates) {
      if (fs.existsSync(p)) {
        console.log(`🌐 Chrome do sistema encontrado: ${p}`);
        return p;
      }
    }

    // 5. Último recurso: instalar agora mesmo
    console.warn("⚠️ Chrome não encontrado — tentando instalar agora...");
    try {
      const { execSync } = await import("child_process");
      const cacheDir = process.env.PUPPETEER_CACHE_DIR || "/opt/render/.cache/puppeteer";
      execSync("npx puppeteer browsers install chrome", {
        stdio: "inherit",
        timeout: 300_000, // 5 minutos
        env: { ...process.env, PUPPETEER_CACHE_DIR: cacheDir },
      });
      // Re-scan após instalação
      return await this.resolveChromePath();
    } catch (installErr: any) {
      console.error("❌ Falha ao instalar Chrome na hora:", installErr?.message);
      return undefined;
    }
  }

  private async ensureClient(userId: string): Promise<void> {
    if (this.clients.has(userId)) return;

    const inFlight = this.initPromises.get(userId);
    if (inFlight) return inFlight;

    // Limpar estado residual de tentativas anteriores falhadas
    await this.cleanupStaleChrome(userId);

    const promise = this.initClient(userId).finally(() => {
      this.initPromises.delete(userId);
    });
    this.initPromises.set(userId, promise);
    return promise;
  }

  /**
   * Mata processos Chrome órfãos e remove lock files que impedem nova inicialização.
   * Chamado antes de cada tentativa de criar um novo cliente.
   */
  private async cleanupStaleChrome(userId: string): Promise<void> {
    const sessionPath = this.getAuthSessionPath(userId);

    // Remover lock files do Chrome (SingletonLock, SingletonCookie, etc.)
    const lockFiles = [
      path.join(sessionPath, "SingletonLock"),
      path.join(sessionPath, "SingletonCookie"),
      path.join(sessionPath, "SingletonSocket"),
      path.join(sessionPath, "Default", "LOCK"),
      path.join(sessionPath, "Default", "MANIFEST-000001"),
    ];
    for (const lockFile of lockFiles) {
      try {
        if (fs.existsSync(lockFile)) {
          fs.unlinkSync(lockFile);
          console.log(`🧹 Lock file removido: ${lockFile}`);
        }
      } catch { /* ignore */ }
    }

    // Matar processos Chrome que ainda possam estar usando este userDataDir
    if (process.platform === "linux") {
      try {
        const { execSync } = await import("child_process");
        // Procura processos chrome/chromium que tenham o sessionPath nos argumentos
        const escaped = sessionPath.replace(/'/g, "'\\''");
        execSync(`pkill -f "${escaped}" 2>/dev/null || true`, { timeout: 5000 });
        console.log(`🧹 Processos Chrome órfãos terminados para ${userId}`);
      } catch { /* ignore — pkill retorna 1 se não encontrar processos */ }
    }

    // Pequena pausa para o OS liberar os recursos
    await new Promise(r => setTimeout(r, 500));
  }

  private async initClient(userId: string): Promise<void> {
    const authDataPath = this.getAuthDataPath();
    if (!fs.existsSync(authDataPath)) fs.mkdirSync(authDataPath, { recursive: true });

    this.connectionStatuses.set(userId, { connected: false, status: "initializing" });

    // ── Resolver o caminho do Chrome ──────────────────────────────────────────
    const chromePath = await this.resolveChromePath();
    console.log(`🌐 Chrome path para puppeteer: ${chromePath ?? "(deixar puppeteer decidir)"}`);

    const headless = (process.env.WHATSAPP_HEADLESS ?? "true").toLowerCase() !== "false";

    const client = new WAWebJS.Client({
      authStrategy: new WAWebJS.LocalAuth({
        clientId: userId,
        dataPath: authDataPath,
      }),
      // Cache local da versão do WA Web — mais fiável que URL remota
      webVersionCache: {
        type: "local",
      },
      // QR expira em 5 minutos (padrão é 60s) — dá tempo para handshake em ambientes lentos
      qrMaxRetries: 5,
      authTimeoutMs: 300_000, // 5 minutos para autenticar após escanear o QR
      puppeteer: {
        headless,
        ...(chromePath ? { executablePath: chromePath } : {}),
        protocolTimeout: 120_000,
        timeout: 120_000,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--disable-gpu",
          "--disable-extensions",
          "--disable-background-networking",
          "--disable-background-timer-throttling",
          "--disable-backgrounding-occluded-windows",
          "--disable-breakpad",
          "--disable-client-side-phishing-detection",
          "--disable-component-extensions-with-background-pages",
          "--disable-default-apps",
          "--disable-hang-monitor",
          "--disable-ipc-flooding-protection",
          "--disable-popup-blocking",
          "--disable-prompt-on-repost",
          "--disable-renderer-backgrounding",
          "--disable-sync",
          "--force-color-profile=srgb",
          "--metrics-recording-only",
          "--safebrowsing-disable-auto-update",
          "--password-store=basic",
          "--use-mock-keychain",
          // REMOVIDO: --single-process (causa crash após scan do QR)
          // REMOVIDO: --js-flags=--max-old-space-size=256 (muito restritivo para WA Web)
        ],
      },
    });

    client.on("qr", async (qr: string) => {
      try {
        const qrBase64 = await QRCode.toDataURL(qr);
        this.qrCodes.set(userId, qrBase64);
        this.connectionStatuses.set(userId, {
          connected: false,
          status: "qr_ready",
          qrCode: qrBase64,
        });

        const waiter = this.qrWaiters.get(userId);
        if (waiter) {
          this.qrWaiters.delete(userId);
          waiter.resolve(qrBase64);
        }

        const dbConn = await storage.getWhatsappConnection(userId);
        if (dbConn) {
          await storage.updateWhatsappConnection(dbConn.id, {
            qrCode: qrBase64,
            isConnected: false,
            updatedAt: new Date(),
          });
        }
      } catch (err) {
        console.error("❌ Erro ao gerar QR Code base64:", err);
      }
    });

    client.on("authenticated", async () => {
      console.log(`🔐 [${userId}] authenticated — aguardando evento 'ready'...`);
      this.connectionStatuses.set(userId, { connected: false, status: "authenticated" });
    });

    client.on("loading_screen" as any, (percent: number, message: string) => {
      console.log(`⏳ [${userId}] loading_screen ${percent}% — ${message}`);
    });

    client.on("auth_failure", async (msg: string) => {
      console.error(`❌ auth_failure (${userId}):`, msg);
      this.connectionStatuses.set(userId, {
        connected: false,
        status: "auth_failure",
        error: msg,
      });
      this.qrCodes.delete(userId);

      const waiter = this.qrWaiters.get(userId);
      if (waiter) {
        this.qrWaiters.delete(userId);
        waiter.reject(new Error(msg || "Falha de autenticação"));
      }

      try {
        const dbConn = await storage.getWhatsappConnection(userId);
        if (dbConn) {
          await storage.updateWhatsappConnection(dbConn.id, {
            isConnected: false,
            status: "auth_failure",
            updatedAt: new Date(),
          });
        }
      } catch (dbError) {
        console.error("Error updating database connection state on auth_failure:", dbError);
      }
    });

    client.on("ready", async () => {
      const phone = (client.info as any)?.wid?.user as string | undefined;

      this.connectionStatuses.set(userId, {
        connected: true,
        status: "connected",
        phoneNumber: phone,
      });
      this.qrCodes.delete(userId);
      // Reconexão bem-sucedida — zerar contador
      this.cancelReconnect(userId);

      const waiter = this.qrWaiters.get(userId);
      if (waiter) {
        this.qrWaiters.delete(userId);
        waiter.resolve("");
      }

      try {
        const existingConn = await storage.getWhatsappConnection(userId);
        if (existingConn) {
          await storage.updateWhatsappConnection(existingConn.id, {
            isConnected: true,
            phoneNumber: phone,
            status: "connected",
            lastConnectedAt: new Date(),
            updatedAt: new Date(),
          });
        } else {
          await storage.createWhatsappConnection({
            userId,
            phoneNumber: phone || "unknown",
            name: "WhatsApp",
            isConnected: true,
            status: "connected",
          });
        }
      } catch (dbError) {
        console.error("Error updating database connection state on ready:", dbError);
      }

      console.log(`✅ WhatsApp conectado (${userId})${phone ? `: ${phone}` : ""}`);
    });

    client.on("disconnected", async (reason: string) => {
      console.log(`WhatsApp disconnected (${userId}): ${reason}`);
      this.connectionStatuses.set(userId, { connected: false, status: "disconnected" });
      this.qrCodes.delete(userId);

      const waiter = this.qrWaiters.get(userId);
      if (waiter) {
        this.qrWaiters.delete(userId);
        waiter.resolve("");
      }

      try {
        const dbConn = await storage.getWhatsappConnection(userId);
        if (dbConn) {
          await storage.updateWhatsappConnection(dbConn.id, {
            isConnected: false,
            status: "disconnected",
            updatedAt: new Date(),
          });
        }
      } catch (dbError) {
        console.error("Error updating database connection state on disconnected:", dbError);
      }

      try {
        await client.destroy();
      } catch {
        // ignore
      }

      this.clients.delete(userId);

      // ── Auto-reconexão: só reconecta se havia sessão salva (não foi logout manual) ──
      const sessionPath = this.getAuthSessionPath(userId);
      const hadSession = fs.existsSync(sessionPath);
      const isLogout = reason === "LOGOUT" || reason === "REPLACED";
      if (hadSession && !isLogout) {
        console.log(`🔄 [RECONEXÃO] Desconexão inesperada (${reason}). Agendando reconexão automática para ${userId}...`);
        this.scheduleReconnect(userId);
      } else if (isLogout) {
        console.log(`ℹ️ [RECONEXÃO] Logout manual detectado (${reason}). Sem reconexão automática.`);
        this.cancelReconnect(userId);
      }
    });

    client.on("message", async (msg: Message) => {
      try {
        if (msg.fromMe) return;

        let contactData: any = null;
        try {
          contactData = await msg.getContact();
        } catch {
          // ignore
        }

        const realNumber = contactData?.number || (msg.from.includes("@c.us") ? msg.from.split("@")[0] : msg.from);
        const contactName = contactData?.pushname || contactData?.name || `Contato ${realNumber}`;
        const phoneNumber = realNumber;
        const messageText = (msg.body || "").trim();

        if (!phoneNumber || !messageText) return;

        const normalizedIncoming = messageText
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^\w\s]/gi, "");

        console.log(`[USER:${userId}] 📩 Mensagem recebida de ${phoneNumber} (${contactName}): "${messageText}"`);

        const { funnelService } = await import("./funnelService");

        let contact = await storage.getContactByPhone(phoneNumber, userId);
        if (!contact) {
          contact = await storage.createContact({
            userId,
            phoneNumber,
            name: contactName,
            tags: [],
            isActive: true,
          });
        }

        await storage.createMessage({
          userId,
          contactId: contact.id,
          type: "text",
          content: messageText,
          status: "delivered",
          sentAt: new Date(),
          externalId: msg.id?._serialized,
        });

        // Verificar se este contato tem execuções pausadas aguardando resposta
        const waitingExecutions = await storage.getWaitingFunnelExecutions(contact.id);
        if (waitingExecutions && waitingExecutions.length > 0) {
          for (const waitingExec of waitingExecutions) {
            console.log(`💬 [WHATSAPP] Resposta recebida de ${phoneNumber}. Retomando execução de funil ${waitingExec.id}`);
            await funnelService.resumeFunnelExecution(waitingExec.id, messageText, msg);
          }
          return;
        }

        const funnels = await storage.getAllFunnels(userId);
        const triggeredFunnels = funnels.filter((f) => {
          const isActive = f.status === "active";
          if (!isActive) return false;

          const isAnyMatch = f.triggerPhrases?.some((p) => {
            const trimmed = p.trim().toLowerCase();
            return trimmed === "*" || trimmed === "__any__" || trimmed === "qualquer mensagem" || trimmed === "qualquer";
          });

          if (isAnyMatch) return true;

          const hasMatch = f.triggerPhrases?.some((phrase) => {
            const normalizedPhrase = phrase
              .trim()
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .replace(/[^\w\s]/gi, "");

            if (!normalizedPhrase) return false;

            const words = normalizedIncoming.split(/\s+/);
            return words.includes(normalizedPhrase) || normalizedIncoming.startsWith(normalizedPhrase);
          });

          return hasMatch;
        });

        for (const funnel of triggeredFunnels) {
          const executions = await storage.getFunnelExecutions(funnel.id);
          const activeExec = executions.find(
            (e) => e.contactId === contact.id && e.status === "active",
          );

          if (!activeExec) {
            console.log(`🚀 Disparando funil "${funnel.name}" para ${phoneNumber}`);
            await funnelService.executeFunnel(funnel.id, contact.id, messageText, msg);
          } else {
            console.log(`ℹ️ Funil "${funnel.name}" já está em execução para ${phoneNumber}`);
          }
        }
      } catch (err) {
        console.error("❌ Erro ao processar mensagem (whatsapp-web.js):", err);
      }
    });

    this.clients.set(userId, client);
    try {
      await client.initialize();
    } catch (err: any) {
      const message = err?.message ? String(err.message) : "Falha ao inicializar WhatsApp Web";
      console.error(`❌ init_failed (${userId}):`, err);
      this.connectionStatuses.set(userId, {
        connected: false,
        status: "init_failed",
        error: message,
      });
      this.qrCodes.delete(userId);

      const waiter = this.qrWaiters.get(userId);
      if (waiter) {
        this.qrWaiters.delete(userId);
        waiter.reject(new Error(message));
      }

      try {
        await client.destroy();
      } catch {
        // ignore
      }
      this.clients.delete(userId);
      throw new Error(message);
    }
  }

  private async waitForQrCode(userId: string, timeoutMs: number): Promise<string> {
    const cached = this.qrCodes.get(userId) || "";
    if (cached) return cached;

    const existingWaiter = this.qrWaiters.get(userId);
    if (existingWaiter) {
      // There is already a waiter; just wait for it to resolve via the stored callbacks.
      return await new Promise<string>((resolve, reject) => {
        const previousResolve = existingWaiter.resolve;
        const previousReject = existingWaiter.reject;

        existingWaiter.resolve = (value) => {
          previousResolve(value);
          resolve(value);
        };
        existingWaiter.reject = (err) => {
          previousReject(err);
          reject(err);
        };
      });
    }

    return await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.qrWaiters.delete(userId);
        resolve(this.qrCodes.get(userId) || "");
      }, timeoutMs);

      this.qrWaiters.set(userId, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
      });
    });
  }

  // ── Anti-ban helpers ────────────────────────────────────────────────────────

  /** Retorna (criando se necessário) o estado anti-ban para um userId */
  private getAntiBanState(userId: string): AntiBanState {
    if (!this.antiBan.has(userId)) {
      this.antiBan.set(userId, {
        timestamps: [],
        sendQueue: Promise.resolve(),
      });
    }
    return this.antiBan.get(userId)!;
  }

  /**
   * Verifica se o rate limit foi atingido.
   * Remove timestamps com mais de 1 hora e verifica se já enviamos MAX_MSGS_PER_HOUR.
   */
  private checkRateLimit(state: AntiBanState): boolean {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    state.timestamps = state.timestamps.filter((t) => t > oneHourAgo);
    return state.timestamps.length < MAX_MSGS_PER_HOUR;
  }

  /**
   * Registra um envio no contador de rate limit.
   */
  private recordSend(state: AntiBanState): void {
    state.timestamps.push(Date.now());
  }

  // ── sendMessage público (com fila serial anti-ban) ──────────────────────────

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

    // Encadeia na fila serial para este usuário (sem envios paralelos)
    const result = state.sendQueue.then(() =>
      this._sendMessageCore(phoneNumber, message, userId, mediaUrl, mediaFileName, location, _quoted, state),
    );
    // Atualiza a fila ignorando erros para não travar
    state.sendQueue = result.then(() => {}, () => {});

    return result;
  }

  private async _sendMessageCore(
    phoneNumber: string,
    message: string,
    userId: string,
    mediaUrl?: string,
    mediaFileName?: string,
    location?: { latitude: number; longitude: number; address: string },
    _quoted?: any,
    state?: AntiBanState,
  ): Promise<boolean> {
    try {
      await this.ensureClient(userId);
      const client = this.clients.get(userId);
      if (!client) {
        console.error("❌ Client não encontrado para usuário:", userId);
        return false;
      }

      const cleanPhone = phoneNumber.replace(/\D/g, "");
      // Bloqueio do número 843955854 conforme solicitação do usuário
      if (cleanPhone.includes("843955854")) {
        console.warn(`🛑 [WHATSAPP] Envio bloqueado para o número proibido: ${phoneNumber}`);
        return false;
      }

      // ── Proteção Anti-Ban: verificação de limite por hora ──
      if (state && !this.checkRateLimit(state)) {
        console.warn(`🛡️ [ANTI-BAN] Limite de ${MAX_MSGS_PER_HOUR} msgs/hora atingido para ${userId}. Pausa preventiva de segurança...`);
        await randomDelay(12000, 20000);
      }

      // ── Proteção Anti-Ban: delay humano aleatório entre envios consecutivos ──
      if (state && state.timestamps.length > 0) {
        const antiBanDelay = Math.floor(Math.random() * (6000 - 3000 + 1)) + 3000;
        console.log(`🛡️ [ANTI-BAN] Intervalo humano de proteção anti-bloqueio: ${(antiBanDelay / 1000).toFixed(1)}s`);
        await new Promise((resolve) => setTimeout(resolve, antiBanDelay));
      }

      let chatId = phoneNumber.trim();
      if (!chatId.includes("@")) {
        // Se número tem 9 dígitos (formato local Moçambique), adiciona prefixo 258
        const fullPhone = cleanPhone.length === 9 ? `258${cleanPhone}` : cleanPhone;
        chatId = `${fullPhone}@c.us`;
      }

      // ── Simulação de presença e digitação realista antes de enviar ──
      try {
        const chat = await client.getChatById(chatId);
        await chat.sendStateTyping();
        const typingDelay = Math.min(Math.max((message || "").length * 40, 1500), 4000);
        await new Promise((resolve) => setTimeout(resolve, typingDelay));
        await chat.clearState();
      } catch {
        // ignore
      }

      if (location) {
        await client.sendMessage(
          chatId,
          new WAWebJS.Location(location.latitude, location.longitude, { address: location.address }),
        );
        if (state) this.recordSend(state);
        return true;
      }

      if (mediaUrl) {
        try {
          let targetUrl = mediaUrl.trim();
          let filename = mediaFileName;

          if (targetUrl.startsWith("doc:")) {
            const raw = targetUrl.substring(4);
            const sepIndex = raw.indexOf("|");
            if (sepIndex !== -1) {
              filename = filename || raw.substring(0, sepIndex);
              targetUrl = raw.substring(sepIndex + 1);
            } else {
              targetUrl = raw;
            }
          } else if (targetUrl.startsWith("video:")) {
            targetUrl = targetUrl.substring(6);
          } else if (targetUrl.startsWith("audio:")) {
            targetUrl = targetUrl.substring(6);
          }

          let media: WAWebJS.MessageMedia;

          if (targetUrl.startsWith("data:")) {
            let mimeType = targetUrl.substring(5, targetUrl.indexOf(";"));
            // Normalizar mime types comuns
            if (mimeType === 'audio/mp3') mimeType = 'audio/mpeg';
            const base64 = targetUrl.split(",")[1] || "";
            media = new WAWebJS.MessageMedia(mimeType, base64, filename);
          } else if (targetUrl.startsWith("http://") || targetUrl.startsWith("https://")) {
            media = await WAWebJS.MessageMedia.fromUrl(targetUrl, { unsafeMime: true });
            if (filename) {
              media.filename = filename;
            }
          } else {
            throw new Error(`Arquivo de mídia sem dados carregados ("${targetUrl.substring(0, 30)}"). Faça o upload do arquivo novamente no painel.`);
          }

          const isAudio = media.mimetype?.startsWith("audio/");
          const isVideo = media.mimetype?.startsWith("video/");
          const isDoc = !media.mimetype?.startsWith("image/") && !isVideo && !isAudio;

          const sendOptions: any = {};
          if (message && !isAudio) {
            sendOptions.caption = message;
          }
          if (isAudio) {
            // Apenas enviar como nota de voz se for ogg/opus, senão enviar como áudio padrão compatível
            if (media.mimetype.includes("ogg") || media.mimetype.includes("opus")) {
              sendOptions.sendAudioAsVoice = true;
            }
          }
          if (isDoc) {
            sendOptions.sendMediaAsDocument = true;
          }

          // Tentar abrir o chat antes de enviar para evitar erro 'getChat' undefined
          try {
            await client.getChatById(chatId);
          } catch (_) {
            // Ignorar se o chat ainda não existir
          }

          try {
            await client.sendMessage(chatId, media, sendOptions);
          } catch (sendMediaErr: any) {
            console.warn(`⚠️ [WHATSAPP] Primeira tentativa de envio de mídia falhou, tentando modo compatibilidade:`, sendMediaErr);
            // Se for erro de getChat (chat não existe), aguardar 1s e tentar novamente
            if (sendMediaErr?.message?.includes('getChat') || sendMediaErr?.message?.includes('Cannot read')) {
              await new Promise(res => setTimeout(res, 1000));
              await client.sendMessage(chatId, media, sendOptions);
            } else if (sendOptions.sendAudioAsVoice) {
              delete sendOptions.sendAudioAsVoice;
              await client.sendMessage(chatId, media, sendOptions);
            } else if (isVideo && !sendOptions.sendMediaAsDocument) {
              sendOptions.sendMediaAsDocument = true;
              await client.sendMessage(chatId, media, sendOptions);
            } else {
              throw sendMediaErr;
            }
          }

          console.log(`✅ [WHATSAPP] Mídia enviada com sucesso para ${chatId} (${media.mimetype}, nome: ${filename || 'mídia'})`);
          if (state) this.recordSend(state);
          return true;
        } catch (mediaError: any) {
          console.error(`❌ Erro ao enviar mídia para ${phoneNumber}:`, mediaError?.message || mediaError);
          await client.sendMessage(chatId, (message ? message + "\n\n" : "") + "⚠️ [Erro ao carregar arquivo de mídia]");
          return false;
        }
      }

      try {
        await client.sendMessage(chatId, message);
        console.log(`✅ [WHATSAPP] Mensagem enviada com sucesso para ${chatId}`);
        if (state) this.recordSend(state);
        return true;
      } catch (sendError: any) {
        // Fallback: se o envio falhou com @c.us mas tínhamos um ID longo (possível @lid) ou vice-versa
        if (chatId.includes("@c.us") && phoneNumber.length > 13) {
          const lidChat = `${phoneNumber.replace(/\D/g, "")}@lid`;
          try {
            console.log(`🔄 [WHATSAPP] Tentando fallback para ${lidChat}...`);
            await client.sendMessage(lidChat, message);
            console.log(`✅ [WHATSAPP] Mensagem enviada via fallback LID para ${lidChat}`);
            if (state) this.recordSend(state);
            return true;
          } catch {}
        }
        throw sendError;
      }
    } catch (error: any) {
      console.error("❌ Erro ao enviar mensagem via whatsapp-web.js:", error?.message || error);
      return false;
    }
  }

  async disconnect(userId: string): Promise<void> {
    const client = this.clients.get(userId);
    if (!client) return;

    try {
      await client.logout();
    } catch (err) {
      console.error("Error during logout:", err);
    }

    try {
      await client.destroy();
    } catch {
      // ignore
    }

    this.clients.delete(userId);
    this.connectionStatuses.set(userId, { connected: false, status: "disconnected" });
    this.qrCodes.delete(userId);

    const waiter = this.qrWaiters.get(userId);
    if (waiter) {
      this.qrWaiters.delete(userId);
      waiter.resolve("");
    }

    const sessionPath = this.getAuthSessionPath(userId);
    if (fs.existsSync(sessionPath)) {
      try {
        fs.rmSync(sessionPath, { recursive: true, force: true });
      } catch (e) {
        console.error("Erro ao remover sessão:", e);
      }
    }
  }

  async getAntiBanStats(userId: string = "default-user") {
    const state = this.antiBan.get(userId);
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const count = state ? state.timestamps.filter((t) => t > oneHourAgo).length : 0;
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
