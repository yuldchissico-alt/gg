import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  MessageSquare,
  Users,
  GitBranch,
  Smartphone,
  AlertTriangle,
  Crown,
} from "lucide-react";

interface UsageData {
  current: number;
  limit: number;
  percentage: number;
}

interface UsageResponse {
  planType: string;
  usage: {
    whatsappAccounts: UsageData;
    messagesThisHour: UsageData;
    funnels: UsageData;
    contacts: UsageData;
  };
}

function formatLimit(limit: number): string {
  if (limit === -1) return "Ilimitado";
  return limit.toLocaleString("pt-BR");
}

function getProgressColor(percentage: number): string {
  if (percentage >= 90) return "bg-red-500";
  if (percentage >= 70) return "bg-yellow-500";
  return "bg-primary";
}

function getPlanDisplayName(planType: string): string {
  const names: Record<string, string> = {
    basic: "Básico",
    pro: "Plus",
    enterprise: "Business",
  };
  return names[planType] || planType;
}

function UsageItem({
  icon: Icon,
  label,
  data,
}: {
  icon: typeof MessageSquare;
  label: string;
  data: UsageData;
}) {
  const isUnlimited = data.limit === -1;
  const isAtLimit = !isUnlimited && data.current >= data.limit;
  const isNearLimit = !isUnlimited && data.percentage >= 80;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          {isAtLimit && (
            <AlertTriangle className="h-4 w-4 text-red-500" />
          )}
          <span className="text-sm text-muted-foreground">
            {data.current.toLocaleString("pt-BR")} / {formatLimit(data.limit)}
          </span>
        </div>
      </div>
      {!isUnlimited && (
        <div className="relative">
          <Progress value={data.percentage} className="h-2" />
          <div
            className={`absolute top-0 left-0 h-2 rounded-full transition-all ${getProgressColor(data.percentage)}`}
            style={{ width: `${Math.min(data.percentage, 100)}%` }}
          />
        </div>
      )}
      {isUnlimited && (
        <div className="h-2 rounded-full bg-green-500/20 flex items-center justify-center">
          <span className="text-[10px] text-green-600 font-medium">ILIMITADO</span>
        </div>
      )}
      {isNearLimit && !isAtLimit && (
        <p className="text-xs text-yellow-600">
          Você está próximo do limite. Considere fazer upgrade.
        </p>
      )}
      {isAtLimit && (
        <p className="text-xs text-red-600 font-medium">
          Limite atingido! Faça upgrade para continuar.
        </p>
      )}
    </div>
  );
}

export default function UsageDisplay({ compact = false }: { compact?: boolean }) {
  const { data, isLoading, error } = useQuery<UsageResponse>({
    queryKey: ["/api/user/usage"],
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <Card className={compact ? "border-0 shadow-none" : ""}>
        <CardContent className="p-4">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-1/2" />
            <div className="h-2 bg-muted rounded" />
            <div className="h-4 bg-muted rounded w-1/2" />
            <div className="h-2 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return null;
  }

  const { usage, planType } = data;
  const hasAnyLimitIssue = 
    usage.funnels.percentage >= 80 ||
    usage.contacts.percentage >= 80 ||
    usage.whatsappAccounts.percentage >= 80 ||
    usage.messagesThisHour.percentage >= 80;

  if (compact) {
    return (
      <div className="p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">
              Plano {getPlanDisplayName(planType)}
            </span>
          </div>
          {hasAnyLimitIssue && (
            <Badge variant="destructive" className="text-xs">
              Limite próximo
            </Badge>
          )}
        </div>
        
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1">
            <GitBranch className="h-3 w-3" />
            <span>{usage.funnels.current}/{formatLimit(usage.funnels.limit)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            <span>{usage.contacts.current}/{formatLimit(usage.contacts.limit)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Smartphone className="h-3 w-3" />
            <span>{usage.whatsappAccounts.current}/{formatLimit(usage.whatsappAccounts.limit)}</span>
          </div>
          <div className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            <span>{usage.messagesThisHour.current}/{formatLimit(usage.messagesThisHour.limit)}/h</span>
          </div>
        </div>

        <Link href="/plans">
          <Button variant="outline" size="sm" className="w-full text-xs" data-testid="button-upgrade-compact">
            <Crown className="h-3 w-3 mr-1" />
            Fazer Upgrade
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <Card data-testid="card-usage-display">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Crown className="h-5 w-5 text-primary" />
            Uso do Plano
          </CardTitle>
          <Badge variant="secondary" data-testid="badge-plan-type">
            {getPlanDisplayName(planType)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <UsageItem
          icon={GitBranch}
          label="Funis"
          data={usage.funnels}
        />
        <UsageItem
          icon={Users}
          label="Contatos"
          data={usage.contacts}
        />
        <UsageItem
          icon={Smartphone}
          label="Contas WhatsApp"
          data={usage.whatsappAccounts}
        />
        <UsageItem
          icon={MessageSquare}
          label="Mensagens/hora"
          data={usage.messagesThisHour}
        />

        {hasAnyLimitIssue && (
          <Link href="/plans">
            <Button className="w-full" data-testid="button-upgrade">
              <Crown className="h-4 w-4 mr-2" />
              Fazer Upgrade do Plano
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
