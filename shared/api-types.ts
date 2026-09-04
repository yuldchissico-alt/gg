// API Response Types for React Query

export interface WeeklyDataPoint {
  name: string;
  mensagens: number;
  contatos: number;
  conversoes: number;
}

export interface OngoingExecution {
  id: string;
  contactId: string;
  funnelId: string;
  contactName: string;
  phoneNumber: string;
  funnelName: string;
  startedAt: string;
}

export interface DashboardAnalytics {
  totalFunnels: number;
  activeFunnels: number;
  todayMessages: number;
  activeContacts: number;
  totalContacts: number;
  deliveryRate: number;
  sentMessages: number;
  deliveredMessages: number;
  totalMessages: number;
  weeklyData?: WeeklyDataPoint[];
  yesterdayMessages: number;
  yesterdayDeliveryRate: number;
  yesterdaySentMessages: number;
  ongoingExecutions?: OngoingExecution[];
  activeNumbers?: string[];
}

export interface WhatsAppStatus {
  connected: boolean;
  phoneNumber?: string;
  status?: string;
  qrCode?: string;
  error?: string;
}

export interface ContactListResponse {
  flatMap: (mapper: (contact: any) => any[]) => any[];
  filter: (predicate: (contact: any) => boolean) => any[];
  [index: number]: any;
}

export interface AnalyticsResponse {
  filter: (predicate: (item: any) => boolean) => any[];
  totalFunnels: number;
  activeFunnels: number;
  totalMessages: number;
  todayMessages: number;
  totalContacts: number;
  activeContacts: number;
  deliveryRate?: number;
  deliveredMessages: number;
  sentMessages: number;
  schedulerTasks: any[];
}

export interface Contact {
  id: string;
  phoneNumber: string;
  name?: string;
  email?: string;
  tags: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ContactsResponse = Contact[];

export interface Campaign {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'paused' | 'inactive' | 'draft';
  triggerPhrase: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CampaignsResponse = Campaign[];

export interface MessageTemplate {
  id: string;
  name: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'location';
  content: string;
  mediaUrl?: string;
  variables: string[];
  createdAt: string;
  updatedAt: string;
}

export type TemplatesResponse = MessageTemplate[];

// New types for expanded schema

export interface UserSettingsResponse {
  id: string;
  userId: string;
  timezone: string;
  notificationsEnabled: boolean;
  autoReplyEnabled: boolean;
  autoReplyMessage?: string;
  businessHoursStart: string;
  businessHoursEnd: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogResponse {
  id: string;
  userId: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  details?: any;
  ipAddress?: string;
  createdAt: string;
}

export interface NotificationResponse {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  actionUrl?: string;
  createdAt: string;
}

export interface ConversationMessageResponse {
  id: string;
  userId: string;
  contactId: string;
  direction: 'inbound' | 'outbound';
  type: string;
  content: string;
  mediaUrl?: string;
  externalId?: string;
  status: string;
  metadata?: any;
  createdAt: string;
}

export interface TagResponse {
  id: string;
  userId: string;
  name: string;
  color: string;
  createdAt: string;
}
