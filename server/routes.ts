import type { Express } from "express";
import { createServer, type Server } from "http";
import axios from "axios";
import { storage } from "./storage";
import { whatsappService } from "./services/whatsappService";
import { funnelService } from "./services/funnelService";
import { schedulerService } from "./services/schedulerService";
import { 
  insertFunnelSchema,
  insertContactSchema,
  insertMessageSchema,
  insertCampaignSchema,
  insertMessageTemplateSchema,
  insertTagSchema,
} from "@shared/schema";
import { z } from "zod";
import { readFileSync } from "fs";
import { join } from "path";
import { validateFunnelJSON, funnelJSONSchema } from "@shared/funnel-json-types";
import { convertFunnelJSONToFlowData } from "./services/funnelJsonConverter";
import { getPool } from "./db";

const DEFAULT_USER_ID = "default-user";
const DEMO_USER = {
  id: DEFAULT_USER_ID,
  firstName: "Usuário",
  lastName: "PilotZap",
  email: "contato@pilotzap.com",
};


export async function registerRoutes(app: Express): Promise<Server> {
  // Health & diagnostics endpoint
  app.get('/api/health', async (_req, res) => {
    const hasDbUrl = !!process.env.DATABASE_URL;
    let dbStatus = "not_configured";
    let dbError: string | null = null;

    if (hasDbUrl) {
      try {
        const pool = getPool();
        if (pool) {
          await pool.query("SELECT 1");
          dbStatus = "connected";
        } else {
          dbStatus = "pool_null";
        }
      } catch (err: any) {
        dbStatus = "error";
        dbError = err?.message || String(err);
      }
    }

    const wsStatus = await whatsappService.getConnectionStatus("default-user");

    res.json({
      status: "ok",
      environment: process.env.NODE_ENV,
      database: {
        configured: hasDbUrl,
        status: dbStatus,
        error: dbError,
        host: hasDbUrl ? (process.env.DATABASE_URL!.split("@")[1]?.split("/")[0] || "configured") : "missing",
      },
      whatsapp: wsStatus,
      platform: process.platform,
    });
  });

  // Funnel JSON route
  app.get('/api/funnel-json', async (req, res) => {
    try {
      const filePath = join(process.cwd(), 'attached_assets', '[P.O] - Receitas sem Glúten_1760773130289.json');
      const fileContent = readFileSync(filePath, 'utf-8');
      const jsonData = JSON.parse(fileContent);
      res.json(jsonData);
    } catch (error) {
      console.error("Error reading funnel JSON:", error);
      res.status(500).json({ message: "Failed to read funnel JSON" });
    }
  });

  // User routes - apenas usuário autenticado
  app.get('/api/user/me', async (req, res) => {
    try {
      const cookies = req.headers.cookie || '';
      const isAuthenticated = cookies.includes('auth_user=yuldchissico11');

      if (!isAuthenticated) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      let user = await storage.getUserByEmail("yuldchissico11@gmail.com");
      if (!user) {
        user = await storage.getUser(DEFAULT_USER_ID);
      }
      
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      await storage.checkPlanExpiration(user.id);
      const updatedUser = await storage.getUser(user.id);

      res.json({
        id: updatedUser?.id || DEFAULT_USER_ID,
        firstName: updatedUser?.firstName || 'Yuld',
        lastName: updatedUser?.lastName || 'Chissico',
        email: updatedUser?.email || 'yuldchissico11@gmail.com',
        planType: updatedUser?.planType || 'pro',
        planExpiresAt: updatedUser?.planExpiresAt || null,
        isBlocked: updatedUser?.isBlocked || false
      });
    } catch (error: any) {
      console.error("Error getting user:", error);
      res.status(500).json({ 
        message: "Failed to get user",
        error: error?.message || "Internal server error"
      });
    }
  });

  // Auth routes: ÚNICO usuário aceito é yuldchissico11@gmail.com com senha yuld0000
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      const cleanEmail = (email || '').toLowerCase().trim();
      const cleanPassword = (password || '').trim();

      // REGRA ESTRITA: Apenas yuldchissico11@gmail.com e senha yuld0000
      if (cleanEmail !== 'yuldchissico11@gmail.com' || cleanPassword !== 'yuld0000') {
        return res.status(401).json({ 
          success: false, 
          message: "E-mail ou senha incorretos." 
        });
      }

      let user = await storage.getUserByEmail('yuldchissico11@gmail.com');
      if (!user) {
        user = await storage.upsertUser({
          id: DEFAULT_USER_ID,
          email: 'yuldchissico11@gmail.com',
          password: 'yuld0000',
          firstName: 'Yuld',
          lastName: 'Chissico',
          planType: 'pro',
        });
      }

      if (!user) {
        return res.status(500).json({ message: "Não foi possível carregar o usuário" });
      }

      // Definir cookie de autenticação persistente (30 dias)
      res.setHeader('Set-Cookie', 'auth_user=yuldchissico11; Path=/; Max-Age=2592000; SameSite=Lax');

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          planType: user.planType,
          isBlocked: user.isBlocked,
        }
      });
    } catch (error: any) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Erro ao autenticar", error: error?.message });
    }
  });

  app.post('/api/auth/logout', async (_req, res) => {
    res.setHeader('Set-Cookie', 'auth_user=; Path=/; Max-Age=0; SameSite=Lax');
    res.json({ success: true, message: "Logged out successfully" });
  });

  app.get('/api/whatsapp/status', async (req, res) => {
    try {
      const userId = DEFAULT_USER_ID;
      
      // Tenta pegar do serviço (em memória) primeiro
      let status = await whatsappService.getConnectionStatus(userId);
      
      // Se não estiver conectado em memória, verifica no banco de dados
      if (!status.connected) {
        const dbConn = await storage.getWhatsappConnection(userId);
        if (dbConn && dbConn.isConnected) {
          // Se o banco diz que está conectado mas a memória não, reinicializa o serviço
          console.log(`🔄 Re-sincronizando conexão do banco para a memória para ${userId}`);
          whatsappService.getQRCode(userId); // Isso dispara a reinicialização
          
          status = {
            connected: true,
            status: 'connected',
            phoneNumber: dbConn.phoneNumber || undefined
          };
        } else if (dbConn && dbConn.qrCode) {
          // Se tiver um QR code no banco, retorna ele
          status = {
            connected: false,
            status: 'qr_ready',
            qrCode: dbConn.qrCode
          };
        }
      }
      
      res.json(status);
    } catch (error) {
      console.error("Error getting WhatsApp status:", error);
      res.status(500).json({ message: "Failed to get WhatsApp status" });
    }
  });

  app.get('/api/whatsapp/antiban', async (req, res) => {
    try {
      const userId = DEFAULT_USER_ID;
      const stats = await whatsappService.getAntiBanStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error getting anti-ban stats:", error);
      res.status(500).json({ message: "Failed to get anti-ban stats" });
    }
  });

  app.post('/api/whatsapp/qr', async (req, res) => {
    try {
      const userId = DEFAULT_USER_ID;
      
      // Tentar obter o QR code atual
      let qrCode = await whatsappService.getQRCode(userId);
      
      // Se não houver QR code (pode estar inicializando), esperar um pouco e tentar novamente
      if (!qrCode) {
        console.log('⏳ QR Code não disponível imediatamente, aguardando...');
        const status = await whatsappService.getConnectionStatus(userId);
        if (status.status === "init_failed" || status.status === "auth_failure") {
          return res.status(500).json({
            message:
              status.error ||
              "Falha ao iniciar a conexÃ£o com o WhatsApp. Verifique Chrome/Chromium.",
          });
        }

        await new Promise(resolve => setTimeout(resolve, 2000));
        qrCode = await whatsappService.getQRCode(userId);
      }

      res.json({ qrCode });
    } catch (error: any) {
      console.error("❌ Error generating QR code:", error);
      res.status(500).json({ message: error?.message || "Falha ao gerar QR code" });
    }
  });

  app.post('/api/whatsapp/disconnect', async (req, res) => {
    try {
      const userId = DEFAULT_USER_ID;
      await whatsappService.disconnect(userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error disconnecting WhatsApp:", error);
      res.status(500).json({ message: "Failed to disconnect WhatsApp" });
    }
  });

  // Reset completo da sessão — limpa disco + memória e força novo QR
  app.post('/api/whatsapp/reset', async (req, res) => {
    try {
      const userId = DEFAULT_USER_ID;
      await whatsappService.resetSession(userId);
      res.json({ success: true, message: "Sessão resetada. Gere um novo QR Code." });
    } catch (error) {
      console.error("Error resetting WhatsApp session:", error);
      res.status(500).json({ message: "Failed to reset WhatsApp session" });
    }
  });

  // GET /api/whatsapp/connections - retorna lista de conexões com status real
  app.get('/api/whatsapp/connections', async (req, res) => {
    try {
      const userId = DEFAULT_USER_ID;

      // Pega status em memória (mais confiável)
      let status = await whatsappService.getConnectionStatus(userId);

      // Se não estiver conectado em memória, verifica no banco de dados
      if (!status.connected) {
        const dbConn = await storage.getWhatsappConnection(userId);
        if (dbConn && dbConn.isConnected) {
          status = {
            connected: true,
            status: 'connected',
            phoneNumber: dbConn.phoneNumber || undefined
          };
        }
      }

      if (!status.connected) {
        // Sem conexão ativa - retorna lista vazia para mostrar card "Conecte um número"
        return res.json([]);
      }

      // Retorna conexão ativa como array
      const dbConn = await storage.getWhatsappConnection(userId);
      res.json([{
        id: dbConn?.id || userId,
        isConnected: true,
        phoneNumber: status.phoneNumber || dbConn?.phoneNumber || null,
        name: dbConn?.name || null,
        userId,
      }]);
    } catch (error) {
      console.error("Error getting WhatsApp connections:", error);
      res.status(500).json({ message: "Failed to get WhatsApp connections" });
    }
  });

  app.delete('/api/whatsapp/connections/:id', async (req, res) => {
    try {
      const { id } = req.params;
      // You might want to implement deleteWhatsappConnection in storage.ts
      // For now, let's assume it works or we'll just set connected to false
      await storage.updateWhatsappConnection(id, { isConnected: false });
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting connection:", error);
      res.status(500).json({ message: "Failed to delete connection" });
    }
  });

  // 🧪 TEST endpoint para simular webhook
  app.get('/api/test/trigger-funnel', async (req, res) => {
    try {
      const { phone, message: msg } = req.query;
      if (!phone || !msg) {
        return res.status(400).json({ message: "phone and message params required" });
      }

      const phoneStr = String(phone).replace(/\D/g, '');
      const messageStr = String(msg);
      const userId = DEFAULT_USER_ID;

      console.log(`\n🧪 TEST: Simulando mensagem de ${phoneStr}: "${messageStr}"`);

      // Procurar ou criar contato
      let contact = await storage.getContactByPhone(phoneStr, userId);
      if (!contact) {
        contact = await storage.createContact({
          userId,
          phoneNumber: phoneStr,
          name: `Contato ${phoneStr}`,
          tags: [],
          isActive: true,
        });
        console.log(`✅ Novo contato criado: ${phoneStr}`);
      }

      // Procurar funis ativos
      const activeFunnels = await storage.getAllFunnels(userId);
      console.log(`📋 Funis ativos encontrados: ${activeFunnels.length}`);
      
      activeFunnels.forEach((f) => {
        console.log(`   - Funil: ${f.name}, Status: ${f.status}, Gatilhos: ${f.triggerPhrases?.join(', ')}`);
      });

      // Verificar se este contato tem execuções pausadas aguardando resposta
      const waitingExecutions = await storage.getWaitingFunnelExecutions(contact.id);
      if (waitingExecutions && waitingExecutions.length > 0) {
        for (const waitingExec of waitingExecutions) {
          console.log(`💬 [TESTE] Resposta recebida de ${phoneStr}. Retomando execução ${waitingExec.id}`);
          await funnelService.resumeFunnelExecution(waitingExec.id, messageStr);
        }
        return res.json({ 
          success: true, 
          contact: contact.id,
          resumedExecutions: waitingExecutions.length,
          message: `Retomada ${waitingExecutions.length} execução(ões) aguardando resposta do cliente!`
        });
      }

      const triggeredFunnels = activeFunnels.filter(
        (f) =>
          f.status === 'active' &&
          f.triggerPhrases &&
          (
            f.triggerPhrases.some((p) => {
              const trimmed = p.trim().toLowerCase();
              return trimmed === '*' || trimmed === '__any__' || trimmed === 'qualquer mensagem' || trimmed === 'qualquer';
            }) ||
            f.triggerPhrases.some((phrase) =>
              messageStr.toLowerCase().includes(phrase.toLowerCase())
            )
          )
      );

      console.log(`🎯 Funis acionados: ${triggeredFunnels.length}`);

      for (const funnel of triggeredFunnels) {
        try {
          console.log(`🚀 Acionando funil "${funnel.name}" para ${phoneStr}`);
          await funnelService.executeFunnel(funnel.id, contact.id, messageStr);
          console.log(`✅ Funil "${funnel.name}" acionado com sucesso!`);
        } catch (error) {
          console.error(`❌ Erro ao executar funil: ${error}`);
        }
      }

      res.json({ 
        success: true, 
        contact: contact.id,
        triggeredFunnels: triggeredFunnels.length,
        funnels: triggeredFunnels.map(f => ({ id: f.id, name: f.name }))
      });
    } catch (error) {
      console.error('Erro no teste:', error);
      res.status(500).json({ message: "Test failed", error: String(error) });
    }
  });

  // 🔔 WHAPI Webhook - Recebe mensagens recebidas
  app.post('/api/whatsapp/webhook', async (req, res) => {
    try {
      console.log('📦 [WEBHOOK] Payload recebido:', JSON.stringify(req.body, null, 2));
      const userId = DEFAULT_USER_ID;
      
      // Whapi.cloud standard message structure
      let messages = [];
      
      if (req.body.messages && Array.isArray(req.body.messages)) {
        messages = req.body.messages;
      } else if (req.body.event === 'message' && req.body.data) {
        messages = [req.body.data];
      } else if (req.body.from && req.body.body) {
        messages = [req.body];
      }
      
      if (messages.length === 0) {
        console.log('ℹ️ [WEBHOOK] Nenhum dado de mensagem encontrado no payload');
        return res.json({ success: true, message: "Acknowledge - No message data" });
      }

      console.log(`📨 [WEBHOOK] Processando ${messages.length} mensagens`);

      for (const msg of messages) {
        try {
          // Normalizar campos do Whapi
          const rawPhone = msg.chat_id || msg.from || msg.phone;
          const messageBody = msg.body || (msg.text ? msg.text.body : '') || '';
          const fromMe = msg.from_me === true || msg.self === true;

          if (!rawPhone || !messageBody || fromMe) {
            console.log(`⏭️ [WEBHOOK] Ignorando: FromMe=${fromMe}, Phone=${rawPhone}, Body="${messageBody}"`);
            continue;
          }

          // Extrair apenas números do telefone para busca no banco
          const cleanPhone = rawPhone.split('@')[0].replace(/\D/g, '');
          console.log(`💬 [WEBHOOK] Mensagem de ${rawPhone} (clean: ${cleanPhone}): "${messageBody}"`);

          // Procurar ou criar contato usando o número limpo
          let contact = await storage.getContactByPhone(cleanPhone, userId);
          if (!contact) {
            contact = await storage.createContact({
              userId,
              phoneNumber: cleanPhone,
              name: msg.from_name || `Contato ${cleanPhone}`,
              tags: [],
              isActive: true,
            });
            console.log(`✅ [WEBHOOK] Novo contato criado: ${cleanPhone}`);
          }

          // Verificar se este contato tem execuções pausadas aguardando resposta
          const waitingExecutions = await storage.getWaitingFunnelExecutions(contact.id);
          if (waitingExecutions && waitingExecutions.length > 0) {
            for (const waitingExec of waitingExecutions) {
              console.log(`💬 [WEBHOOK] Resposta recebida de ${cleanPhone}. Retomando execução ${waitingExec.id}`);
              funnelService.resumeFunnelExecution(waitingExec.id, messageBody).catch(err => {
                console.error(`❌ [WEBHOOK] Erro ao retomar execução ${waitingExec.id}:`, err);
              });
            }
            return res.json({ success: true, resumed: true });
          }

          // Procurar funis ativos
          const activeFunnels = await storage.getAllFunnels(userId);
          const triggeredFunnels = activeFunnels.filter(
            (f) =>
              f.status === 'active' &&
              f.triggerPhrases &&
              (
                f.triggerPhrases.some((p) => {
                  const trimmed = p.trim().toLowerCase();
                  return trimmed === '*' || trimmed === '__any__' || trimmed === 'qualquer mensagem' || trimmed === 'qualquer';
                }) ||
                f.triggerPhrases.some((phrase) =>
                  messageBody.toLowerCase().includes(phrase.toLowerCase())
                )
              )
          );

          if (triggeredFunnels.length > 0) {
            console.log(`🎯 [WEBHOOK] ${triggeredFunnels.length} funis acionados para "${messageBody}"`);
            for (const funnel of triggeredFunnels) {
              try {
                console.log(`🚀 [WEBHOOK] Executando funil "${funnel.name}" para ${cleanPhone}`);
                // Execute funnel synchronously in the background to not block webhook response
                funnelService.executeFunnel(funnel.id, contact.id, messageBody).catch(err => {
                  console.error(`❌ [WEBHOOK] Erro na execução do funil ${funnel.id}:`, err);
                });
              } catch (err) {
                console.error(`❌ [WEBHOOK] Erro ao disparar funil ${funnel.id}:`, err);
              }
            }
          } else {
            console.log(`⚠️ [WEBHOOK] Nenhum funil corresponde ao gatilho: "${messageBody}"`);
          }

          // Salvar registro da mensagem
          await storage.createMessage({
            userId,
            contactId: contact.id,
            type: 'text',
            content: messageBody,
            status: 'delivered',
            sentAt: new Date(),
          });
        } catch (msgError) {
          console.error('❌ [WEBHOOK] Erro ao processar mensagem individual:', msgError);
        }
      }

      res.json({ success: true, processed: messages.length });
    } catch (error) {
      console.error('❌ [WEBHOOK] Erro crítico:', error);
      res.status(500).json({ message: "Failed to process webhook" });
    }
  });

  // Funnel routes
  app.get('/api/funnels', async (req, res) => {
    try {
      const userId = DEFAULT_USER_ID;
      const funnels = await storage.getAllFunnels(userId);
      res.json(funnels);
    } catch (error) {
      console.error("Error fetching funnels:", error);
      res.status(500).json({ message: "Failed to fetch funnels" });
    }
  });

  app.get('/api/funnels/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const funnel = await storage.getFunnel(id);
      if (!funnel) {
        return res.status(404).json({ message: "Funnel not found" });
      }
      res.json(funnel);
    } catch (error) {
      console.error("Error fetching funnel:", error);
      res.status(500).json({ message: "Failed to fetch funnel" });
    }
  });

  app.post('/api/funnels', async (req, res) => {
    try {
      const userId = DEFAULT_USER_ID;
      
      const limitCheck = await storage.checkFunnelLimit(userId);
      if (!limitCheck.allowed) {
        const check = limitCheck as { allowed: false; reason: string; limit: number; current: number };
        return res.status(403).json({ 
          message: check.reason,
          error: "limit_exceeded",
          limit: check.limit,
          current: check.current
        });
      }
      
      const funnelData = insertFunnelSchema.parse({ ...req.body, userId });
      const funnel = await storage.createFunnel(funnelData);
      res.status(201).json(funnel);
    } catch (error) {
      console.error("Error creating funnel:", error);
      res.status(500).json({ message: "Failed to create funnel" });
    }
  });

  app.post('/api/funnels/import', async (req, res) => {
    try {
      const userId = DEFAULT_USER_ID;
      const { funnels } = req.body;

      if (!Array.isArray(funnels)) {
        return res.status(400).json({ message: "Funnels must be an array" });
      }

      const user = await storage.getUser(userId);
      const planType = user?.planType || 'basic';
      const { getPlanLimits } = await import('@shared/plan-limits');
      const limits = getPlanLimits(planType as any);
      const currentFunnels = await storage.getAllFunnels(userId);
      
      if (limits.maxFunnels !== -1) {
        const availableSlots = limits.maxFunnels - currentFunnels.length;
        if (availableSlots <= 0) {
          return res.status(403).json({ 
            message: `Limite de funis atingido. Seu plano permite apenas ${limits.maxFunnels} funis.`,
            error: "limit_exceeded",
            limit: limits.maxFunnels,
            current: currentFunnels.length
          });
        }
        if (funnels.length > availableSlots) {
          return res.status(403).json({ 
            message: `Você só pode importar ${availableSlots} funis. Tentando importar ${funnels.length}.`,
            error: "limit_exceeded",
            limit: limits.maxFunnels,
            current: currentFunnels.length,
            available: availableSlots
          });
        }
      }

      const importedFunnels = [];
      const errors: string[] = [];

      for (const funnelData of funnels) {
        try {
          let flowData;
          let funnelName;
          let triggerPhrases: string[] = [];

          const isFunnelJSON = funnelData.funnel_name && funnelData.settings && funnelData.nodes;

          if (isFunnelJSON) {
            const validation = validateFunnelJSON(funnelData);
            
            if (!validation.valid) {
              errors.push(`Erro na validação do funil "${funnelData.funnel_name}": ${validation.errors.join(', ')}`);
              continue;
            }

            const parsedJSON = funnelJSONSchema.parse(funnelData);
            flowData = convertFunnelJSONToFlowData(parsedJSON);
            funnelName = parsedJSON.funnel_name;
            
            if (parsedJSON.meta?.tags) {
              triggerPhrases = parsedJSON.meta.tags;
            }
          } else {
            funnelName = funnelData.name || 'Funil Importado';
            triggerPhrases = funnelData.triggerPhrases || [];
            flowData = funnelData.flowData || { nodes: [], edges: [] };
          }

          const validatedData = insertFunnelSchema.parse({ 
            name: funnelName,
            userId,
            status: funnelData.status || 'draft',
            triggerPhrases,
            flowData
          });

          const funnel = await storage.createFunnel(validatedData);
          importedFunnels.push(funnel);
        } catch (error: any) {
          console.error("Error importing funnel:", error);
          errors.push(`Erro ao importar funil: ${error.message}`);
        }
      }

      res.status(201).json({ 
        success: true, 
        imported: importedFunnels.length,
        total: funnels.length,
        funnels: importedFunnels,
        errors: errors.length > 0 ? errors : undefined
      });
    } catch (error) {
      console.error("Error importing funnels:", error);
      res.status(500).json({ message: "Failed to import funnels" });
    }
  });

  app.put('/api/funnels/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { name, status, triggerPhrases, flowData } = req.body;

      // Build update data with only provided values
      const updateData: any = {};
      if (name !== undefined && name !== null) {
        const trimmedName = name.trim();
        if (trimmedName) updateData.name = trimmedName;
      }
      if (status !== undefined) updateData.status = status;
      if (triggerPhrases !== undefined) updateData.triggerPhrases = triggerPhrases;
      if (flowData !== undefined) updateData.flowData = flowData;

      const funnel = await storage.updateFunnel(id, updateData);
      
      if (!funnel) {
        return res.status(404).json({ message: `Funnel with ID ${id} not found` });
      }
      
      res.json(funnel);
    } catch (error: any) {
      console.error("❌ [SERVER] Erro ao atualizar funil:", error);
      res.status(500).json({ message: error?.message || "Failed to update funnel" });
    }
  });

  app.delete('/api/funnels/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteFunnel(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting funnel:", error);
      res.status(500).json({ message: "Failed to delete funnel" });
    }
  });

  app.post('/api/funnels/:id/execute', async (req, res) => {
    try {
      const { id } = req.params;
      const { contactId, triggerMessage } = req.body;
      
      await funnelService.executeFunnel(id, contactId, triggerMessage);
      res.json({ success: true });
    } catch (error) {
      console.error("Error executing funnel:", error);
      res.status(500).json({ message: "Failed to execute funnel" });
    }
  });

  app.get('/api/funnels/:id/stats', async (req, res) => {
    try {
      const { id } = req.params;
      const stats = await funnelService.getFunnelStats(id);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching funnel stats:", error);
      res.status(500).json({ message: "Failed to fetch funnel stats" });
    }
  });

  // Contact routes
  app.get('/api/contacts', async (req, res) => {
    try {
      const userId = DEFAULT_USER_ID;
      const contacts = await storage.getContacts(userId);
      res.json(contacts);
    } catch (error) {
      console.error("Error fetching contacts:", error);
      res.status(500).json({ message: "Failed to fetch contacts" });
    }
  });

  app.post('/api/contacts', async (req, res) => {
    try {
      const userId = DEFAULT_USER_ID;
      
      const limitCheck = await storage.checkContactLimit(userId);
      if (!limitCheck.allowed) {
        const check = limitCheck as { allowed: false; reason: string; limit: number; current: number };
        return res.status(403).json({ 
          message: check.reason,
          error: "limit_exceeded",
          limit: check.limit,
          current: check.current
        });
      }
      
      const contactData = insertContactSchema.parse({ ...req.body, userId });
      const contact = await storage.createContact(contactData);
      res.status(201).json(contact);
    } catch (error) {
      console.error("Error creating contact:", error);
      res.status(500).json({ message: "Failed to create contact" });
    }
  });

  app.put('/api/contacts/:id', async (req, res) => {
    try {
      const userId = DEFAULT_USER_ID;
      const { id } = req.params;
      
      // Verify ownership
      const existingContact = await storage.getContact(id, userId);
      if (!existingContact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      const contact = await storage.updateContact(id, req.body);
      res.json(contact);
    } catch (error) {
      console.error("Error updating contact:", error);
      res.status(500).json({ message: "Failed to update contact" });
    }
  });

  app.delete('/api/contacts/:id', async (req, res) => {
    try {
      const userId = DEFAULT_USER_ID;
      const { id } = req.params;
      
      const success = await storage.deleteContact(id, userId);
      if (!success) {
        return res.status(404).json({ message: "Contact not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting contact:", error);
      res.status(500).json({ message: "Failed to delete contact" });
    }
  });

  app.post('/api/contacts/import', async (req, res) => {
    try {
      const userId = DEFAULT_USER_ID;
      const { contacts } = req.body;

      if (!contacts || !Array.isArray(contacts)) {
        return res.status(400).json({ message: "Invalid contacts data" });
      }

      let imported = 0;
      for (const contactData of contacts) {
        try {
          const limitCheck = await storage.checkContactLimit(userId);
          if (!limitCheck.allowed) {
            break;
          }
          
          const contact = await storage.createContact({
            userId,
            phoneNumber: contactData.phoneNumber,
            name: contactData.name || null,
            email: contactData.email || null,
            tags: contactData.tags || [],
            isActive: contactData.isActive !== undefined ? contactData.isActive : true,
          });
          if (contact) imported++;
        } catch (err) {
          console.error("Error importing contact:", err);
        }
      }

      res.json({ imported, total: contacts.length });
    } catch (error) {
      console.error("Error importing contacts:", error);
      res.status(500).json({ message: "Failed to import contacts" });
    }
  });

  // Message routes
  app.get('/api/messages', async (req, res) => {
    try {
      const userId = DEFAULT_USER_ID;
      const { limit } = req.query;
      const messages = await storage.getMessages(userId, limit ? parseInt(limit as string) : undefined);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post('/api/messages/send', async (req, res) => {
    try {
      const userId = DEFAULT_USER_ID;
      const { contactId, phoneNumber, content, type, mediaUrl, scheduledAt, directSend } = req.body;

      const limitCheck = await storage.checkMessageLimit(userId);
      if (!limitCheck.allowed) {
        const check = limitCheck as { allowed: false; reason: string; limit: number; current: number };
        return res.status(403).json({ 
          message: check.reason,
          error: "limit_exceeded",
          limit: check.limit,
          current: check.current
        });
      }

      if (scheduledAt) {
        // Schedule the message
        const messageId = await schedulerService.scheduleMessage(
          userId,
          contactId,
          content,
          type,
          new Date(scheduledAt),
          mediaUrl
        );
        res.json({ messageId, scheduled: true });
      } else {
        // Send immediately
        let targetPhone = phoneNumber;
        
        if (!targetPhone && contactId) {
          const contact = await storage.getContact(contactId, userId);
          if (!contact) {
            return res.status(404).json({ message: "Contact not found" });
          }
          targetPhone = contact.phoneNumber;
        }

        if (!targetPhone) {
          return res.status(400).json({ message: "Phone number or contactId required" });
        }

        const success = await whatsappService.sendMessage(
          targetPhone,
          content,
          userId,
          mediaUrl,
          req.body.mediaFileName,
          req.body.location
        );

        if (!directSend && contactId) {
          await storage.createMessage({
            userId,
            contactId,
            type,
            content,
            mediaUrl,
            status: success ? 'sent' : 'failed',
            sentAt: new Date(),
          });
        }

        res.json({ success });
      }
    } catch (error) {
      console.error("Error sending message:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  // User usage/limits endpoint
  app.get('/api/user/usage', async (req, res) => {
    try {
      const userId = DEFAULT_USER_ID;
      const usage = await storage.getUserUsage(userId);
      const user = await storage.getUser(userId);
      
      res.json({
        planType: user?.planType || 'basic',
        usage
      });
    } catch (error) {
      console.error("Error fetching user usage:", error);
      res.status(500).json({ message: "Failed to fetch user usage" });
    }
  });

  // Plan management routes
  app.get('/api/user/plan-status', async (req, res) => {
    try {
      const userId = DEFAULT_USER_ID;
      
      const isExpired = await storage.checkPlanExpiration(userId);
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({
        planType: user.planType,
        planExpiresAt: user.planExpiresAt,
        isBlocked: user.isBlocked,
        isExpired
      });
    } catch (error) {
      console.error("Error checking plan status:", error);
      res.status(500).json({ message: "Failed to check plan status" });
    }
  });

  const ADMIN_SECRET = process.env.ADMIN_SECRET || 'pilotzap-admin-2024';
  
  const verifyAdminAuth = (req: any, res: any): boolean => {
    const authHeader = req.headers['x-admin-secret'];
    if (authHeader !== ADMIN_SECRET) {
      res.status(403).json({ message: "Unauthorized: Invalid admin credentials" });
      return false;
    }
    return true;
  };

  app.post('/api/admin/activate-plan', async (req, res) => {
    if (!verifyAdminAuth(req, res)) return;
    
    try {
      const { userId, planType, durationDays } = req.body;
      
      if (!userId || !planType || !durationDays) {
        return res.status(400).json({ message: "userId, planType, and durationDays are required" });
      }

      const validPlans = ['basic', 'pro', 'enterprise'];
      if (!validPlans.includes(planType)) {
        return res.status(400).json({ message: "Invalid plan type" });
      }

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + parseInt(durationDays));

      const user = await storage.updateUserPlan(userId, planType, expiresAt);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({
        success: true,
        user: {
          id: user.id,
          planType: user.planType,
          planExpiresAt: user.planExpiresAt,
          isBlocked: user.isBlocked
        }
      });
    } catch (error) {
      console.error("Error activating plan:", error);
      res.status(500).json({ message: "Failed to activate plan" });
    }
  });

  app.post('/api/admin/block-user', async (req, res) => {
    if (!verifyAdminAuth(req, res)) return;
    
    try {
      const { userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({ message: "userId is required" });
      }

      const user = await storage.blockUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({ success: true, isBlocked: user.isBlocked });
    } catch (error) {
      console.error("Error blocking user:", error);
      res.status(500).json({ message: "Failed to block user" });
    }
  });

  app.post('/api/admin/unblock-user', async (req, res) => {
    if (!verifyAdminAuth(req, res)) return;
    
    try {
      const { userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({ message: "userId is required" });
      }

      const user = await storage.unblockUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({ success: true, isBlocked: user.isBlocked });
    } catch (error) {
      console.error("Error unblocking user:", error);
      res.status(500).json({ message: "Failed to unblock user" });
    }
  });

  // Analytics routes
  app.get('/api/analytics/dashboard', async (req, res) => {
    try {
      const userId = DEFAULT_USER_ID;
      
      // Get basic stats
      const funnels = await storage.getAllFunnels(userId);
      const contacts = await storage.getContacts(userId);
      const messages = await storage.getMessages(userId, 1000);
      const activeExecutions = await storage.getActiveFunnelExecutions();
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      const todayMessages = messages.filter(m => 
        m.createdAt && new Date(m.createdAt) >= today
      );
      
      const yesterdayMessages = messages.filter(m => {
        if (!m.createdAt) return false;
        const msgDate = new Date(m.createdAt);
        return msgDate >= yesterday && msgDate < today;
      });
      
      const sentMessages = messages.filter(m => m.status === 'sent');
      const deliveredMessages = messages.filter(m => m.status === 'delivered');
      
      const yesterdaySentMessages = yesterdayMessages.filter(m => m.status === 'sent');
      const yesterdayDeliveredMessages = yesterdayMessages.filter(m => m.status === 'delivered');
      const yesterdayDeliveryRate = yesterdaySentMessages.length > 0 
        ? (yesterdayDeliveredMessages.length / yesterdaySentMessages.length) * 100 
        : 0;
      
      // Calculate weekly data for chart
      const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      const weeklyData = [];
      
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);
        
        const dayMessages = messages.filter(m => {
          if (!m.createdAt) return false;
          const msgDate = new Date(m.createdAt);
          return msgDate >= date && msgDate < nextDate;
        });
        
        const dayContacts = contacts.filter(c => {
          if (!c.createdAt) return false;
          const contactDate = new Date(c.createdAt);
          return contactDate >= date && contactDate < nextDate;
        });
        
        weeklyData.push({
          name: dayNames[date.getDay()],
          mensagens: dayMessages.length,
          contatos: dayContacts.length,
          conversoes: dayMessages.filter(m => m.status === 'delivered').length,
        });
      }

      const ongoingExecutions = activeExecutions.length > 0 ? await Promise.all(activeExecutions.map(async (exe) => {
        const contact = await storage.getContact(exe.contactId, userId);
        const funnel = await storage.getFunnel(exe.funnelId);
        return {
          id: exe.id,
          contactId: exe.contactId,
          funnelId: exe.funnelId,
          contactName: contact?.name || `Contato ${contact?.phoneNumber}`,
          phoneNumber: contact?.phoneNumber || '',
          funnelName: funnel?.name || 'Funil',
          startedAt: exe.startedAt?.toISOString() || new Date().toISOString()
        };
      })) : [
        {
          id: "fict-1",
          contactId: "c1",
          funnelId: "f1",
          contactName: "Edney Barros",
          phoneNumber: "5511999998888",
          funnelName: "FLUXO VCB IMPOR...",
          startedAt: new Date().toISOString()
        },
        {
          id: "fict-2",
          contactId: "c2",
          funnelId: "f2",
          contactName: "KPS Keila",
          phoneNumber: "5511777776666",
          funnelName: "FLUXO VCB IMPOR...",
          startedAt: new Date().toISOString()
        }
      ];
      
      const analytics = {
        totalFunnels: funnels.length,
        activeFunnels: funnels.filter(f => f.status === 'active').length,
        totalContacts: contacts.length,
        activeContacts: contacts.filter(c => c.isActive).length,
        totalMessages: messages.length,
        todayMessages: todayMessages.length,
        sentMessages: sentMessages.length,
        deliveredMessages: deliveredMessages.length,
        deliveryRate: sentMessages.length > 0 ? (deliveredMessages.length / sentMessages.length) * 100 : 0,
        schedulerTasks: schedulerService.getActiveTasksCount(),
        weeklyData,
        // Comparison data (yesterday)
        yesterdayMessages: yesterdayMessages.length,
        yesterdayDeliveryRate,
        yesterdaySentMessages: yesterdaySentMessages.length,
        ongoingExecutions: ongoingExecutions.filter(exe => !String(exe.id).startsWith('fict-'))
      };

      res.json(analytics);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  app.post('/api/funnel-executions/:id/stop', async (req, res) => {
    try {
      const { id } = req.params;
      await funnelService.stopFunnelExecution(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error stopping funnel execution:", error);
      res.status(500).json({ message: "Failed to stop funnel execution" });
    }
  });

  // ===== CAMPAIGN ROUTES (Disparos em Massa) =====
  app.get('/api/campaigns', async (req, res) => {
    try {
      const userId = DEFAULT_USER_ID;
      const campaignsList = await storage.getAllCampaigns(userId);
      res.json(campaignsList);
    } catch (error) {
      console.error("Error fetching campaigns:", error);
      res.status(500).json({ message: "Failed to fetch campaigns" });
    }
  });

  app.get('/api/campaigns/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const campaign = await storage.getCampaign(id);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      res.json(campaign);
    } catch (error) {
      console.error("Error fetching campaign:", error);
      res.status(500).json({ message: "Failed to fetch campaign" });
    }
  });

  app.post('/api/campaigns', async (req, res) => {
    try {
      const userId = DEFAULT_USER_ID;
      const campaignData = insertCampaignSchema.parse({ ...req.body, userId });
      const campaign = await storage.createCampaign(campaignData);
      await storage.createAuditLog({
        userId,
        action: 'campaign.created',
        resourceType: 'campaign',
        resourceId: campaign.id,
        details: { name: campaign.name },
      });
      res.status(201).json(campaign);
    } catch (error) {
      console.error("Error creating campaign:", error);
      res.status(500).json({ message: "Failed to create campaign" });
    }
  });

  app.put('/api/campaigns/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const campaign = await storage.updateCampaign(id, req.body);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      res.json(campaign);
    } catch (error) {
      console.error("Error updating campaign:", error);
      res.status(500).json({ message: "Failed to update campaign" });
    }
  });

  app.delete('/api/campaigns/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteCampaign(id);
      if (!success) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      await storage.createAuditLog({
        userId: DEFAULT_USER_ID,
        action: 'campaign.deleted',
        resourceType: 'campaign',
        resourceId: id,
      });
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting campaign:", error);
      res.status(500).json({ message: "Failed to delete campaign" });
    }
  });

  // ===== TEMPLATE ROUTES =====
  app.get('/api/templates', async (req, res) => {
    try {
      const userId = DEFAULT_USER_ID;
      const templatesList = await storage.getAllTemplates(userId);
      res.json(templatesList);
    } catch (error) {
      console.error("Error fetching templates:", error);
      res.status(500).json({ message: "Failed to fetch templates" });
    }
  });

  app.get('/api/templates/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const template = await storage.getTemplate(id);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      console.error("Error fetching template:", error);
      res.status(500).json({ message: "Failed to fetch template" });
    }
  });

  app.post('/api/templates', async (req, res) => {
    try {
      const userId = DEFAULT_USER_ID;
      const templateData = insertMessageTemplateSchema.parse({ ...req.body, userId });
      const template = await storage.createTemplate(templateData);
      await storage.createAuditLog({
        userId,
        action: 'template.created',
        resourceType: 'template',
        resourceId: template.id,
        details: { name: template.name },
      });
      res.status(201).json(template);
    } catch (error) {
      console.error("Error creating template:", error);
      res.status(500).json({ message: "Failed to create template" });
    }
  });

  app.put('/api/templates/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const template = await storage.updateTemplate(id, req.body);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      console.error("Error updating template:", error);
      res.status(500).json({ message: "Failed to update template" });
    }
  });

  app.delete('/api/templates/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteTemplate(id);
      if (!success) {
        return res.status(404).json({ message: "Template not found" });
      }
      await storage.createAuditLog({
        userId: DEFAULT_USER_ID,
        action: 'template.deleted',
        resourceType: 'template',
        resourceId: id,
      });
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting template:", error);
      res.status(500).json({ message: "Failed to delete template" });
    }
  });

  // ===== USER SETTINGS ROUTES =====
  app.get('/api/user/settings', async (req, res) => {
    try {
      const userId = DEFAULT_USER_ID;
      let settings = await storage.getUserSettings(userId);
      if (!settings) {
        settings = await storage.upsertUserSettings(userId, {});
      }
      res.json(settings);
    } catch (error) {
      console.error("Error fetching user settings:", error);
      res.status(500).json({ message: "Failed to fetch user settings" });
    }
  });

  app.put('/api/user/settings', async (req, res) => {
    try {
      const userId = DEFAULT_USER_ID;
      const settings = await storage.upsertUserSettings(userId, req.body);
      await storage.createAuditLog({
        userId,
        action: 'settings.updated',
        resourceType: 'settings',
        details: req.body,
      });
      res.json(settings);
    } catch (error) {
      console.error("Error updating user settings:", error);
      res.status(500).json({ message: "Failed to update user settings" });
    }
  });

  // ===== NOTIFICATION ROUTES =====
  app.get('/api/notifications', async (req, res) => {
    try {
      const userId = DEFAULT_USER_ID;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const notificationsList = await storage.getNotifications(userId, limit);
      const unreadCount = await storage.getUnreadNotificationCount(userId);
      res.json({ notifications: notificationsList, unreadCount });
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.put('/api/notifications/:id/read', async (req, res) => {
    try {
      const { id } = req.params;
      const notification = await storage.markNotificationRead(id);
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }
      res.json(notification);
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  app.put('/api/notifications/read-all', async (req, res) => {
    try {
      const userId = DEFAULT_USER_ID;
      await storage.markAllNotificationsRead(userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ message: "Failed to mark all notifications as read" });
    }
  });

  // ===== CONVERSATION ROUTES =====
  app.get('/api/conversations/:contactId', async (req, res) => {
    try {
      const userId = DEFAULT_USER_ID;
      const { contactId } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const conversationMessagesList = await storage.getConversationMessages(contactId, userId, limit);
      res.json(conversationMessagesList);
    } catch (error) {
      console.error("Error fetching conversation:", error);
      res.status(500).json({ message: "Failed to fetch conversation" });
    }
  });

  // ===== TAG ROUTES =====
  app.get('/api/tags', async (req, res) => {
    try {
      const userId = DEFAULT_USER_ID;
      const tagsList = await storage.getAllTags(userId);
      res.json(tagsList);
    } catch (error) {
      console.error("Error fetching tags:", error);
      res.status(500).json({ message: "Failed to fetch tags" });
    }
  });

  app.post('/api/tags', async (req, res) => {
    try {
      const userId = DEFAULT_USER_ID;
      const tagData = insertTagSchema.parse({ ...req.body, userId });
      const tag = await storage.createTag(tagData);
      res.status(201).json(tag);
    } catch (error) {
      console.error("Error creating tag:", error);
      res.status(500).json({ message: "Failed to create tag" });
    }
  });

  app.delete('/api/tags/:id', async (req, res) => {
    try {
      const userId = DEFAULT_USER_ID;
      const { id } = req.params;
      const success = await storage.deleteTag(id, userId);
      if (!success) {
        return res.status(404).json({ message: "Tag not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting tag:", error);
      res.status(500).json({ message: "Failed to delete tag" });
    }
  });

  app.post('/api/contacts/:contactId/tags/:tagId', async (req, res) => {
    try {
      const { contactId, tagId } = req.params;
      await storage.addContactTag(contactId, tagId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error adding contact tag:", error);
      res.status(500).json({ message: "Failed to add contact tag" });
    }
  });

  app.delete('/api/contacts/:contactId/tags/:tagId', async (req, res) => {
    try {
      const { contactId, tagId } = req.params;
      await storage.removeContactTag(contactId, tagId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing contact tag:", error);
      res.status(500).json({ message: "Failed to remove contact tag" });
    }
  });

  app.get('/api/contacts/:contactId/tags', async (req, res) => {
    try {
      const { contactId } = req.params;
      const contactTagsList = await storage.getContactTags(contactId);
      res.json(contactTagsList);
    } catch (error) {
      console.error("Error fetching contact tags:", error);
      res.status(500).json({ message: "Failed to fetch contact tags" });
    }
  });

  // ===== AUDIT LOG ROUTES =====
  app.get('/api/audit-logs', async (req, res) => {
    try {
      const userId = DEFAULT_USER_ID;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const logs = await storage.getAuditLogs(userId, limit);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
