import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CreditCard, Phone } from "lucide-react";
import { useLocation } from "wouter";

export default function BlockedPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
          <CardTitle className="text-2xl" data-testid="text-blocked-title">
            Conta Bloqueada
          </CardTitle>
          <CardDescription className="text-base mt-2">
            O seu plano expirou e a sua conta foi temporariamente bloqueada.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-sm text-muted-foreground text-center">
              Para continuar a usar o Pilot Zap e todas as suas funcionalidades, 
              por favor renove o seu plano.
            </p>
          </div>
          
          <div className="space-y-3">
            <Button 
              className="w-full" 
              size="lg"
              onClick={() => setLocation('/plans')}
              data-testid="button-view-plans"
            >
              <CreditCard className="h-5 w-5 mr-2" />
              Ver Planos
            </Button>
            
            <Button 
              variant="outline" 
              className="w-full" 
              size="lg"
              onClick={() => window.open('https://wa.me/your-support-number', '_blank')}
              data-testid="button-contact-support"
            >
              <Phone className="h-5 w-5 mr-2" />
              Contactar Suporte
            </Button>
          </div>
          
          <p className="text-xs text-muted-foreground text-center">
            Se acredita que isto é um erro, por favor contacte o nosso suporte.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
