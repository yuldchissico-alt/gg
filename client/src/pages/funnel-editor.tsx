import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useRoute, useLocation } from "wouter";
import type { Funnel } from "@shared/schema";
import Sidebar from "@/components/sidebar";
import FunnelCanvas from "@/components/funnel-canvas";
import WhatsAppPreview from "@/components/whatsapp-preview";
import LocationPicker from "@/components/location-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { 
  Save, 
  Eye, 
  MessageSquare, 
  Image, 
  Video, 
  Mic, 
  FileText, 
  MapPin,
  GitBranch,
  Clock,
  HelpCircle,
  Tag,
  CheckCircle,
  ArrowLeft,
  X
} from "lucide-react";

interface LocationData {
  latitude: number;
  longitude: number;
  address: string;
}

interface FunnelNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    label?: string;
    content?: string;
    mediaUrl?: string;
    mediaFileName?: string;
    delayMinutes?: number;
    delayValue?: number;
    delayUnit?: 'segundo' | 'minuto' | 'hora';
    waitForReply?: boolean;
    nodeType?: string;
    icon?: string;
    location?: LocationData;
  };
}

interface FunnelData {
  nodes: FunnelNode[];
  edges: Array<{
    id: string;
    source: string;
    target: string;
  }>;
}

export default function FunnelEditor() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/funnel-editor/:id");
  const funnelId = params?.id;
  
  const [selectedNode, setSelectedNode] = useState<FunnelNode | null>(null);
  const [funnelData, setFunnelData] = useState<FunnelData>({ nodes: [], edges: [] });
  const [funnelName, setFunnelName] = useState("Novo Funil");
  const [funnelStatus, setFunnelStatus] = useState("draft");
  const [triggerPhrases, setTriggerPhrases] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  const { data: funnel, isLoading } = useQuery<Funnel>({
    queryKey: ["/api/funnels", funnelId],
    enabled: !!funnelId,
  });

  useEffect(() => {
    if (funnel) {
      setFunnelName(funnel.name);
      setFunnelStatus(funnel.status || 'draft');
      setTriggerPhrases(funnel.triggerPhrases || []);
      if (funnel.flowData && typeof funnel.flowData === 'object') {
        setFunnelData(funnel.flowData as FunnelData);
      }
    }
  }, [funnel]);

  const saveFunnelMutation = useMutation({
    mutationFn: async () => {
      if (!funnelId) {
        throw new Error("ID do funil não encontrado");
      }
      
      console.log("💾 Salvando funil no cliente...", { 
        funnelName, 
        funnelStatus, 
        triggerPhrases, 
        flowData: funnelData,
        nodeCount: funnelData.nodes.length 
      });
      
      const response = await apiRequest("PUT", `/api/funnels/${funnelId}`, {
        name: funnelName,
        status: funnelStatus,
        triggerPhrases: triggerPhrases,
        flowData: funnelData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Erro ao salvar funil");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      console.log("✅ Funil salvo com sucesso!", data);
      if (data && data.flowData) {
        console.log(`📦 Funil salvo no servidor com ${data.flowData.nodes?.length || 0} nós`);
      }
      toast({
        title: "✅ Funil Salvo com Sucesso!",
        description: "Seu funil foi atualizado no banco de dados!",
        duration: 3000,
      });
      queryClient.setQueryData(["/api/funnels", funnelId], data);
      queryClient.invalidateQueries({ queryKey: ["/api/funnels"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/dashboard"] });
    },
    onError: (error: any) => {
      console.error("❌ Erro ao salvar:", error);
      toast({
        title: "❌ Erro ao Salvar",
        description: error?.message || "Falha ao salvar funil. Tente novamente.",
        variant: "destructive",
        duration: 3000,
      });
    },
  });

  const handleNodeSelect = (node: FunnelNode | null) => {
    setSelectedNode(node);
  };

  const handleFunnelDataChange = (newData: FunnelData) => {
    setFunnelData(newData);
  };

  const handlePreviewFunnel = () => {
    if (funnelData.nodes.length === 0) {
      toast({
        title: "Funil Vazio",
        description: "Adicione alguns elementos ao funil antes de visualizar",
        variant: "destructive",
        duration: 2000,
      });
      return;
    }
    setShowPreview(true);
  };

  const toggleFunnelStatus = () => {
    const newStatus = funnelStatus === 'active' ? 'draft' : 'active';
    setFunnelStatus(newStatus);
    // Automatically save when status is toggled to ensure sync
    saveFunnelMutation.mutate();
  };

  const handleSaveFunnel = () => {
    if (!funnelName.trim()) {
      toast({
        title: "Nome Obrigatório",
        description: "Digite um nome para o funil",
        variant: "destructive",
        duration: 2000,
      });
      return;
    }
    saveFunnelMutation.mutate();
  };

  const updateNodeContent = (content: string) => {
    if (!selectedNode) return;
    
    // Create updated data
    const updatedData = { ...selectedNode.data, content };
    
    const updatedNodes = funnelData.nodes.map(node => 
      node.id === selectedNode.id 
        ? { ...node, data: updatedData }
        : node
    );
    
    console.log("📝 Atualizando conteúdo localmente:", { nodeId: selectedNode.id, content });
    setFunnelData({ ...funnelData, nodes: updatedNodes });
    setSelectedNode({ ...selectedNode, data: updatedData });
  };

  const updateNodeDelay = (delayValue: number, delayUnit: 'segundo' | 'minuto' | 'hora' = 'minuto') => {
    if (!selectedNode) return;
    
    let delayMinutes = delayValue;
    if (delayUnit === 'segundo') {
      delayMinutes = delayValue / 60;
    } else if (delayUnit === 'hora') {
      delayMinutes = delayValue * 60;
    }

    // Create updated data
    const updatedData = { 
      ...selectedNode.data, 
      delayValue, 
      delayUnit, 
      delayMinutes, 
      content: `Aguardar ${delayValue} ${delayUnit}(s)`,
      waitForReply: false 
    };
    
    const updatedNodes = funnelData.nodes.map(node => 
      node.id === selectedNode.id 
        ? { ...node, data: updatedData }
        : node
    );
    
    setFunnelData({ ...funnelData, nodes: updatedNodes });
    setSelectedNode({ ...selectedNode, data: updatedData });
  };

  const updateNodeDelayMode = (waitForReply: boolean) => {
    if (!selectedNode) return;

    const delayVal = selectedNode.data.delayValue || 5;
    const delayU = selectedNode.data.delayUnit || 'minuto';

    const content = waitForReply
      ? 'Aguardar resposta do cliente'
      : `Aguardar ${delayVal} ${delayU}(s)`;

    const updatedData = {
      ...selectedNode.data,
      waitForReply,
      content,
    };

    const updatedNodes = funnelData.nodes.map(node =>
      node.id === selectedNode.id
        ? { ...node, data: updatedData }
        : node
    );

    setFunnelData({ ...funnelData, nodes: updatedNodes });
    setSelectedNode({ ...selectedNode, data: updatedData });
  };

  const updateNodeMediaUrl = (mediaUrl: string, mediaFileName?: string) => {
    if (!selectedNode) return;
    
    const updatedData = { ...selectedNode.data, mediaUrl };
    if (mediaFileName) {
      updatedData.mediaFileName = mediaFileName;
    }
    
    const updatedNodes = funnelData.nodes.map(node => 
      node.id === selectedNode.id 
        ? { ...node, data: updatedData }
        : node
    );
    
    setFunnelData({ ...funnelData, nodes: updatedNodes });
    setSelectedNode({ ...selectedNode, data: updatedData });
  };

  const updateNodeLocation = (location: LocationData) => {
    if (!selectedNode) return;
    
    // Create updated data
    const updatedData = { ...selectedNode.data, location, nodeType: selectedNode.data.nodeType || 'location' };
    
    const updatedNodes = funnelData.nodes.map(node => 
      node.id === selectedNode.id 
        ? { ...node, data: updatedData }
        : node
    );
    
    setFunnelData({ ...funnelData, nodes: updatedNodes });
    setSelectedNode({ ...selectedNode, data: updatedData });
  };

  const deleteNode = () => {
    if (!selectedNode) return;
    
    // Prevent deletion of start and trigger nodes
    if (selectedNode.id === 'start' || selectedNode.data.nodeType === 'trigger') {
      toast({
        title: "Ação não permitida",
        description: "Este elemento não pode ser excluído",
        variant: "destructive",
        duration: 2000,
      });
      return;
    }
    
    const updatedNodes = funnelData.nodes.filter(node => node.id !== selectedNode.id);
    const updatedEdges = funnelData.edges.filter(
      edge => edge.source !== selectedNode.id && edge.target !== selectedNode.id
    );
    
    setFunnelData({ ...funnelData, nodes: updatedNodes, edges: updatedEdges });
    setSelectedNode(null);
    
    toast({
      title: "Elemento Removido",
      description: "O elemento foi excluído do funil",
      duration: 2000,
    });
  };

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };


  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedNode) return;

    const nodeType = selectedNode.data.nodeType;
    const maxSizeMB = nodeType === 'image' ? 5 : nodeType === 'audio' ? 10 : nodeType === 'video' ? 50 : 20;
    const maxSizeBytes = maxSizeMB * 1024 * 1024;

    if (file.size > maxSizeBytes) {
      toast({
        title: "Arquivo muito grande",
        description: `O tamanho máximo para ${nodeType} é ${maxSizeMB}MB`,
        variant: "destructive",
        duration: 2000,
      });
      return;
    }

    // For all files (image, video, audio, document), read as data URL
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      updateNodeMediaUrl(dataUrl, file.name);
      
      const mediaTypeNames: Record<string, string> = {
        document: 'Documento',
        audio: 'Áudio',
        image: 'Imagem',
        video: 'Vídeo'
      };
      const mediaTypeName = nodeType && mediaTypeNames[nodeType] ? mediaTypeNames[nodeType] : 'Arquivo';
      
      toast({
        title: `✅ ${mediaTypeName} Adicionado`,
        description: `${file.name} foi anexado ao nó`,
        duration: 2000,
      });
    };
    reader.onerror = () => {
      toast({
        title: "❌ Erro",
        description: `Falha ao carregar o arquivo`,
        variant: "destructive",
        duration: 2000,
      });
    };
    reader.readAsDataURL(file);
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando funil...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#1a1a1a]">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="bg-black border-b border-[#333] px-3 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 sm:space-x-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setLocation("/funnel-builder")}
                className="text-gray-400 hover:text-white"
                data-testid="button-back"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h2 className="text-base sm:text-xl font-semibold text-white" data-testid="text-page-title">
                  Editor de Funil
                </h2>
                <p className="text-xs sm:text-sm text-gray-400 hidden sm:block">
                  Construa seu fluxo de mensagens automatizadas
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <div className="flex items-center gap-2 bg-[#1a1a1a] px-3 py-1.5 rounded-full border border-border">
                <div className={`h-2 w-2 rounded-full ${funnelStatus === 'active' ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
                <span className="text-xs font-medium text-gray-300">
                  {funnelStatus === 'active' ? 'Ativo' : 'Pausado'}
                </span>
                <Button 
                  size="sm"
                  variant="ghost"
                  onClick={toggleFunnelStatus}
                  className={`h-7 px-2 text-xs font-bold transition-all ${
                    funnelStatus === 'active' 
                    ? 'text-red-400 hover:text-red-300 hover:bg-red-900/20' 
                    : 'text-green-400 hover:text-green-300 hover:bg-green-900/20'
                  }`}
                  data-testid="button-toggle-status"
                >
                  {funnelStatus === 'active' ? 'PAUSAR' : 'ATIVAR'}
                </Button>
              </div>
              <Button 
                size="sm"
                onClick={handleSaveFunnel}
                disabled={saveFunnelMutation.isPending}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg transition-all"
                data-testid="button-save-funnel"
              >
                <Save className={`h-4 w-4 sm:mr-2 ${saveFunnelMutation.isPending ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{saveFunnelMutation.isPending ? "Salvando..." : "Salvar Funil"}</span>
                <span className="sm:hidden">{saveFunnelMutation.isPending ? "Salvando..." : "Salvar"}</span>
              </Button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Toolbox - visible on all screen sizes */}
          <div className="flex flex-col w-20 sm:w-32 md:w-56 lg:w-72 bg-gradient-to-b from-[#1f1f1f] to-[#252525] border-r border-[#404040] p-2 sm:p-4 lg:p-5 overflow-y-auto flex-shrink-0">
            <div className="space-y-8">
              {/* Message Types */}
              <div>
                <h3 className="hidden sm:block text-xs font-bold text-foreground uppercase tracking-widest mb-4 pl-1">
                  Mensagens
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div 
                    className="p-3 sm:p-3 lg:p-3.5 bg-gradient-to-br from-[#2d2d2d] to-[#252525] rounded-lg cursor-grab hover:from-[#3a3a3a] hover:to-[#2d2d2d] active:from-gray-800 transition-all duration-200 border border-[#404040] hover:border-gray-500 active:cursor-grabbing overflow-hidden flex flex-col items-center shadow-md hover:shadow-lg" 
                    data-testid="tool-text"
                    draggable
                    onDragStart={(e) => onDragStart(e, 'message')}
                  >
                    <MessageSquare className="h-6 w-6 text-white mb-1.5 flex-shrink-0 drop-shadow-lg" />
                    <p className="text-xs font-semibold text-gray-200 text-center truncate w-full">Texto</p>
                  </div>
                  <div 
                    className="p-3 sm:p-3 lg:p-3.5 bg-gradient-to-br from-[#2d2d2d] to-[#252525] rounded-lg cursor-grab hover:from-[#3a3a3a] hover:to-[#2d2d2d] active:from-gray-800 transition-all duration-200 border border-[#404040] hover:border-gray-500 active:cursor-grabbing overflow-hidden flex flex-col items-center shadow-md hover:shadow-lg" 
                    data-testid="tool-image"
                    draggable
                    onDragStart={(e) => onDragStart(e, 'image')}
                  >
                    <Image className="h-6 w-6 text-white mb-1.5 flex-shrink-0 drop-shadow-lg" />
                    <p className="text-xs font-semibold text-gray-200 text-center truncate w-full">Imagem</p>
                  </div>
                  <div 
                    className="p-3 sm:p-3 lg:p-3.5 bg-gradient-to-br from-[#2d2d2d] to-[#252525] rounded-lg cursor-grab hover:from-[#3a3a3a] hover:to-[#2d2d2d] active:from-gray-800 transition-all duration-200 border border-[#404040] hover:border-gray-500 active:cursor-grabbing overflow-hidden flex flex-col items-center shadow-md hover:shadow-lg" 
                    data-testid="tool-video"
                    draggable
                    onDragStart={(e) => onDragStart(e, 'video')}
                  >
                    <Video className="h-6 w-6 text-white mb-1.5 flex-shrink-0 drop-shadow-lg" />
                    <p className="text-xs font-semibold text-gray-200 text-center truncate w-full">Vídeo</p>
                  </div>
                  <div 
                    className="p-3 sm:p-3 lg:p-3.5 bg-gradient-to-br from-[#2d2d2d] to-[#252525] rounded-lg cursor-grab hover:from-[#3a3a3a] hover:to-[#2d2d2d] active:from-gray-800 transition-all duration-200 border border-[#404040] hover:border-gray-500 active:cursor-grabbing overflow-hidden flex flex-col items-center shadow-md hover:shadow-lg" 
                    data-testid="tool-audio"
                    draggable
                    onDragStart={(e) => onDragStart(e, 'audio')}
                  >
                    <Mic className="h-6 w-6 text-white mb-1.5 flex-shrink-0 drop-shadow-lg" />
                    <p className="text-xs font-semibold text-gray-200 text-center truncate w-full">Audio</p>
                  </div>
                  <div 
                    className="p-3 sm:p-3 lg:p-3.5 bg-gradient-to-br from-[#2d2d2d] to-[#252525] rounded-lg cursor-grab hover:from-[#3a3a3a] hover:to-[#2d2d2d] active:from-gray-800 transition-all duration-200 border border-[#404040] hover:border-gray-500 active:cursor-grabbing overflow-hidden flex flex-col items-center shadow-md hover:shadow-lg" 
                    data-testid="tool-location"
                    draggable
                    onDragStart={(e) => onDragStart(e, 'location')}
                  >
                    <MapPin className="h-6 w-6 text-white mb-1.5 flex-shrink-0 drop-shadow-lg" />
                    <p className="text-xs font-semibold text-gray-200 text-center truncate w-full">Local</p>
                  </div>
                  
                  <div 
                    className="p-3 sm:p-3 lg:p-3.5 bg-gradient-to-br from-[#2d2d2d] to-[#252525] rounded-lg cursor-grab hover:from-[#3a3a3a] hover:to-[#2d2d2d] active:from-gray-800 transition-all duration-200 border border-[#404040] hover:border-gray-500 active:cursor-grabbing overflow-hidden flex flex-col items-center shadow-md hover:shadow-lg" 
                    data-testid="tool-document"
                    draggable
                    onDragStart={(e) => onDragStart(e, 'document')}
                  >
                    <FileText className="h-6 w-6 text-white mb-1.5 flex-shrink-0 drop-shadow-lg" />
                    <p className="text-xs font-semibold text-gray-200 text-center truncate w-full">Doc</p>
                  </div>
                </div>
              </div>
              
              {/* Logic Elements */}
              <div>
                <h3 className="hidden sm:block text-xs font-bold text-foreground uppercase tracking-widest mb-4 pl-1">Lógica</h3>
                <div className="space-y-2.5">
                  <div 
                    className="p-3.5 sm:p-3 lg:p-3.5 bg-gradient-to-br from-[#2d2d2d] to-[#252525] rounded-lg cursor-grab hover:from-[#3a3a3a] hover:to-[#2d2d2d] active:from-gray-800 transition-all duration-200 flex items-center border border-[#404040] hover:border-gray-500 active:cursor-grabbing shadow-md hover:shadow-lg" 
                    data-testid="tool-condition"
                    draggable
                    onDragStart={(e) => onDragStart(e, 'condition')}
                  >
                    <GitBranch className="h-4 w-4 text-white mr-2.5 flex-shrink-0 drop-shadow-lg" />
                    <span className="text-sm font-semibold text-gray-200 hidden md:inline">Condição</span>
                  </div>
                  <div 
                    className="p-3.5 sm:p-3 lg:p-3.5 bg-gradient-to-br from-[#2d2d2d] to-[#252525] rounded-lg cursor-grab hover:from-[#3a3a3a] hover:to-[#2d2d2d] active:from-gray-800 transition-all duration-200 flex items-center border border-[#404040] hover:border-gray-500 active:cursor-grabbing shadow-md hover:shadow-lg" 
                    data-testid="tool-delay"
                    draggable
                    onDragStart={(e) => onDragStart(e, 'delay')}
                  >
                    <Clock className="h-4 w-4 text-white mr-2.5 flex-shrink-0 drop-shadow-lg" />
                    <span className="text-sm font-semibold text-gray-200 hidden md:inline">Esperar</span>
                  </div>
                  <div 
                    className="p-3.5 sm:p-3 lg:p-3.5 bg-gradient-to-br from-[#2d2d2d] to-[#252525] rounded-lg cursor-grab hover:from-[#3a3a3a] hover:to-[#2d2d2d] active:from-gray-800 transition-all duration-200 flex items-center border border-[#404040] hover:border-gray-500 active:cursor-grabbing shadow-md hover:shadow-lg" 
                    data-testid="tool-question"
                    draggable
                    onDragStart={(e) => onDragStart(e, 'question')}
                  >
                    <HelpCircle className="h-4 w-4 text-white mr-2.5 flex-shrink-0 drop-shadow-lg" />
                    <span className="text-sm font-semibold text-gray-200 hidden md:inline">Pergunta</span>
                  </div>
                  <div 
                    className="p-3.5 sm:p-3 lg:p-3.5 bg-gradient-to-br from-[#2d2d2d] to-[#252525] rounded-lg cursor-grab hover:from-[#3a3a3a] hover:to-[#2d2d2d] active:from-gray-800 transition-all duration-200 flex items-center border border-[#404040] hover:border-gray-500 active:cursor-grabbing shadow-md hover:shadow-lg" 
                    data-testid="tool-tag"
                    draggable
                    onDragStart={(e) => onDragStart(e, 'tag')}
                  >
                    <Tag className="h-4 w-4 text-white mr-2.5 flex-shrink-0 drop-shadow-lg" />
                    <span className="text-sm font-semibold text-gray-200 hidden md:inline">Tag</span>
                  </div>
                  <div 
                    className="p-3.5 sm:p-3 lg:p-3.5 bg-gradient-to-br from-[#2d2d2d] to-[#252525] rounded-lg cursor-grab hover:from-[#3a3a3a] hover:to-[#2d2d2d] active:from-gray-800 transition-all duration-200 flex items-center border border-[#404040] hover:border-gray-500 active:cursor-grabbing shadow-md hover:shadow-lg" 
                    data-testid="tool-verify"
                    draggable
                    onDragStart={(e) => onDragStart(e, 'verify')}
                  >
                    <CheckCircle className="h-4 w-4 text-white mr-2.5 flex-shrink-0 drop-shadow-lg" />
                    <span className="text-sm font-semibold text-gray-200 hidden md:inline">Verificar</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Canvas Area */}
          <div className="flex-1 relative bg-[#1a1a1a]">
            <FunnelCanvas
              data={{ ...funnelData, triggerPhrases: triggerPhrases }}
              onDataChange={handleFunnelDataChange}
              onNodeSelect={handleNodeSelect}
            />
          </div>

          {/* Right Sidebar - Node Editor (appears only when editing) - Desktop */}
          {selectedNode && (
            <div className="hidden md:flex w-72 lg:w-80 flex-col bg-[#252525] border-l border-[#333] overflow-hidden">
              <div className="p-3 lg:p-4 border-b border-[#333]">
                <h3 className="text-lg font-semibold text-white mb-1">
                  Editar Nó
                </h3>
                <p className="text-xs text-gray-400">
                  {selectedNode.data.label || 'Configurações'}
                </p>
              </div>

              <div className="flex-1 overflow-y-auto p-3 lg:p-4 space-y-4">

                {/* Text Message Node */}
                {selectedNode.data.nodeType === 'message' && (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="message-content" className="text-gray-300">
                      Mensagem
                    </Label>
                    <Textarea
                      id="message-content"
                      value={selectedNode.data.content || ''}
                      onChange={(e) => updateNodeContent(e.target.value)}
                      placeholder="Digite a mensagem..."
                      className="mt-2 bg-[#1a1a1a] border-gray-700 text-white"
                      rows={5}
                      data-testid="input-message-content"
                    />
                  </div>
                </div>
              )}

                {/* Media Nodes (Image, Video, Audio, Document) */}
                {['image', 'video', 'audio', 'document'].includes(selectedNode.data.nodeType || '') && (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="media-url" className="text-gray-300">
                      URL do arquivo
                    </Label>
                    <Input
                      id="media-url"
                      type="text"
                      value={selectedNode.data.mediaUrl || ''}
                      onChange={(e) => updateNodeMediaUrl(e.target.value)}
                      placeholder={`URL do ${selectedNode.data.nodeType}...`}
                      className="mt-2 bg-[#1a1a1a] border-gray-700 text-white"
                      data-testid="input-media-url"
                    />
                  </div>
                  <div>
                    <Label htmlFor="media-file" className="text-gray-300">
                      Ou faça upload
                    </Label>
                    <Input
                      id="media-file"
                      type="file"
                      accept={
                        selectedNode.data.nodeType === 'image' ? 'image/*' :
                        selectedNode.data.nodeType === 'video' ? 'video/*' :
                        selectedNode.data.nodeType === 'audio' ? 'audio/*' :
                        '*/*'
                      }
                      onChange={handleFileUpload}
                      className="mt-2 bg-[#1a1a1a] border-gray-700 text-white file:bg-primary file:text-primary-foreground file:border-0 file:px-4 file:py-2 file:rounded file:mr-4"
                      data-testid="input-media-file"
                    />
                  </div>
                  {selectedNode.data.mediaUrl && (
                    <div>
                      <Label className="text-gray-300">Preview</Label>
                      <div className="mt-2 border border-gray-700 rounded overflow-hidden bg-[#1a1a1a] p-2">
                        {selectedNode.data.nodeType === 'image' && (
                          <img 
                            src={selectedNode.data.mediaUrl} 
                            alt="Preview" 
                            className="w-full h-auto max-h-48 object-contain"
                          />
                        )}
                        {selectedNode.data.nodeType === 'video' && (
                          <div className="flex items-center gap-3 p-3 bg-[#2a2a2a] rounded w-full">
                            <Video className="h-10 w-10 text-foreground flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-300">Vídeo anexado</p>
                              <p className="text-xs text-gray-500 truncate">
                                {selectedNode.data.mediaUrl?.startsWith('video:') 
                                  ? selectedNode.data.mediaUrl.replace('video:', '')
                                  : 'Arquivo de vídeo'}
                              </p>
                            </div>
                          </div>
                        )}
                        {selectedNode.data.nodeType === 'audio' && (
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-3 p-2 bg-[#2a2a2a] rounded">
                              <Mic className="h-8 w-8 text-foreground flex-shrink-0" />
                              <p className="text-sm text-gray-300">Áudio anexado</p>
                            </div>
                            <audio 
                              src={selectedNode.data.mediaUrl}
                              controls
                              preload="metadata"
                              className="w-full"
                              data-testid="audio-preview"
                            />
                          </div>
                        )}
                        {selectedNode.data.nodeType === 'document' && (
                          <div className="flex items-center gap-3 p-3 bg-[#2a2a2a] rounded">
                            <FileText className="h-10 w-10 text-foreground flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-300">Documento anexado</p>
                              <p className="text-xs text-gray-500 truncate mb-1">
                                {selectedNode.data.mediaUrl?.startsWith('doc:') 
                                  ? selectedNode.data.mediaUrl.split('|')[0].replace('doc:', '')
                                  : selectedNode.data.mediaUrl?.startsWith('data:') 
                                    ? 'Arquivo carregado'
                                    : selectedNode.data.mediaUrl}
                              </p>
                              {selectedNode.data.mediaUrl?.includes('|loading') ? (
                                <p className="text-xs text-yellow-500">Carregando...</p>
                              ) : (
                                <Button
                                  variant="link"
                                  size="sm"
                                  className="text-xs text-foreground hover:underline p-0 h-auto"
                                  onClick={() => {
                                    const mediaUrl = selectedNode.data.mediaUrl;
                                    if (!mediaUrl) return;
                                    
                                    let dataUrl = mediaUrl;
                                    let fileName = 'documento';
                                    
                                    if (mediaUrl.startsWith('doc:')) {
                                      const parts = mediaUrl.split('|');
                                      fileName = parts[0].replace('doc:', '');
                                      dataUrl = parts[1] || '';
                                    }
                                    
                                    if (dataUrl && dataUrl !== 'loading') {
                                      // Create a link and trigger download
                                      const link = document.createElement('a');
                                      link.href = dataUrl;
                                      link.download = fileName;
                                      link.target = '_blank';
                                      document.body.appendChild(link);
                                      link.click();
                                      link.remove();
                                    }
                                  }}
                                  data-testid="button-open-document"
                                >
                                  Abrir documento
                                </Button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

                {/* Location Node */}
                {selectedNode.data.nodeType === 'location' && (
                  <div className="space-y-3">
                    <LocationPicker
                      value={selectedNode.data.location}
                      onChange={updateNodeLocation}
                    />
                  </div>
                )}

                {/* Delay Node */}
                {selectedNode.data.nodeType === 'delay' && (
                  <div className="space-y-4">
                    <div>
                      <Label className="text-gray-300 font-medium text-sm">Modo de espera</Label>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => updateNodeDelayMode(false)}
                          className={`p-3 rounded-lg border text-left transition-all text-xs ${
                            !selectedNode.data.waitForReply
                              ? 'border-green-500 bg-green-500/10 text-white'
                              : 'border-gray-800 bg-[#141414] text-gray-400 hover:border-gray-700'
                          }`}
                        >
                          <div className="font-semibold flex items-center gap-1.5 mb-1 text-white">
                            <Clock className="w-3.5 h-3.5 text-green-400" />
                            Tempo
                          </div>
                          <span className="text-[11px] text-gray-400">Aguardar intervalo</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => updateNodeDelayMode(true)}
                          className={`p-3 rounded-lg border text-left transition-all text-xs ${
                            selectedNode.data.waitForReply
                              ? 'border-green-500 bg-green-500/10 text-white'
                              : 'border-gray-800 bg-[#141414] text-gray-400 hover:border-gray-700'
                          }`}
                        >
                          <div className="font-semibold flex items-center gap-1.5 mb-1 text-white">
                            <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
                            Resposta
                          </div>
                          <span className="text-[11px] text-gray-400">Esperar resposta</span>
                        </button>
                      </div>
                    </div>

                    {!selectedNode.data.waitForReply ? (
                      <div>
                        <Label htmlFor="delay-value" className="text-gray-300">
                          Tempo de espera
                        </Label>
                        <div className="flex gap-2 mt-2">
                          <Input
                            id="delay-value"
                            type="number"
                            min="1"
                            value={selectedNode.data.delayValue || 5}
                            onChange={(e) => updateNodeDelay(parseInt(e.target.value) || 1, selectedNode.data.delayUnit || 'minuto')}
                            className="flex-1 bg-[#1a1a1a] border-gray-700 text-white"
                            data-testid="input-delay-value"
                          />
                          <Select value={selectedNode.data.delayUnit || 'minuto'} onValueChange={(value: any) => updateNodeDelay(selectedNode.data.delayValue || 5, value)}>
                            <SelectTrigger className="w-40 bg-[#1a1a1a] border-gray-700 text-white" data-testid="select-delay-unit">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="segundo">Segundo(s)</SelectItem>
                              <SelectItem value="minuto">Minuto(s)</SelectItem>
                              <SelectItem value="hora">Hora(s)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-blue-950/20 border border-blue-800/40 rounded-lg text-xs text-blue-300 flex items-start gap-2">
                        <MessageSquare className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                        <span>
                          O funil será pausado aqui e continuará automaticamente enviando a próxima mensagem assim que o cliente responder.
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Condition Node */}
                {selectedNode.data.nodeType === 'condition' && (
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="condition-content" className="text-gray-300">
                        Condição
                      </Label>
                      <Textarea
                        id="condition-content"
                        value={selectedNode.data.content || ''}
                        onChange={(e) => updateNodeContent(e.target.value)}
                        placeholder="Descreva a condição..."
                        className="mt-2 bg-[#1a1a1a] border-gray-700 text-white"
                        rows={3}
                        data-testid="input-condition-content"
                      />
                    </div>
                  </div>
                )}

                {/* Question Node */}
                {selectedNode.data.nodeType === 'question' && (
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="question-content" className="text-gray-300">
                        Pergunta
                      </Label>
                      <Textarea
                        id="question-content"
                        value={selectedNode.data.content || ''}
                        onChange={(e) => updateNodeContent(e.target.value)}
                        placeholder="Digite a pergunta..."
                        className="mt-2 bg-[#1a1a1a] border-gray-700 text-white"
                        rows={3}
                        data-testid="input-question-content"
                      />
                    </div>
                  </div>
                )}

                {/* Tag Node */}
                {selectedNode.data.nodeType === 'tag' && (
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="tag-content" className="text-gray-300">
                        Tag
                      </Label>
                      <Input
                        id="tag-content"
                        type="text"
                        value={selectedNode.data.content || ''}
                        onChange={(e) => updateNodeContent(e.target.value)}
                        placeholder="Nome da tag..."
                        className="mt-2 bg-[#1a1a1a] border-gray-700 text-white"
                        data-testid="input-tag-content"
                      />
                    </div>
                  </div>
                )}

                {/* Trigger Node - Configuração de Gatilho */}
                {selectedNode.data.nodeType === 'trigger' && (() => {
                  const isAnyMessage = triggerPhrases.length > 0 && (
                    triggerPhrases[0] === '*' ||
                    triggerPhrases.some(p => p.trim() === '*' || p.trim().toLowerCase() === '__any__' || p.trim().toLowerCase() === 'qualquer mensagem')
                  );

                  return (
                    <div className="space-y-4">
                      <div>
                        <Label className="text-gray-300 text-sm font-semibold">
                          Tipo de Gatilho
                        </Label>
                        <p className="text-xs text-gray-500 mt-0.5 mb-3">
                          Escolha quando este funil deve ser iniciado
                        </p>

                        <div className="space-y-2">
                          {/* Opção 1: Frase específica */}
                          <div 
                            onClick={() => {
                              if (isAnyMessage) {
                                setTriggerPhrases(['']);
                              }
                            }}
                            className={`p-3 rounded-lg border cursor-pointer transition-all flex items-start gap-3 ${
                              !isAnyMessage
                                ? 'bg-primary/15 border-primary text-white shadow-sm'
                                : 'bg-[#1a1a1a] border-gray-700 text-gray-400 hover:border-gray-600'
                            }`}
                          >
                            <div className={`mt-0.5 h-4 w-4 rounded-full border flex items-center justify-center shrink-0 ${
                              !isAnyMessage ? 'border-primary' : 'border-gray-600'
                            }`}>
                              {!isAnyMessage && <div className="h-2 w-2 rounded-full bg-primary" />}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-white">Frase específica</p>
                              <p className="text-xs text-gray-400 mt-0.5">Dispara quando o contato enviar uma palavra ou frase exata</p>
                            </div>
                          </div>

                          {/* Opção 2: Qualquer mensagem */}
                          <div 
                            onClick={() => {
                              setTriggerPhrases(['*']);
                            }}
                            className={`p-3 rounded-lg border cursor-pointer transition-all flex items-start gap-3 ${
                              isAnyMessage
                                ? 'bg-primary/15 border-primary text-white shadow-sm'
                                : 'bg-[#1a1a1a] border-gray-700 text-gray-400 hover:border-gray-600'
                            }`}
                          >
                            <div className={`mt-0.5 h-4 w-4 rounded-full border flex items-center justify-center shrink-0 ${
                              isAnyMessage ? 'border-primary' : 'border-gray-600'
                            }`}>
                              {isAnyMessage && <div className="h-2 w-2 rounded-full bg-primary" />}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-white">Qualquer mensagem</p>
                              <p className="text-xs text-gray-400 mt-0.5">Dispara automaticamente para qualquer mensagem recebida</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {!isAnyMessage ? (
                        <div className="pt-2 border-t border-gray-800">
                          <Label className="text-gray-300 text-xs font-medium">
                            Palavra ou frase gatilho
                          </Label>
                          <div className="flex gap-2 mt-1.5">
                            <Input
                              value={triggerPhrases[0] === '*' ? '' : (triggerPhrases[0] || '')}
                              onChange={(e) => {
                                setTriggerPhrases([e.target.value]);
                              }}
                              placeholder="Digite a frase gatilho (ex: oi)..."
                              className="bg-[#1a1a1a] border-gray-700 text-white flex-1"
                              data-testid="input-trigger-phrase"
                            />
                            {triggerPhrases[0] && triggerPhrases[0] !== '*' && (
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => setTriggerPhrases([])}
                                className="border-gray-600 text-gray-300 hover:bg-red-900"
                                data-testid="button-clear-trigger-phrase"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-500 mt-1.5">
                            Palavra ou frase que inicia o funil quando digitada pelo cliente.
                          </p>
                        </div>
                      ) : (
                        <div className="p-3 bg-emerald-950/30 border border-emerald-800/40 rounded-lg">
                          <p className="text-xs text-emerald-400 font-medium flex items-center gap-1.5">
                            <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" />
                            Qualquer Mensagem Ativada
                          </p>
                          <p className="text-[11px] text-gray-300 mt-1">
                            Este funil responderá a qualquer primeira mensagem recebida do contato.
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Verify Node */}
                {selectedNode.data.nodeType === 'verify' && (
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="verify-content" className="text-gray-300">
                        Verificação
                      </Label>
                      <Textarea
                        id="verify-content"
                        value={selectedNode.data.content || ''}
                        onChange={(e) => updateNodeContent(e.target.value)}
                        placeholder="O que verificar..."
                        className="mt-2 bg-[#1a1a1a] border-gray-700 text-white"
                        rows={3}
                        data-testid="input-verify-content"
                      />
                    </div>
                  </div>
                )}

              </div>
              
              {/* Action buttons - always visible at bottom */}
              <div className="pt-3 mt-3 border-t border-gray-700 space-y-2 flex-shrink-0 p-3 lg:p-4">
                {selectedNode.id !== 'start' && selectedNode.data.nodeType !== 'trigger' && (
                  <Button
                    variant="outline"
                    className="w-full border-red-600 text-red-400 hover:bg-red-900/50"
                    onClick={deleteNode}
                    data-testid="button-delete-node"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Excluir Elemento
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="w-full border-gray-600 text-gray-300 hover:bg-gray-800"
                  onClick={() => setSelectedNode(null)}
                  data-testid="button-close-editor"
                >
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
      <WhatsAppPreview
        open={showPreview}
        onOpenChange={setShowPreview}
        nodes={funnelData.nodes}
        edges={funnelData.edges}
        triggerPhrase={triggerPhrases[0] || "Oi"}
      />
    </div>
  );
}
