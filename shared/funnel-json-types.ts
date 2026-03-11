import { z } from "zod";

export type NodeType = 
  | "message" 
  | "product" 
  | "form" 
  | "conditional" 
  | "transfer" 
  | "wait" 
  | "end";

export interface FunnelButton {
  id: string;
  text: string;
  next: string;
}

export interface FunnelCTA {
  text: string;
  url: string;
}

export interface FunnelNode {
  id: string;
  type: NodeType;
  title: string;
  content: string;
  delay?: number;
  buttons?: FunnelButton[];
  cta?: FunnelCTA;
  price?: string;
  agent_name?: string;
  agent_phone?: string;
  condition_field?: string;
  condition_operator?: string;
  condition_value?: string;
  true_next?: string;
  false_next?: string;
  form_fields?: string[];
  image_url?: string;
}

export interface FunnelConnection {
  from: string;
  to: string;
  via?: string;
}

export interface FunnelSettings {
  start_node: string;
  theme_color?: string;
  accent_color?: string;
  enable_notifications?: boolean;
}

export interface FunnelMeta {
  tags?: string[];
  author?: string;
  language?: string;
}

export interface FunnelJSON {
  funnel_name: string;
  description: string;
  created_at?: string;
  version?: string;
  settings: FunnelSettings;
  nodes: FunnelNode[];
  connections?: FunnelConnection[];
  meta?: FunnelMeta;
}

export const funnelButtonSchema = z.object({
  id: z.string(),
  text: z.string(),
  next: z.string(),
});

export const funnelCTASchema = z.object({
  text: z.string(),
  url: z.string().url(),
});

export const funnelNodeSchema = z.object({
  id: z.string(),
  type: z.enum(["message", "product", "form", "conditional", "transfer", "wait", "end"]),
  title: z.string(),
  content: z.string(),
  delay: z.number().optional(),
  buttons: z.array(funnelButtonSchema).optional(),
  cta: funnelCTASchema.optional(),
  price: z.string().optional(),
  agent_name: z.string().optional(),
  agent_phone: z.string().optional(),
  condition_field: z.string().optional(),
  condition_operator: z.string().optional(),
  condition_value: z.string().optional(),
  true_next: z.string().optional(),
  false_next: z.string().optional(),
  form_fields: z.array(z.string()).optional(),
  image_url: z.string().url().optional(),
});

export const funnelConnectionSchema = z.object({
  from: z.string(),
  to: z.string(),
  via: z.string().optional(),
});

export const funnelSettingsSchema = z.object({
  start_node: z.string(),
  theme_color: z.string().optional(),
  accent_color: z.string().optional(),
  enable_notifications: z.boolean().optional(),
});

export const funnelMetaSchema = z.object({
  tags: z.array(z.string()).optional(),
  author: z.string().optional(),
  language: z.string().optional(),
});

export const funnelJSONSchema = z.object({
  funnel_name: z.string(),
  description: z.string(),
  created_at: z.string().optional(),
  version: z.string().optional(),
  settings: funnelSettingsSchema,
  nodes: z.array(funnelNodeSchema),
  connections: z.array(funnelConnectionSchema).optional(),
  meta: funnelMetaSchema.optional(),
});

export function validateFunnelJSON(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  try {
    funnelJSONSchema.parse(data);
  } catch (err: any) {
    if (err.errors) {
      err.errors.forEach((error: any) => {
        errors.push(`${error.path.join('.')}: ${error.message}`);
      });
    }
    return { valid: false, errors };
  }

  const nodeIds = new Set<string>();
  const buttonIds = new Set<string>();

  for (const node of data.nodes) {
    if (nodeIds.has(node.id)) {
      errors.push(`ID de nó duplicado: ${node.id}`);
    }
    nodeIds.add(node.id);

    if (node.buttons) {
      for (const button of node.buttons) {
        const fullButtonId = `${node.id}-${button.id}`;
        if (buttonIds.has(fullButtonId)) {
          errors.push(`ID de botão duplicado: ${button.id} no nó ${node.id}`);
        }
        buttonIds.add(fullButtonId);
      }
    }
  }

  for (const node of data.nodes) {
    if (node.buttons) {
      for (const button of node.buttons) {
        if (!nodeIds.has(button.next)) {
          errors.push(`Botão "${button.text}" no nó ${node.id} referencia nó inexistente: ${button.next}`);
        }
      }
    }

    if (node.type === 'conditional') {
      if (node.true_next && !nodeIds.has(node.true_next)) {
        errors.push(`Nó condicional ${node.id} referencia true_next inexistente: ${node.true_next}`);
      }
      if (node.false_next && !nodeIds.has(node.false_next)) {
        errors.push(`Nó condicional ${node.id} referencia false_next inexistente: ${node.false_next}`);
      }
    }
  }

  if (!nodeIds.has(data.settings.start_node)) {
    errors.push(`start_node referencia nó inexistente: ${data.settings.start_node}`);
  }

  if (data.connections) {
    for (const conn of data.connections) {
      if (!nodeIds.has(conn.from)) {
        errors.push(`Conexão referencia nó de origem inexistente: ${conn.from}`);
      }
      if (!nodeIds.has(conn.to)) {
        errors.push(`Conexão referencia nó de destino inexistente: ${conn.to}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
