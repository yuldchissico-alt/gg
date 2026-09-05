import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { WhatsAppStatus } from "@shared/api-types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QrCode, Timer } from "lucide-react";

interface WhatsAppConnectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function WhatsAppConnectionModal({ open, onOpenChange }: WhatsAppConnectionModalProps) {
  const [apiToken, setApiToken] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [connectionName, setConnectionName] = useState("");
  const [qrCodeImage, setQrCodeImage] = useState<string>("");
  const [showQR, setShowQR] = useState(false);
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutos — alinhado com authTimeoutMs do backend
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 🎯 GERAR QR CODE VIA BACKEND
  const generateQRMutation = useMutation({
    mutationFn: async () => {
      // Verificar se já está conectado
      const statusRes = await apiRequest("GET", "/api/whatsapp/status");
      const statusData = await statusRes.json();
      if (statusData.connected) {
        return { connected: true };
      }

      setTimeLeft(300);

      // Disparar inicialização do cliente (não bloquear — o backend faz long-poll internamente)
      const initRes = await apiRequest("POST", "/api/whatsapp/qr");

      // Se já veio QR na primeira chamada, usar diretamente
      if (initRes.ok) {
        const initData = await initRes.json();
        if (initData.qrCode) return { qrCode: initData.qrCode };
      }

      // Polling leve — só para buscar o QR gerado pelo evento 'qr' do whatsapp-web.js
      // Intervalo de 3s, máximo de 30 tentativas (90s total)
      let qr = "";
      let attempts = 0;
      const maxAttempts = 30;

      while (!qr && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 3000));

        if (!open) throw new Error("Modal fechado");

        // Usar GET no status em vez de POST no /qr — não reinicia o processo
        const statusCheck = await apiRequest("GET", "/api/whatsapp/status");
        const currentStatus = await statusCheck.json();

        if (currentStatus.connected) return { connected: true };
        if (currentStatus.qrCode) {
          qr = currentStatus.qrCode;
          break;
        }

        attempts++;
      }

      if (!qr) {
        throw new Error("O QR Code demorou muito para ser gerado. Tente novamente.");
      }

      return { qrCode: qr };
    },
    onSuccess: (data) => {
      if (data.connected) {
        toast({
          title: "✅ WhatsApp Conectado!",
          description: "Sua conta já está ativa.",
          duration: 3000,
        });
        onOpenChange(false);
        queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/status"] });
        return;
      }

      if (data.qrCode) {
        setQrCodeImage(data.qrCode);
        setShowQR(true);
        setTimeLeft(300); // 5 minutos

        toast({
          title: "✅ QR Code Gerado!",
          description: "Escaneie com o WhatsApp no celular",
          duration: 2000,
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "❌ Erro ao Gerar QR Code",
        description: error?.message || "Tente novamente.",
        variant: "destructive",
        duration: 3000,
      });
    },
  });

  const { data: whatsappStatus } = useQuery<WhatsAppStatus>({
    queryKey: ["/api/whatsapp/status"],
    enabled: open,
    // Polling activo enquanto o modal está aberto OU enquanto estiver a aguardar conexão
    refetchInterval: (query) => {
      const status = query.state.data;
      // Parar polling se já conectou
      if (status?.connected) return false;
      // Se o modal está aberto com QR visível, poll agressivo (2s)
      if (open && showQR) return 2000;
      // Se está em inicialização (pode ter escaneado e fechado o modal), continuar a 3s
      if (status?.status === "qr_ready" || status?.status === "initializing" || status?.status === "authenticated") return 3000;
      return false;
    },
    // Continuar a fazer refetch mesmo com o modal fechado enquanto não conectar
    refetchIntervalInBackground: true,
  });

  // Detecta conexão bem-sucedida via polling — funciona mesmo com modal fechado
  // (o utilizador pode escanear e fechar o modal antes do 'ready' chegar)
  useEffect(() => {
    if (whatsappStatus?.connected) {
      console.log("✅ Conexão detectada via polling!");

      const finishConnection = async () => {
        try {
          if (open && connectionName.trim()) {
            await apiRequest("POST", "/api/whatsapp/connections", {
              name: connectionName.trim(),
              phoneNumber: whatsappStatus.phoneNumber || "",
              isConnected: true
            });
          }

          toast({
            title: "✅ WhatsApp Conectado!",
            description: `Número ${whatsappStatus.phoneNumber || ""} vinculado com sucesso.`,
            duration: 4000,
          });

          setShowQR(false);
          setQrCodeImage("");
          if (open) onOpenChange(false);

          queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/connections"] });
          queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/status"] });
        } catch (error) {
          console.error("Erro ao finalizar conexão:", error);
          if (open) onOpenChange(false);
        }
      };

      finishConnection();
    }
  }, [whatsappStatus?.connected]);

  // Timer para exibição — conta regressiva de 5 minutos
  // Ao chegar a 0, mostra botão de regenerar mas NÃO reinicia automaticamente
  // (evita interromper o handshake no meio)
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showQR && qrCodeImage && timeLeft > 0 && !whatsappStatus?.connected) {
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            return 0; // Parar em 0 — não reiniciar sozinho
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [showQR, qrCodeImage, whatsappStatus?.connected]);

  // Reset quando o modal abre/fecha
  useEffect(() => {
    if (!open) {
      setTimeLeft(300);
      setShowQR(false);
      setQrCodeImage("");
    } else {
      // Quando abrir o modal, tenta gerar o primeiro QR se não estiver conectado
      if (!whatsappStatus?.connected && !showQR && !generateQRMutation.isPending) {
        generateQRMutation.mutate();
      }
    }
  }, [open, whatsappStatus?.connected]);

  // 🚀 ADICIONAR CONEXÃO WHAPI
  const addConnectionMutation = useMutation({
    mutationFn: async () => {
      if (!apiToken.trim() || !phoneNumber.trim()) {
        throw new Error("Preencha todos os campos obrigatórios");
      }
      
      const response = await apiRequest("POST", "/api/whatsapp/connections", {
        name: connectionName.trim() || `Whapi ${phoneNumber}`,
        apiTokenInstance: apiToken.trim(),
        phoneNumber: phoneNumber.trim(),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Falha ao adicionar conexão");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "✅ Conexão Adicionada!",
        description: "Sua conta Whapi foi conectada com sucesso!",
        duration: 2000,
      });
      
      // Limpar formulário
      setApiToken("");
      setPhoneNumber("");
      setConnectionName("");
      setQrCodeImage("");
      setShowQR(false);
      setTimeLeft(300);
      
      // Fechar modal e atualizar lista
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/connections"] });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/status"] });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Erro ao Adicionar Conexão",
        description: error?.message || "Verifique suas credenciais e tente novamente.",
        variant: "destructive",
        duration: 3000,
      });
    },
  });

  const verifyConnectionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/whatsapp/verify");
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Falha ao verificar conexão");
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "✅ Conectado!",
        description: `Whapi conectado ao número: ${data.phoneNumber}`,
        duration: 2000,
      });
      
      setPhoneNumber(data.phoneNumber || "");
      
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/connections"] });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/status"] });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Erro na Verificação",
        description: error?.message || "Não foi possível verificar a conexão Whapi.",
        variant: "destructive",
        duration: 3000,
      });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/whatsapp/disconnect");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/status"] });
      toast({
        title: "Desconectado",
        description: "WhatsApp desconectado com sucesso!",
        duration: 2000,
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: "Falha ao desconectar WhatsApp.",
        variant: "destructive",
        duration: 2000,
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto" data-testid="modal-whatsapp-connection">
        <DialogHeader>
          <DialogTitle className="flex items-center text-base" id="whatsapp-dialog-title">
            <QrCode className="h-4 w-4 mr-2 text-primary" />
            Conectar WhatsApp
          </DialogTitle>
          <DialogDescription className="text-xs" id="whatsapp-dialog-description">
            Gere um QR Code para conectar sua conta WhatsApp
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!showQR ? (
            <div className="space-y-3 p-4 bg-card rounded-xl border border-border">
              <div>
                <h3 className="text-base font-bold text-foreground">Pronto para conectar?</h3>
                <p className="text-xs text-muted-foreground">Clique abaixo para gerar o QR Code</p>
              </div>
              
              {generateQRMutation.isPending ? (
                <div className="flex flex-col items-center space-y-2">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-foreground"></div>
                  <p className="text-sm font-medium text-foreground">Gerando QR Code...</p>
                </div>
              ) : (
                <Button
                  onClick={() => generateQRMutation.mutate()}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-2 text-sm"
                  data-testid="button-generate-qr"
                >
                  <QrCode className="h-4 w-4 mr-2" />
                  Gerar QR Code
                </Button>
              )}
            </div>
          ) : qrCodeImage ? (
            <div className="space-y-3">
              <div className="relative bg-white p-4 rounded-lg border-2 border-blue-200 mx-auto flex justify-center dark:bg-gray-800">
                <img 
                  src={qrCodeImage} 
                  alt="QR Code" 
                  className={`w-48 h-48 transition-opacity ${timeLeft === 0 ? 'opacity-30' : 'opacity-100'}`}
                  data-testid="img-qr-code"
                />
                <div className={`absolute top-2 right-2 px-2 py-1 rounded-md flex items-center gap-1 text-[10px] font-bold border ${
                  timeLeft === 0
                    ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
                    : timeLeft < 60
                    ? 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800'
                    : 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                }`}>
                  <Timer className="h-3 w-3" />
                  {timeLeft === 0 ? 'Expirado' : timeLeft >= 60 ? `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')}` : `${timeLeft}s`}
                </div>
              </div>
              
              <div className="space-y-2 text-center">
                <h3 className="text-base font-bold text-blue-700 dark:text-blue-300">📱 Escaneie o QR Code</h3>
                
                <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg text-xs text-gray-700 dark:text-gray-300">
                  <p className="font-medium mb-1">Como conectar:</p>
                  <ol className="text-left space-y-0.5">
                    <li><strong>1.</strong> No celular, abra o WhatsApp</li>
                    <li><strong>2.</strong> Toque em <strong>Aparelhos conectados</strong></li>
                    <li><strong>3.</strong> Toque em <strong>Conectar um aparelho</strong></li>
                  </ol>
                </div>

                <div className="space-y-2 text-left mt-4 border-t pt-4">
                  <Label htmlFor="connection-name" className="text-xs font-medium">
                    Nome da Conexão (Opcional)
                  </Label>
                  <Input
                    id="connection-name"
                    placeholder="Ex: WhatsApp Business Loja"
                    value={connectionName}
                    className="h-8 text-sm"
                    onChange={(e) => setConnectionName(e.target.value)}
                  />
                </div>
                
                <Button
                  onClick={() => {
                    setShowQR(false);
                    setQrCodeImage("");
                    setTimeLeft(300);
                  }}
                  variant="outline"
                  size="sm"
                  className="w-full text-xs mt-2"
                  data-testid="button-regenerate-qr"
                >
                  🔄 Gerar Novo QR Code
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
