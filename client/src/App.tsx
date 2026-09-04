import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SettingsProvider } from "@/contexts/SettingsContext";
import StarfieldBackground from "@/components/starfield-background";
import Dashboard from "@/pages/dashboard";
import WhatsAppConnection from "@/pages/whatsapp-connection";
import FunnelBuilder from "@/pages/funnel-builder";
import FunnelEditor from "@/pages/funnel-editor";
import Contacts from "@/pages/contacts";
import Campaigns from "@/pages/campaigns";
import Analytics from "@/pages/analytics";
import Plans from "@/pages/plans";
import Settings from "@/pages/settings";
import Login from "@/pages/login";
import BlockedPage from "@/pages/blocked";
import NotFound from "@/pages/not-found";
import { useEffect } from "react";

type User = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  planType: string;
  planExpiresAt: string | null;
  isBlocked: boolean;
};

function BlockedUserCheck({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  
  const { data: user } = useQuery<User>({
    queryKey: ["/api/user/me"],
    retry: false,
  });

  useEffect(() => {
    if (user?.isBlocked && location !== '/blocked' && location !== '/plans') {
      setLocation('/blocked');
    }
  }, [user, location, setLocation]);

  return <>{children}</>;
}

function Router() {
  const [location, setLocation] = useLocation();
  const { data: user, isLoading } = useQuery<User>({
    queryKey: ["/api/user/me"],
    retry: false,
  });

  // Limpar qualquer dado residual do localStorage
  useEffect(() => {
    try {
      localStorage.clear();
    } catch (_) {}
  }, []);

  const isLoggedIn = !!user;

  useEffect(() => {
    if (!isLoading) {
      if (!isLoggedIn && location !== "/" && location !== "/login") {
        setLocation("/login");
      }
      if (isLoggedIn && (location === "/" || location === "/login")) {
        setLocation("/dashboard");
      }
    }
  }, [isLoggedIn, isLoading, location, setLocation]);

  return (
    <BlockedUserCheck>
      <Switch>
        <Route path="/" component={isLoggedIn ? Dashboard : Login} />
        <Route path="/login" component={Login} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/whatsapp-connection" component={WhatsAppConnection} />
        <Route path="/funnel-builder" component={FunnelBuilder} />
        <Route path="/disparos" component={Campaigns} />
        <Route path="/funnel-editor/:id" component={FunnelEditor} />
        <Route path="/contacts" component={Contacts} />
        <Route path="/analytics" component={Analytics} />
        <Route path="/plans" component={Plans} />
        <Route path="/settings" component={Settings} />
        <Route path="/blocked" component={BlockedPage} />
        <Route component={NotFound} />
      </Switch>
    </BlockedUserCheck>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
        <TooltipProvider>
          <StarfieldBackground />
          <div className="relative z-10">
            <Router />
          </div>
          <Toaster />
        </TooltipProvider>
      </SettingsProvider>
    </QueryClientProvider>
  );
}

export default App;
