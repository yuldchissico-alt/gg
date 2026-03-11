import { useEffect, useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Image, Video, Mic, FileText, MapPin, Navigation } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

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
    nodeType?: string;
    location?: LocationData;
  };
}

interface WhatsAppPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodes: FunnelNode[];
  edges: Array<{ id: string; source: string; target: string }>;
  triggerPhrase: string;
}

interface Message {
  id: string;
  type: "user" | "bot" | "waiting";
  content: string;
  mediaType?: string;
  mediaUrl?: string;
  timestamp: Date;
  waitMinutes?: number;
  location?: LocationData;
  displayContent?: string;
  isTyping?: boolean;
}

export default function WhatsAppPreview({ 
  open, 
  onOpenChange, 
  nodes, 
  edges,
  triggerPhrase 
}: WhatsAppPreviewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const simulationIdRef = useRef<number>(0);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  
  // Keep refs updated
  useEffect(() => {
    nodesRef.current = nodes;
    edgesRef.current = edges;
  }, [nodes, edges]);

  useEffect(() => {
    if (open) {
      setMessages([]);
      setIsSimulating(false);
      simulationIdRef.current += 1;
      const currentSimulationId = simulationIdRef.current;
      setTimeout(() => simulateFunnel(currentSimulationId), 100);
    }
    return () => {
      // Cancel any ongoing simulation when dialog closes
      simulationIdRef.current += 1;
    };
  }, [open]);

  const simulateTyping = async (text: string, messageId: string) => {
    // Simulate typing effect character by character
    let displayedText = "";
    const typingSpeed = 30; // ms per character
    
    for (let i = 0; i < text.length; i++) {
      displayedText += text[i];
      
      setMessages(prev => 
        prev.map(msg => 
          msg.id === messageId 
            ? { ...msg, displayContent: displayedText, isTyping: true }
            : msg
        )
      );
      
      await new Promise(resolve => setTimeout(resolve, typingSpeed));
    }
    
    // Mark typing as complete
    setMessages(prev => 
      prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, isTyping: false }
          : msg
      )
    );
  };

  const simulateFunnel = async (simulationId: number) => {
    setIsSimulating(true);
    setMessages([]);

    // Helper to check if this simulation is still active
    const isActive = () => simulationIdRef.current === simulationId;

    const userMessage: Message = {
      id: "user-trigger",
      type: "user",
      content: triggerPhrase || "Oi",
      displayContent: triggerPhrase || "Oi",
      timestamp: new Date(),
    };

    setMessages([userMessage]);
    await new Promise(resolve => setTimeout(resolve, 500));
    if (!isActive()) return;

    const sortedNodes = getExecutionOrder(nodesRef.current, edgesRef.current);
    
    for (const node of sortedNodes) {
      if (!isActive()) return;
      
      const nodeType = (node.data as any)?.nodeType || node.type;
      
      // Delay nodes - wait silently for the configured time
      if (nodeType === 'delay') {
        const delayMinutes = node.data?.delayMinutes || 5;
        const delayMs = delayMinutes * 60 * 1000;
        
        // Wait for the actual configured time silently
        await new Promise(resolve => setTimeout(resolve, delayMs));
        
        if (!isActive()) return;
        continue;
      }
      
      // Get content
      const content = node.data.content || "";
      
      // Skip condition, tag, verify nodes - they are logic, not messages
      if (['condition', 'tag', 'verify', 'question'].includes(nodeType)) {
        await new Promise(resolve => setTimeout(resolve, 500));
        if (!isActive()) return;
        continue;
      }
      
      // For message nodes, show even if placeholder - just use default text if empty
      const displayContent = content.trim() || "Mensagem de exemplo";

      await new Promise(resolve => setTimeout(resolve, 400));
      if (!isActive()) return;

      const botMessage: Message = {
        id: node.id,
        type: "bot",
        content: displayContent,
        displayContent: nodeType === 'document' ? (node.data.mediaFileName || 'Documento') : "",
        isTyping: true,
        mediaType: nodeType,
        mediaUrl: node.data.mediaUrl,
        timestamp: new Date(),
        location: node.data.location,
      };

      setMessages(prev => [...prev, botMessage]);

      // Simulate typing for text messages only
      if (nodeType === 'message') {
        await simulateTyping(displayContent, node.id);
      } else {
        // For media, just remove the typing indicator
        setMessages(prev => 
          prev.map(msg => 
            msg.id === node.id 
              ? { ...msg, isTyping: false }
              : msg
          )
        );
      }
    }

    if (isActive()) {
      setIsSimulating(false);
    }
  };

  const getExecutionOrder = (nodes: FunnelNode[], edges: Array<{ id: string; source: string; target: string }>): FunnelNode[] => {
    // Check both node.type and node.data.nodeType for trigger nodes
    const isTriggerNode = (n: FunnelNode) => n.type === 'trigger' || (n.data as any)?.nodeType === 'trigger';
    
    const startNode = nodes.find(n => isTriggerNode(n));
    if (!startNode) return nodes.filter(n => !isTriggerNode(n));

    const ordered: FunnelNode[] = [];
    const visited = new Set<string>();
    
    const traverse = (nodeId: string) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      
      const node = nodes.find(n => n.id === nodeId);
      if (!node || isTriggerNode(node)) return;
      
      ordered.push(node);
      
      const outgoingEdges = edges.filter(e => e.source === nodeId);
      outgoingEdges.forEach(edge => traverse(edge.target));
    };

    const firstEdges = edges.filter(e => e.source === startNode.id);
    firstEdges.forEach(edge => traverse(edge.target));

    return ordered;
  };

  const renderMessageContent = (message: Message) => {
    if (message.type === 'bot' && message.mediaType === 'message') {
      return (
        <div className="flex items-baseline gap-1">
          <p className="text-sm whitespace-pre-wrap break-words">
            {message.displayContent || message.content}
          </p>
          {message.isTyping && (
            <div className="flex gap-0.5 items-center">
              <span className="text-sm text-gray-300 animate-bounce" style={{ animationDelay: '0ms' }}>.</span>
              <span className="text-sm text-gray-300 animate-bounce" style={{ animationDelay: '150ms' }}>.</span>
              <span className="text-sm text-gray-300 animate-bounce" style={{ animationDelay: '300ms' }}>.</span>
            </div>
          )}
        </div>
      );
    }

    if (message.mediaType === 'image' && message.mediaUrl) {
      return (
        <div>
          {message.mediaUrl.startsWith('data:') || message.mediaUrl.startsWith('http') ? (
            <img 
              src={message.mediaUrl} 
              alt="Imagem" 
              className="max-w-[200px] rounded-lg"
            />
          ) : (
            <div className="flex items-center gap-2 text-sm">
              <Image className="h-4 w-4" />
              <span>📷 Imagem</span>
            </div>
          )}
        </div>
      );
    }

    if (message.mediaType === 'video') {
      return (
        <div className="flex items-center gap-2 text-sm">
          <Video className="h-4 w-4" />
          <span>🎥 Vídeo</span>
        </div>
      );
    }

    if (message.mediaType === 'audio') {
      const isPlaying = playingAudioId === message.id;
      return (
        <div>
          {message.mediaUrl ? (
            <div className="space-y-2">
              <div className={`relative w-full max-w-[200px] flex items-center gap-1.5 px-3 py-2 rounded ${isPlaying ? 'bg-purple-600/30' : 'bg-purple-600/10'}`}>
                {/* Animated waveform bars - like recording in real time */}
                <div className="flex items-center gap-0.5 h-8">
                  <div className="w-1 bg-purple-400 rounded-full" style={{ height: isPlaying ? '6px' : '2px', animation: isPlaying ? 'wave 0.6s ease-in-out infinite' : 'none', animationDelay: '0ms' }} />
                  <div className="w-1 bg-purple-400 rounded-full" style={{ height: isPlaying ? '8px' : '2px', animation: isPlaying ? 'wave 0.6s ease-in-out infinite' : 'none', animationDelay: '100ms' }} />
                  <div className="w-1 bg-purple-400 rounded-full" style={{ height: isPlaying ? '12px' : '2px', animation: isPlaying ? 'wave 0.6s ease-in-out infinite' : 'none', animationDelay: '200ms' }} />
                  <div className="w-1 bg-purple-400 rounded-full" style={{ height: isPlaying ? '10px' : '2px', animation: isPlaying ? 'wave 0.6s ease-in-out infinite' : 'none', animationDelay: '300ms' }} />
                  <div className="w-1 bg-purple-400 rounded-full" style={{ height: isPlaying ? '8px' : '2px', animation: isPlaying ? 'wave 0.6s ease-in-out infinite' : 'none', animationDelay: '400ms' }} />
                </div>
                <span className="text-xs text-gray-300 whitespace-nowrap">
                  {isPlaying ? '▶' : ''}
                </span>
              </div>
              <audio 
                controls 
                className="w-full max-w-[200px] h-8"
                src={message.mediaUrl}
                onPlay={() => setPlayingAudioId(message.id)}
                onPause={() => setPlayingAudioId(null)}
                onEnded={() => setPlayingAudioId(null)}
              />
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm">
              <Mic className="h-4 w-4" />
              <span>🎤 Áudio</span>
            </div>
          )}
        </div>
      );
    }

    if (message.mediaType === 'document') {
      const fileName = message.displayContent || 'Documento';
      return (
        <div className="flex items-center gap-2 text-sm">
          <FileText className="h-4 w-4" />
          <span>📄 {fileName}</span>
        </div>
      );
    }

    if (message.mediaType === 'location' && message.location) {
      return (
        <div className="w-[180px]">
          <div className="relative w-full h-24 bg-[#1a2e35] rounded-lg overflow-hidden">
            <iframe
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${message.location.longitude - 0.005}%2C${message.location.latitude - 0.005}%2C${message.location.longitude + 0.005}%2C${message.location.latitude + 0.005}&layer=mapnik&marker=${message.location.latitude}%2C${message.location.longitude}`}
              width="100%"
              height="100%"
              style={{ border: 0 }}
              className="rounded-t-lg"
            />
          </div>
          <div className="bg-[#1a2e35] rounded-b-lg p-2 border-t border-[#2a3942]">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white font-medium truncate">
                  {message.location.address.split(',')[0]}
                </p>
                <p className="text-[10px] text-[#8696a0] truncate">
                  {message.location.address.split(',').slice(1, 3).join(',')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 mt-2 text-[#00a884]">
              <Navigation className="h-3 w-3" />
              <span className="text-[10px] font-medium">Ver no mapa</span>
            </div>
          </div>
        </div>
      );
    }

    return <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="w-[280px] h-[500px] max-h-[85vh] p-0 bg-black border-none overflow-hidden rounded-[30px] flex flex-col"
        style={{ 
          boxShadow: '0 0 0 6px #1a1a1a, 0 15px 30px -8px rgba(0, 0, 0, 0.5)' 
        }}
      >
        {/* Top bezel - iPhone frame */}
        <div className="h-6 bg-black flex-shrink-0 relative">
          {/* Dynamic Island / Notch */}
          <div className="absolute left-1/2 -translate-x-1/2 top-1 w-20 h-4 bg-black rounded-full border border-gray-800"></div>
        </div>

        {/* Screen content wrapper */}
        <div className="flex-1 flex flex-col overflow-hidden mx-1 rounded-t-lg">
          {/* Status bar */}
          <div className="h-6 bg-[#111b21] flex items-center justify-between px-3 flex-shrink-0">
            <span className="text-white text-[10px] font-semibold">9:41</span>
            <div className="flex items-center gap-1">
              <svg width="14" height="9" viewBox="0 0 17 11" fill="white">
                <rect x="0" y="2" width="4" height="7" rx="0.8"/>
                <rect x="5.5" y="0.5" width="4" height="10" rx="0.8"/>
                <rect x="11" y="0" width="4" height="11" rx="0.8"/>
              </svg>
              <svg width="12" height="9" viewBox="0 0 15 11">
                <path d="M7.5 0C3.4 0 0 2.5 0 5.5s3.4 5.5 7.5 5.5 7.5-2.5 7.5-5.5S11.6 0 7.5 0zm0 9.5c-3.1 0-5.5-1.7-5.5-3.7s2.4-3.7 5.5-3.7 5.5 1.7 5.5 3.7-2.4 3.7-5.5 3.7z" fill="white"/>
              </svg>
              <span className="text-white text-[10px] font-semibold">100%</span>
            </div>
          </div>

          {/* WhatsApp Header */}
          <div className="bg-[#202c33] px-3 py-2 flex items-center justify-between border-b border-[#2a3942] flex-shrink-0">
          <div className="flex items-center gap-2 flex-1">
            <button 
              onClick={() => onOpenChange(false)}
              className="text-[#8696a0] hover:text-white"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6"/>
              </svg>
            </button>
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-purple-600 text-white text-sm font-bold">
                R
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-white text-sm font-medium truncate">
                PilotZap
              </DialogTitle>
              <p className="text-[10px] text-[#8696a0]">online</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8696a0" strokeWidth="2.2">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8696a0" strokeWidth="2.5">
              <circle cx="12" cy="12" r="1.5"/>
              <circle cx="12" cy="5" r="1.5"/>
              <circle cx="12" cy="19" r="1.5"/>
            </svg>
          </div>
        </div>

        {/* Messages Area */}
        <div 
          className="flex-1 overflow-y-auto p-4 space-y-2.5"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23182229' fill-opacity='0.25'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            backgroundColor: '#0b141a'
          }}
          data-testid="whatsapp-preview-messages"
        >
          {messages.map((message, index) => (
            <div
              key={`${message.id}-${index}`}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.type === 'waiting' ? (
                <div className="max-w-[80%]">
                  <div className="bg-yellow-600/20 border border-yellow-600/50 rounded-lg px-3 py-2 shadow-lg">
                    <div className="flex items-center gap-2 text-yellow-400 text-sm">
                      <span className="animate-pulse">{message.content}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="max-w-[80%]">
                  <div
                    className={`rounded-lg px-3 py-2 shadow-lg relative ${
                      message.type === 'user'
                        ? 'bg-[#005c4b] text-white rounded-br-sm'
                        : 'bg-[#202c33] text-[#e9edef] rounded-bl-sm'
                    }`}
                  >
                    <div className={`absolute bottom-0 ${
                      message.type === 'user' 
                        ? 'right-[-7px] border-l-[7px] border-l-[#005c4b]' 
                        : 'left-[-7px] border-r-[7px] border-r-[#202c33]'
                    } border-b-[7px] border-b-transparent w-0 h-0`}></div>
                    
                    {renderMessageContent(message)}
                    
                    <div className={`text-[10px] mt-1 flex items-center gap-1 justify-end ${
                      message.type === 'user' ? 'text-[#a5c8bb]' : 'text-[#8696a0]'
                    }`}>
                      {message.timestamp.toLocaleTimeString('pt-BR', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                      {message.type === 'user' && (
                        <svg viewBox="0 0 16 15" width="13" height="13" className="fill-current ml-0.5">
                          <path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z"/>
                        </svg>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {isSimulating && messages.length > 0 && (
            <div className="flex justify-start">
              <div className="max-w-[80%]">
                <div className="bg-[#202c33] rounded-lg rounded-bl-sm px-4 py-3 shadow-lg relative">
                  <div className="absolute bottom-0 left-[-7px] border-r-[7px] border-r-[#202c33] border-b-[7px] border-b-transparent w-0 h-0"></div>
                  <div className="flex gap-1.5">
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

          {/* Input Area */}
          <div className="bg-[#202c33] px-2 py-1.5 border-t border-[#2a3942] flex-shrink-0 rounded-b-lg">
            <div className="flex items-center gap-1.5">
              <div className="flex-1 flex items-center gap-2 bg-[#2a3942] rounded-2xl px-3 py-1.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8696a0" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
                  <line x1="9" y1="9" x2="9.01" y2="9"/>
                  <line x1="15" y1="9" x2="15.01" y2="9"/>
                </svg>
                <span className="text-xs text-[#8696a0] flex-1">Mensagem</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8696a0" strokeWidth="2">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                </svg>
              </div>
              <div className="w-8 h-8 rounded-full bg-[#00a884] flex items-center justify-center flex-shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bezel - iPhone frame */}
        <div className="h-8 bg-black flex-shrink-0 flex items-center justify-center">
          {/* Home Indicator */}
          <div className="w-28 h-1 bg-gray-600 rounded-full"></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
