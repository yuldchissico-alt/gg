import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { DashboardAnalytics } from "@shared/api-types";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type WhatsAppStatus = {
  connected: boolean;
  phoneNumber?: string;
};

type User = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};
import { queryClient } from "@/lib/queryClient";
import Sidebar from "@/components/sidebar";
import WhatsAppConnectionModal from "@/components/whatsapp-connection-modal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, MessageSquare, Users, TrendingUp, Wifi, WifiOff, Send, Loader2, PlayCircle, Filter, Rocket } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Dashboard() {
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState("Olá, este é um teste de envio do PilotZap!");
  const [ongoingExecutions, setOngoingExecutions] = useState<any[]>([]);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const { toast } = useToast();

  const { data: analytics, isLoading: analyticsLoading } = useQuery<any>({
    queryKey: ["/api/analytics/dashboard"],
    retry: false,
    staleTime: 30000, 
    refetchInterval: 10000, // Refresh dashboard every 10 seconds for real-time feel
  });

  // Fetch recent messages for activities
  const { data: messages } = useQuery<any[]>({
    queryKey: ["/api/messages"],
    staleTime: 10000,
    refetchInterval: 10000,
  });

  // Sync state with query data
  useEffect(() => {
    if (analytics?.ongoingExecutions) {
      const mockPhones = ["5511999998888", "5511777776666", "5511999991111", "5511988882222"];
      const filtered = analytics.ongoingExecutions.filter((exe: any) => {
        const phone = String(exe.phoneNumber || "");
        const name = String(exe.funnelName || "");
        return !mockPhones.includes(phone) && 
               !name.includes("FLUXO VCB IMPOR") &&
               !name.includes("Vendas Diretas") &&
               !name.includes("Suporte VIP") &&
               !name.includes("Lembrete de Aula");
      });
      setOngoingExecutions(filtered);
    } else {
      setOngoingExecutions([]);
    }
  }, [analytics]);

  useEffect(() => {
    if (messages) {
      setRecentLogs(messages.slice(0, 5));
    }
  }, [messages]);

  const { data: whatsappStatus } = useQuery<WhatsAppStatus>({
    queryKey: ["/api/whatsapp/status"],
    retry: false,
  });

  const { data: user } = useQuery<User>({
    queryKey: ["/api/user/me"],
    retry: false,
  });

  const [displayName, setDisplayName] = useState("Usuário");

  useEffect(() => {
    const storedName = localStorage.getItem("demo_user_name");
    if (storedName) {
      setDisplayName(storedName);
    } else if (user?.firstName) {
      setDisplayName(user.firstName);
    }
  }, [user]);

  const sendTestMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/messages/send", {
        phoneNumber: testPhone.replace(/\D/g, ''),
        content: testMessage,
        type: "text",
        // No contactId for direct test
        directSend: true 
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Falha ao enviar mensagem");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Mensagem Enviada!",
        description: "O teste de envio foi concluído com sucesso.",
        duration: 3000,
      });
      setShowTestDialog(false);
      setTestPhone("");
    },
    onError: (error: Error) => {
      toast({
        title: "Erro no Envio",
        description: error.message,
        variant: "destructive",
        duration: 4000,
      });
    }
  });

  const stopExecutionMutation = useMutation({
    mutationFn: async (id: string) => {
      // In a real app, this would call the API. For demo/mock, we just invalidate
      const response = await apiRequest("POST", `/api/funnel-executions/${id}/stop`, {});
      if (!response.ok) throw new Error("Falha ao parar disparo");
      return response.json();
    },
    onSuccess: (_, variables) => {
      // Update local state state immediately
      setOngoingExecutions(prev => prev.filter(exe => String(exe.id) !== String(variables)));
      
      // Update query data as well to maintain consistency
      queryClient.setQueryData(["/api/analytics/dashboard"], (oldData: any) => {
        if (!oldData) return oldData;
        const updatedExecutions = (oldData.ongoingExecutions || [])
          .filter((exe: any) => String(exe.id) !== String(variables));
          
        return {
          ...oldData,
          ongoingExecutions: updatedExecutions,
          activeFunnels: Math.max(0, (oldData.activeFunnels || 0) - 1)
        };
      });
      
      toast({ title: "Disparo Interrompido", description: "O fluxo para este contato foi parado.", duration: 2000 });
    }
  });

  const metricsData = analytics?.weeklyData || [
    { name: 'Dom', mensagens: 0, contatos: 0, conversoes: 0, funisAtivos: 0, taxaFinalizacao: 0 },
    { name: 'Seg', mensagens: 0, contatos: 0, conversoes: 0, funisAtivos: 0, taxaFinalizacao: 0 },
    { name: 'Ter', mensagens: 0, contatos: 0, conversoes: 0, funisAtivos: 0, taxaFinalizacao: 0 },
    { name: 'Qua', mensagens: 0, contatos: 0, conversoes: 0, funisAtivos: 0, taxaFinalizacao: 0 },
    { name: 'Qui', mensagens: 0, contatos: 0, conversoes: 0, funisAtivos: 0, taxaFinalizacao: 0 },
    { name: 'Sex', mensagens: 0, contatos: 0, conversoes: 0, funisAtivos: 0, taxaFinalizacao: 0 },
    { name: 'Sáb', mensagens: 0, contatos: 0, conversoes: 0, funisAtivos: 0, taxaFinalizacao: 0 },
  ];

  // Calculate comparison metrics
  const getMessageDiff = () => {
    if (!analytics) return { value: 0, text: "0%", colorClass: "text-muted-foreground" };
    const today = analytics.todayMessages || 0;
    const yesterday = analytics.yesterdayMessages || 0;
    if (yesterday === 0) {
      if (today > 0) return { value: 100, text: `+${today} novas`, colorClass: "text-green-600" };
      return { value: 0, text: "0%", colorClass: "text-muted-foreground" };
    }
    const diff = ((today - yesterday) / yesterday) * 100;
    const sign = diff > 0 ? "+" : "";
    const colorClass = diff > 0 ? "text-green-600" : diff < 0 ? "text-red-600" : "text-muted-foreground";
    return { value: diff, text: `${sign}${diff.toFixed(0)}%`, colorClass };
  };

  const getFunnelInfo = () => {
    if (!analytics) return "Total: 0 funis";
    const total = analytics.totalFunnels || 0;
    const active = analytics.activeFunnels || 0;
    if (total === 0) return "Nenhum funil criado";
    return `${active}/${total} ativos`;
  };

  const getDeliveryInfo = () => {
    if (!analytics) return "0 mensagens enviadas";
    const sent = analytics.sentMessages || 0;
    const delivered = analytics.deliveredMessages || 0;
    if (sent === 0) return "Nenhuma mensagem enviada";
    return `${delivered}/${sent} entregues (${analytics.deliveryRate?.toFixed(0) || 0}%)`;
  };

  const getContactDiff = () => {
    if (!analytics) return { value: 0, text: "0%", colorClass: "text-muted-foreground" };
    const total = analytics.totalContacts || 0;
    const today = analytics.activeContacts || 0; // Simplified for demo/real data calculation
    if (total === 0) return { value: 0, text: "0%", colorClass: "text-muted-foreground" };
    const diff = (today / total) * 100;
    return { value: diff, text: `+${diff.toFixed(0)}%`, colorClass: "text-green-600" };
  };

  const getRateDiff = () => {
    if (!analytics) return { value: 0, text: "0%", colorClass: "text-muted-foreground" };
    const rate = analytics.deliveryRate || 0;
    const prevRate = analytics.yesterdayDeliveryRate || 0;
    if (prevRate === 0) {
      if (rate > 0) return { value: 100, text: `+${rate.toFixed(0)}%`, colorClass: "text-green-600" };
      return { value: 0, text: "0%", colorClass: "text-muted-foreground" };
    }
    const diff = rate - prevRate;
    const sign = diff > 0 ? "+" : "";
    const colorClass = diff > 0 ? "text-green-600" : diff < 0 ? "text-red-600" : "text-muted-foreground";
    return { value: diff, text: `${sign}${diff.toFixed(1)}%`, colorClass };
  };

  const contactDiff = getContactDiff();
  const rateDiff = getRateDiff();
  const messageDiff = getMessageDiff();

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-card border-b border-border pl-14 pr-4 lg:pl-6 lg:pr-6 py-3 sm:py-4 lg:py-5 pt-[16px] pb-[16px]">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex-1">
              <h1 className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold text-foreground" data-testid="text-dashboard-title">
                Bem-vindo, <span className="text-primary">{displayName}</span>
              </h1>
              <p className="text-sm sm:text-base lg:text-lg text-muted-foreground mt-1">Aqui estão algumas métricas da sua operação:</p>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center space-x-2 px-3 sm:px-4 py-2 sm:text-sm font-medium border-none text-justify text-[12px] pl-[8px] pr-[8px] pt-[4px] pb-[4px]">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${whatsappStatus?.connected ? "bg-green-500" : "bg-red-500"}`}></span>
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${whatsappStatus?.connected ? "bg-green-500" : "bg-red-500"}`}></span>
                  </span>
                  <span className={whatsappStatus?.connected ? "text-muted-foreground" : "text-red-500"}>
                    {whatsappStatus?.connected ? "Conectado" : "Desconectado"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-2 sm:p-4 lg:p-6 overflow-auto">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 lg:gap-6 mb-4 sm:mb-6 lg:mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-4 lg:p-6 pb-1 sm:pb-2">
                <CardTitle className="text-[10px] sm:text-xs lg:text-sm font-medium">Funis Ativos</CardTitle>
                <Filter className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="p-3 sm:p-4 lg:p-6 pt-0">
                <div className="text-lg sm:text-xl lg:text-2xl font-bold" data-testid="text-active-funnels">
                  {analyticsLoading ? "..." : analytics?.triggeredTodayCount || 0}
                </div>
                <div className="flex flex-col gap-0.5 mt-1">
                  <p className="text-[10px] sm:text-xs lg:text-sm leading-tight text-muted-foreground">
                    {analyticsLoading ? "..." : (analytics?.triggeredTodayCount || 0) > 0 ? (
                      <>
                        <span className="text-primary font-bold">{analytics?.triggeredTodayCount} {analytics?.triggeredTodayCount === 1 ? 'funil' : 'funis'}</span> em execução hoje
                      </>
                    ) : (
                      "Nenhum funil ativo hoje"
                    )}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-4 lg:p-6 pb-1 sm:pb-2">
                <CardTitle className="text-[10px] sm:text-xs lg:text-sm font-medium">Total de Interações</CardTitle>
                <Rocket className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="p-3 sm:p-4 lg:p-6 pt-0">
                <div className="text-lg sm:text-xl lg:text-2xl font-bold" data-testid="text-today-messages">
                  {analyticsLoading ? "..." : analytics?.todayMessages || 0}
                </div>
                <div className="flex flex-col gap-0.5 mt-1">
                  <p className="text-[10px] sm:text-xs lg:text-sm leading-tight text-muted-foreground">
                    <span className={`${messageDiff.colorClass} font-medium`}>{messageDiff.text}</span> em relação ao período anterior
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-4 lg:p-6 pb-1 sm:pb-2">
                <CardTitle className="text-[10px] sm:text-xs lg:text-sm font-medium">Novos Contatos</CardTitle>
                <Users className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="p-3 sm:p-4 lg:p-6 pt-0">
                <div className="text-lg sm:text-xl lg:text-2xl font-bold" data-testid="text-active-contacts">
                  {analyticsLoading ? "..." : analytics?.totalContacts || 0}
                </div>
                <div className="flex flex-col gap-0.5 mt-1">
                  <p className="text-[10px] sm:text-xs lg:text-sm leading-tight text-muted-foreground">
                    <span className={`${contactDiff.colorClass} font-medium`}>{contactDiff.text}</span> em relação ao mês passado
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-4 lg:p-6 pb-1 sm:pb-2">
                <CardTitle className="text-[10px] sm:text-xs lg:text-sm font-medium">Taxa de Finalização</CardTitle>
                <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="p-3 sm:p-4 lg:p-6 pt-0">
                <div className="text-lg sm:text-xl lg:text-2xl font-bold" data-testid="text-delivery-rate">
                  {analyticsLoading ? "..." : `${(analytics?.deliveryRate || 0).toFixed(1)}%`}
                </div>
                <div className="flex flex-col gap-0.5 mt-1">
                  <p className="text-[10px] sm:text-xs lg:text-sm leading-tight text-muted-foreground">
                    <span className={`${rateDiff.colorClass} font-medium`}>{rateDiff.text}</span> em relação ao mês passado
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Metrics Chart */}
          <div className="grid grid-cols-1 gap-2 sm:gap-4 lg:gap-6 items-stretch">
            <Card className="min-w-0 flex flex-col overflow-hidden">
              <CardHeader className="p-2 sm:p-4 lg:p-6 pb-1 sm:pb-2">
                <CardTitle className="text-[10px] sm:text-base lg:text-lg">Análise de Desempenho</CardTitle>
                <CardDescription className="hidden sm:block text-[10px] sm:text-xs lg:text-sm">
                  Desempenho da sua automação nos últimos 7 dias
                </CardDescription>
              </CardHeader>
              <CardContent className="p-2 sm:p-4 lg:p-6 pt-0 flex-1">
                <div className="h-[250px] sm:h-[300px] lg:h-[350px] w-full" data-testid="chart-metrics">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={metricsData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="name" 
                        tick={{ fill: '#333333', fontSize: 8 }}
                      />
                      <YAxis 
                        tick={{ fill: '#333333', fontSize: 8 }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '4px',
                          fontSize: '9px'
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="mensagens" 
                        stroke="#000000" 
                        strokeWidth={2}
                        name="Interações"
                        dot={{ r: 3, fill: '#000000' }}
                        activeDot={{ r: 5 }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="contatos" 
                        stroke="#4b5563" 
                        strokeWidth={2}
                        name="Novos Contatos"
                        dot={{ r: 3, fill: '#4b5563' }}
                        activeDot={{ r: 5 }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="funisAtivos" 
                        stroke="#9ca3af" 
                        strokeWidth={2}
                        name="Funis ativos"
                        dot={{ r: 3, fill: '#9ca3af' }}
                        activeDot={{ r: 5 }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="taxaFinalizacao" 
                        stroke="#d1d5db" 
                        strokeWidth={2}
                        name="Taxa de Sucesso"
                        dot={{ r: 3, fill: '#d1d5db' }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                
                <div className="flex flex-row items-center justify-between mt-4 px-1 w-full overflow-hidden">
                  <div className="flex items-center gap-1 shrink-0">
                    <div className="h-1.5 w-1.5 rounded-full bg-[#000000]"></div>
                    <span className="text-[7.5px] sm:text-[9px] text-muted-foreground whitespace-nowrap">Interações</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <div className="h-1.5 w-1.5 rounded-full bg-[#4b5563]"></div>
                    <span className="text-[7.5px] sm:text-[9px] text-muted-foreground whitespace-nowrap">Novos Contatos</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <div className="h-1.5 w-1.5 rounded-full bg-[#9ca3af]"></div>
                    <span className="text-[7.5px] sm:text-[9px] text-muted-foreground whitespace-nowrap">Funis ativos</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <div className="h-1.5 w-1.5 rounded-full bg-[#d1d5db]"></div>
                    <span className="text-[7.5px] sm:text-[9px] text-muted-foreground whitespace-nowrap">Sucesso %</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
      {/* 🚀 MODAL ZAPRÁPIDO WHATSAPP - ABRIR AUTOMATICAMENTE */}
      <WhatsAppConnectionModal 
        open={showWhatsAppModal}
        onOpenChange={setShowWhatsAppModal}
      />
    </div>
  );
}
