import React, { useCallback, useRef, useMemo, memo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  BackgroundVariant,
  NodeTypes,
  useReactFlow,
  ReactFlowProvider,
  ConnectionMode,
} from 'reactflow';
import 'reactflow/dist/style.css';
import FunnelNode from './funnel-node';

interface FunnelCanvasProps {
  data: {
    nodes: Array<{
      id: string;
      type: string;
      position: { x: number; y: number };
      data: any;
    }>;
    edges: Array<{
      id: string;
      source: string;
      target: string;
    }>;
    triggerPhrases?: string[];
  };
  onDataChange: (data: any) => void;
  onNodeSelect: (node: any) => void;
}

const MemoizedFunnelNode = memo(FunnelNode);

const nodeTypes: NodeTypes = {
  funnelNode: MemoizedFunnelNode,
};

function FunnelCanvasInner({ data, onDataChange, onNodeSelect }: FunnelCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const reactFlowInstance = useReactFlow();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const prevDataRef = useRef<any>(null);
  const prevNodesRef = useRef<Node[]>([]);
  const prevEdgesRef = useRef<Edge[]>([]);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const saveToParent = useCallback((newNodes: Node[], newEdges: Edge[]) => {
    if (!Array.isArray(newNodes) || !Array.isArray(newEdges)) return;
    
    // Check if data actually changed
    const dataChanged = prevNodesRef.current.length !== newNodes.length ||
      prevEdgesRef.current.length !== newEdges.length ||
      JSON.stringify(prevNodesRef.current) !== JSON.stringify(newNodes) ||
      JSON.stringify(prevEdgesRef.current) !== JSON.stringify(newEdges);
    
    if (!dataChanged) return;
    
    prevNodesRef.current = newNodes;
    prevEdgesRef.current = newEdges;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      onDataChange({
        nodes: newNodes,
        edges: newEdges,
      });
    }, 1000); // 1 second debounce for performance
  }, [onDataChange]);

  React.useEffect(() => {
    // Only sync if data from parent actually changed
    const dataStringified = JSON.stringify({ nodes: data.nodes, edges: data.edges, triggerPhrases: data.triggerPhrases });
    const prevDataStringified = prevDataRef.current ? JSON.stringify(prevDataRef.current) : null;
    
    if (dataStringified === prevDataStringified) return;
    prevDataRef.current = { nodes: data.nodes, edges: data.edges, triggerPhrases: data.triggerPhrases };
    
    if (data.nodes.length === 0) {
      if (initializedRef.current) return;
      
      const isAnyMessage = data.triggerPhrases && (
        data.triggerPhrases.includes('*') ||
        data.triggerPhrases.some(p => p.trim() === '*' || p.trim().toLowerCase() === '__any__' || p.trim().toLowerCase() === 'qualquer mensagem')
      );

      const phrasesText = isAnyMessage
        ? 'Qualquer mensagem'
        : (data.triggerPhrases && data.triggerPhrases.length > 0
          ? data.triggerPhrases.filter(p => p.trim()).map(p => `"${p}"`).join(', ')
          : null);
      
      const initialNodes: Node[] = [
        {
          id: 'start',
          type: 'funnelNode',
          position: { x: 100, y: 50 },
          data: { 
            label: 'Início',
            nodeType: 'trigger',
            content: phrasesText ? `Gatilho: ${phrasesText}` : 'Clique para configurar frases de gatilho',
            icon: 'play'
          },
        },
        {
          id: 'message1',
          type: 'funnelNode',
          position: { x: 100, y: 200 },
          data: { 
            label: 'Mensagem Texto',
            nodeType: 'message',
            content: 'Clique para editar esta mensagem...',
            delayMinutes: 0,
            icon: 'message'
          },
        },
      ];

      const initialEdges: Edge[] = [
        {
          id: 'start-message1',
          source: 'start',
          target: 'message1',
          animated: true,
        },
      ];

      setNodes(initialNodes);
      setEdges(initialEdges);
      prevNodesRef.current = initialNodes;
      prevEdgesRef.current = initialEdges;
      initializedRef.current = true;
    } else if (data.nodes.length > 0) {
      const formattedNodes = data.nodes.map(dataNode => ({
        ...dataNode,
        type: 'funnelNode',
        data: {
          ...dataNode.data,
          nodeType: dataNode.data.nodeType || dataNode.type,
        }
      }));
      
      setNodes(formattedNodes);
      setEdges(data.edges.map(e => ({ ...e, animated: true })));
      prevNodesRef.current = formattedNodes;
      prevEdgesRef.current = data.edges.map(e => ({ ...e, animated: true }));
      initializedRef.current = true;
    }
  }, [data.nodes, data.edges, data.triggerPhrases, setNodes, setEdges]);

  React.useEffect(() => {
    const isAnyMessage = data.triggerPhrases && (
      data.triggerPhrases.includes('*') ||
      data.triggerPhrases.some(p => p.trim() === '*' || p.trim().toLowerCase() === '__any__' || p.trim().toLowerCase() === 'qualquer mensagem')
    );

    const phrasesText = isAnyMessage
      ? 'Qualquer mensagem'
      : (data.triggerPhrases && data.triggerPhrases.length > 0
        ? data.triggerPhrases.filter(p => p.trim()).map(p => `"${p}"`).join(', ')
        : null);
    
    setNodes(currentNodes => {
      return currentNodes.map(node => {
        if (node.id === 'start' || node.data.nodeType === 'trigger') {
          return {
            ...node,
            data: {
              ...node.data,
              content: phrasesText ? `Gatilho: ${phrasesText}` : 'Clique para configurar frases de gatilho',
            }
          };
        }
        return node;
      });
    });
  }, [data.triggerPhrases]);

  const handleNodesChange = useCallback((changes: any) => {
    onNodesChange(changes);
  }, [onNodesChange]);

  const handleEdgesChange = useCallback((changes: any) => {
    onEdgesChange(changes);
  }, [onEdgesChange]);

  React.useEffect(() => {
    // Debounce saveToParent to prevent excessive updates
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    debounceTimerRef.current = setTimeout(() => {
      saveToParent(nodes, edges);
    }, 100);
    
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [nodes, edges, saveToParent]);

  const onConnect = useCallback(
    (params: Connection) => {
      const newEdge = { ...params, animated: true };
      setEdges(currentEdges => {
        // Find existing edge from same source
        const existingEdgeIndex = currentEdges.findIndex(e => e.source === params.source && e.sourceHandle === params.sourceHandle);
        if (existingEdgeIndex !== -1) {
          const newEdges = [...currentEdges];
          newEdges[existingEdgeIndex] = { ...newEdges[existingEdgeIndex], target: params.target!, targetHandle: params.targetHandle! };
          return newEdges;
        }
        return addEdge(newEdge, currentEdges);
      });
    },
    [setEdges]
  );

  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      onNodeSelect({
        id: node.id,
        type: node.data.nodeType,
        position: node.position,
        data: node.data,
      });
    },
    [onNodeSelect]
  );

  const onEdgeClick = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      setEdges(currentEdges => {
        return currentEdges.filter(e => e.id !== edge.id);
      });
    },
    []
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const nodeType = event.dataTransfer.getData('application/reactflow');

      if (!nodeType) {
        return;
      }

      if (!reactFlowWrapper.current) {
        return;
      }

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNodeId = `${nodeType}_${Date.now()}`;
      const nodeData = {
        label: '',
        nodeType,
        content: getDefaultContent(nodeType),
        icon: getNodeIcon(nodeType),
        delayMinutes: nodeType === 'delay' ? 5 : 0,
        delayValue: nodeType === 'delay' ? 5 : undefined,
        delayUnit: nodeType === 'delay' ? 'minuto' : undefined,
        waitForReply: false,
      };
      nodeData.label = getNodeLabel(nodeType, nodeData);

      const newNode: Node = {
        id: newNodeId,
        type: 'funnelNode',
        position,
        data: nodeData,
      };

      setNodes(currentNodes => [...currentNodes, newNode]);
    },
    [reactFlowInstance]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const getNodeLabel = (nodeType: string, nodeData?: any): string => {
    const labels: Record<string, string> = {
      message: 'Mensagem Texto',
      image: 'Imagem',
      video: 'Vídeo',
      audio: 'Áudio',
      document: 'Documento',
      location: 'Localização',
      condition: 'Condição',
      delay: 'Esperar',
      question: 'Pergunta',
      tag: 'Tag',
      verify: 'Verificar',
    };
    
    return labels[nodeType] || nodeType;
  };

  const getDefaultContent = (nodeType: string): string => {
    const defaults: Record<string, string> = {
      message: 'Digite sua mensagem aqui...',
      image: '',
      video: '',
      audio: '',
      document: '',
      location: '',
      delay: 'Aguardar 5 minutos',
      condition: 'Se condição for verdadeira...',
      question: 'Qual é sua pergunta?',
      tag: 'Adicionar tag ao contato',
      verify: 'Verificar condição',
    };
    return defaults[nodeType] || 'Configurar este nó...';
  };

  const getNodeIcon = (nodeType: string): string => {
    const icons: Record<string, string> = {
      message: 'message',
      image: 'image',
      video: 'video',
      audio: 'music',
      document: 'file',
      location: 'map-pin',
      condition: 'git-branch',
      delay: 'clock',
      question: 'help-circle',
      tag: 'tag',
      verify: 'check-circle',
    };
    return icons[nodeType] || 'circle';
  };

  const defaultEdgeOptions = useMemo(() => ({
    animated: true,
  }), []);

  return (
    <div ref={reactFlowWrapper} className="w-full h-full" data-testid="funnel-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onDrop={onDrop}
        onDragOver={onDragOver}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        className="bg-background"
        connectionMode={ConnectionMode.Loose}
        connectionRadius={30}
        deleteKeyCode={['Backspace', 'Delete']}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={defaultEdgeOptions}
        snapToGrid={true}
        snapGrid={[15, 15]}
        panOnScroll={false}
        selectionOnDrag={false}
        panOnDrag={[0, 1, 2]}
        zoomOnScroll={true}
        zoomOnDoubleClick={true}
        minZoom={0.1}
        maxZoom={2}
      >
        <Controls className="bg-card border-border" />
        <Background 
          variant={BackgroundVariant.Dots} 
          gap={20} 
          size={1}
          color="hsl(240, 6%, 25%)"
        />
      </ReactFlow>
    </div>
  );
}

export default function FunnelCanvas(props: FunnelCanvasProps) {
  return (
    <ReactFlowProvider>
      <FunnelCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
