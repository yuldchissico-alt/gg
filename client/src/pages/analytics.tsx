import { useQuery } from "@tanstack/react-query";
import type { AnalyticsResponse } from "@shared/api-types";
import Sidebar from "@/components/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart3, 
  MessageSquare, 
  Users, 
  Zap, 
  TrendingUp, 
  TrendingDown,
  Clock,
  CheckCircle,
  XCircle,
  Activity,
  Target,
  Send,
  Eye
} from "lucide-react";

interface AnalyticsData {
  totalFunnels: number;
  activeFunnels: number;
  totalContacts: number;
  activeContacts: number;
  totalMessages: number;
  todayMessages: number;
  sentMessages: number;
  deliveredMessages: number;
  deliveryRate: number;
  schedulerTasks: number;
}

export default function Analytics() {
  const { data: analytics, isLoading: analyticsLoading, error } = useQuery<AnalyticsResponse>({
    queryKey: ["/api/analytics/dashboard"],
    retry: false,
    refetchInterval: 30000, // Refetch every 30 seconds for real-time updates
  });

  // Calculate additional metrics from analytics data only
  const calculateMetrics = () => {
    const deliveryRate = analytics?.deliveryRate || 0;
    
    if (!analytics) {
      return {
        funnelSuccessRate: 0,
        avgMessagesPerFunnel: 0,
        contactEngagementRate: 0,
        recentActivity: [],
      };
    }

    const funnelSuccessRate = analytics.totalFunnels > 0 
      ? (analytics.activeFunnels / analytics.totalFunnels) * 100 
      : 0;

    const avgMessagesPerFunnel = analytics.totalFunnels > 0 
      ? analytics.totalMessages / analytics.totalFunnels 
      : 0;

    const contactEngagementRate = analytics.totalContacts > 0 
      ? (analytics.activeContacts / analytics.totalContacts) * 100 
      : 0;

    // Create recent activity from analytics data
    const recentActivity = [
      {
        id: 1,
        type: 'funnel',
        title: `${analytics.activeFunnels} funis ativos`,
        time: 'Agora',
        status: 'success'
      },
      {
        id: 2,
        type: 'message',
        title: `${analytics.todayMessages} mensagens enviadas hoje`,
        time: 'Últimas 24h',
        status: 'success'
      },
      {
        id: 3,
        type: 'contact',
        title: `${analytics.activeContacts} contatos ativos`,
        time: 'Total',
        status: 'info'
      },
      {
        id: 4,
        type: 'delivery',
        title: `Taxa de entrega: ${deliveryRate.toFixed(1)}%`,
        time: 'Média geral',
        status: deliveryRate >= 90 ? 'success' : deliveryRate >= 70 ? 'warning' : 'error'
      }
    ];

    return {
      funnelSuccessRate,
      avgMessagesPerFunnel,
      contactEngagementRate,
      recentActivity,
    };
  };

  const metrics = calculateMetrics();

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-card border-b border-border pl-14 pr-4 lg:px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold" data-testid="text-page-title">Relatórios e Analytics</h1>
              <p className="text-sm text-muted-foreground">Acompanhe o desempenho dos seus funis em tempo real</p>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="text-primary border-primary">
                <Activity className="h-3 w-3 mr-1" />
                Tempo Real
              </Badge>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-6 overflow-auto">
          {analyticsLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Carregando analytics...</p>
              </div>
            </div>
          ) : error ? (
            <div className="text-center py-12" data-testid="error-state-analytics">
              <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Erro ao Carregar Dados</h3>
              <p className="text-muted-foreground">
                Não foi possível carregar os dados de analytics. Tente novamente.
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Funis Ativos</CardTitle>
                    <Zap className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-active-funnels">
                      {analytics?.activeFunnels || 0}
                    </div>
                    <div className="flex items-center space-x-2 mt-1">
                      <Badge variant="outline" className="text-primary border-primary text-xs">
                        {analytics?.totalFunnels || 0} total
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        {metrics.funnelSuccessRate.toFixed(0)}% ativos
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Mensagens Enviadas</CardTitle>
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-total-messages">
                      {analytics?.totalMessages || 0}
                    </div>
                    <div className="flex items-center space-x-2 mt-1">
                      <Badge variant="outline" className="text-primary border-primary text-xs">
                        {analytics?.todayMessages || 0} hoje
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        {metrics.avgMessagesPerFunnel.toFixed(1)} por funil
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Contatos</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-total-contacts">
                      {analytics?.totalContacts || 0}
                    </div>
                    <div className="flex items-center space-x-2 mt-1">
                      <Badge variant="secondary" className="text-xs">
                        {analytics?.activeContacts || 0} ativos
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        {metrics.contactEngagementRate.toFixed(1)}% engajamento
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Taxa de Entrega</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-delivery-rate">
                      {analytics?.deliveryRate ? `${analytics.deliveryRate.toFixed(1)}%` : '0.0%'}
                    </div>
                    <div className="flex items-center space-x-2 mt-1">
                      <Badge 
                        variant={(analytics?.deliveryRate || 0) >= 90 ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {analytics?.deliveredMessages || 0} entregues
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        de {analytics?.sentMessages || 0} enviadas
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Performance Charts */}
              <div className="grid grid-cols-1 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Performance de Entrega</CardTitle>
                    <CardDescription>
                      Acompanhe o sucesso das suas mensagens em tempo real
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span>Mensagens Enviadas</span>
                          <span className="font-medium" data-testid="text-sent-messages">
                            {analytics?.sentMessages || 0}
                          </span>
                        </div>
                        <Progress 
                          value={analytics?.totalMessages ? (analytics.sentMessages / analytics.totalMessages) * 100 : 0} 
                          className="h-2" 
                        />
                      </div>
                      
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span>Mensagens Entregues</span>
                          <span className="font-medium text-green-600" data-testid="text-delivered-messages">
                            {analytics?.deliveredMessages || 0}
                          </span>
                        </div>
                        <Progress 
                          value={analytics?.sentMessages ? (analytics.deliveredMessages / analytics.sentMessages) * 100 : 0} 
                          className="h-2"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span>Taxa de Sucesso Geral</span>
                          <span className={`font-medium ${
                            (analytics?.deliveryRate || 0) >= 90 ? 'text-green-600' : 
                            (analytics?.deliveryRate || 0) >= 70 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {analytics?.deliveryRate ? `${analytics.deliveryRate.toFixed(1)}%` : '0.0%'}
                          </span>
                        </div>
                        <Progress 
                          value={analytics?.deliveryRate || 0} 
                          className="h-2"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Activity Feed */}
              <Card>
                <CardHeader>
                  <CardTitle>Atividade Recente</CardTitle>
                  <CardDescription>
                    Últimas atividades do sistema em tempo real
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {metrics.recentActivity.map((activity) => (
                      <div key={activity.id} className="flex items-center space-x-4">
                        <div className={`w-2 h-2 rounded-full ${
                          activity.status === 'success' ? 'bg-green-500' :
                          activity.status === 'warning' ? 'bg-yellow-500' :
                          activity.status === 'error' ? 'bg-red-500' : 'bg-blue-500'
                        }`}></div>
                        <div className="flex-1">
                          <p className="text-sm font-medium" data-testid={`text-activity-${activity.id}`}>
                            {activity.title}
                          </p>
                          <p className="text-xs text-muted-foreground">{activity.time}</p>
                        </div>
                        <div className="flex items-center space-x-1">
                          {activity.status === 'success' && <CheckCircle className="h-4 w-4 text-green-500" />}
                          {activity.status === 'warning' && <Clock className="h-4 w-4 text-yellow-500" />}
                          {activity.status === 'error' && <XCircle className="h-4 w-4 text-red-500" />}
                          {activity.status === 'info' && <Eye className="h-4 w-4 text-blue-500" />}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
