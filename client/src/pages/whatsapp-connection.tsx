import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/sidebar";
import WhatsAppConnectionModal from "@/components/whatsapp-connection-modal";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Smartphone } from "lucide-react";

export default function WhatsAppConnection() {
  const [showConnectionModal, setShowConnectionModal] = useState(false);

  const { data: whatsappStatus } = useQuery<any>({
    queryKey: ["/api/whatsapp/status"],
    refetchInterval: 5000,
  });

  const { data: connections } = useQuery<any[]>({
    queryKey: ["/api/whatsapp/connections"],
    refetchInterval: 5000,
  });

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-card border-b border-border pl-14 pr-4 lg:px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold" data-testid="text-page-title">Conexão</h1>
              <p className="text-sm text-muted-foreground mt-1">Conecte e verifique sua conexão com o WhatsApp</p>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 overflow-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl w-full mx-auto">
            {/* Status Card */}
            <div className="space-y-4">
              {connections && connections.length > 0 ? (
                connections.map((conn: any) => (
                  <Card key={conn.id} className="bg-[#1a1b23] border border-border/50 shadow-xl rounded-2xl overflow-hidden">
                    <CardContent className="pt-8 pb-8 px-8 space-y-6">
                      <div className="flex items-center gap-3">
                        <span className="text-white text-sm font-medium">Status:</span>
                        <Badge className={`${conn.isConnected ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500"} border-none px-3 py-1 rounded-md font-bold text-[10px]`}>
                          {conn.isConnected ? "Conectado" : "Desconectado"}
                        </Badge>
                      </div>
                      
                      <div className="space-y-6">
                        <div>
                          <h3 className="text-white text-xl font-bold">
                            {conn.name || (conn.isConnected ? "Número conectado" : "Número desconectado")}
                          </h3>
                          {conn.phoneNumber && <p className="text-gray-400 text-sm mt-1">{conn.phoneNumber}</p>}
                        </div>
                        <Button 
                          className={`w-full ${conn.isConnected ? "bg-red-500 hover:bg-red-600" : "bg-primary hover:bg-primary/90"} text-white font-bold h-12 text-base rounded-xl transition-all active:scale-95`}
                          onClick={() => {
                            if (conn.isConnected) {
                              apiRequest("POST", "/api/whatsapp/disconnect", { connectionId: conn.id }).then(() => {
                                queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/status"] });
                                queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/connections"] });
                              });
                            } else {
                              setShowConnectionModal(true);
                            }
                          }}
                        >
                          {conn.isConnected ? "Desconectar" : "Conectar"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card className="bg-[#1a1b23] border border-border/50 shadow-xl rounded-2xl overflow-hidden">
                  <CardContent className="pt-8 pb-8 px-8 space-y-6">
                    <div className="flex items-center gap-3">
                      <span className="text-white text-sm font-medium">Status:</span>
                      <Badge className="bg-red-500/20 text-red-500 border-none px-3 py-1 rounded-md font-bold text-[10px]">
                        Desconectado
                      </Badge>
                    </div>
                    
                    <div className="space-y-6">
                      <h3 className="text-white text-xl font-bold">Conecte um número</h3>
                      <Button 
                        className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 text-base rounded-xl transition-all active:scale-95"
                        onClick={() => setShowConnectionModal(true)}
                      >
                        Conectar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Purchase Options */}
            <div className="space-y-4 h-full">
              <h2 className="text-xl font-bold text-white mb-2">Mais números:</h2>
              
              <div className="space-y-3">
                {/* Option 1 */}
                <div className="group relative">
                  <Button className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-bold text-sm rounded-full border border-primary/20 flex items-center justify-center relative overflow-hidden transition-all active:scale-[0.98]">
                    + 1 número por 500 MT
                  </Button>
                </div>

                {/* Option 2 */}
                <div className="group relative">
                  <div className="absolute -top-2.5 right-6 z-10 bg-primary text-white text-[9px] font-extrabold px-2 py-0.5 rounded-full border border-primary/30 shadow-sm">
                    PROMO 15% OFF
                  </div>
                  <Button className="w-full h-14 bg-primary hover:bg-primary/90 text-white font-bold text-sm rounded-full border border-primary/20 flex items-center justify-center relative overflow-hidden transition-all active:scale-[0.98]">
                    <div className="flex flex-col items-center">
                      <span>+ 2 números de: <span className="line-through opacity-60">1000 MT</span></span>
                      <span className="text-xs">por: 750 MT</span>
                    </div>
                  </Button>
                </div>

                {/* Option 3 */}
                <div className="group relative">
                  <div className="absolute -top-2.5 right-6 z-10 bg-primary text-white text-[9px] font-extrabold px-2 py-0.5 rounded-full border border-primary/30 shadow-sm">
                    PROMO 20% OFF
                  </div>
                  <Button className="w-full h-14 bg-primary hover:bg-primary/90 text-white font-bold text-sm rounded-full border border-primary/20 flex items-center justify-center relative overflow-hidden transition-all active:scale-[0.98]">
                    <div className="flex flex-col items-center">
                      <span>+ 3 números de: <span className="line-through opacity-60">1500 MT</span></span>
                      <span className="text-xs">por: 1200 MT</span>
                    </div>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      <WhatsAppConnectionModal 
        open={showConnectionModal}
        onOpenChange={setShowConnectionModal}
      />
    </div>
  );
}
