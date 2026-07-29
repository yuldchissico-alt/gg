import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { 
  MessageSquare, 
  Image, 
  Video, 
  Mic, 
  Music,
  FileText, 
  MapPin, 
  GitBranch, 
  Clock, 
  HelpCircle, 
  Tag, 
  CheckCircle, 
  Play,
  Edit3,
  MoreVertical
} from 'lucide-react';

interface LocationData {
  latitude: number;
  longitude: number;
  address: string;
}

interface FunnelNodeData {
  label: string;
  nodeType: string;
  content: string;
  icon?: string;
  delayMinutes?: number;
  delayValue?: number;
  delayUnit?: 'segundo' | 'minuto' | 'hora';
  mediaUrl?: string;
  location?: LocationData;
}

const iconMap = {
  play: Play,
  message: MessageSquare,
  image: Image,
  video: Video,
  mic: Mic,
  audio: Mic,
  music: Mic,
  file: FileText,
  'map-pin': MapPin,
  'git-branch': GitBranch,
  clock: Clock,
  'help-circle': HelpCircle,
  tag: Tag,
  'check-circle': CheckCircle,
};

export default function FunnelNode({ data, selected }: NodeProps<FunnelNodeData>) {
  const IconComponent = iconMap[data.icon as keyof typeof iconMap] || MessageSquare;
  
  const getBorderColor = () => {
    if (selected) return 'border-primary';
    if (data.nodeType === 'trigger') return 'border-primary';
    return 'border-border';
  };

  const getBackgroundColor = () => {
    if (data.nodeType === 'trigger') return 'bg-primary/10';
    return 'bg-card';
  };

  return (
    <div 
      className={`
        funnel-node relative bg-card border-2 rounded-lg p-4 shadow-lg min-w-[200px] max-w-[250px]
        ${getBorderColor()} ${getBackgroundColor()}
      `}
      data-testid={`funnel-node-${data.nodeType}`}
    >
      {/* Input Handle */}
      {data.nodeType !== 'trigger' && (
        <Handle
          type="target"
          position={Position.Top}
          className="!w-4 !h-4 !bg-primary !border-2 !border-foreground hover:!bg-primary/80 transition-colors"
          data-testid="handle-input"
        />
      )}

      {/* Node Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center">
          <IconComponent className="h-4 w-4 text-primary mr-2" />
          <span className="text-sm font-semibold text-foreground">{data.label}</span>
        </div>
      </div>

      {/* Node Content */}
      <div className="mb-3">
        {data.nodeType === 'trigger' && (
          <p className="text-xs text-muted-foreground mb-2">
            {data.content}
          </p>
        )}
        
        {data.nodeType === 'message' && (
          <div className="bg-muted rounded p-2 mb-2">
            <p className="text-xs text-muted-foreground line-clamp-3">
              {data.content || 'Clique para editar mensagem...'}
            </p>
          </div>
        )}

        {data.nodeType === 'delay' && (
          <div className="bg-muted rounded p-2 mb-2">
            <p className="text-xs text-muted-foreground">
              Aguardar {data.delayValue || 5} {data.delayUnit || 'minuto'}(s)
            </p>
          </div>
        )}

        {data.nodeType === 'condition' && (
          <div className="bg-muted rounded p-2 mb-2">
            <p className="text-xs text-muted-foreground">
              {data.content}
            </p>
          </div>
        )}

        {data.nodeType === 'audio' && (
          <div className="bg-muted rounded p-2 mb-2">
            {data.mediaUrl ? (
              <audio 
                controls 
                className="w-full h-8"
                src={data.mediaUrl}
                data-testid="audio-player"
              />
            ) : (
              <div className="w-full h-10 bg-border rounded flex items-center px-2 gap-2">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                  <Play className="h-3 w-3 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="h-1 bg-muted-foreground/30 rounded-full">
                    <div className="h-1 w-0 bg-primary rounded-full"></div>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">0:00</span>
              </div>
            )}
          </div>
        )}

        {data.nodeType === 'image' && (
          <div className="bg-muted rounded p-2 mb-2">
            {data.mediaUrl && data.mediaUrl.startsWith('data:') ? (
              <img 
                src={data.mediaUrl} 
                alt="preview"
                className="w-full h-32 object-cover rounded"
                data-testid="image-preview"
              />
            ) : (
              <div className="w-full h-32 bg-border rounded flex items-center justify-center">
                <IconComponent className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
          </div>
        )}

        {data.nodeType === 'video' && (
          <div className="bg-muted rounded p-2 mb-2">
            <div className="w-full h-8 bg-border rounded flex items-center justify-center">
              <IconComponent className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        )}

        {data.nodeType === 'document' && (
          <div className="bg-muted rounded p-2 mb-2">
            <div className="w-full h-8 bg-border rounded flex items-center justify-center">
              <IconComponent className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        )}

        {data.nodeType === 'location' && (
          <div className="bg-muted rounded p-2 mb-2">
            <div className="w-full h-24 bg-border rounded overflow-hidden relative">
              {data.location ? (
                <iframe
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${data.location.longitude - 0.005}%2C${data.location.latitude - 0.005}%2C${data.location.longitude + 0.005}%2C${data.location.latitude + 0.005}&layer=mapnik&marker=${data.location.latitude}%2C${data.location.longitude}`}
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  loading="lazy"
                  className="rounded"
                  data-testid="location-map"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-muted">
                  <MapPin className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <div className="absolute bottom-1 left-1 right-1 bg-background/90 rounded px-1.5 py-0.5 flex items-center gap-1">
                <MapPin className="h-3 w-3 text-red-500 flex-shrink-0" />
                <span className="text-[10px] text-foreground truncate">
                  {data.location?.address ? data.location.address.split(',')[0] : 'Selecione local'}
                </span>
              </div>
            </div>
          </div>
        )}

        {['question', 'tag', 'verify'].includes(data.nodeType) && (
          <div className="bg-muted rounded p-2 mb-2">
            <p className="text-xs text-muted-foreground">
              {data.content}
            </p>
          </div>
        )}
      </div>

      {/* Node Footer */}
      <div className="flex justify-between items-center">
        {data.nodeType === 'condition' ? (
          <div className="flex space-x-4 w-full justify-around">
            <div className="text-center">
              <Handle
                type="source"
                position={Position.Bottom}
                id="yes"
                className="!w-4 !h-4 !bg-green-500 !border-2 !border-green-300 hover:!bg-green-400 transition-colors"
                style={{ left: '25%' }}
                data-testid="handle-output-yes"
              />
              <span className="text-xs text-muted-foreground">Sim</span>
            </div>
            <div className="text-center">
              <Handle
                type="source"
                position={Position.Bottom}
                id="no"
                className="!w-4 !h-4 !bg-red-500 !border-2 !border-red-300 hover:!bg-red-400 transition-colors"
                style={{ left: '75%' }}
                data-testid="handle-output-no"
              />
              <span className="text-xs text-muted-foreground">Não</span>
            </div>
          </div>
        ) : (
          <>
            {(data.delayValue ?? 0) > 0 && (
              <div className="text-xs text-muted-foreground">
                Delay: {data.delayValue}{data.delayUnit === 'segundo' ? 's' : data.delayUnit === 'minuto' ? 'min' : 'h'}
              </div>
            )}
            <Handle
              type="source"
              position={Position.Bottom}
              className="!w-4 !h-4 !bg-primary !border-2 !border-foreground hover:!bg-primary/80 transition-colors"
              data-testid="handle-output"
            />
          </>
        )}
      </div>
    </div>
  );
}
