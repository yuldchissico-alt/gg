import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { saveToStorage, getStorageKey } from "@/lib/localStorage";
import { useLocation } from "wouter";
import type { Funnel } from "@shared/schema";
import Sidebar from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { 
  Plus,
  Trash2,
  Edit,
  MessageSquare,
  Upload,
  Download,
  Check
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function FunnelBuilder() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [selectedFunnelsForExport, setSelectedFunnelsForExport] = useState<string[]>([]);
  const [newFunnelName, setNewFunnelName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: funnels, isLoading } = useQuery<Funnel[]>({
    queryKey: ["/api/funnels"],
    retry: false,
  });

  const createFunnelMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/funnels", {
        name: newFunnelName,
        status: "draft",
        flowData: { nodes: [], edges: [] },
      });
      return response.json();
    },
    onSuccess: (newFunnel) => {
      toast({
        title: "Funil Criado",
        description: "Seu funil foi criado com sucesso!",
        duration: 2000,
      });
      // Save to localStorage immediately
      const funnelsList = queryClient.getQueryData<Funnel[]>(["/api/funnels"]) || [];
      const updatedFunnels = [...funnelsList, newFunnel];
      saveToStorage(getStorageKey("/api/funnels"), updatedFunnels);
      
      queryClient.invalidateQueries({ queryKey: ["/api/funnels"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/dashboard"] });
      setIsCreateDialogOpen(false);
      setNewFunnelName("");
    },
    onError: (error: any) => {
      toast({
        title: "Limite Excedido",
        description: error.message || "Falha ao criar funil. Tente novamente.",
        variant: "destructive",
        duration: 2000,
      });
    },
  });

  const deleteFunnelMutation = useMutation({
    mutationFn: async (funnelId: string) => {
      const response = await apiRequest("DELETE", `/api/funnels/${funnelId}`);
      return response.json();
    },
    onSuccess: (_, funnelId) => {
      toast({
        title: "Funil Removido",
        description: "Funil removido com sucesso!",
        duration: 2000,
      });
      // Update localStorage immediately
      const funnelsList = queryClient.getQueryData<Funnel[]>(["/api/funnels"]) || [];
      const updatedFunnels = funnelsList.filter(f => f.id !== funnelId);
      saveToStorage(getStorageKey("/api/funnels"), updatedFunnels);
      
      queryClient.invalidateQueries({ queryKey: ["/api/funnels"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/dashboard"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error?.message || "Falha ao remover funil.",
        variant: "destructive",
        duration: 2000,
      });
    },
  });

  const toggleFunnelStatusMutation = useMutation({
    mutationFn: async ({ funnelId, newStatus }: { funnelId: string; newStatus: string }) => {
      const response = await apiRequest("PUT", `/api/funnels/${funnelId}`, {
        status: newStatus,
      });
      return response.json();
    },
    onMutate: async ({ funnelId, newStatus }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/funnels"] });
      const previousFunnels = queryClient.getQueryData<Funnel[]>(["/api/funnels"]);
      queryClient.setQueryData<Funnel[]>(["/api/funnels"], (old) =>
        old?.map((f) => (f.id === funnelId ? { ...f, status: newStatus as Funnel["status"] } : f))
      );
      return { previousFunnels };
    },
    onError: (_err: any, _vars, context) => {
      if (context?.previousFunnels) {
        queryClient.setQueryData(["/api/funnels"], context.previousFunnels);
      }
      toast({
        title: "Erro",
        description: _err?.message || "Falha ao atualizar status do funil.",
        variant: "destructive",
        duration: 2000,
      });
    },
    onSuccess: (_, { funnelId, newStatus }) => {
      // Save updated funnels to localStorage
      const funnelsList = queryClient.getQueryData<Funnel[]>(["/api/funnels"]) || [];
      saveToStorage(getStorageKey("/api/funnels"), funnelsList);
      
      queryClient.invalidateQueries({ queryKey: ["/api/funnels"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/dashboard"] });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/funnels"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/dashboard"] });
    },
  });

  const importMutation = useMutation({
    mutationFn: async (funnels: any[]) => {
      const res = await apiRequest('POST', '/api/funnels/import', { funnels });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Funil importado!",
        description: `${data.imported} funil foi adicionado com sucesso.`,
        duration: 2000,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/funnels"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/dashboard"] });
      
      // Note: Save will happen automatically when invalidateQueries refetches
      // But we can trigger it manually here if needed
      setTimeout(() => {
        const funnelsList = queryClient.getQueryData<Funnel[]>(["/api/funnels"]);
        if (funnelsList) {
          saveToStorage(getStorageKey("/api/funnels"), funnelsList);
        }
      }, 100);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao importar",
        description: error.message || "Não foi possível importar o funil. Verifique o formato do arquivo.",
        variant: "destructive",
        duration: 2000,
      });
    },
  });

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const jsonData = JSON.parse(content);
        
        const funnels = Array.isArray(jsonData) ? jsonData : [jsonData];
        
        importMutation.mutate(funnels);
      } catch (error) {
        toast({
          title: "Arquivo inválido",
          description: "O arquivo não está em formato JSON válido.",
          variant: "destructive",
          duration: 2000,
        });
      }
    };
    reader.readAsText(file);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleOpenExportDialog = () => {
    if (!funnels || funnels.length === 0) {
      toast({
        title: "Nenhum funil",
        description: "Não há funil para exportar.",
        variant: "destructive",
        duration: 2000,
      });
      return;
    }
    setSelectedFunnelsForExport(funnels.map(f => f.id));
    setIsExportDialogOpen(true);
  };

  const handleToggleFunnelExport = (funnelId: string) => {
    setSelectedFunnelsForExport(prev => 
      prev.includes(funnelId) 
        ? prev.filter(id => id !== funnelId)
        : [...prev, funnelId]
    );
  };

  const handleSelectAllFunnels = () => {
    if (funnels) {
      if (selectedFunnelsForExport.length === funnels.length) {
        setSelectedFunnelsForExport([]);
      } else {
        setSelectedFunnelsForExport(funnels.map(f => f.id));
      }
    }
  };

  const handleExportSelectedFunnels = () => {
    if (selectedFunnelsForExport.length === 0) {
      toast({
        title: "Selecione funis",
        description: "Selecione pelo menos um funil para exportar.",
        variant: "destructive",
        duration: 2000,
      });
      return;
    }

    const selectedFunnels = funnels?.filter(f => selectedFunnelsForExport.includes(f.id)) || [];
    const exportData = selectedFunnels.map(funnel => ({
      name: funnel.name,
      triggerPhrases: funnel.triggerPhrases,
      status: funnel.status,
      flowData: funnel.flowData,
    }));

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `funil-pilotzap-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Funil exportado!",
      description: `${selectedFunnels.length} funil(s) exportado(s) com sucesso.`,
      duration: 2000,
    });
    setIsExportDialogOpen(false);
  };

  const handleCreateFunnel = () => {
    if (!newFunnelName.trim()) {
      toast({
        title: "Nome Obrigatório",
        description: "Digite um nome para o funil",
        variant: "destructive",
        duration: 2000,
      });
      return;
    }
    createFunnelMutation.mutate();
  };

  const getActiveFunnelsCount = (funnel: Funnel) => {
    return 0;
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-card border-b border-border pl-14 pr-4 lg:px-6 pt-[16px] pb-[16px]">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-2">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-foreground" data-testid="text-page-title">Funil</h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 hidden sm:block">
                Crie fluxos de mensagens automatizados para aumentar suas conversões
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileImport}
                className="hidden"
                data-testid="input-import-file"
              />
              <Button 
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={importMutation.isPending}
                data-testid="button-import-funnels"
                className="flex-1 sm:flex-initial"
              >
                <Upload className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">{importMutation.isPending ? 'Importando...' : 'Importar'}</span>
              </Button>
              <Button 
                variant="outline"
                size="sm"
                onClick={handleOpenExportDialog}
                disabled={!funnels || funnels.length === 0}
                data-testid="button-export-funnels"
                className="flex-1 sm:flex-initial"
              >
                <Download className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Exportar</span>
              </Button>
              <Button 
                size="sm"
                onClick={() => setIsCreateDialogOpen(true)}
                className="bg-purple-600 hover:bg-purple-700 text-white font-semibold flex-1 sm:flex-initial pl-[12px] pr-[12px]"
                data-testid="button-create-funnel"
              >
                <Plus className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Novo Funil</span>
                <span className="sm:hidden">Novo</span>
              </Button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-3 sm:p-6">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="p-6 animate-pulse bg-card border border-border">
                  <div className="h-6 bg-muted rounded mb-4"></div>
                  <div className="h-4 bg-muted rounded mb-2"></div>
                  <div className="h-4 bg-muted rounded mb-4"></div>
                  <div className="flex justify-between mt-4">
                    <div className="h-10 w-20 bg-muted rounded"></div>
                    <div className="h-10 w-20 bg-muted rounded"></div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {funnels && funnels.length > 0 ? (
                funnels.map((funnel) => (
                  <Card 
                    key={funnel.id} 
                    className="p-6 bg-card border border-border hover:border-primary/50 transition-all"
                    data-testid={`card-funnel-${funnel.id}`}
                  >
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-lg font-bold text-foreground" data-testid={`text-funnel-name-${funnel.id}`}>
                          {funnel.name}
                        </h3>
                      </div>

                      <div className="space-y-2">
                        {/* Status and Switch */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <div className={`w-2 h-2 rounded-full ${funnel.status === 'active' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                            <span className="text-xs text-muted-foreground" data-testid={`text-funnel-status-${funnel.id}`}>
                              {funnel.status === 'active' ? 'Ativo' : 'Inativo'}
                            </span>
                          </div>
                          <Switch
                            checked={funnel.status === 'active'}
                            onCheckedChange={(checked) => {
                              toggleFunnelStatusMutation.mutate({
                                funnelId: funnel.id,
                                newStatus: checked ? 'active' : 'inactive'
                              });
                            }}
                            data-testid={`switch-funnel-status-${funnel.id}`}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-2">
                        <Button
                          variant="destructive"
                          size="icon"
                          className="rounded-full w-10 h-10 bg-red-600 hover:bg-red-700"
                          onClick={() => deleteFunnelMutation.mutate(funnel.id)}
                          disabled={deleteFunnelMutation.isPending}
                          data-testid={`button-delete-funnel-${funnel.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          className="rounded-full w-10 h-10 bg-purple-600 hover:bg-purple-700"
                          onClick={() => setLocation(`/funnel-editor/${funnel.id}`)}
                          data-testid={`button-edit-funnel-${funnel.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))
              ) : (
                <div className="col-span-full text-center py-12">
                  <MessageSquare className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">Nenhum funil criado</h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    Comece criando seu primeiro funil de vendas automatizado
                  </p>
                  <Button 
                    onClick={() => setIsCreateDialogOpen(true)}
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                    data-testid="button-create-first-funnel"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Primeiro Funil
                  </Button>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-create-funnel">
          <DialogHeader>
            <DialogTitle>Criar Novo Funil</DialogTitle>
            <DialogDescription>
              Configure seu novo funil de vendas automatizado
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="funnel-name">Nome do Funil</Label>
              <Input
                id="funnel-name"
                placeholder="Ex: Funil Grátis Henrique"
                value={newFunnelName}
                onChange={(e) => setNewFunnelName(e.target.value)}
                data-testid="input-new-funnel-name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateDialogOpen(false)}
              data-testid="button-cancel-create"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateFunnel}
              disabled={createFunnelMutation.isPending}
              className="bg-purple-600 hover:bg-purple-700 text-white"
              data-testid="button-confirm-create"
            >
              {createFunnelMutation.isPending ? "Criando..." : "Criar Funil"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-export-funnels">
          <DialogHeader>
            <DialogTitle>Exportar Funis</DialogTitle>
            <DialogDescription>
              Selecione os funis que deseja exportar
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center space-x-2 pb-2 border-b">
              <Checkbox
                id="select-all-funnels"
                checked={funnels ? selectedFunnelsForExport.length === funnels.length : false}
                onCheckedChange={handleSelectAllFunnels}
                data-testid="checkbox-select-all-funnels"
              />
              <label htmlFor="select-all-funnels" className="text-sm font-medium cursor-pointer">
                Selecionar todos ({funnels?.length || 0})
              </label>
            </div>
            <div className="max-h-60 overflow-y-auto space-y-2">
              {funnels?.map((funnel) => (
                <div key={funnel.id} className="flex items-center space-x-2 p-2 rounded hover:bg-muted">
                  <Checkbox
                    id={`export-funnel-${funnel.id}`}
                    checked={selectedFunnelsForExport.includes(funnel.id)}
                    onCheckedChange={() => handleToggleFunnelExport(funnel.id)}
                    data-testid={`checkbox-export-funnel-${funnel.id}`}
                  />
                  <label htmlFor={`export-funnel-${funnel.id}`} className="flex-1 text-sm cursor-pointer">
                    {funnel.name}
                  </label>
                  <span className={`text-xs px-2 py-0.5 rounded ${funnel.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {funnel.status === 'active' ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsExportDialogOpen(false)}
              data-testid="button-cancel-export"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleExportSelectedFunnels}
              disabled={selectedFunnelsForExport.length === 0}
              className="bg-purple-600 hover:bg-purple-700 text-white"
              data-testid="button-confirm-export"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar ({selectedFunnelsForExport.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
