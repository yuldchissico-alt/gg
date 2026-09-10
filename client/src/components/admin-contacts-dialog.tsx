import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Contact {
  id: string;
  phone_number: string;
  name: string;
}

export function AdminContactsDialog() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: contacts, isLoading } = useQuery<Contact[]>({
    queryKey: ["/api/admin/contacts"],
    enabled: open,
  });

  const fixLidsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/fix-lids", {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Erro ao corrigir LIDs");
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "✅ LIDs corrigidos",
        description: `${data.fixed} contacto(s) actualizado(s) com sucesso!`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const isLid = (phone: string) => {
    // LIDs são números muito longos (>12 dígitos) que não começam com 258
    if (!phone) return false;
    const clean = phone.replace(/\D/g, "");
    return clean.length > 12 && !clean.startsWith("258");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Users className="w-4 h-4 mr-2" />
          Ver Contactos
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Contactos do Sistema</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Últimos 20 contactos criados
            </p>
            <Button
              onClick={() => fixLidsMutation.mutate()}
              disabled={fixLidsMutation.isPending}
              size="sm"
            >
              {fixLidsMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Corrigindo...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Corrigir LIDs
                </>
              )}
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : contacts && contacts.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Número</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell className="font-medium">{contact.name || "Sem nome"}</TableCell>
                    <TableCell className="font-mono text-sm">{contact.phone_number}</TableCell>
                    <TableCell>
                      {isLid(contact.phone_number) ? (
                        <Badge variant="destructive" className="gap-1">
                          <AlertCircle className="w-3 h-3" />
                          LID
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <CheckCircle className="w-3 h-3" />
                          OK
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum contacto encontrado
            </div>
          )}
        </div>

        <div className="mt-4 p-4 bg-muted/50 rounded-lg space-y-2">
          <h4 className="font-semibold text-sm">ℹ️ Sobre LIDs</h4>
          <p className="text-xs text-muted-foreground">
            LIDs (Local IDs) são identificadores internos do WhatsApp usados no modo multi-device.
            Eles precisam ser convertidos para números reais antes de enviar mensagens.
          </p>
          <p className="text-xs text-muted-foreground">
            Se vê contactos com LID, clique em <strong>"Corrigir LIDs"</strong> para actualizar automaticamente.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
