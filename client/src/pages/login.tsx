import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Rocket } from "lucide-react";
import { useLocation } from "wouter";
import logoHeader from "@assets/logo-dashboard-old.png";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setIsLoading(true);
    
    // Extração do primeiro nome
    const handle = email.split('@')[0];
    
    // Tenta separar por caracteres especiais primeiro (. _ -)
    // Se o email for 'joaosilva@gmail.com', handle é 'joaosilva'
    const parts = handle.split(/[._-]/);
    let namePart = parts[0];
    
    // Lista de nomes comuns para ajudar na separação se estiverem grudados
    // Se o nome não estiver nesta lista mas estiver grudado, ainda pegaremos a primeira parte razoável
    const commonPrefixes = [
      'joao', 'maria', 'jose', 'ana', 'paulo', 'pedro', 'lucas', 'luiz', 'luis', 
      'carlos', 'marcos', 'andre', 'felipe', 'rafael', 'bruno', 'tiago', 'diogo',
      'carla', 'julia', 'fernanda', 'patricia', 'aline', 'camila', 'beatriz',
      'gabriel', 'gustavo', 'rodrigo', 'marcelo', 'ricardo', 'fernando'
    ];

    // Se não houver separadores e o nome for longo, tenta ver se começa com um nome comum
    if (parts.length === 1 && namePart.length > 5) {
      const lowerName = namePart.toLowerCase();
      for (const prefix of commonPrefixes) {
        if (lowerName.startsWith(prefix) && lowerName.length > prefix.length) {
          namePart = namePart.substring(0, prefix.length);
          break;
        }
      }
    }
    
    // Se houver números no final do nome, vamos removê-los
    namePart = namePart.replace(/[0-9]+$/, '');
    
    const capitalizedFirstName = namePart.charAt(0).toUpperCase() + namePart.slice(1).toLowerCase();
    
    localStorage.setItem("demo_user_email", email);
    localStorage.setItem("demo_user_name", capitalizedFirstName);
    localStorage.setItem("demo_logged_in", "true");

    // Redirecionamento via wouter para evitar tela branca de reload
    setTimeout(() => {
      try {
        setLocation("/dashboard");
      } catch (error) {
        console.error("Navigation failed:", error);
        setIsLoading(false);
        toast({
          title: "Erro",
          description: "Falha ao redirecionar. Tente recarregar a página.",
          variant: "destructive",
        });
      }
    }, 500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md border-border bg-card/50 backdrop-blur-sm">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <img src={logoHeader} alt="Pilot Zap Logo" className="h-16 w-auto object-contain" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-2xl font-bold">Acesse sua conta</CardTitle>
            <CardDescription>Entre com suas credenciais para continuar</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="nome@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-12"
              />
            </div>
            <Button type="submit" className="w-full h-12 text-base font-bold" disabled={isLoading}>
              {isLoading ? "Entrando..." : (
                <>
                  <Rocket className="mr-2 h-5 w-5" />
                  Entrar no PilotZap
                </>
              )}
            </Button>
          </form>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Ao entrar, você concorda com nossos termos de uso.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
