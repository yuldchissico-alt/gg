import { getDb } from "./db";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  type User,
  type UpsertUser,
  type Funnel,
  type InsertFunnel,
  type FunnelNode,
  type Contact,
  type InsertContact,
  type Message,
  type InsertMessage,
  type WhatsappConnection,
  type InsertWhatsappConnection,
  type FunnelExecution,
  type InsertFunnelExecution,
  users,
  whatsappConnections,
  funnels,
  funnelNodes,
  contacts,
  messages,
  funnelExecutions,
} from "@shared/schema";
import { nanoid } from "nanoid";
import { 
  getPlanLimits, 
  checkLimit, 
  calculatePercentage,
  type PlanType,
  type UsageInfo,
  type LimitCheckResult 
} from "@shared/plan-limits";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserPlan(userId: string, planType: string, expiresAt: Date): Promise<User | undefined>;
  blockUser(userId: string): Promise<User | undefined>;
  unblockUser(userId: string): Promise<User | undefined>;
  checkPlanExpiration(userId: string): Promise<boolean>;
  getWhatsappConnection(userId: string): Promise<WhatsappConnection | undefined>;
  getAllWhatsappConnections(userId: string): Promise<WhatsappConnection[]>;
  getConnectedAccountsCount(userId: string): Promise<number>;
  createWhatsappConnection(connection: InsertWhatsappConnection): Promise<WhatsappConnection>;
  updateWhatsappConnection(id: string, updates: Partial<WhatsappConnection>): Promise<WhatsappConnection | undefined>;
  getAllFunnels(userId: string): Promise<Funnel[]>;
  getFunnel(id: string): Promise<Funnel | undefined>;
  createFunnel(funnel: InsertFunnel): Promise<Funnel>;
  updateFunnel(id: string, updates: Partial<Funnel>): Promise<Funnel | undefined>;
  deleteFunnel(id: string): Promise<boolean>;
  getFunnelNodes(funnelId: string): Promise<FunnelNode[]>;
  createFunnelNode(node: Omit<FunnelNode, "id" | "createdAt">): Promise<FunnelNode>;
  updateFunnelNode(id: string, updates: Partial<FunnelNode>): Promise<FunnelNode | undefined>;
  deleteFunnelNode(id: string): Promise<boolean>;
  getContacts(userId: string): Promise<Contact[]>;
  getContact(id: string, userId: string): Promise<Contact | undefined>;
  getContactByPhone(phoneNumber: string, userId: string): Promise<Contact | undefined>;
  createContact(contact: InsertContact): Promise<Contact>;
  updateContact(id: string, updates: Partial<Contact>): Promise<Contact | undefined>;
  deleteContact(id: string, userId: string): Promise<boolean>;
  getMessages(userId: string, limit?: number): Promise<Message[]>;
  getMessage(id: string, userId: string): Promise<Message | undefined>;
  createMessage(message: InsertMessage): Promise<Message>;
  updateMessage(id: string, updates: Partial<Message>): Promise<Message | undefined>;
  getPendingMessages(): Promise<Message[]>;
  getScheduledMessages(): Promise<Message[]>;
  getFunnelExecution(id: string): Promise<FunnelExecution | undefined>;
  getFunnelExecutions(funnelId: string): Promise<FunnelExecution[]>;
  createFunnelExecution(execution: InsertFunnelExecution): Promise<FunnelExecution>;
  updateFunnelExecution(id: string, updates: Partial<FunnelExecution>): Promise<FunnelExecution | undefined>;
  getActiveFunnelExecutions(): Promise<FunnelExecution[]>;
  getDashboardStats(userId: string): Promise<any>;
  getUserUsage(userId: string): Promise<UsageInfo>;
  checkFunnelLimit(userId: string): Promise<LimitCheckResult>;
  checkContactLimit(userId: string): Promise<LimitCheckResult>;
  checkWhatsappLimit(userId: string): Promise<LimitCheckResult>;
  checkMessageLimit(userId: string): Promise<LimitCheckResult>;
  getMessagesThisHour(userId: string): Promise<number>;
  cleanupWhatsappConnections(userId: string, keepPhone: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  private getDb() {
    const db = getDb();
    if (!db) throw new Error("Database not initialized");
    return db;
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await this.getDb().select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await this.getDb().insert(users).values(userData).onConflictDoUpdate({
      target: users.id,
      set: { ...userData, updatedAt: new Date() }
    }).returning();
    return user;
  }

  async getWhatsappConnection(userId: string): Promise<WhatsappConnection | undefined> {
    const [conn] = await this.getDb().select().from(whatsappConnections).where(eq(whatsappConnections.userId, userId));
    return conn;
  }

  async getAllWhatsappConnections(userId: string): Promise<WhatsappConnection[]> {
    const conns = await this.getDb().select().from(whatsappConnections)
      .where(eq(whatsappConnections.userId, userId))
      .orderBy(desc(whatsappConnections.createdAt));
    
    console.log(`🔍 [STORAGE] Encontradas ${conns.length} conexões para o usuário ${userId}`);
    
    if (conns.length === 0) {
      console.log(`🆓 [STORAGE] Criando conexão gratuita padrão para ${userId}`);
      const freeConn = await this.createWhatsappConnection({
        userId,
        name: "WhatsApp Principal",
        phoneNumber: null,
        isConnected: false,
        status: 'disconnected'
      });
      return [freeConn];
    }
    return conns;
  }

  async getConnectedAccountsCount(userId: string): Promise<number> {
    const conns = await this.getDb().select().from(whatsappConnections)
      .where(and(eq(whatsappConnections.userId, userId), eq(whatsappConnections.isConnected, true)));
    return conns.length;
  }

  async createWhatsappConnection(conn: InsertWhatsappConnection): Promise<WhatsappConnection> {
    const [newConn] = await this.getDb().insert(whatsappConnections).values(conn).returning();
    return newConn;
  }

  async updateWhatsappConnection(id: string, update: Partial<WhatsappConnection>): Promise<WhatsappConnection | undefined> {
    const [updated] = await this.getDb().update(whatsappConnections)
      .set({ ...update, updatedAt: new Date() })
      .where(eq(whatsappConnections.id, id))
      .returning();
    return updated;
  }

  async getAllFunnels(userId: string): Promise<Funnel[]> {
    return await this.getDb().select().from(funnels).where(eq(funnels.userId, userId)).orderBy(desc(funnels.createdAt));
  }

  async getFunnel(id: string): Promise<Funnel | undefined> {
    const [funnel] = await this.getDb().select().from(funnels).where(eq(funnels.id, id));
    return funnel;
  }

  async createFunnel(funnel: InsertFunnel): Promise<Funnel> {
    const [newFunnel] = await this.getDb().insert(funnels).values(funnel).returning();
    return newFunnel;
  }

  async updateFunnel(id: string, updates: Partial<Funnel>): Promise<Funnel | undefined> {
    const [updated] = await this.getDb().update(funnels)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(funnels.id, id))
      .returning();
    return updated;
  }

  async deleteFunnel(id: string): Promise<boolean> {
    const [deleted] = await this.getDb().delete(funnels).where(eq(funnels.id, id)).returning();
    return !!deleted;
  }

  async getFunnelNodes(funnelId: string): Promise<FunnelNode[]> {
    return await this.getDb().select().from(funnelNodes).where(eq(funnelNodes.funnelId, funnelId));
  }

  async createFunnelNode(node: Omit<FunnelNode, "id" | "createdAt">): Promise<FunnelNode> {
    const [newNode] = await this.getDb().insert(funnelNodes).values(node).returning();
    return newNode;
  }

  async updateFunnelNode(id: string, updates: Partial<FunnelNode>): Promise<FunnelNode | undefined> {
    const [updated] = await this.getDb().update(funnelNodes)
      .set(updates)
      .where(eq(funnelNodes.id, id))
      .returning();
    return updated;
  }

  async deleteFunnelNode(id: string): Promise<boolean> {
    const [deleted] = await this.getDb().delete(funnelNodes).where(eq(funnelNodes.id, id)).returning();
    return !!deleted;
  }

  async getContacts(userId: string): Promise<Contact[]> {
    return await this.getDb().select().from(contacts).where(eq(contacts.userId, userId)).orderBy(desc(contacts.createdAt));
  }

  async getContact(id: string, userId: string): Promise<Contact | undefined> {
    const [contact] = await this.getDb().select().from(contacts).where(and(eq(contacts.id, id), eq(contacts.userId, userId)));
    return contact;
  }

  async getContactByPhone(phoneNumber: string, userId: string): Promise<Contact | undefined> {
    const [contact] = await this.getDb().select().from(contacts).where(and(eq(contacts.phoneNumber, phoneNumber), eq(contacts.userId, userId)));
    return contact;
  }

  async createContact(contact: InsertContact): Promise<Contact> {
    const [newContact] = await this.getDb().insert(contacts).values(contact).returning();
    return newContact;
  }

  async updateContact(id: string, updates: Partial<Contact>): Promise<Contact | undefined> {
    const [updated] = await this.getDb().update(contacts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(contacts.id, id))
      .returning();
    return updated;
  }

  async deleteContact(id: string, userId: string): Promise<boolean> {
    const [deleted] = await this.getDb().delete(contacts).where(and(eq(contacts.id, id), eq(contacts.userId, userId))).returning();
    return !!deleted;
  }

  async getMessages(userId: string, limit = 100): Promise<Message[]> {
    return await this.getDb().select().from(messages).where(eq(messages.userId, userId)).orderBy(desc(messages.createdAt)).limit(limit);
  }

  async getMessage(id: string, userId: string): Promise<Message | undefined> {
    const [message] = await this.getDb().select().from(messages).where(and(eq(messages.id, id), eq(messages.userId, userId)));
    return message;
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const [newMessage] = await this.getDb().insert(messages).values(message).returning();
    return newMessage;
  }

  async updateMessage(id: string, updates: Partial<Message>): Promise<Message | undefined> {
    const [updated] = await this.getDb().update(messages)
      .set(updates)
      .where(eq(messages.id, id))
      .returning();
    return updated;
  }

  async getPendingMessages(): Promise<Message[]> {
    return await this.getDb().select().from(messages).where(eq(messages.status, "pending")).orderBy(messages.scheduledAt);
  }

  async getScheduledMessages(): Promise<Message[]> {
    return await this.getDb().select().from(messages).where(and(eq(messages.status, "pending"), sql`scheduled_at <= now()`));
  }

  async getFunnelExecution(id: string): Promise<FunnelExecution | undefined> {
    const [execution] = await this.getDb().select().from(funnelExecutions).where(eq(funnelExecutions.id, id));
    return execution;
  }

  async getFunnelExecutions(funnelId: string): Promise<FunnelExecution[]> {
    return await this.getDb().select().from(funnelExecutions).where(eq(funnelExecutions.funnelId, funnelId)).orderBy(desc(funnelExecutions.startedAt));
  }

  async createFunnelExecution(execution: InsertFunnelExecution): Promise<FunnelExecution> {
    const [newExecution] = await this.getDb().insert(funnelExecutions).values(execution).returning();
    return newExecution;
  }

  async updateFunnelExecution(id: string, updates: Partial<FunnelExecution>): Promise<FunnelExecution | undefined> {
    const [updated] = await this.getDb().update(funnelExecutions)
      .set(updates)
      .where(eq(funnelExecutions.id, id))
      .returning();
    return updated;
  }

  async getActiveFunnelExecutions(): Promise<FunnelExecution[]> {
    return await this.getDb().select().from(funnelExecutions).where(eq(funnelExecutions.status, "active"));
  }

  async getDashboardStats(userId: string): Promise<any> {
    const allFunnels = await this.getAllFunnels(userId);
    const activeFunnels = allFunnels.filter(f => f.status === 'active').length;
    const allContacts = await this.getContacts(userId);
    const messages = await this.getMessages(userId);
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    
    const todayMessages = messages.filter(m => m.createdAt && m.createdAt >= today).length;
    const yesterdayMessages = messages.filter(m => m.createdAt && m.createdAt >= yesterday && m.createdAt < today).length;
    
    const delivered = messages.filter(m => m.status === 'delivered').length;
    const total = messages.length;
    const deliveryRate = total > 0 ? (delivered / total) * 100 : 0;

    // Get real ongoing executions
    const executions = await this.getActiveFunnelExecutions();
    const ongoingExecutions = await Promise.all(executions.map(async (exe) => {
      const contact = await this.getContact(exe.contactId, userId);
      const funnel = await this.getFunnel(exe.funnelId);
      
      // Filter out known mock data if it somehow exists in DB
      const mockPhones = ["5511999998888", "5511777776666", "5511999991111", "5511988882222"];
      if (contact && mockPhones.includes(contact.phoneNumber)) return null;
      if (funnel && (funnel.name.includes("FLUXO VCB IMPOR") || funnel.name.includes("Vendas Diretas") || funnel.name.includes("Suporte VIP"))) return null;

      return {
        id: exe.id,
        contactName: contact?.name || "Desconhecido",
        phoneNumber: contact?.phoneNumber || "",
        funnelName: funnel?.name || "Funil"
      };
    }));

    const filteredOngoing = ongoingExecutions.filter((exe): exe is NonNullable<typeof exe> => {
      if (!exe) return false;
      const mockPhones = ["5511999998888", "5511777776666", "5511999991111", "5511988882222"];
      const phoneNumber = String(exe.phoneNumber || "");
      if (mockPhones.includes(phoneNumber)) return false;
      const funnelName = String(exe.funnelName || "");
      const isMockFunnel = funnelName.includes("FLUXO VCB IMPOR") || 
                          funnelName.includes("Vendas Diretas") || 
                          funnelName.includes("Suporte VIP") ||
                          funnelName.includes("Lembrete de Aula");
      if (isMockFunnel) return false;
      return true;
    });

    const weeklyData = [
      { name: 'Seg', triggered: 0, messages: 0 },
      { name: 'Ter', triggered: 0, messages: 0 },
      { name: 'Qua', triggered: 0, messages: 0 },
      { name: 'Qui', triggered: 0, messages: 0 },
      { name: 'Sex', triggered: 0, messages: 0 },
      { name: 'Sáb', triggered: 0, messages: 0 },
      { name: 'Dom', triggered: 0, messages: 0 },
    ];

    // Calculate triggered today correctly
    const triggeredToday = await this.getDb().select().from(funnelExecutions)
      .where(sql`started_at >= ${today}`);

    return {
      totalFunnels: allFunnels.length,
      activeFunnels,
      triggeredTodayCount: triggeredToday.length,
      totalContacts: allContacts.length,
      activeContacts: allContacts.filter(c => c.isActive).length,
      todayMessages,
      yesterdayMessages,
      deliveryRate,
      sentMessages: total,
      deliveredMessages: delivered,
      totalMessages: total,
      yesterdayDeliveryRate: 0, 
      activeNumbers: messages.length > 0 ? Array.from(new Set(messages.slice(0, 5).map(m => m.contactId))).filter(Boolean) : [],
      ongoingExecutions: filteredOngoing.map(exe => ({
        ...exe,
        funnelName: exe.funnelName.length > 15 ? exe.funnelName.substring(0, 12) + "..." : exe.funnelName
      })),
      weeklyData
    };
  }

  async updateUserPlan(userId: string, planType: string, expiresAt: Date): Promise<User | undefined> {
    const [updated] = await this.getDb().update(users)
      .set({ planType: planType as any, planExpiresAt: expiresAt, isBlocked: false, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  async blockUser(userId: string): Promise<User | undefined> {
    const [updated] = await this.getDb().update(users)
      .set({ isBlocked: true, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  async unblockUser(userId: string): Promise<User | undefined> {
    const [updated] = await this.getDb().update(users)
      .set({ isBlocked: false, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  async checkPlanExpiration(userId: string): Promise<boolean> {
    const user = await this.getUser(userId);
    if (!user || !user.planExpiresAt) return false;
    const isExpired = user.planExpiresAt < new Date();
    if (isExpired && !user.isBlocked) await this.blockUser(userId);
    return isExpired;
  }

  async getMessagesThisHour(userId: string): Promise<number> {
    const result = await this.getDb().select().from(messages)
      .where(and(eq(messages.userId, userId), sql`status != 'failed'`, sql`coalesce(sent_at, created_at) >= now() - interval '1 hour'`));
    return result.length;
  }

  async checkMessageLimit(userId: string): Promise<LimitCheckResult> {
    const user = await this.getUser(userId);
    const planType = (user?.planType || "basic") as PlanType;
    const limits = getPlanLimits(planType);
    const count = await this.getMessagesThisHour(userId);
    return checkLimit("mensagens por hora", count, limits.maxMessagesPerHour);
  }

  async cleanupWhatsappConnections(userId: string, keepPhone: string): Promise<void> {
    await this.getDb().delete(whatsappConnections)
      .where(and(
        eq(whatsappConnections.userId, userId),
        sql`${whatsappConnections.phoneNumber} != ${keepPhone}`
      ));
  }

  async getUserUsage(userId: string): Promise<UsageInfo> {
    const user = await this.getUser(userId);
    const planType = (user?.planType || "basic") as PlanType;
    const limits = getPlanLimits(planType);
    const funnelCount = (await this.getAllFunnels(userId)).length;
    const contactCount = (await this.getContacts(userId)).length;
    const whatsappCount = await this.getConnectedAccountsCount(userId);
    const messagesThisHour = await this.getMessagesThisHour(userId);
    return {
      whatsappAccounts: { current: whatsappCount, limit: limits.maxWhatsappAccounts, percentage: calculatePercentage(whatsappCount, limits.maxWhatsappAccounts) },
      messagesThisHour: { current: messagesThisHour, limit: limits.maxMessagesPerHour, percentage: calculatePercentage(messagesThisHour, limits.maxMessagesPerHour) },
      funnels: { current: funnelCount, limit: limits.maxFunnels, percentage: calculatePercentage(funnelCount, limits.maxFunnels) },
      contacts: { current: contactCount, limit: limits.maxContacts, percentage: calculatePercentage(contactCount, limits.maxContacts) }
    };
  }

  async checkFunnelLimit(userId: string): Promise<LimitCheckResult> {
    const user = await this.getUser(userId);
    const planType = (user?.planType || "basic") as PlanType;
    const limits = getPlanLimits(planType);
    const count = (await this.getAllFunnels(userId)).length;
    return checkLimit("funis", count, limits.maxFunnels);
  }

  async checkContactLimit(userId: string): Promise<LimitCheckResult> {
    const user = await this.getUser(userId);
    const planType = (user?.planType || "basic") as PlanType;
    const limits = getPlanLimits(planType);
    const count = (await this.getContacts(userId)).length;
    return checkLimit("contatos", count, limits.maxContacts);
  }

  async checkWhatsappLimit(userId: string): Promise<LimitCheckResult> {
    const user = await this.getUser(userId);
    const planType = (user?.planType || "basic") as PlanType;
    const limits = getPlanLimits(planType);
    const count = await this.getConnectedAccountsCount(userId);
    return checkLimit("contas WhatsApp", count, limits.maxWhatsappAccounts);
  }

  async getWhatsappConnectionsByPhone(phoneNumber: string): Promise<WhatsappConnection[]> {
    return await this.getDb().select().from(whatsappConnections).where(eq(whatsappConnections.phoneNumber, phoneNumber));
  }
}

// In-memory fallback storage for testing
export class MemStorage implements IStorage {
  private users = new Map<string, User>();
  private funnels = new Map<string, Funnel>();
  private funnelNodes = new Map<string, FunnelNode>();
  private contacts = new Map<string, Contact>();
  private messages = new Map<string, Message>();
  private whatsappConnections = new Map<string, WhatsappConnection>();
  private funnelExecutions = new Map<string, FunnelExecution>();

  async getUser(id: string) { return this.users.get(id); }
  async upsertUser(user: UpsertUser) { 
    const u = { ...user, id: user.id, createdAt: new Date(), updatedAt: new Date() } as User;
    this.users.set(u.id, u);
    return u;
  }
  async updateUserPlan(id: string, plan: string, expires: Date) {
    const u = this.users.get(id);
    if (u) { u.planType = plan as any; u.planExpiresAt = expires; u.updatedAt = new Date(); }
    return u;
  }
  async blockUser(id: string) { const u = this.users.get(id); if (u) u.isBlocked = true; return u; }
  async unblockUser(id: string) { const u = this.users.get(id); if (u) u.isBlocked = false; return u; }
  async checkPlanExpiration(id: string) { return false; }
  async getWhatsappConnection(userId: string): Promise<WhatsappConnection | undefined> { 
    return Array.from(this.whatsappConnections.values()).find(c => c.userId === userId);
  }
  async getAllWhatsappConnections(userId: string) { 
    return Array.from(this.whatsappConnections.values()).filter(c => c.userId === userId);
  }
  async getConnectedAccountsCount(userId: string): Promise<number> {
    const conns = Array.from(this.whatsappConnections.values())
      .filter(c => c.userId === userId && c.isConnected);
    return conns.length;
  }
  async createWhatsappConnection(conn: InsertWhatsappConnection) { 
    const c = { ...conn, id: nanoid(), createdAt: new Date(), updatedAt: new Date() } as WhatsappConnection;
    this.whatsappConnections.set(c.id, c);
    return c;
  }
  async updateWhatsappConnection(id: string, updates: Partial<WhatsappConnection>) {
    const c = this.whatsappConnections.get(id);
    if (c) { Object.assign(c, updates, { updatedAt: new Date() }); }
    return c;
  }
  async getAllFunnels(userId: string) { 
    return Array.from(this.funnels.values())
      .filter(f => f.userId === userId)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }
  async getFunnel(id: string) { return this.funnels.get(id); }
  async createFunnel(funnel: InsertFunnel) { 
    const f = { ...funnel, id: nanoid(), createdAt: new Date(), updatedAt: new Date() } as Funnel;
    this.funnels.set(f.id, f);
    return f;
  }
  async updateFunnel(id: string, updates: Partial<Funnel>) {
    const f = this.funnels.get(id);
    if (f) { Object.assign(f, updates, { updatedAt: new Date() }); }
    return f;
  }
  async deleteFunnel(id: string) { return this.funnels.delete(id); }
  async getFunnelNodes(funnelId: string) { 
    return Array.from(this.funnelNodes.values()).filter(n => n.funnelId === funnelId);
  }
  async createFunnelNode(node: Omit<FunnelNode, "id" | "createdAt">) { 
    const n = { ...node, id: nanoid(), createdAt: new Date() } as FunnelNode;
    this.funnelNodes.set(n.id, n);
    return n;
  }
  async updateFunnelNode(id: string, updates: Partial<FunnelNode>) {
    const n = this.funnelNodes.get(id);
    if (n) Object.assign(n, updates);
    return n;
  }
  async deleteFunnelNode(id: string) { return this.funnelNodes.delete(id); }
  async getContacts(userId: string) { 
    return Array.from(this.contacts.values())
      .filter(c => c.userId === userId)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }
  async getContact(id: string, userId: string) { 
    const c = this.contacts.get(id);
    return c?.userId === userId ? c : undefined;
  }
  async getContactByPhone(phone: string, userId: string): Promise<Contact | undefined> { 
    return Array.from(this.contacts.values()).find(c => c.phoneNumber === phone && c.userId === userId);
  }
  async createContact(contact: InsertContact) { 
    const c = { ...contact, id: nanoid(), createdAt: new Date(), updatedAt: new Date() } as Contact;
    this.contacts.set(c.id, c);
    return c;
  }
  async updateContact(id: string, updates: Partial<Contact>) {
    const c = this.contacts.get(id);
    if (c) { Object.assign(c, updates, { updatedAt: new Date() }); }
    return c;
  }
  async deleteContact(id: string, userId: string) { 
    const c = this.contacts.get(id);
    return c?.userId === userId ? this.contacts.delete(id) : false;
  }
  async getMessages(userId: string, limit = 100) { 
    return Array.from(this.messages.values())
      .filter(m => m.userId === userId)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
      .slice(0, limit);
  }
  async getMessage(id: string, userId: string) { 
    const m = this.messages.get(id);
    return m?.userId === userId ? m : undefined;
  }
  async createMessage(message: InsertMessage) { 
    const m = { ...message, id: nanoid(), createdAt: new Date(), updatedAt: new Date() } as Message;
    this.messages.set(m.id, m);
    return m;
  }
  async updateMessage(id: string, updates: Partial<Message>) {
    const m = this.messages.get(id);
    if (m) { Object.assign(m, updates); }
    return m;
  }
  async getPendingMessages() { 
    return Array.from(this.messages.values()).filter(m => m.status === "pending").sort((a, b) => (a.scheduledAt?.getTime() || 0) - (b.scheduledAt?.getTime() || 0));
  }
  async getScheduledMessages() { 
    return Array.from(this.messages.values()).filter(m => m.status === "pending" && m.scheduledAt && m.scheduledAt <= new Date());
  }
  async getFunnelExecution(id: string) { return this.funnelExecutions.get(id); }
  async getFunnelExecutions(funnelId: string) { 
    return Array.from(this.funnelExecutions.values())
      .filter(e => e.funnelId === funnelId)
      .sort((a, b) => (b.startedAt?.getTime() || 0) - (a.startedAt?.getTime() || 0));
  }
  async createFunnelExecution(execution: InsertFunnelExecution) { 
    const e = { ...execution, id: nanoid(), createdAt: new Date(), updatedAt: new Date(), startedAt: new Date(), completedAt: null } as FunnelExecution;
    this.funnelExecutions.set(e.id, e);
    return e;
  }
  async updateFunnelExecution(id: string, updates: Partial<FunnelExecution>) {
    const e = this.funnelExecutions.get(id);
    if (e) { Object.assign(e, updates); }
    return e;
  }
  async getActiveFunnelExecutions() { 
    return Array.from(this.funnelExecutions.values()).filter(e => e.status === "active");
  }

  async getDashboardStats(userId: string): Promise<any> {
    return {
      totalFunnels: 0,
      activeFunnels: 0,
      totalContacts: 0,
      activeContacts: 0,
      todayMessages: 0,
      yesterdayMessages: 0,
      deliveryRate: 0,
      sentMessages: 0,
      deliveredMessages: 0,
      totalMessages: 0,
      yesterdayDeliveryRate: 0,
      activeNumbers: []
    };
  }

  async getUserUsage(userId: string) { 
    return { whatsappAccounts: { current: 0, limit: 5, percentage: 0 }, messagesThisHour: { current: 0, limit: 100, percentage: 0 }, funnels: { current: (await this.getAllFunnels(userId)).length, limit: 10, percentage: 0 }, contacts: { current: (await this.getContacts(userId)).length, limit: 100, percentage: 0 } };
  }
  async checkFunnelLimit(userId: string): Promise<LimitCheckResult> {
    const user = await this.getUser(userId);
    const planType = (user?.planType || "basic") as PlanType;
    const limits = getPlanLimits(planType);
    const count = (await this.getAllFunnels(userId)).length;
    return checkLimit("funis", count, limits.maxFunnels);
  }

  async checkContactLimit(userId: string): Promise<LimitCheckResult> {
    const user = await this.getUser(userId);
    const planType = (user?.planType || "basic") as PlanType;
    const limits = getPlanLimits(planType);
    const count = (await this.getContacts(userId)).length;
    return checkLimit("contatos", count, limits.maxContacts);
  }

  async checkWhatsappLimit(userId: string): Promise<LimitCheckResult> {
    const user = await this.getUser(userId);
    const planType = (user?.planType || "basic") as PlanType;
    const limits = getPlanLimits(planType);
    const count = await this.getConnectedAccountsCount(userId);
    return checkLimit("contas WhatsApp", count, limits.maxWhatsappAccounts);
  }

  async checkMessageLimit(userId: string): Promise<LimitCheckResult> {
    const user = await this.getUser(userId);
    const planType = (user?.planType || "basic") as PlanType;
    const limits = getPlanLimits(planType);
    const count = await this.getMessagesThisHour(userId);
    return checkLimit("mensagens por hora", count, limits.maxMessagesPerHour);
  }

  async getMessagesThisHour(userId: string): Promise<number> {
    return Array.from(this.messages.values()).filter(m => 
      m.userId === userId && 
      m.status !== "failed" && 
      (m.sentAt || m.createdAt || new Date()).getTime() >= Date.now() - 3600000
    ).length;
  }
  async cleanupWhatsappConnections(userId: string, keepPhone: string): Promise<void> {
    const conns = Array.from(this.whatsappConnections.values()).filter(c => c.userId === userId && c.phoneNumber !== keepPhone);
    for (const c of conns) {
      this.whatsappConnections.delete(c.id);
    }
  }
}

const db = getDb();
export const storage = db ? new DatabaseStorage() : new MemStorage();