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

export class WhatsAppService {
  private clients: Map<string, WAWebJS.Client> = new Map();
  private initPromises: Map<string, Promise<void>> = new Map();
  private qrCodes: Map<string, string> = new Map();
  private connectionStatuses: Map<string, WhatsAppConnection> = new Map();
  private qrWaiters: Map<
    string,
    { resolve: (qrCode: string) => void; reject: (err: Error) => void }
  > = new Map();

  constructor() {
    console.log("🚀 WhatsAppService (whatsapp-web.js) inicializado");
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

  private async ensureClient(userId: string): Promise<void> {
    if (this.clients.has(userId)) return;

    const inFlight = this.initPromises.get(userId);
    if (inFlight) return inFlight;

    const promise = this.initClient(userId).finally(() => {
      this.initPromises.delete(userId);
    });
    this.initPromises.set(userId, promise);
    return promise;
  }

  private async initClient(userId: string): Promise<void> {
    const authDataPath = this.getAuthDataPath();
    if (!fs.existsSync(authDataPath)) fs.mkdirSync(authDataPath, { recursive: true });

    this.connectionStatuses.set(userId, { connected: false, status: "initializing" });

    const chromePath = process.env.WHATSAPP_CHROME_PATH?.trim();
    const headless = (process.env.WHATSAPP_HEADLESS ?? "true").toLowerCase() !== "false";

    const client = new WAWebJS.Client({
      authStrategy: new WAWebJS.LocalAuth({
        clientId: userId,
        dataPath: authDataPath,
      }),
      puppeteer: {
        headless,
        ...(chromePath ? { executablePath: chromePath } : {}),
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
      this.connectionStatuses.set(userId, { connected: false, status: "authenticated" });
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
    });

    client.on("message", async (msg: Message) => {
      try {
        if (msg.fromMe) return;

        const isGroup = msg.from.endsWith("@g.us");
        const senderId = (isGroup ? (msg.author || msg.from) : msg.from) || "";
        const phoneNumber = senderId.split("@")[0];
        const messageText = (msg.body || "").trim();

        if (!phoneNumber || !messageText) return;

        const normalizedIncoming = messageText
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^\w\s]/gi, "");

        console.log(`[USER:${userId}] 📩 Mensagem recebida de ${phoneNumber}: "${messageText}"`);

        const { funnelService } = await import("./funnelService");

        let contact = await storage.getContactByPhone(phoneNumber, userId);
        if (!contact) {
          contact = await storage.createContact({
            userId,
            phoneNumber,
            name: `Contato ${phoneNumber}`,
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

        const funnels = await storage.getAllFunnels(userId);
        const triggeredFunnels = funnels.filter((f) => {
          const isActive = f.status === "active";
          const hasMatch = f.triggerPhrases?.some((phrase) => {
            const normalizedPhrase = phrase
              .trim()
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .replace(/[^\w\s]/gi, "");

            const words = normalizedIncoming.split(/\s+/);
            return words.includes(normalizedPhrase) || normalizedIncoming.startsWith(normalizedPhrase);
          });

          return isActive && hasMatch;
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

  async sendMessage(
    phoneNumber: string,
    message: string,
    userId: string = "default-user",
    mediaUrl?: string,
    mediaFileName?: string,
    location?: { latitude: number; longitude: number; address: string },
    _quoted?: any,
  ): Promise<boolean> {
    try {
      await this.ensureClient(userId);
      const client = this.clients.get(userId);
      if (!client) {
        console.error("❌ Client não encontrado para usuário:", userId);
        return false;
      }

      const cleanPhone = phoneNumber.replace(/\D/g, "");
      const chatId = cleanPhone.includes("@") ? cleanPhone : `${cleanPhone}@c.us`;

      try {
        const chat = await client.getChatById(chatId);
        await chat.sendStateTyping();
        const delay = Math.min(Math.max(message.length * 50, 1000), 4000);
        await new Promise((resolve) => setTimeout(resolve, delay));
        await chat.clearState();
      } catch {
        // ignore
      }

      if (location) {
        await client.sendMessage(
          chatId,
          new WAWebJS.Location(location.latitude, location.longitude, { address: location.address }),
        );
        return true;
      }

      if (mediaUrl) {
        try {
          if (mediaUrl.startsWith("data:")) {
            const mimeType = mediaUrl.substring(5, mediaUrl.indexOf(";"));
            const base64 = mediaUrl.split(",")[1] || "";
            const media = new WAWebJS.MessageMedia(mimeType, base64, mediaFileName);
            await client.sendMessage(chatId, media, { caption: message });
            return true;
          }

          const url = mediaUrl.replace(/^(video:|audio:|doc:)/, "");
          const media = await WAWebJS.MessageMedia.fromUrl(url, { unsafeMime: true });
          await client.sendMessage(chatId, media, { caption: message });
          return true;
        } catch (mediaError: any) {
          console.error(`❌ Erro ao enviar mídia para ${phoneNumber}:`, mediaError);
          await client.sendMessage(chatId, message + "\n\n(Erro ao carregar mídia)");
          return true;
        }
      }

      await client.sendMessage(chatId, message);
      return true;
    } catch (error) {
      console.error("❌ Erro ao enviar mensagem via whatsapp-web.js:", error);
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

  async getAntiBanStats() {
    return { messagesThisHour: 0, maxPerHour: 100, queueSize: 0 };
  }
}

export const whatsappService = new WhatsAppService();
