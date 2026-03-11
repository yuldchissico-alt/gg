import * as cron from 'node-cron';
import { storage } from "../storage";
import { funnelService } from "./funnelService";
import { whatsappService } from "./whatsappService";

interface ScheduledTask {
  type: 'funnel_next_node' | 'send_message' | 'cleanup';
  data: any;
  executeAt: Date;
}

export class SchedulerService {
  private tasks: Map<string, NodeJS.Timeout> = new Map();
  private readonly isServerless =
    Boolean(process.env.VERCEL) || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);

  constructor() {
    if (this.isServerless) {
      console.log("Scheduler service disabled (serverless runtime detected)");
      return;
    }

    this.initializeScheduler();
  }

  private initializeScheduler(): void {
    // Run every minute to check for scheduled messages
    cron.schedule('* * * * *', async () => {
      await this.processScheduledMessages();
    });

    // Run every 5 minutes to process funnel executions
    cron.schedule('*/10 * * * *', async () => {
      await this.processActiveFunnelExecutions();
    });

    // Cleanup completed tasks daily
    cron.schedule('0 2 * * *', async () => {
      await this.cleanupCompletedTasks();
    });

    console.log('Scheduler service initialized');
  }

  async scheduleTask(task: ScheduledTask): Promise<string> {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const delay = task.executeAt.getTime() - Date.now();

    if (this.isServerless && delay > 0) {
      throw new Error("Agendamento nÃ£o suportado em runtime serverless (Vercel).");
    }
    
    if (delay <= 0) {
      // Execute immediately
      await this.executeTask(task);
      return taskId;
    }

    const timeout = setTimeout(async () => {
      await this.executeTask(task);
      this.tasks.delete(taskId);
    }, delay);

    this.tasks.set(taskId, timeout);
    
    console.log(`Task ${taskId} scheduled for ${task.executeAt.toISOString()}`);
    return taskId;
  }

  async cancelTask(taskId: string): Promise<boolean> {
    const timeout = this.tasks.get(taskId);
    if (timeout) {
      clearTimeout(timeout);
      this.tasks.delete(taskId);
      return true;
    }
    return false;
  }

  private async executeTask(task: ScheduledTask): Promise<void> {
    try {
      switch (task.type) {
        case 'funnel_next_node':
          await funnelService.processNextNode(task.data.executionId);
          break;

        case 'send_message':
          await this.executeSendMessage(task.data);
          break;

        case 'cleanup':
          await this.cleanupCompletedTasks();
          break;

        default:
          console.log(`Unknown task type: ${task.type}`);
      }
    } catch (error) {
      console.error(`Error executing task ${task.type}:`, error);
    }
  }

  private async executeSendMessage(data: any): Promise<void> {
    const { messageId } = data;
    
    const message = await storage.getMessage(messageId, ''); // We'll need to adjust this
    if (!message || message.status !== 'pending') {
      return;
    }

    try {
      const contact = await storage.getContact(message.contactId, message.userId);
      if (!contact) {
        throw new Error('Contact not found');
      }

      const success = await whatsappService.sendMessage(contact.phoneNumber, message.content, contact.userId, message.mediaUrl || undefined);

      await storage.updateMessage(messageId, {
        status: success ? 'sent' : 'failed',
        sentAt: new Date(),
      });

      console.log(`Scheduled message sent to ${contact.phoneNumber}`);
    } catch (error) {
      console.error('Failed to send scheduled message:', error);
      
      await storage.updateMessage(messageId, {
        status: 'failed',
      });
    }
  }

  private async processScheduledMessages(): Promise<void> {
    try {
      const scheduledMessages = await storage.getScheduledMessages();
      
      for (const message of scheduledMessages) {
        await this.scheduleTask({
          type: 'send_message',
          data: { messageId: message.id },
          executeAt: new Date(), // Execute immediately since it's already due
        });
      }
    } catch (error) {
      console.error('Error processing scheduled messages:', error);
    }
  }

  private async processActiveFunnelExecutions(): Promise<void> {
    try {
      const activeExecutions = await storage.getActiveFunnelExecutions();
      
      for (const execution of activeExecutions) {
        // Check if execution has been stuck for too long
        if (!execution.startedAt) continue;
        const startedAt = new Date(execution.startedAt);
        const hoursSinceStart = (Date.now() - startedAt.getTime()) / (1000 * 60 * 60);
        
        if (hoursSinceStart > 24) {
          // Stop executions that have been running for more than 24 hours
          await funnelService.stopFunnelExecution(execution.id);
          console.log(`Stopped stuck funnel execution: ${execution.id}`);
        }
      }
    } catch (error) {
      console.error('Error processing active funnel executions:', error);
    }
  }

  private async cleanupCompletedTasks(): Promise<void> {
    // Clear any remaining timeouts for tasks that might have been completed
    this.tasks.clear();
    console.log('Completed task cleanup');
  }

  async scheduleMessage(
    userId: string,
    contactId: string,
    content: string,
    type: 'text' | 'image' | 'video' | 'audio' | 'document',
    scheduledAt: Date,
    mediaUrl?: string
  ): Promise<string> {
    // Create message record
    const message = await storage.createMessage({
      userId,
      contactId,
      type,
      content,
      mediaUrl,
      status: 'pending',
      scheduledAt,
    });

    // Schedule the message
    await this.scheduleTask({
      type: 'send_message',
      data: { messageId: message.id },
      executeAt: scheduledAt,
    });

    return message.id;
  }

  getActiveTasksCount(): number {
    return this.tasks.size;
  }
}

export const schedulerService = new SchedulerService();
