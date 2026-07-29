import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useSettings } from "@/contexts/SettingsContext";
import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Settings as SettingsIcon,
  HelpCircle,
  Mail,
  ChevronDown,
  MessageCircle,
  LogOut,
  User,
  Check,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function Settings() {
  const { toast } = useToast();
  const { settings } = useSettings();
  const { data: user } = useQuery<any>({
    queryKey: ["/api/user/me"],
    retry: false,
  });

  const [displayEmail, setDisplayEmail] = useState("demo@pilotzap.com");
  const [displayPlan, setDisplayPlan] = useState("Plano Básico");

  useEffect(() => {
    const storedEmail = localStorage.getItem("demo_user_email");
    if (storedEmail) {
      setDisplayEmail(storedEmail);
    } else if (user?.email) {
      setDisplayEmail(user.email);
    }

    if (user?.planType) {
      const plans: Record<string, string> = {
        free: "Plano Gratuito",
        basic: "Plano Básico",
        pro: "Plano Pro",
        enterprise: "Plano Enterprise"
      };
      setDisplayPlan(plans[user.planType] || "Plano Básico");
    }
  }, [user]);
  
  // Tab State
  const [activeTab, setActiveTab] = useState(() => {
    const hash = window.location.hash.replace('#', '');
    return hash && ['account', 'faq', 'suporte'].includes(hash) ? hash : 'account';
  });

  const handleLogout = () => {
    window.location.href = "/login";
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto">
          {/* Header */}
          <div className="bg-card border-b border-border">
            <div className="max-w-7xl mx-auto pl-14 pr-4 lg:px-8 pt-[16px] pb-[16px]">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-foreground flex items-center" data-testid="text-page-title">
                    <SettingsIcon className="h-8 w-8 mr-3 text-primary" />
                    Configurações
                  </h1>
                  <p className="text-muted-foreground mt-1">
                    Gerencie as configurações da sua conta e preferências
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Settings Content */}
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="grid w-full grid-cols-3 bg-card p-1 rounded-xl" data-testid="tabs-settings">
                <TabsTrigger value="account" className="rounded-lg data-[state=active]:bg-muted" data-testid="tab-account">
                  Conta
                </TabsTrigger>
                <TabsTrigger value="faq" className="rounded-lg data-[state=active]:bg-muted" data-testid="tab-faq">
                  FAQ
                </TabsTrigger>
                <TabsTrigger value="suporte" className="rounded-lg data-[state=active]:bg-muted" data-testid="tab-suporte">
                  Suporte
                </TabsTrigger>
              </TabsList>

              {/* Account Settings */}
              <TabsContent value="account" className="space-y-6">
                <Card className="border-none bg-card/50 shadow-none">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Conta</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col">
                      <span className="text-xl font-bold text-foreground">{displayEmail}</span>
                      <div className="flex items-center gap-1.5 mt-1 text-muted-foreground text-sm">
                        <Check className="h-4 w-4 text-green-500" />
                        <span>{displayPlan}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Button 
                  onClick={handleLogout}
                  className="w-full h-14 bg-[#F24444] hover:bg-[#D93B3B] text-white font-bold rounded-xl flex items-center justify-center gap-2"
                >
                  <LogOut className="h-5 w-5" />
                  Sair da Conta
                </Button>
              </TabsContent>

              {/* FAQ */}
              <TabsContent value="faq" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <HelpCircle className="h-5 w-5 text-primary" />
                      Perguntas Frequentes
                    </CardTitle>
                    <CardDescription>
                      Respostas para as dúvidas mais comuns
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Accordion type="single" collapsible className="w-full">
                      <AccordionItem value="item-1">
                        <AccordionTrigger>O que é o PilotZap?</AccordionTrigger>
                        <AccordionContent>
                          O PilotZap é uma plataforma de automação de marketing para WhatsApp. 
                          Com ele, você pode gerenciar contatos, criar funis de 
                          vendas automatizados e acompanhar métricas de engajamento.
                        </AccordionContent>
                      </AccordionItem>
                      <AccordionItem value="item-2">
                        <AccordionTrigger>Como conectar meu WhatsApp?</AccordionTrigger>
                        <AccordionContent>
                          Para conectar seu WhatsApp, vá até a seção "Conexão" no menu lateral 
                          e escaneie o QR Code com seu celular. Certifique-se de que seu WhatsApp está 
                          atualizado e funcionando normalmente.
                        </AccordionContent>
                      </AccordionItem>
                      <AccordionItem value="item-3">
                        <AccordionTrigger>Quantas mensagens posso enviar por dia?</AccordionTrigger>
                        <AccordionContent>
                          O limite de mensagens depende do seu plano. No plano Básico, você pode enviar 
                          até 1.000 mensagens por dia. Planos superiores têm limites maiores.
                        </AccordionContent>
                      </AccordionItem>
                      <AccordionItem value="item-5">
                        <AccordionTrigger>O que são funis de vendas?</AccordionTrigger>
                        <AccordionContent>
                          Funis de vendas são sequências automatizadas de mensagens que guiam seus 
                          contatos por uma jornada de compra. Você pode criar gatilhos, condições e 
                          ações personalizadas para cada etapa do funil.
                        </AccordionContent>
                      </AccordionItem>
                      <AccordionItem value="item-6">
                        <AccordionTrigger>Como importar contatos?</AccordionTrigger>
                        <AccordionContent>
                          Na seção "Contatos", clique no botão "Importar" e selecione um arquivo CSV 
                          com os dados dos seus contatos. O sistema irá mapear automaticamente os 
                          campos como nome e número de telefone.
                        </AccordionContent>
                      </AccordionItem>
                      <AccordionItem value="item-7">
                        <AccordionTrigger>Como cancelar minha assinatura?</AccordionTrigger>
                        <AccordionContent>
                          Para cancelar sua assinatura, entre em contato com nosso suporte via 
                          WhatsApp ou email. O cancelamento pode ser feito a qualquer momento 
                          e será efetivado no próximo ciclo de cobrança.
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Support */}
              <TabsContent value="suporte" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MessageCircle className="h-5 w-5 text-primary" />
                      Canais de Suporte
                    </CardTitle>
                    <CardDescription>
                      Escolha a melhor forma de contato
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div 
                      onClick={() => {
                        const subject = encodeURIComponent("Suporte PilotZap");
                        const body = encodeURIComponent("Olá Suporte, preciso de ajuda com...");
                        window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=suporte@pilotzap.com&su=${subject}&body=${body}`, '_blank');
                      }}
                      className="flex items-start space-x-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                    >
                      <Mail className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <p className="font-medium">Email</p>
                        <p className="text-sm text-muted-foreground">suporte@pilotzap.com</p>
                      </div>
                    </div>
                    <Separator />
                    <div 
                      onClick={() => {
                        const message = encodeURIComponent("Olá Suporte PilotZap, preciso de ajuda!");
                        window.open(`https://wa.me/258864014350?text=${message}`, '_blank');
                      }}
                      className="flex items-start space-x-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                    >
                      <MessageCircle className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <p className="font-medium">WhatsApp</p>
                        <p className="text-sm text-muted-foreground">+258 864 014 350</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}
