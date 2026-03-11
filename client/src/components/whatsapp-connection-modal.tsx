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
  const [timeLeft, setTimeLeft] = useState(60);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 🎯 GERAR QR CODE DO BAILEYS VIA BACKEND
  const generateQRMutation = useMutation({
    mutationFn: async () => {
      // First, check connection status
      const statusRes = await apiRequest("GET", "/api/whatsapp/status");
      const statusData = await statusRes.json();
      if (statusData.connected) {
        return { connected: true };
      }

      // Reset timer before starting
      setTimeLeft(60);
      
      // Inicia processo de geração
      await apiRequest("POST", "/api/whatsapp/qr");
      
      // Polling para obter o QR Code
      let qr = "";
      let attempts = 0;
      const maxAttempts = 20; // Even more attempts
      
      while (!qr && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Se o modal foi fechado ou já conectou, para o polling
        if (!open) throw new Error("Modal fechado");

        const response = await apiRequest("POST", "/api/whatsapp/qr");
        const data = await response.json();
        
        // Se conectou durante o polling
        const checkStatus = await apiRequest("GET", "/api/whatsapp/status");
        const currentStatus = await checkStatus.json();
        if (currentStatus.connected) {
          return { connected: true };
        }

        qr = data.qrCode;
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
        setTimeLeft(60);
        
        toast({
          title: "✅ QR Code Atualizado!",
          description: "Escaneie para conectar",
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
    refetchInterval: (query) => {
      // Se estiver na tela do QR e não estiver conectado, poll status mais rápido
      if (open && showQR && !query.state.data?.connected) {
        return 2000;
      }
      return false;
    }
  });

  // Fecha o modal automaticamente se conectar via polling do useQuery
  useEffect(() => {
    if (open && showQR && whatsappStatus?.connected) {
      console.log("✅ Conexão detectada via polling!");
      
      const finishConnection = async () => {
        try {
          // Salva o nome da conexão se houver um
          if (connectionName.trim()) {
            await apiRequest("POST", "/api/whatsapp/connections", {
              name: connectionName.trim(),
              phoneNumber: whatsappStatus.phoneNumber || "",
              isConnected: true
            });
          }
          
          toast({
            title: "✅ Conectado com sucesso!",
            description: `WhatsApp ${connectionName || ""} vinculado.`,
            duration: 3000,
          });
          
          // RESET STATE BEFORE CLOSING
          setShowQR(false);
          setQrCodeImage("");
          onOpenChange(false);
          
          // Invalidate queries to update UI
          queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/connections"] });
          queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/status"] });
        } catch (error) {
          console.error("Erro ao salvar nome da conexão:", error);
          // Mesmo com erro no nome, fecha o modal pois conectou
          onOpenChange(false);
        }
      };
      
      finishConnection();
    }
  }, [whatsappStatus?.connected, open, showQR, connectionName, onOpenChange, queryClient, toast]);

  // Timer logic for QR Code expiration
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showQR && qrCodeImage && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            console.log("Tempo esgotado, disparando regeneração...");
            // Don't auto-regenerate if already connected or connecting
            if (!whatsappStatus?.connected) {
              generateQRMutation.mutate();
            }
            return 60;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [showQR, qrCodeImage, whatsappStatus?.connected, generateQRMutation]);

  // Reset timer when open changes
  useEffect(() => {
    if (!open) {
      setTimeLeft(60);
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
      setTimeLeft(60);
      
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
            <div className="space-y-3 p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border-2 border-purple-300 dark:from-purple-950 dark:to-purple-900 dark:border-purple-700">
              <div>
                <h3 className="text-base font-bold text-purple-700 dark:text-purple-300">Pronto para conectar?</h3>
                <p className="text-xs text-gray-600 dark:text-gray-300">Clique abaixo para gerar o QR Code</p>
              </div>
              
              {generateQRMutation.isPending ? (
                <div className="flex flex-col items-center space-y-2">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <p className="text-sm font-medium text-blue-700 dark:text-blue-400">Gerando QR Code...</p>
                </div>
              ) : (
                <Button
                  onClick={() => generateQRMutation.mutate()}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 text-sm"
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
                  className="w-48 h-48"
                  data-testid="img-qr-code"
                />
                <div className="absolute top-2 right-2 bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded-md flex items-center gap-1 text-[10px] font-bold text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  <Timer className="h-3 w-3" />
                  {timeLeft}s
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
                    setTimeLeft(60);
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
