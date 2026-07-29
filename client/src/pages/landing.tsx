import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, BarChart3, Users, Smartphone, Shield, MessageSquare } from "lucide-react";
import logoHeader from "@assets/IMG-20260102-WA0063__1_-removebg-preview_1767392224479.png";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <img src={logoHeader} alt="Pilot Zap Logo" className="h-8 w-auto object-contain" />
            <h1 className="text-2xl font-bold text-primary">Pilot Zap</h1>
          </div>
          <Button asChild data-testid="button-login">
            <a href="/login">Entrar</a>
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center">
          <h2 className="text-4xl md:text-6xl font-bold mb-6">
            Automação para WhatsApp
            <span className="block text-primary">Profissional</span>
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Crie campanhas automatizadas, funil inteligente e gerencie seus contatos 
            com a plataforma mais completa de marketing no WhatsApp.
          </p>
          <Button size="lg" asChild className="text-lg px-8 py-3" data-testid="button-start">
            <a href="/login">Começar Agora</a>
          </Button>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4 bg-card">
        <div className="container mx-auto">
          <h3 className="text-3xl font-bold text-center mb-12">Recursos Poderosos</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card>
              <CardHeader>
                <Zap className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Funil Automatizado</CardTitle>
                <CardDescription>
                  Crie sequências de mensagens inteligentes com delays configuráveis
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Drag & drop visual</li>
                  <li>• Condições e lógica avançada</li>
                  <li>• Disparos por gatilhos</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Users className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Gestão de Contatos</CardTitle>
                <CardDescription>
                  Organize e segmente seus contatos de forma eficiente
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Importação em massa</li>
                  <li>• Tags e segmentação</li>
                  <li>• Histórico completo</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <BarChart3 className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Relatórios Detalhados</CardTitle>
                <CardDescription>
                  Acompanhe performance e otimize suas campanhas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Métricas em tempo real</li>
                  <li>• Taxa de entrega e leitura</li>
                  <li>• Análise de conversão</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Smartphone className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Multiplataforma</CardTitle>
                <CardDescription>
                  Funciona em todos os países e dispositivos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Suporte global</li>
                  <li>• QR Code para conexão</li>
                  <li>• Interface responsiva</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <MessageSquare className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Múltiplos Formatos</CardTitle>
                <CardDescription>
                  Envie texto, imagens, vídeos, áudios e documentos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Templates de mensagens</li>
                  <li>• Mídia personalizada</li>
                  <li>• Variáveis dinâmicas</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Shield className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Seguro e Confiável</CardTitle>
                <CardDescription>
                  Integração oficial com APIs do WhatsApp Business
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Conexão criptografada</li>
                  <li>• Backup automático</li>
                  <li>• Conformidade LGPD</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4">
        <div className="container mx-auto text-center">
          <h3 className="text-3xl font-bold mb-4">Pronto para Começar?</h3>
          <p className="text-xl text-muted-foreground mb-8">
            Transforme seu atendimento e vendas com automação profissional
          </p>
          <Button size="lg" asChild className="text-lg px-8 py-3" data-testid="button-cta">
            <a href="/login">Criar Conta Grátis</a>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4">
        <div className="container mx-auto text-center text-muted-foreground">
          <p>&copy; 2024 Pilot Zap. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
