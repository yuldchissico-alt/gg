import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { CampaignsResponse, Campaign } from "@shared/api-types";
import Sidebar from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { 
  Plus, 
  Search, 
  Filter, 
  Play, 
  Pause, 
  Square, 
  MoreVertical, 
  Edit, 
  Trash2, 
  BarChart3, 
  Users,
  MessageSquare,
  TrendingUp
} from "lucide-react";

export default function Campaigns() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  
  // Form state
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    status: 'active' | 'paused' | 'inactive' | 'draft';
    triggerPhrase: string;
    isActive: boolean;
  }>({
    name: "",
    description: "",
    status: "draft",
    triggerPhrase: "",
    isActive: false,
  });

  const { data: campaigns, isLoading: campaignsLoading } = useQuery<CampaignsResponse>({
    queryKey: ["/api/campaigns"],
    retry: false,
  });

  const createCampaignMutation = useMutation({
    mutationFn: async (campaignData: typeof formData) => {
      const response = await apiRequest("POST", "/api/campaigns", campaignData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      toast({
        title: "Campanha Criada",
        description: "Sua campanha foi criada com sucesso!",
        duration: 2000,
      });
      setShowCreateDialog(false);
      resetForm();
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao criar campanha. Tente novamente.",
        variant: "destructive",
        duration: 2000,
      });
    },
  });

  const updateCampaignMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Campaign> }) => {
      const response = await apiRequest("PUT", `/api/campaigns/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      toast({
        title: "Campanha Atualizada",
        description: "As alterações foram salvas com sucesso!",
        duration: 2000,
      });
      setEditingCampaign(null);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao atualizar campanha.",
        variant: "destructive",
        duration: 2000,
      });
    },
  });

  const deleteCampaignMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      await apiRequest("DELETE", `/api/campaigns/${campaignId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      toast({
        title: "Campanha Excluída",
        description: "A campanha foi removida com sucesso!",
        duration: 2000,
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao excluir campanha.",
        variant: "destructive",
        duration: 2000,
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      status: "draft",
      triggerPhrase: "",
      isActive: false,
    });
  };

  const handleCreateCampaign = () => {
    if (!formData.name.trim()) {
      toast({
        title: "Nome Obrigatório",
        description: "Digite um nome para a campanha",
        variant: "destructive",
        duration: 2000,
      });
      return;
    }
    
    if (!formData.triggerPhrase.trim()) {
      toast({
        title: "Frase Gatilho Obrigatória",
        description: "Digite uma frase gatilho para a campanha",
        variant: "destructive",
        duration: 2000,
      });
      return;
    }

    createCampaignMutation.mutate(formData);
  };

  const handleEditCampaign = (campaign: Campaign) => {
    setFormData({
      name: campaign.name,
      description: campaign.description || "",
      status: campaign.status,
      triggerPhrase: campaign.triggerPhrase,
      isActive: campaign.isActive,
    });
    setEditingCampaign(campaign);
  };

  const handleUpdateCampaign = () => {
    if (!editingCampaign) return;
    
    updateCampaignMutation.mutate({
      id: editingCampaign.id,
      data: formData,
    });
  };

  const handleToggleCampaign = (campaign: Campaign) => {
    updateCampaignMutation.mutate({
      id: campaign.id,
      data: { isActive: !campaign.isActive },
    });
  };

  const handleDeleteCampaign = (campaignId: string) => {
    if (window.confirm("Tem certeza que deseja excluir esta campanha?")) {
      deleteCampaignMutation.mutate(campaignId);
    }
  };

  const filteredCampaigns = campaigns?.filter((campaign: Campaign) => {
    const matchesSearch = campaign.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         campaign.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         campaign.triggerPhrase.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || campaign.status === statusFilter;
    return matchesSearch && matchesStatus;
  }) || [];

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: "bg-green-500",
      paused: "bg-yellow-500", 
      inactive: "bg-blue-500",
      draft: "bg-gray-500",
    };
    return colors[status] || "bg-gray-500";
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      active: "Ativo",
      paused: "Pausado",
      inactive: "Inativo",
      draft: "Rascunho",
    };
    return labels[status] || status;
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-card border-b border-border pl-14 pr-4 lg:px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold" data-testid="text-page-title">Disparos</h1>
              <p className="text-sm text-muted-foreground">Gerencie seus disparos e automações</p>
            </div>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-campaign">
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Disparo
                </Button>
              </DialogTrigger>
              <DialogContent data-testid="dialog-create-campaign">
                <DialogHeader>
                  <DialogTitle>Novo Disparo</DialogTitle>
                  <DialogDescription>
                    Crie um novo disparo de automação para WhatsApp
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Nome do Disparo</Label>
                    <Input
                      id="name"
                      placeholder="Ex: Disparo de Interesse"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      data-testid="input-campaign-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Descrição</Label>
                    <Textarea
                      id="description"
                      placeholder="Descreva o objetivo desta campanha..."
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      data-testid="textarea-campaign-description"
                    />
                  </div>
                  <div>
                    <Label htmlFor="triggerPhrase">Frase Gatilho</Label>
                    <Input
                      id="triggerPhrase"
                      placeholder="Ex: Estou interessado"
                      value={formData.triggerPhrase}
                      onChange={(e) => setFormData({ ...formData, triggerPhrase: e.target.value })}
                      data-testid="input-trigger-phrase"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="isActive"
                      checked={formData.isActive}
                      onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                      data-testid="switch-campaign-active"
                    />
                    <Label htmlFor="isActive">Ativar campanha imediatamente</Label>
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setShowCreateDialog(false)} data-testid="button-cancel">
                      Cancelar
                    </Button>
                    <Button 
                      onClick={handleCreateCampaign}
                      disabled={createCampaignMutation.isPending}
                      data-testid="button-save-campaign"
                    >
                      {createCampaignMutation.isPending ? "Criando..." : "Criar Disparo"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </header>

        {/* Filters */}
        <div className="bg-card border-b border-border px-6 py-3">
          <div className="flex items-center space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Buscar disparos..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                data-testid="input-search-campaigns"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40" data-testid="select-status-filter">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="paused">Pausado</SelectItem>
                <SelectItem value="inactive">Inativo</SelectItem>
                <SelectItem value="draft">Rascunho</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Main Content */}
        <main className="flex-1 p-6 overflow-auto">
          {campaignsLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Carregando campanhas...</p>
              </div>
            </div>
          ) : filteredCampaigns.length === 0 ? (
            <div className="text-center py-12" data-testid="empty-state-campaigns">
              <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhum disparo encontrado</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm || statusFilter !== "all" 
                  ? "Tente ajustar os filtros de busca" 
                  : "Crie seu primeiro disparo para começar"
                }
              </p>
              {(!searchTerm && statusFilter === "all") && (
                <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-first-campaign">
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeiro Disparo
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCampaigns.map((campaign: Campaign) => (
                <Card key={campaign.id} className="relative" data-testid={`campaign-card-${campaign.id}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{campaign.name}</CardTitle>
                        <CardDescription className="mt-1">
                          {campaign.description || "Sem descrição"}
                        </CardDescription>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" data-testid={`button-campaign-menu-${campaign.id}`}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditCampaign(campaign)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleCampaign(campaign)}>
                            {campaign.isActive ? (
                              <>
                                <Pause className="h-4 w-4 mr-2" />
                                Pausar
                              </>
                            ) : (
                              <>
                                <Play className="h-4 w-4 mr-2" />
                                Ativar
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDeleteCampaign(campaign.id)}>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="flex items-center space-x-2 mt-2">
                      <Badge className={getStatusColor(campaign.status)}>
                        {getStatusLabel(campaign.status)}
                      </Badge>
                      {campaign.isActive && (
                        <Badge variant="outline" className="text-green-500 border-green-500">
                          Ativo
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Gatilho:</p>
                        <p className="text-sm">{campaign.triggerPhrase}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Funis</p>
                          <p className="text-sm font-medium">0</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Execuções</p>
                          <p className="text-sm font-medium">0</p>
                        </div>
                      </div>
                      <div className="pt-2 border-t">
                        <p className="text-xs text-muted-foreground">
                          Criada em {new Date(campaign.createdAt).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Edit Campaign Dialog */}
      <Dialog open={!!editingCampaign} onOpenChange={(open) => !open && setEditingCampaign(null)}>
        <DialogContent data-testid="dialog-edit-campaign">
          <DialogHeader>
            <DialogTitle>Editar Disparo</DialogTitle>
            <DialogDescription>
              Atualize as informações do seu disparo
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="editName">Nome do Disparo</Label>
              <Input
                id="editName"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                data-testid="input-edit-campaign-name"
              />
            </div>
            <div>
              <Label htmlFor="editDescription">Descrição</Label>
              <Textarea
                id="editDescription"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                data-testid="textarea-edit-campaign-description"
              />
            </div>
            <div>
              <Label htmlFor="editTriggerPhrase">Frase Gatilho</Label>
              <Input
                id="editTriggerPhrase"
                value={formData.triggerPhrase}
                onChange={(e) => setFormData({ ...formData, triggerPhrase: e.target.value })}
                data-testid="input-edit-trigger-phrase"
              />
            </div>
            <div>
              <Label htmlFor="editStatus">Status</Label>
              <Select value={formData.status} onValueChange={(value: any) => setFormData({ ...formData, status: value })}>
                <SelectTrigger data-testid="select-edit-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Rascunho</SelectItem>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="paused">Pausado</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="editIsActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                data-testid="switch-edit-campaign-active"
              />
              <Label htmlFor="editIsActive">Disparo ativo</Label>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setEditingCampaign(null)} data-testid="button-cancel-edit">
                Cancelar
              </Button>
              <Button 
                onClick={handleUpdateCampaign}
                disabled={updateCampaignMutation.isPending}
                data-testid="button-save-edit"
              >
                {updateCampaignMutation.isPending ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
