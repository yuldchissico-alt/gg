import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import Sidebar from "@/components/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  CreditCard,
  Check,
  Star,
  Zap,
  Users,
  MessageSquare,
  Shield,
  Headphones,
  TrendingUp,
  ArrowRight,
} from "lucide-react";

interface UserData {
  planType: string;
}

export default function Plans() {
  const { toast } = useToast();
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");
  
  const { data: userData } = useQuery<UserData>({
    queryKey: ["/api/user/me"],
  });
  
  const currentPlan = userData?.planType || "basic";

  const handleUpgrade = (planName: string) => {
    toast({
      title: "Redirecionando para checkout",
      description: `Você será redirecionado para completar a assinatura do plano ${planName}.`,
      duration: 2000,
    });
  };

  const plans = [
    {
      id: "basic",
      name: "Básico",
      description: "Perfeito para começar",
      monthlyPrice: 250,
      yearlyPrice: 2400,
      popular: false,
      features: [
        { text: "500 mensagens/hora", included: true },
        { text: "3 funis de venda", included: true },
        { text: "1.000 contatos", included: true },
        { text: "Suporte via email (48h)", included: true },
      ]
    },
    {
      id: "pro",
      name: "Plus",
      description: "Para profissionais e pequenas empresas",
      monthlyPrice: 500,
      yearlyPrice: 4800,
      popular: true,
      features: [
        { text: "1.000 mensagens/hora", included: true },
        { text: "Funis ilimitados", included: true },
        { text: "5.000 contatos", included: true },
        { text: "Suporte prioritário (24h)", included: true },
      ]
    },
    {
      id: "enterprise",
      name: "Business",
      description: "Para empresas em crescimento",
      monthlyPrice: 1500,
      yearlyPrice: 14400,
      popular: false,
      features: [
        { text: "5.000 mensagens/hora", included: true },
        { text: "Funis ilimitados", included: true },
        { text: "Contatos ilimitados", included: true },
        { text: "Chat ao vivo 24/7", included: true },
      ]
    }
  ];

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-background border-b border-border">
            <div className="max-w-7xl mx-auto lg:px-8 py-12 text-center pl-[48px] pr-[48px]">
              <h1 className="text-4xl font-bold text-foreground mb-3" data-testid="text-page-title">
                Escolha o Plano Ideal
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Potencialize suas vendas com automação inteligente no WhatsApp. 
                Escolha o plano que melhor se adapta ao seu negócio.
              </p>
              
              {/* Billing Toggle */}
              <div className="mt-8 inline-flex items-center bg-card border border-border rounded-lg p-1">
                <Button
                  variant={billingPeriod === "monthly" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setBillingPeriod("monthly")}
                  data-testid="button-billing-monthly"
                  className="px-6"
                >
                  Mensal
                </Button>
                <Button
                  variant={billingPeriod === "yearly" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setBillingPeriod("yearly")}
                  data-testid="button-billing-yearly"
                  className="px-6"
                >
                  Anual
                  <Badge className="ml-2 bg-green-500 text-white">-20%</Badge>
                </Button>
              </div>
            </div>
          </div>

          {/* Plans Grid */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
              {plans.map((plan) => {
                const price = billingPeriod === "monthly" ? plan.monthlyPrice : plan.yearlyPrice;
                const isCurrentPlan = currentPlan === plan.id;
                
                return (
                  <Card 
                    key={plan.id}
                    className={`relative ${plan.popular ? 'border-primary border-2 shadow-xl md:scale-105' : ''} ${isCurrentPlan ? 'border-primary' : ''}`}
                  >
                    {plan.popular && (
                      <div className="absolute -top-4 left-0 right-0 flex justify-center">
                        <Badge className="bg-primary text-primary-foreground px-4 py-1 text-sm">
                          <Star className="h-3 w-3 inline mr-1" />
                          Mais Popular
                        </Badge>
                      </div>
                    )}
                    <CardHeader className="text-center pb-8 pt-6">
                      <CardTitle className="text-2xl mb-2">
                        {plan.name}
                        {isCurrentPlan && (
                          <Badge className="ml-2 bg-green-500">Plano Atual</Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="text-base">
                        {plan.description}
                      </CardDescription>
                      
                      <div className="mt-6">
                        <div className="flex items-baseline justify-center whitespace-nowrap">
                          <span className="text-[30px] font-extrabold">{price} MT</span>
                          <span className="text-muted-foreground ml-2 text-sm sm:text-base">
                            /{billingPeriod === "monthly" ? "mês" : "ano"}
                          </span>
                        </div>
                        {billingPeriod === "yearly" && plan.monthlyPrice > 0 && (
                          <p className="text-xs sm:text-sm text-muted-foreground mt-2">
                            {(price / 12).toFixed(2)} MT/mês economize {((plan.monthlyPrice * 12 - price) / (plan.monthlyPrice * 12) * 100).toFixed(0)}%
                          </p>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <Button
                        onClick={() => handleUpgrade(plan.name)}
                        disabled={isCurrentPlan}
                        className={`w-full ${plan.popular ? 'bg-primary hover:bg-primary/90' : ''}`}
                        variant={plan.popular ? "default" : "outline"}
                        data-testid={`button-select-${plan.id}`}
                      >
                        {isCurrentPlan ? "Plano Atual" : plan.id === "free" ? "Começar Grátis" : "Assinar Agora"}
                        {!isCurrentPlan && <ArrowRight className="ml-2 h-4 w-4" />}
                      </Button>

                      <Separator />

                      <div className="space-y-3">
                        <p className="text-sm font-semibold text-foreground">O que está incluso:</p>
                        {plan.features.map((feature, idx) => (
                          <div key={idx} className="flex items-start space-x-3">
                            <div className={`mt-0.5 ${feature.included ? 'text-green-500' : 'text-muted-foreground/40'}`}>
                              {feature.included ? (
                                <Check className="h-5 w-5" />
                              ) : (
                                <Check className="h-5 w-5" />
                              )}
                            </div>
                            <span className={`text-sm ${feature.included ? 'text-foreground' : 'text-muted-foreground/60 line-through'}`}>
                              {feature.text}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Features Comparison */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="mt-20">
              <h2 className="text-3xl font-bold text-center mb-12">Por que escolher o Pilot Zap?</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                  <CardHeader className="text-center">
                    <div className="mx-auto w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                      <Zap className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="text-lg">Automação Inteligente</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground text-center">
                      Crie funis de vendas automatizados e aumente suas conversões em até 300%
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="text-center">
                    <div className="mx-auto w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                      <MessageSquare className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="text-lg">WhatsApp Business</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground text-center">
                      Conecte sua conta oficial do WhatsApp Business de forma segura
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="text-center">
                    <div className="mx-auto w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                      <TrendingUp className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="text-lg">Relatórios em Tempo Real</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground text-center">
                      Acompanhe métricas detalhadas e tome decisões baseadas em dados
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="text-center">
                    <div className="mx-auto w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                      <Shield className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="text-lg">Seguro e Confiável</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground text-center">
                      Seus dados e de seus clientes protegidos com criptografia avançada
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* FAQ Section */}
            <div className="mt-20 bg-card rounded-lg border border-border p-8">
              <h2 className="text-2xl font-bold text-center mb-8">Perguntas Frequentes sobre Planos</h2>
              
              <div className="max-w-3xl mx-auto">
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="item-1">
                    <AccordionTrigger className="text-left">
                      Posso cancelar a qualquer momento?
                    </AccordionTrigger>
                    <AccordionContent>
                      Sim! Não há fidelidade. Você pode cancelar seu plano quando quiser sem custos adicionais.
                    </AccordionContent>
                  </AccordionItem>
                  
                  <AccordionItem value="item-2">
                    <AccordionTrigger className="text-left">
                      Como funciona o período de teste?
                    </AccordionTrigger>
                    <AccordionContent>
                      O plano gratuito não tem limite de tempo. Teste todas as funcionalidades antes de fazer upgrade.
                    </AccordionContent>
                  </AccordionItem>
                  
                  <AccordionItem value="item-3">
                    <AccordionTrigger className="text-left">
                      Posso mudar de plano depois?
                    </AccordionTrigger>
                    <AccordionContent>
                      Claro! Você pode fazer upgrade ou downgrade a qualquer momento, com ajuste proporcional.
                    </AccordionContent>
                  </AccordionItem>
                  
                  <AccordionItem value="item-4">
                    <AccordionTrigger className="text-left">
                      Quais formas de pagamento aceitas?
                    </AccordionTrigger>
                    <AccordionContent>
                      Aceitamos cartão de crédito, M-Pesa e transferência bancária. Pagamento 100% seguro.
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </div>

            {/* CTA Section */}
            <div className="mt-20 text-center bg-gradient-to-r from-primary/10 to-background rounded-lg p-12 mx-4 sm:mx-6 lg:mx-8">
              <h2 className="text-3xl font-bold mb-4">Ainda tem dúvidas?</h2>
              <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
                Nossa equipe está pronta para ajudar você a escolher o melhor plano para seu negócio
              </p>
              <div className="flex justify-center">
                <Link href="/settings#support">
                  <Button size="lg" data-testid="button-contact-support">
                    <Headphones className="h-5 w-5 mr-2" />
                    Falar com Suporte
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
