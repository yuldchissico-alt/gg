import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { TemplatesResponse, MessageTemplate } from "@shared/api-types";
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
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Edit, 
  Trash2, 
  Copy,
  MessageSquare,
  Image,
  Video,
  Mic,
  FileText,
  MapPin,
  Eye
} from "lucide-react";

export default function Templates() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<MessageTemplate | null>(null);
  
  // Form state
  const [formData, setFormData] = useState<{
    name: string;
    type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'location';
    content: string;
    mediaUrl: string;
    variables: string[];
  }>({
    name: "",
    type: "text",
    content: "",
    mediaUrl: "",
    variables: [],
  });

  const [newVariable, setNewVariable] = useState("");

  const { data: templates, isLoading: templatesLoading } = useQuery<TemplatesResponse>({
    queryKey: ["/api/templates"],
    retry: false,
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (templateData: typeof formData) => {
      const response = await apiRequest("POST", "/api/templates", templateData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({
        title: "Template Criado",
        description: "Novo template adicionado com sucesso!",
        duration: 2000,
      });
      setShowCreateDialog(false);
      resetForm();
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao criar template. Tente novamente.",
        variant: "destructive",
        duration: 2000,
      });
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<MessageTemplate> }) => {
      const response = await apiRequest("PUT", `/api/templates/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({
        title: "Template Atualizado",
        description: "As alterações foram salvas com sucesso!",
        duration: 2000,
      });
      setEditingTemplate(null);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao atualizar template.",
        variant: "destructive",
        duration: 2000,
      });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      await apiRequest("DELETE", `/api/templates/${templateId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({
        title: "Template Excluído",
        description: "O template foi removido com sucesso!",
        duration: 2000,
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao excluir template.",
        variant: "destructive",
        duration: 2000,
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      type: "text",
      content: "",
      mediaUrl: "",
      variables: [],
    });
    setNewVariable("");
  };

  const addVariable = () => {
    if (newVariable.trim() && !formData.variables.includes(newVariable.trim())) {
      setFormData({
        ...formData,
        variables: [...formData.variables, newVariable.trim()],
      });
      setNewVariable("");
    }
  };

  const removeVariable = (variableToRemove: string) => {
    setFormData({
      ...formData,
      variables: formData.variables.filter(variable => variable !== variableToRemove),
    });
  };

  const handleCreateTemplate = () => {
    if (!formData.name.trim()) {
      toast({
        title: "Nome Obrigatório",
        description: "Digite um nome para o template",
        variant: "destructive",
        duration: 2000,
      });
      return;
    }

    if (!formData.content.trim()) {
      toast({
        title: "Conteúdo Obrigatório",
        description: "Digite o conteúdo do template",
        variant: "destructive",
        duration: 2000,
      });
      return;
    }

    createTemplateMutation.mutate(formData);
  };

  const handleEditTemplate = (template: MessageTemplate) => {
    setFormData({
      name: template.name,
      type: template.type,
      content: template.content,
      mediaUrl: template.mediaUrl || "",
      variables: template.variables || [],
    });
    setEditingTemplate(template);
  };

  const handleUpdateTemplate = () => {
    if (!editingTemplate) return;
    
    updateTemplateMutation.mutate({
      id: editingTemplate.id,
      data: formData,
    });
  };

  const handleDeleteTemplate = (templateId: string) => {
    if (window.confirm("Tem certeza que deseja excluir este template?")) {
      deleteTemplateMutation.mutate(templateId);
    }
  };

  const handleCopyTemplate = async (template: MessageTemplate) => {
    try {
      await navigator.clipboard.writeText(template.content);
      toast({
        title: "Copiado!",
        description: "Conteúdo do template copiado para a área de transferência",
        duration: 2000,
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao copiar template",
        variant: "destructive",
        duration: 2000,
      });
    }
  };

  const handlePreviewTemplate = (template: MessageTemplate) => {
    setPreviewTemplate(template);
    setShowPreviewDialog(true);
  };

  const getTypeIcon = (type: string) => {
    const icons: Record<string, any> = {
      text: MessageSquare,
      image: Image,
      video: Video,
      audio: Mic,
      document: FileText,
      location: MapPin,
    };
    const Icon = icons[type] || MessageSquare;
    return <Icon className="h-4 w-4" />;
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      text: "Texto",
      image: "Imagem",
      video: "Vídeo",
      audio: "Áudio",
      document: "Documento",
      location: "Localização",
    };
    return labels[type] || type;
  };

  const filteredTemplates = templates?.filter((template: MessageTemplate) => {
    const matchesSearch = 
      template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.content.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = typeFilter === "all" || template.type === typeFilter;
    
    return matchesSearch && matchesType;
  }) || [];

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-card border-b border-border pl-14 pr-4 lg:px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold" data-testid="text-page-title">Templates</h1>
              <p className="text-sm text-muted-foreground">Crie e gerencie templates de mensagens</p>
            </div>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-template">
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Template
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl" data-testid="dialog-create-template">
                <DialogHeader>
                  <DialogTitle>Novo Template</DialogTitle>
                  <DialogDescription>
                    Crie um template reutilizável para suas mensagens
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Nome do Template</Label>
                      <Input
                        id="name"
                        placeholder="Ex: Boas-vindas"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        data-testid="input-template-name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="type">Tipo</Label>
                      <Select value={formData.type} onValueChange={(value: any) => setFormData({ ...formData, type: value })}>
                        <SelectTrigger data-testid="select-template-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Texto</SelectItem>
                          <SelectItem value="image">Imagem</SelectItem>
                          <SelectItem value="video">Vídeo</SelectItem>
                          <SelectItem value="audio">Áudio</SelectItem>
                          <SelectItem value="document">Documento</SelectItem>
                          <SelectItem value="location">Localização</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="content">Conteúdo</Label>
                    <Textarea
                      id="content"
                      placeholder="Digite o conteúdo da mensagem..."
                      rows={6}
                      value={formData.content}
                      onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                      data-testid="textarea-template-content"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Use {"{nome}"}, {"{empresa}"} etc. para criar variáveis dinâmicas
                    </p>
                  </div>
                  {formData.type !== 'text' && (
                    <div>
                      <Label htmlFor="mediaUrl">URL da Mídia</Label>
                      <Input
                        id="mediaUrl"
                        placeholder="https://exemplo.com/arquivo.jpg"
                        value={formData.mediaUrl}
                        onChange={(e) => setFormData({ ...formData, mediaUrl: e.target.value })}
                        data-testid="input-media-url"
                      />
                    </div>
                  )}
                  <div>
                    <Label>Variáveis</Label>
                    <div className="flex space-x-2 mb-2">
                      <Input
                        placeholder="nome, empresa, produto..."
                        value={newVariable}
                        onChange={(e) => setNewVariable(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addVariable()}
                        data-testid="input-new-variable"
                      />
                      <Button type="button" variant="outline" onClick={addVariable} data-testid="button-add-variable">
                        Adicionar
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {formData.variables.map((variable) => (
                        <Badge key={variable} variant="secondary" className="cursor-pointer" onClick={() => removeVariable(variable)}>
                          {"{" + variable + "}"} ×
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setShowCreateDialog(false)} data-testid="button-cancel">
                      Cancelar
                    </Button>
                    <Button 
                      onClick={handleCreateTemplate}
                      disabled={createTemplateMutation.isPending}
                      data-testid="button-save-template"
                    >
                      {createTemplateMutation.isPending ? "Criando..." : "Criar Template"}
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
                placeholder="Buscar templates..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                data-testid="input-search-templates"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40" data-testid="select-type-filter">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="text">Texto</SelectItem>
                <SelectItem value="image">Imagem</SelectItem>
                <SelectItem value="video">Vídeo</SelectItem>
                <SelectItem value="audio">Áudio</SelectItem>
                <SelectItem value="document">Documento</SelectItem>
                <SelectItem value="location">Localização</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Main Content */}
        <main className="flex-1 p-6 overflow-auto">
          {templatesLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Carregando templates...</p>
              </div>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center py-12" data-testid="empty-state-templates">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhum template encontrado</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm || typeFilter !== "all"
                  ? "Tente ajustar os filtros de busca" 
                  : "Crie seu primeiro template para agilizar suas mensagens"
                }
              </p>
              {(!searchTerm && typeFilter === "all") && (
                <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-first-template">
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeiro Template
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTemplates.map((template: MessageTemplate) => (
                <Card key={template.id} className="relative" data-testid={`template-card-${template.id}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          {getTypeIcon(template.type)}
                          <CardTitle className="text-lg">{template.name}</CardTitle>
                        </div>
                        <Badge variant="outline">
                          {getTypeLabel(template.type)}
                        </Badge>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" data-testid={`button-template-menu-${template.id}`}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handlePreviewTemplate(template)}>
                            <Eye className="h-4 w-4 mr-2" />
                            Visualizar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEditTemplate(template)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleCopyTemplate(template)}>
                            <Copy className="h-4 w-4 mr-2" />
                            Copiar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDeleteTemplate(template.id)}>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="bg-muted rounded p-3">
                        <p className="text-sm line-clamp-3">
                          {template.content}
                        </p>
                      </div>
                      {template.variables && template.variables.length > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-2">Variáveis:</p>
                          <div className="flex flex-wrap gap-1">
                            {template.variables.map((variable) => (
                              <Badge key={variable} variant="secondary" className="text-xs">
                                {"{" + variable + "}"}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="pt-2 border-t text-xs text-muted-foreground">
                        Criado em {new Date(template.createdAt).toLocaleDateString('pt-BR')}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Edit Template Dialog */}
      <Dialog open={!!editingTemplate} onOpenChange={(open) => !open && setEditingTemplate(null)}>
        <DialogContent className="max-w-2xl" data-testid="dialog-edit-template">
          <DialogHeader>
            <DialogTitle>Editar Template</DialogTitle>
            <DialogDescription>
              Atualize as informações do template
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="editName">Nome do Template</Label>
                <Input
                  id="editName"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  data-testid="input-edit-template-name"
                />
              </div>
              <div>
                <Label htmlFor="editType">Tipo</Label>
                <Select value={formData.type} onValueChange={(value: any) => setFormData({ ...formData, type: value })}>
                  <SelectTrigger data-testid="select-edit-template-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Texto</SelectItem>
                    <SelectItem value="image">Imagem</SelectItem>
                    <SelectItem value="video">Vídeo</SelectItem>
                    <SelectItem value="audio">Áudio</SelectItem>
                    <SelectItem value="document">Documento</SelectItem>
                    <SelectItem value="location">Localização</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="editContent">Conteúdo</Label>
              <Textarea
                id="editContent"
                rows={6}
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                data-testid="textarea-edit-template-content"
              />
            </div>
            {formData.type !== 'text' && (
              <div>
                <Label htmlFor="editMediaUrl">URL da Mídia</Label>
                <Input
                  id="editMediaUrl"
                  value={formData.mediaUrl}
                  onChange={(e) => setFormData({ ...formData, mediaUrl: e.target.value })}
                  data-testid="input-edit-media-url"
                />
              </div>
            )}
            <div>
              <Label>Variáveis</Label>
              <div className="flex space-x-2 mb-2">
                <Input
                  placeholder="nome, empresa, produto..."
                  value={newVariable}
                  onChange={(e) => setNewVariable(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addVariable()}
                  data-testid="input-edit-new-variable"
                />
                <Button type="button" variant="outline" onClick={addVariable} data-testid="button-edit-add-variable">
                  Adicionar
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.variables.map((variable) => (
                  <Badge key={variable} variant="secondary" className="cursor-pointer" onClick={() => removeVariable(variable)}>
                    {"{" + variable + "}"} ×
                  </Badge>
                ))}
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setEditingTemplate(null)} data-testid="button-cancel-edit">
                Cancelar
              </Button>
              <Button 
                onClick={handleUpdateTemplate}
                disabled={updateTemplateMutation.isPending}
                data-testid="button-save-edit"
              >
                {updateTemplateMutation.isPending ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Template Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent data-testid="dialog-preview-template">
          <DialogHeader>
            <DialogTitle>Preview do Template</DialogTitle>
            <DialogDescription>
              Visualize como o template será exibido
            </DialogDescription>
          </DialogHeader>
          {previewTemplate && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                {getTypeIcon(previewTemplate.type)}
                <span className="font-medium">{previewTemplate.name}</span>
                <Badge variant="outline">{getTypeLabel(previewTemplate.type)}</Badge>
              </div>
              <div className="bg-muted rounded p-4">
                <p className="whitespace-pre-wrap">{previewTemplate.content}</p>
                {previewTemplate.mediaUrl && (
                  <div className="mt-3 p-2 bg-background rounded border">
                    <p className="text-sm text-muted-foreground">Mídia: {previewTemplate.mediaUrl}</p>
                  </div>
                )}
              </div>
              {previewTemplate.variables && previewTemplate.variables.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Variáveis disponíveis:</p>
                  <div className="flex flex-wrap gap-2">
                    {previewTemplate.variables.map((variable) => (
                      <Badge key={variable} variant="secondary">
                        {"{" + variable + "}"}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex justify-end">
                <Button onClick={() => setShowPreviewDialog(false)} data-testid="button-close-preview">
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
