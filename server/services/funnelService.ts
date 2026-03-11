import { storage } from "../storage";
import { whatsappService } from "./whatsappService";
import type { Funnel, FunnelExecution, Contact } from "@shared/schema";
import { whatsappConnections } from "@shared/schema";
import { eq } from "drizzle-orm";

// Import schedulerService dynamically to avoid circular dependency
const getSchedulerService = async () => {
  const { schedulerService } = await import('./schedulerService');
  return schedulerService;
};

interface FunnelNodeData {
  id: string;
  type: string;
  data: {
    content?: string;
    mediaUrl?: string;
    delayMinutes?: number;
    conditions?: any;
  };
  position: { x: number; y: number };
}

export class FunnelService {
  async executeFunnel(funnelId: string, contactId: string, triggerMessage?: string, quotedMsg?: any): Promise<void> {
    try {
      const funnel = await storage.getFunnel(funnelId);
      if (!funnel || funnel.status !== 'active') {
        throw new Error('Funnel not found or not active');
      }

      console.log(`\n🚀 [MONITOR] Iniciando Funil: "${funnel.name}"`);
      console.log(`👤 [MONITOR] Para o contato: ${contactId}`);
      console.log(`💬 [MONITOR] Gatilho: "${triggerMessage}"`);

      // Get the funnel's user ID first
      const contact = await storage.getContact(contactId, funnel.userId);
      if (!contact) {
        throw new Error('Contact not found');
      }

      // Create funnel execution record
      const execution = await storage.createFunnelExecution({
        funnelId,
        contactId,
        currentNodeId: null,
        status: 'active',
        completedAt: null,
        data: { triggerMessage, quotedMsg },
      });

      // Update analytics stats
      try {
        const db = (storage as any).getDb?.();
        if (db) {
          await db.update(whatsappConnections)
            .set({ 
              updatedAt: new Date() 
            })
            .where(eq(whatsappConnections.userId, funnel.userId));
        }
      } catch (e) {
        console.warn('Could not update connection timestamp:', e);
      }

      // Start funnel execution from the first node
      await this.processNextNode(execution.id);
    } catch (error) {
      console.error('Execute funnel error:', error);
      throw error;
    }
  }

  async processNextNode(executionId: string): Promise<void> {
    try {
      const execution = await storage.getFunnelExecution(executionId);
      if (!execution || execution.status !== 'active') {
        return;
      }

      // Prevenir re-processamento rápido do mesmo nó (deve haver pelo menos 1 segundo de diferença)
      const executionData = execution.data as any || {};
      const lastProcessed = executionData.lastNodeProcessedAt ? new Date(executionData.lastNodeProcessedAt).getTime() : 0;
      // Removido o check de duplicidade para garantir que mensagens sequenciais funcionem
      // if (Date.now() - lastProcessed < 500 && execution.currentNodeId) { ... }

      const funnel = await storage.getFunnel(execution.funnelId);
      if (!funnel) {
        return;
      }

      const flowData = funnel.flowData as { nodes: FunnelNodeData[], edges: any[] };
      
      // Helper to check if a node is a trigger node (check both type and data.nodeType)
      const isTriggerNode = (node: FunnelNodeData) => 
        node.type === 'trigger' || (node.data as any)?.nodeType === 'trigger';
      
      // If no current node, start with the first node (trigger)
      let currentNode: FunnelNodeData | undefined;
      
      if (!execution.currentNodeId) {
        // Find the start/trigger node
        currentNode = flowData.nodes.find(node => isTriggerNode(node));
        console.log(`🏁 [FUNNEL] Iniciando do nó gatilho: ${currentNode?.id}`);
      } else {
        // Find the current node
        const prevNodeId = execution.currentNodeId;
        
        // Find the next node based on edges
        const nextEdge = flowData.edges.find(edge => edge.source === prevNodeId);
        if (nextEdge) {
          currentNode = flowData.nodes.find(node => node.id === nextEdge.target);
          console.log(`➡️ [FUNNEL] Movendo do nó ${prevNodeId} para ${currentNode?.id}`);
        }
      }

      if (!currentNode) {
        // End of funnel
        await storage.updateFunnelExecution(executionId, {
          status: 'completed',
          completedAt: new Date(),
        });
        return;
      }

      // Get the current node type
      const currentNodeType = (currentNode.data as any)?.nodeType || currentNode.type;
      
    // Process the current node
    await this.processNode(execution, currentNode);
    
    // Update execution with current node
    await storage.updateFunnelExecution(executionId, {
      currentNodeId: currentNode.id,
      data: { 
        ...(execution.data as object || {}),
        lastNodeProcessedAt: new Date().toISOString()
      }
    });

    console.log(`📍 [FUNNEL] Nó processado: ${currentNode.id} (${currentNodeType})`);

    // If current node is a delay node, wait before continuing to next node
    if (currentNodeType === 'delay') {
        const delayMinutes = currentNode.data.delayMinutes || 0;
        if (delayMinutes > 0) {
          const schedulerService = await getSchedulerService();
          await schedulerService.scheduleTask({
            type: 'funnel_next_node',
            data: { executionId },
            executeAt: new Date(Date.now() + delayMinutes * 60 * 1000),
          });
          console.log(`⏰ Aguardando ${delayMinutes} minuto(s) antes da próxima mensagem`);
          return; // Stop here, scheduler will call processNextNode later
        }
      }
      
    // For all other nodes, process next node immediately
    if (currentNodeType !== 'message' || !flowData.edges.some(e => e.source === currentNode.id)) {
      setImmediate(() => this.processNextNode(executionId));
    } else {
      // Pequeno delay randômico para simular tempo de resposta variado e evitar detecção
      const humanDelay = 500 + Math.random() * 1000;
      setTimeout(() => this.processNextNode(executionId), humanDelay);
    }
  } catch (error) {
      console.error('Process next node error:', error);
      
      // Mark execution as failed
      await storage.updateFunnelExecution(executionId, {
        status: 'stopped',
        completedAt: new Date(),
      });
    }
  }

  private async processNode(execution: FunnelExecution, node: FunnelNodeData): Promise<void> {
    // Get the funnel to find the user ID
    const funnel = await storage.getFunnel(execution.funnelId);
    if (!funnel) {
      throw new Error('Funnel not found for execution');
    }

    const contact = await storage.getContact(execution.contactId, funnel.userId);
    if (!contact) {
      throw new Error('Contact not found for execution');
    }

    const executionData = execution.data as any || {};
    const quotedMsg = executionData.quotedMsg;

    // Get the actual node type (check both type and data.nodeType)
    const nodeType = (node.data as any)?.nodeType || node.type;

    switch (nodeType) {
      case 'trigger':
        // Trigger node - just log the start, DO NOT send any message
        console.log(`✅ [MONITOR] Funil iniciado para ${contact.phoneNumber}`);
        break;

      case 'message':
      case 'image':
      case 'video':
      case 'audio':
      case 'document':
        console.log(`📤 [MONITOR] Enviando mensagem do nó ${node.id} para ${contact.phoneNumber}`);
        await this.sendMessage(contact, node, quotedMsg);
        break;

      case 'delay':
        // Delay is handled in the scheduling logic
        console.log(`⏰ [MONITOR] Aguardando ${node.data.delayMinutes} minutos para ${contact.phoneNumber}`);
        break;

      case 'condition':
        // Handle conditional logic
        await this.processCondition(execution, node);
        break;

      default:
        console.log(`Unknown node type: ${nodeType}`);
    }
  }

  private async sendMessage(contact: Contact, node: FunnelNodeData, quotedMsg?: any): Promise<void> {
    try {
      const nodeType = (node.data as any)?.nodeType || node.type;
      let messageContent = node.data.content || '';
      const mediaUrl = node.data.mediaUrl;

      // For media nodes, only send caption if it has meaningful content (not the default placeholder)
      if (['image', 'video', 'audio', 'document', 'location'].includes(nodeType)) {
        if (!messageContent || messageContent === 'Configurar este nó...') {
          messageContent = '';
        }
      }

      console.log(`📡 [FUNNEL] Iniciando envio para ${contact.phoneNumber}: "${messageContent}"`);

      // Determine message type based on content
      let messageType: 'text' | 'image' | 'video' | 'audio' | 'document' = 'text';
      if (mediaUrl) {
        if (mediaUrl.match(/\.(jpg|jpeg|png|gif)$/i) || mediaUrl.startsWith('data:image')) {
          messageType = 'image';
        } else if (mediaUrl.match(/\.(mp4|avi|mov)$/i) || mediaUrl.startsWith('video:')) {
          messageType = 'video';
        } else if (mediaUrl.match(/\.(mp3|wav|ogg)$/i) || mediaUrl.startsWith('audio:')) {
          messageType = 'audio';
        } else {
          messageType = 'document';
        }
      }

      // Send message via WhatsApp
      const mediaFileName = (node.data as any)?.mediaFileName;
      const success = await whatsappService.sendMessage(
        contact.phoneNumber, 
        messageContent, 
        contact.userId, 
        mediaUrl, 
        mediaFileName,
        (node.data as any)?.location,
        quotedMsg
      );
      
      if (!success) {
        throw new Error(`Falha no whatsappService.sendMessage para ${contact.phoneNumber}`);
      }

      // Store message record
      await storage.createMessage({
        contactId: contact.id,
        userId: contact.userId,
        type: messageType,
        content: messageContent,
        mediaUrl,
        status: 'sent',
        sentAt: new Date(),
      });

      console.log(`✨ [FUNNEL] Fluxo de mensagem concluído para ${contact.phoneNumber}`);
    } catch (error) {
      console.error('Send message error:', error);
      
      // Store failed message record
      await storage.createMessage({
        contactId: contact.id,
        userId: contact.userId,
        type: 'text',
        content: node.data.content || '',
        mediaUrl: node.data.mediaUrl,
        status: 'failed',
      });
    }
  }

  private async processCondition(execution: FunnelExecution, node: FunnelNodeData): Promise<void> {
    // Handle conditional logic based on node configuration
    // This is a simplified version - in a real implementation,
    // you'd evaluate conditions based on contact data, previous responses, etc.
    
    const conditions = node.data.conditions || {};
    console.log(`Processing condition for execution ${execution.id}:`, conditions);
    
    // For now, we'll just continue to the next node
    // In a real implementation, you'd evaluate the condition and choose the appropriate path
    console.log(`[CONDITION] Evaluated condition for ${execution.id}, moving to next node.`);
    setImmediate(() => this.processNextNode(execution.id));
  }

  async pauseFunnel(funnelId: string): Promise<void> {
    await storage.updateFunnel(funnelId, { status: 'paused' });
    
    // Also pause all active executions for this funnel
    const executions = await storage.getFunnelExecutions(funnelId);
    for (const execution of executions) {
      if (execution.status === 'active') {
        await storage.updateFunnelExecution(execution.id, { status: 'stopped' });
      }
    }
  }

  async resumeFunnel(funnelId: string): Promise<void> {
    await storage.updateFunnel(funnelId, { status: 'active' });
  }

  async stopFunnelExecution(executionId: string): Promise<void> {
    await storage.updateFunnelExecution(executionId, {
      status: 'stopped',
      completedAt: new Date(),
    });
  }

  async getFunnelStats(funnelId: string): Promise<any> {
    const executions = await storage.getFunnelExecutions(funnelId);
    
    const stats = {
      totalExecutions: executions.length,
      activeExecutions: executions.filter(e => e.status === 'active').length,
      completedExecutions: executions.filter(e => e.status === 'completed').length,
      stoppedExecutions: executions.filter(e => e.status === 'stopped').length,
    };

    return stats;
  }
}

export const funnelService = new FunnelService();
