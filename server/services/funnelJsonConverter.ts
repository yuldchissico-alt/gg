import type { FunnelJSON, FunnelNode as ImportedNode } from "@shared/funnel-json-types";

interface ReactFlowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    label: string;
    content?: string;
    delay?: number;
    buttons?: Array<{ id: string; text: string; next: string }>;
    cta?: { text: string; url: string };
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
    nodeType?: string;
  };
}

interface ReactFlowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  type?: string;
}

interface FlowData {
  nodes: ReactFlowNode[];
  edges: ReactFlowEdge[];
}

export function convertFunnelJSONToFlowData(funnelJSON: FunnelJSON): FlowData {
  const nodes: ReactFlowNode[] = [];
  const edges: ReactFlowEdge[] = [];
  const nodePositions = new Map<string, { x: number; y: number }>();

  const startNodeId = funnelJSON.settings.start_node;
  calculateNodePositions(funnelJSON.nodes, startNodeId, nodePositions, funnelJSON.connections);

  funnelJSON.nodes.forEach((node) => {
    const position = nodePositions.get(node.id) || { x: 250, y: 100 };
    
    const reactFlowNode: ReactFlowNode = {
      id: node.id,
      type: mapNodeType(node.type),
      position,
      data: {
        label: node.title,
        content: node.content,
        nodeType: node.type,
      },
    };

    if (node.delay !== undefined) {
      reactFlowNode.data.delay = node.delay;
    }

    if (node.buttons) {
      reactFlowNode.data.buttons = node.buttons;
      
      node.buttons.forEach((button, index) => {
        edges.push({
          id: `${node.id}-${button.id}`,
          source: node.id,
          target: button.next,
          label: button.text,
          type: 'smoothstep',
        });
      });
    }

    if (node.cta) {
      reactFlowNode.data.cta = node.cta;
    }

    if (node.price) {
      reactFlowNode.data.price = node.price;
    }

    if (node.agent_name) {
      reactFlowNode.data.agent_name = node.agent_name;
    }

    if (node.agent_phone) {
      reactFlowNode.data.agent_phone = node.agent_phone;
    }

    if (node.type === 'conditional') {
      reactFlowNode.data.condition_field = node.condition_field;
      reactFlowNode.data.condition_operator = node.condition_operator;
      reactFlowNode.data.condition_value = node.condition_value;
      reactFlowNode.data.true_next = node.true_next;
      reactFlowNode.data.false_next = node.false_next;

      if (node.true_next) {
        edges.push({
          id: `${node.id}-true`,
          source: node.id,
          target: node.true_next,
          label: 'Verdadeiro',
          type: 'smoothstep',
        });
      }

      if (node.false_next) {
        edges.push({
          id: `${node.id}-false`,
          source: node.id,
          target: node.false_next,
          label: 'Falso',
          type: 'smoothstep',
        });
      }
    }

    if (node.form_fields) {
      reactFlowNode.data.form_fields = node.form_fields;
    }

    if (node.image_url) {
      reactFlowNode.data.image_url = node.image_url;
    }

    nodes.push(reactFlowNode);
  });

  if (funnelJSON.connections) {
    funnelJSON.connections.forEach((conn, index) => {
      const edgeExists = edges.some(
        (edge) => edge.source === conn.from && edge.target === conn.to
      );

      if (!edgeExists) {
        edges.push({
          id: `conn-${index}`,
          source: conn.from,
          target: conn.to,
          label: conn.via,
          type: 'smoothstep',
        });
      }
    });
  }

  return { nodes, edges };
}

function mapNodeType(type: string): string {
  const typeMap: Record<string, string> = {
    'message': 'message',
    'product': 'message',
    'form': 'question',
    'conditional': 'condition',
    'transfer': 'message',
    'wait': 'delay',
    'end': 'message',
  };

  return typeMap[type] || 'message';
}

function calculateNodePositions(
  nodes: ImportedNode[],
  startNodeId: string,
  positions: Map<string, { x: number; y: number }>,
  connections?: Array<{ from: string; to: string }>
) {
  const visited = new Set<string>();
  const levelMap = new Map<string, number>();
  const nodesByLevel = new Map<number, string[]>();

  const nodeMap = new Map<string, ImportedNode>();
  nodes.forEach(node => nodeMap.set(node.id, node));

  const adjacencyList = new Map<string, string[]>();
  
  nodes.forEach(node => {
    const nexts: string[] = [];
    
    if (node.buttons) {
      node.buttons.forEach((btn) => nexts.push(btn.next));
    }

    if (node.type === 'conditional') {
      if (node.true_next) nexts.push(node.true_next);
      if (node.false_next) nexts.push(node.false_next);
    }
    
    adjacencyList.set(node.id, nexts);
  });

  if (connections) {
    connections.forEach(conn => {
      const existing = adjacencyList.get(conn.from) || [];
      if (!existing.includes(conn.to)) {
        existing.push(conn.to);
      }
      adjacencyList.set(conn.from, existing);
    });
  }

  function assignLevel(nodeId: string, level: number) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    levelMap.set(nodeId, level);

    if (!nodesByLevel.has(level)) {
      nodesByLevel.set(level, []);
    }
    nodesByLevel.get(level)!.push(nodeId);

    const nextNodes = adjacencyList.get(nodeId) || [];
    nextNodes.forEach((nextId) => {
      assignLevel(nextId, level + 1);
    });
  }

  assignLevel(startNodeId, 0);

  const verticalSpacing = 200;
  const horizontalSpacing = 300;

  nodesByLevel.forEach((nodeIds, level) => {
    const yPosition = level * verticalSpacing + 100;
    const totalWidth = (nodeIds.length - 1) * horizontalSpacing;
    const startX = 250 - totalWidth / 2;

    nodeIds.forEach((nodeId, index) => {
      positions.set(nodeId, {
        x: startX + index * horizontalSpacing,
        y: yPosition,
      });
    });
  });

  nodes.forEach((node) => {
    if (!positions.has(node.id)) {
      positions.set(node.id, {
        x: 250 + Math.random() * 200,
        y: 100 + Math.random() * 300,
      });
    }
  });
}
