import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useSettings } from "@/contexts/SettingsContext";
import { useState } from "react";
import logoDashboard from "@assets/logo-dashboard-old.png";
import whatsappIcon from "@/assets/whatsapp-icon.png";
import { IoLogoWhatsapp } from "react-icons/io";
import {
  MessageCircle,
  Filter,
  Users,
  TrendingUp,
  Settings,
  Home,
  ChevronLeft,
  ChevronRight,
  Menu,
  Smartphone,
  Rocket,
  LogOut,
} from "lucide-react";

export default function Sidebar() {
  const [location] = useLocation();
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { t } = useSettings();

  const handleLogout = () => {
    localStorage.removeItem("demo_logged_in");
    localStorage.removeItem("demo_user_email");
    localStorage.removeItem("demo_user_name");
    window.location.href = "/login";
  };

  if (location.startsWith("/funnel-editor/")) {
    return null;
  }

  const menuItems = [
    { href: "/dashboard", icon: Home, label: "Início", key: 'dashboard' },
    { 
      href: "/whatsapp-connection", 
      icon: MessageCircle, 
      label: "Conexão", 
      key: 'whatsapp_connection' 
    },
    { href: "/funnel-builder", icon: Filter, label: "Funis", key: 'sales_funnels' },
    { href: "/contacts", icon: Users, label: "Contatos", key: 'contacts' },
    { href: "/analytics", icon: TrendingUp, label: "Relatórios", key: 'reports' },
    { href: "/settings", icon: Settings, label: "Configurações", key: 'settings' },
    { href: "#logout", icon: LogOut, label: "Sair", key: 'logout', onClick: handleLogout },
  ];

  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => {
    const showMinimized = !isMobile && isMinimized;
    
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 sm:p-6 border-b border-border flex items-center justify-between">
          {!showMinimized && (
            <div className="flex items-center gap-2.5">
              <img 
                src={logoDashboard} 
                alt="PilotZap Logo" 
                className="h-12 w-auto object-contain"
              />
            </div>
          )}
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          {menuItems.map((item) => {
            const isActive = location === item.href;
            const isLogout = item.key === 'logout';
            const Icon = item.icon;

            const content = (
              <Button
                onClick={(e) => {
                  if (isLogout) {
                    e.preventDefault();
                    handleLogout();
                  } else {
                    setIsMobileMenuOpen(false);
                  }
                }}
                variant={isActive ? "secondary" : "ghost"}
                className={`w-full ${showMinimized ? 'justify-center px-2' : 'justify-start'} ${isActive ? 'bg-secondary text-secondary-foreground' : 'hover:bg-transparent hover:text-primary'} ${isLogout ? 'text-red-500 hover:text-red-600 hover:bg-red-50/10' : ''}`}
                data-testid={`button-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                title={showMinimized ? item.label : undefined}
              >
                <Icon className={`h-4 w-4 ${showMinimized ? '' : 'mr-3'}`} />
                {!showMinimized && item.label}
              </Button>
            );

            if (isLogout) {
              return <div key={item.key}>{content}</div>;
            }

            return (
              <Link key={item.href} href={item.href}>
                {content}
              </Link>
            );
          })}
        </nav>
      </div>
    );
  };

  return (
    <>
      {/* Mobile Menu Button */}
      <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden fixed top-4 left-4 z-40 bg-card border border-border shadow-md hover:bg-primary/20 hover:text-primary"
            data-testid="button-mobile-menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <div className="bg-card flex flex-col h-full">
            <SidebarContent isMobile={true} />
          </div>
        </SheetContent>
      </Sheet>

      {/* Desktop Sidebar */}
      <div className={`hidden lg:flex bg-card border-r border-border flex-col transition-all duration-300 ${isMinimized ? 'w-16' : 'w-64'}`}>
        <SidebarContent isMobile={false} />
      </div>
    </>
  );
}
