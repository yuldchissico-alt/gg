import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Plan type enum
export const planTypeEnum = pgEnum("plan_type", ["free", "basic", "pro", "enterprise"]);

// User storage table.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  planType: planTypeEnum("plan_type").default("basic"),
  planExpiresAt: timestamp("plan_expires_at"),
  isBlocked: boolean("is_blocked").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// WhatsApp connections
export const whatsappConnections = pgTable("whatsapp_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  phoneNumber: varchar("phone_number"),
  name: varchar("name"),
  isConnected: boolean("is_connected").default(false),
  qrCode: text("qr_code"),
  status: varchar("status").default("disconnected"), // disconnected, qr_ready, connected
  sessionData: jsonb("session_data"), // To store auth credentials if needed
  lastConnectedAt: timestamp("last_connected_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Enums
export const messageTypeEnum = pgEnum("message_type", ["text", "image", "video", "audio", "document", "location"]);
export const nodeTypeEnum = pgEnum("node_type", ["trigger", "message", "delay", "condition", "question", "tag", "verify"]);
export const campaignStatusEnum = pgEnum("campaign_status", ["active", "paused", "inactive", "draft"]);
export const funnelStatusEnum = pgEnum("funnel_status", ["active", "paused", "inactive", "draft"]);

// Campaigns
export const campaigns = pgTable("campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name").notNull(),
  description: text("description"),
  status: campaignStatusEnum("status").default("draft"),
  triggerPhrase: varchar("trigger_phrase").notNull(),
  isActive: boolean("is_active").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Funnels
export const funnels = pgTable("funnels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name").notNull(),
  triggerPhrases: text("trigger_phrases").array().default(sql`ARRAY[]::text[]`),
  status: funnelStatusEnum("status").default("draft"),
  flowData: jsonb("flow_data").notNull(), // React Flow data
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Funnel nodes
export const funnelNodes = pgTable("funnel_nodes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  funnelId: varchar("funnel_id").notNull().references(() => funnels.id, { onDelete: "cascade" }),
  nodeId: varchar("node_id").notNull(), // React Flow node ID
  type: nodeTypeEnum("type").notNull(),
  data: jsonb("data").notNull(),
  position: jsonb("position").notNull(),
  delayMinutes: integer("delay_minutes").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Contacts
export const contacts = pgTable("contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  phoneNumber: varchar("phone_number").notNull(),
  name: varchar("name"),
  email: varchar("email"),
  tags: text("tags").array(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Messages
export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").references(() => campaigns.id, { onDelete: "cascade" }),
  contactId: varchar("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: messageTypeEnum("type").notNull(),
  content: text("content").notNull(),
  mediaUrl: varchar("media_url"),
  status: varchar("status").default("pending"), // pending, sent, delivered, failed
  scheduledAt: timestamp("scheduled_at"),
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  externalId: varchar("external_id"), // OneMsg.io message ID
  createdAt: timestamp("created_at").defaultNow(),
});

// Message templates
export const messageTemplates = pgTable("message_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name").notNull(),
  type: messageTypeEnum("type").notNull(),
  content: text("content").notNull(),
  mediaUrl: varchar("media_url"),
  variables: text("variables").array(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Funnel executions (tracking user progress through funnels)
export const funnelExecutions = pgTable("funnel_executions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  funnelId: varchar("funnel_id").notNull().references(() => funnels.id, { onDelete: "cascade" }),
  contactId: varchar("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
  currentNodeId: varchar("current_node_id"),
  status: varchar("status").default("active"), // active, completed, stopped
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  data: jsonb("data"), // Store execution state
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  whatsappConnections: many(whatsappConnections),
  funnels: many(funnels),
  contacts: many(contacts),
  messages: many(messages),
}));

export const whatsappConnectionsRelations = relations(whatsappConnections, ({ one }) => ({
  user: one(users, { fields: [whatsappConnections.userId], references: [users.id] }),
}));

export const funnelsRelations = relations(funnels, ({ one, many }) => ({
  user: one(users, { fields: [funnels.userId], references: [users.id] }),
  nodes: many(funnelNodes),
  executions: many(funnelExecutions),
}));

export const funnelNodesRelations = relations(funnelNodes, ({ one }) => ({
  funnel: one(funnels, { fields: [funnelNodes.funnelId], references: [funnels.id] }),
}));

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  user: one(users, { fields: [contacts.userId], references: [users.id] }),
  messages: many(messages),
  funnelExecutions: many(funnelExecutions),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  contact: one(contacts, { fields: [messages.contactId], references: [contacts.id] }),
  user: one(users, { fields: [messages.userId], references: [users.id] }),
}));

export const funnelExecutionsRelations = relations(funnelExecutions, ({ one }) => ({
  funnel: one(funnels, { fields: [funnelExecutions.funnelId], references: [funnels.id] }),
  contact: one(contacts, { fields: [funnelExecutions.contactId], references: [contacts.id] }),
}));

// Insert schemas
export const insertFunnelSchema = createInsertSchema(funnels).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export const insertWhatsappConnectionSchema = createInsertSchema(whatsappConnections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFunnelExecutionSchema = createInsertSchema(funnelExecutions).omit({
  id: true,
  startedAt: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type Funnel = typeof funnels.$inferSelect;
export type InsertFunnel = z.infer<typeof insertFunnelSchema>;
export type FunnelNode = typeof funnelNodes.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type WhatsappConnection = typeof whatsappConnections.$inferSelect;
export type InsertWhatsappConnection = z.infer<typeof insertWhatsappConnectionSchema>;
export type FunnelExecution = typeof funnelExecutions.$inferSelect;
export type InsertFunnelExecution = z.infer<typeof insertFunnelExecutionSchema>;
