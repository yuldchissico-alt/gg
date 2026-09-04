import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { ContactsResponse } from "@shared/api-types";
import Sidebar from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Edit, 
  Trash2, 
  MessageSquare,
  Phone,
  Mail,
  User,
  Upload,
  Download,
  Check
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

interface Contact {
  id: string;
  phoneNumber: string;
  name?: string;
  email?: string;
  tags: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function Contacts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [selectedContactsForExport, setSelectedContactsForExport] = useState<string[]>([]);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    phoneNumber: "",
    name: "",
    email: "",
    tags: [] as string[],
    isActive: true,
  });

  const [newTag, setNewTag] = useState("");

  const { data: contacts, isLoading: contactsLoading } = useQuery<ContactsResponse>({
    queryKey: ["/api/contacts"],
    retry: false,
  });

  const resetForm = () => {
    setFormData({
      phoneNumber: "",
      name: "",
      email: "",
      tags: [],
      isActive: true,
    });
    setNewTag("");
  };

  const createContactMutation = useMutation({
    mutationFn: async (contactData: typeof formData) => {
      // Validate phone number
      if (!contactData.phoneNumber.trim()) {
        throw new Error("Número de telefone é obrigatório");
      }
      if (!/^[\d+\s\-().]*$/.test(contactData.phoneNumber)) {
        throw new Error("Número de telefone inválido");
      }
      if (contactData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactData.email)) {
        throw new Error("Email inválido");
      }
      const response = await apiRequest("POST", "/api/contacts", contactData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/dashboard"] });
      toast({
        title: "Contato Criado",
        description: "Novo contato adicionado com sucesso!",
        duration: 2000,
      });
      setShowCreateDialog(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error?.message || "Falha ao criar contato. Tente novamente.",
        variant: "destructive",
        duration: 2000,
      });
    },
  });

  const updateContactMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Contact> }) => {
      const response = await apiRequest("PUT", `/api/contacts/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      // Wait for invalidation to complete before closing
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/dashboard"] });
      toast({
        title: "Contato Atualizado",
        description: "As alterações foram salvas com sucesso!",
        duration: 2000,
      });
      setEditingContact(null);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error?.message || "Falha ao atualizar contato.",
        variant: "destructive",
        duration: 2000,
      });
    },
  });

  const deleteContactMutation = useMutation({
    mutationFn: async (contactId: string) => {
      await apiRequest("DELETE", `/api/contacts/${contactId}`);
    },
    onSuccess: (_, contactId) => {
      // Clear editing state if deleting the contact being edited
      if (editingContact?.id === contactId) {
        setEditingContact(null);
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/dashboard"] });
      toast({
        title: "Contato Excluído",
        description: "Contato removido com sucesso!",
        duration: 2000,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error?.message || "Falha ao excluir contato.",
        variant: "destructive",
        duration: 2000,
      });
    },
  });

  const importMutation = useMutation({
    mutationFn: async (contacts: any[]) => {
      const response = await apiRequest("POST", "/api/contacts/bulk", { contacts });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Contatos importados!",
        description: `${data.imported} contato(s) importado(s) com sucesso.`,
        duration: 2000,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/dashboard"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao importar",
        description: error.message || "Não foi possível importar os contatos. Verifique o formato do arquivo.",
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
        
        const contactsData = Array.isArray(jsonData) ? jsonData : [jsonData];
        
        importMutation.mutate(contactsData);
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

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData({
        ...formData,
        tags: [...formData.tags, newTag.trim()],
      });
      setNewTag("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter(tag => tag !== tagToRemove),
    });
  };

  const handleCreateContact = () => {
    if (!formData.phoneNumber.trim()) {
      toast({
        title: "Número Obrigatório",
        description: "Digite o número de WhatsApp do contato",
        variant: "destructive",
        duration: 2000,
      });
      return;
    }

    createContactMutation.mutate(formData);
  };

  const handleEditContact = (contact: Contact) => {
    setFormData({
      phoneNumber: contact.phoneNumber,
      name: contact.name || "",
      email: contact.email || "",
      tags: contact.tags || [],
      isActive: contact.isActive,
    });
    setEditingContact(contact);
  };

  const handleUpdateContact = () => {
    if (!editingContact) return;
    
    updateContactMutation.mutate({
      id: editingContact.id,
      data: formData,
    });
  };

  const handleToggleContact = (contact: Contact) => {
    updateContactMutation.mutate({
      id: contact.id,
      data: { isActive: !contact.isActive },
    });
  };

  const handleDeleteContact = (contactId: string) => {
    if (window.confirm("Tem certeza que deseja excluir este contato?")) {
      deleteContactMutation.mutate(contactId);
    }
  };

  // Get all unique tags from contacts
  const allTags = Array.from(new Set(
    contacts?.flatMap((contact: Contact) => contact.tags || []) || []
  ));

  const filteredContacts = contacts?.filter((contact: Contact) => {
    const matchesSearch = 
      contact.phoneNumber.includes(searchTerm) ||
      contact.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || 
      (statusFilter === "active" && contact.isActive) ||
      (statusFilter === "inactive" && !contact.isActive);
    
    const matchesTag = tagFilter === "all" || 
      (contact.tags && contact.tags.includes(tagFilter));
    
    return matchesSearch && matchesStatus && matchesTag;
  }) || [];

  const getInitials = (name: string, phone: string) => {
    if (name) {
      const words = name.split(' ');
      return words.map(word => word[0]?.toUpperCase()).join('').slice(0, 2);
    }
    return phone.slice(-2);
  };

  const handleOpenExportDialog = () => {
    if (!contacts || contacts.length === 0) {
      toast({
        title: "Nenhum contato",
        description: "Não há contatos para exportar.",
        variant: "destructive",
        duration: 2000,
      });
      return;
    }
    setSelectedContactsForExport(contacts.map((c: Contact) => c.id));
    setShowExportDialog(true);
  };

  const handleToggleContactExport = (contactId: string) => {
    setSelectedContactsForExport(prev => 
      prev.includes(contactId) 
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };

  const handleSelectAllContacts = () => {
    if (contacts) {
      if (selectedContactsForExport.length === contacts.length) {
        setSelectedContactsForExport([]);
      } else {
        setSelectedContactsForExport(contacts.map((c: Contact) => c.id));
      }
    }
  };

  const handleExportSelectedContacts = () => {
    if (selectedContactsForExport.length === 0) {
      toast({
        title: "Selecione contatos",
        description: "Selecione pelo menos um contato para exportar.",
        variant: "destructive",
        duration: 2000,
      });
      return;
    }

    const selectedContacts = contacts?.filter((c: Contact) => selectedContactsForExport.includes(c.id)) || [];
    const exportData = selectedContacts.map((contact: Contact) => ({
      phoneNumber: contact.phoneNumber,
      name: contact.name,
      email: contact.email,
      tags: contact.tags,
      isActive: contact.isActive,
    }));

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `contatos-pilotzap-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    toast({
      title: "Contatos exportados!",
      description: `${selectedContacts.length} contato(s) exportado(s) com sucesso.`,
      duration: 2000,
    });
    setShowExportDialog(false);
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-card border-b border-border pl-14 pr-4 lg:px-6 py-3 sm:py-4 pt-[16px] pb-[16px]">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="w-full sm:w-auto">
              <h1 className="sm:text-2xl font-semibold text-[20px]" data-testid="text-page-title">Contatos</h1>
              <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">Gerencie sua lista de contatos</p>
            </div>
            <div className="flex space-x-2 w-full sm:w-auto">
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
                className="hidden sm:flex" 
                onClick={() => fileInputRef.current?.click()}
                disabled={importMutation.isPending}
                data-testid="button-import-contacts"
              >
                <Upload className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">{importMutation.isPending ? 'Importando...' : 'Importar'}</span>
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="hidden sm:flex" 
                onClick={handleOpenExportDialog}
                disabled={!contacts || contacts.length === 0}
                data-testid="button-export-contacts"
              >
                <Download className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Exportar</span>
              </Button>
              <Dialog open={showCreateDialog} onOpenChange={(open) => { if (!open) resetForm(); setShowCreateDialog(open); }}>
                <DialogTrigger asChild>
                  <Button size="sm" className="flex-1 sm:flex-initial" data-testid="button-create-contact">
                    <Plus className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Novo Contato</span>
                    <span className="sm:hidden">Novo</span>
                  </Button>
                </DialogTrigger>
                <DialogContent data-testid="dialog-create-contact">
                  <DialogHeader>
                    <DialogTitle>Novo Contato</DialogTitle>
                    <DialogDescription>
                      Adicione um novo contato à sua lista
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="phoneNumber">Número do WhatsApp *</Label>
                      <Input
                        id="phoneNumber"
                        placeholder="+258 84 123 4567"
                        value={formData.phoneNumber}
                        onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                        data-testid="input-phone-number"
                      />
                    </div>
                    <div>
                      <Label htmlFor="name">Nome</Label>
                      <Input
                        id="name"
                        placeholder="Nome do contato"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        data-testid="input-contact-name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">E-mail</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="email@exemplo.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        data-testid="input-contact-email"
                      />
                    </div>
                    <div>
                      <Label>Tags</Label>
                      <div className="flex space-x-2 mb-2">
                        <Input
                          placeholder="Digite uma tag"
                          value={newTag}
                          onChange={(e) => setNewTag(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && addTag()}
                          data-testid="input-new-tag"
                        />
                        <Button type="button" variant="outline" onClick={addTag} data-testid="button-add-tag">
                          Adicionar
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {formData.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="cursor-pointer" onClick={() => removeTag(tag)}>
                            {tag} ×
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="isActive"
                        checked={formData.isActive}
                        onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                        data-testid="switch-contact-active"
                      />
                      <Label htmlFor="isActive">Contato ativo</Label>
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" onClick={() => setShowCreateDialog(false)} data-testid="button-cancel">
                        Cancelar
                      </Button>
                      <Button 
                        onClick={handleCreateContact}
                        disabled={createContactMutation.isPending}
                        data-testid="button-save-contact"
                      >
                        {createContactMutation.isPending ? "Criando..." : "Criar Contato"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </header>

        {/* Filters */}
        <div className="bg-card border-b border-border px-3 sm:px-6 py-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Buscar..."
                className="pl-10 text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                data-testid="input-search-contacts"
              />
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-32" data-testid="select-status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Ativos</SelectItem>
                  <SelectItem value="inactive">Inativos</SelectItem>
                </SelectContent>
              </Select>
              <Select value={tagFilter} onValueChange={setTagFilter}>
                <SelectTrigger className="w-full sm:w-40" data-testid="select-tag-filter">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Tags" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {allTags.map((tag) => (
                    <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <main className="flex-1 p-3 sm:p-6 overflow-auto">
          {contactsLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Carregando contatos...</p>
              </div>
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="text-center py-12" data-testid="empty-state-contacts">
              <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhum contato encontrado</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm || statusFilter !== "all" || tagFilter !== "all"
                  ? "Tente ajustar os filtros de busca" 
                  : "Adicione seus primeiros contatos para começar"
                }
              </p>
              {(!searchTerm && statusFilter === "all" && tagFilter === "all") && (
                <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-first-contact">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Primeiro Contato
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {filteredContacts.map((contact: Contact) => (
                <Card key={contact.id} className="relative" data-testid={`contact-card-${contact.id}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <Avatar>
                          <AvatarFallback className="bg-primary text-primary-foreground">
                            {getInitials(contact.name || '', contact.phoneNumber)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <CardTitle className="text-base">
                            {contact.name || 'Sem nome'}
                          </CardTitle>
                          <CardDescription className="flex items-center">
                            <Phone className="h-3 w-3 mr-1" />
                            {contact.phoneNumber}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {!contact.isActive && (
                          <Badge variant="secondary">Inativo</Badge>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" data-testid={`button-contact-menu-${contact.id}`}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditContact(contact)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggleContact(contact)}>
                              <MessageSquare className="h-4 w-4 mr-2" />
                              {contact.isActive ? 'Desativar' : 'Ativar'}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeleteContact(contact.id)}>
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {contact.email && (
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Mail className="h-3 w-3 mr-2" />
                          {contact.email}
                        </div>
                      )}
                      {contact.tags && contact.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {contact.tags.map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <div className="pt-2 border-t text-xs text-muted-foreground">
                        Adicionado em {new Date(contact.createdAt).toLocaleDateString('pt-BR')}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>
      {/* Edit Contact Dialog */}
      <Dialog open={!!editingContact} onOpenChange={(open) => { if (!open) { setEditingContact(null); resetForm(); } }}>
        <DialogContent data-testid="dialog-edit-contact">
          <DialogHeader>
            <DialogTitle>Editar Contato</DialogTitle>
            <DialogDescription>
              Atualize as informações do contato
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="editPhoneNumber">Número do WhatsApp *</Label>
              <Input
                id="editPhoneNumber"
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                data-testid="input-edit-phone-number"
              />
            </div>
            <div>
              <Label htmlFor="editName">Nome</Label>
              <Input
                id="editName"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                data-testid="input-edit-contact-name"
              />
            </div>
            <div>
              <Label htmlFor="editEmail">E-mail</Label>
              <Input
                id="editEmail"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                data-testid="input-edit-contact-email"
              />
            </div>
            <div>
              <Label>Tags</Label>
              <div className="flex space-x-2 mb-2">
                <Input
                  placeholder="Digite uma tag"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addTag()}
                  data-testid="input-edit-new-tag"
                />
                <Button type="button" variant="outline" onClick={addTag} data-testid="button-edit-add-tag">
                  Adicionar
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="cursor-pointer" onClick={() => removeTag(tag)}>
                    {tag} ×
                  </Badge>
                ))}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="editIsActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                data-testid="switch-edit-contact-active"
              />
              <Label htmlFor="editIsActive">Contato ativo</Label>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setEditingContact(null)} data-testid="button-cancel-edit">
                Cancelar
              </Button>
              <Button 
                onClick={handleUpdateContact}
                disabled={updateContactMutation.isPending}
                data-testid="button-save-edit"
              >
                {updateContactMutation.isPending ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-export-contacts">
          <DialogHeader>
            <DialogTitle>Exportar Contatos</DialogTitle>
            <DialogDescription>
              Selecione os contatos que deseja exportar
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center space-x-2 pb-2 border-b">
              <Checkbox
                id="select-all-contacts"
                checked={contacts ? selectedContactsForExport.length === contacts.length : false}
                onCheckedChange={handleSelectAllContacts}
                data-testid="checkbox-select-all-contacts"
              />
              <label htmlFor="select-all-contacts" className="text-sm font-medium cursor-pointer">
                Selecionar todos ({contacts?.length || 0})
              </label>
            </div>
            <div className="max-h-60 overflow-y-auto space-y-2">
              {contacts?.map((contact: Contact) => (
                <div key={contact.id} className="flex items-center space-x-2 p-2 rounded hover:bg-muted">
                  <Checkbox
                    id={`export-contact-${contact.id}`}
                    checked={selectedContactsForExport.includes(contact.id)}
                    onCheckedChange={() => handleToggleContactExport(contact.id)}
                    data-testid={`checkbox-export-contact-${contact.id}`}
                  />
                  <label htmlFor={`export-contact-${contact.id}`} className="flex-1 text-sm cursor-pointer">
                    <span className="font-medium">{contact.name || 'Sem nome'}</span>
                    <span className="text-muted-foreground ml-2 text-xs">{contact.phoneNumber}</span>
                  </label>
                  <span className={`text-xs px-2 py-0.5 rounded ${contact.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {contact.isActive ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => setShowExportDialog(false)}
              data-testid="button-cancel-export-contacts"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleExportSelectedContacts}
              disabled={selectedContactsForExport.length === 0}
              data-testid="button-confirm-export-contacts"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar ({selectedContactsForExport.length})
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
