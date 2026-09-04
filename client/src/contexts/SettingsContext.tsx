import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface Settings {
  companyName: string;
  companyEmail: string;
  timezone: string;
  language: string;
}

interface SettingsContextType {
  settings: Settings;
  updateSettings: (newSettings: Settings) => void;
  t: (key: string) => string;
  formatDate: (date: Date | string) => string;
  formatDateTime: (date: Date | string) => string;
}

const defaultSettings: Settings = {
  companyName: "Pilot Zap",
  companyEmail: "contato@pilotzap.com",
  timezone: "Africa/Maputo",
  language: "pt-BR",
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const translations: Record<string, Record<string, string>> = {
  'pt-BR': {
    // Menu
    'dashboard': 'Dashboard',
    'sales_funnels': 'Funil de venda',
    'contacts': 'Contatos',
    'reports': 'Relatórios',
    'plans': 'Planos',
    'settings': 'Configurações',
    'whatsapp_connection': 'Conexão WhatsApp',
    'whatsapp_automation': 'Automação para WhatsApp',
    
    // Common
    'connected': 'Conectado',
    'disconnected': 'Desconectado',
    'connect': 'Conectar',
    'disconnect': 'Desconectar',
    'save': 'Salvar',
    'cancel': 'Cancelar',
    'delete': 'Excluir',
    'edit': 'Editar',
    'create': 'Criar',
    'back': 'Voltar',
    
    // Plans
    'choose_plan': 'Escolha o Plano Ideal',
    'monthly': 'Mensal',
    'yearly': 'Anual',
    'month': 'mês',
    'year': 'ano',
    'current_plan': 'Plano Atual',
    'subscribe_now': 'Assinar Agora',
    'start_free': 'Começar Grátis',
    'most_popular': 'Mais Popular',
    'whatsapp_accounts': 'contas WhatsApp',
    'messages_per_hour': 'mensagens/hora',
    'unlimited_funnels': 'Funil ilimitado',
    'unlimited_contacts': 'Contatos ilimitados',
    'email_support': 'Suporte via email',
    'priority_support': 'Suporte prioritário',
    'live_chat': 'Chat ao vivo 24/7',
    'account_manager': 'Gerente de conta dedicado',
    'advanced_reports': 'Relatórios avançados',
    'multiple_accounts': 'Múltiplas contas',
    
    // Dashboard
    'hello': 'Olá',
    'your_sales_center': 'Sua central de vendas automáticas no WhatsApp',
    'active_funnels': 'Funil Ativo',
    'messages_today': 'Mensagens Hoje',
    'active_contacts': 'Contatos Ativos',
    'delivery_rate': 'Taxa de Entrega',
    'metrics_analysis': 'Análise de Métricas',
    'track_performance': 'Acompanhe o desempenho das suas conversas e conversões',
    'last_7_days': 'nos últimos 7 dias',
    'since_yesterday': 'desde ontem',
    'total': 'Total',
    'messages': 'Mensagens',
    'conversations': 'Conversas',
    'conversions': 'Conversões',
    
    // Plans page
    'choose_ideal_plan': 'Escolha o Plano Ideal',
    'boost_sales': 'Potencialize suas vendas com automação inteligente no WhatsApp',
    'choose_best_plan': 'Escolha o plano que melhor se adapta ao seu negócio',
    'perfect_to_start': 'Perfeito para começar',
    'for_professionals': 'Para profissionais e pequenas empresas',
    'for_growing_companies': 'Para empresas em crescimento',
    'sales_funnels_limit': 'funil de venda',
    'contacts_limit': 'contatos',
    'whats_included': 'O que está incluso:',
    'save_offer_pt': 'economize',
    'per_month': '/mês',
    
    // WhatsApp Connection
    'whatsapp_connection_title': 'Conexão WhatsApp',
    'manage_whatsapp': 'Gerencie a conexão da sua conta WhatsApp',
    'whatsapp_accounts_title': 'Contas WhatsApp',
    'of': 'de',
    'connected_accounts': 'conectadas',
    'plan_allows': 'permite',
    'account': 'conta',
    'accounts': 'contas',
    'want_more_accounts': 'Quer conectar mais contas?',
    'upgrade_business': 'Faça upgrade para o plano Business e conecte até 5 contas WhatsApp.',
    'view_plans': 'Ver Planos',
    'connection_status': 'Status da Conexão',
    'whatsapp_connected': 'WhatsApp Conectado',
    'whatsapp_disconnected': 'WhatsApp Desconectado',
    'number': 'Número',
    'disconnecting': 'Desconectando...',
    'connect_whatsapp': 'Conectar WhatsApp',
    'scan_qr': 'Escaneie o QR Code para conectar sua conta WhatsApp',
    'generate_qr': 'Gerar QR Code',
    'generating_qr': 'Gerando QR Code...',
    'how_to_use': 'Como usar:',
    'open_whatsapp': 'Abra o WhatsApp no seu celular',
    'go_to_settings': 'Vá em Configurações → Aparelhos conectados',
    'tap_connect': 'Toque em "Conectar um aparelho"',
    'scan_code': 'Escaneie o QR Code acima com a câmera',
    'limit_reached': 'Limite de Contas Atingido',
    'current_plan_allows': 'Seu plano atual permite apenas',
    'upgrade_for_more': 'Faça upgrade para o plano Business e conecte até 5 contas WhatsApp.',
    'upgrade': 'Fazer Upgrade',
    'need_help': 'Precisa de ajuda?',
    'qr_not_appearing': 'QR Code não aparece?',
    'check_local': 'Verifique se você está executando o projeto localmente, pois WhatsApp bloqueia conexões de servidores cloud.',
    'still_questions': 'Ainda com dúvidas?',
    'contact_support': 'Entre em contato com o suporte através da página de configurações.',
  },
  'en-US': {
    // Menu
    'dashboard': 'Dashboard',
    'sales_funnels': 'Sales Funnels',
    'contacts': 'Contacts',
    'reports': 'Reports',
    'plans': 'Plans',
    'settings': 'Settings',
    'whatsapp_connection': 'WhatsApp Connection',
    'whatsapp_automation': 'WhatsApp Automation',
    
    // Common
    'connected': 'Connected',
    'disconnected': 'Disconnected',
    'connect': 'Connect',
    'disconnect': 'Disconnect',
    'save': 'Save',
    'cancel': 'Cancel',
    'delete': 'Delete',
    'edit': 'Edit',
    'create': 'Create',
    'back': 'Back',
    
    // Plans
    'choose_plan': 'Choose Your Perfect Plan',
    'monthly': 'Monthly',
    'yearly': 'Yearly',
    'month': 'month',
    'year': 'year',
    'current_plan': 'Current Plan',
    'subscribe_now': 'Subscribe Now',
    'start_free': 'Start Free',
    'most_popular': 'Most Popular',
    'whatsapp_accounts': 'WhatsApp accounts',
    'messages_per_hour': 'messages/hour',
    'unlimited_funnels': 'Unlimited funnels',
    'unlimited_contacts': 'Unlimited contacts',
    'email_support': 'Email support',
    'priority_support': 'Priority support',
    'live_chat': 'Live chat 24/7',
    'account_manager': 'Dedicated account manager',
    'advanced_reports': 'Advanced reports',
    'multiple_accounts': 'Multiple accounts',
    
    // Dashboard
    'hello': 'Hello',
    'your_sales_center': 'Your automated WhatsApp sales center',
    'active_funnels': 'Active Funnels',
    'messages_today': 'Messages Today',
    'active_contacts': 'Active Contacts',
    'delivery_rate': 'Delivery Rate',
    'metrics_analysis': 'Metrics Analysis',
    'track_performance': 'Track your conversations and conversions performance',
    'last_7_days': 'in the last 7 days',
    'since_yesterday': 'since yesterday',
    'total': 'Total',
    'messages': 'Messages',
    'conversations': 'Conversations',
    'conversions': 'Conversions',
    
    // Plans page
    'choose_ideal_plan': 'Choose Your Perfect Plan',
    'boost_sales': 'Boost your sales with intelligent WhatsApp automation',
    'choose_best_plan': 'Choose the plan that best suits your business',
    'perfect_to_start': 'Perfect to get started',
    'for_professionals': 'For professionals and small businesses',
    'for_growing_companies': 'For growing companies',
    'sales_funnels_limit': 'sales funnels',
    'contacts_limit': 'contacts',
    'whats_included': 'What\'s included:',
    'save_offer_en': 'save',
    'per_month': '/month',
    
    // WhatsApp Connection
    'whatsapp_connection_title': 'WhatsApp Connection',
    'manage_whatsapp': 'Manage your WhatsApp account connection',
    'whatsapp_accounts_title': 'WhatsApp Accounts',
    'of': 'of',
    'connected_accounts': 'connected',
    'plan_allows': 'allows',
    'account': 'account',
    'accounts': 'accounts',
    'want_more_accounts': 'Want to connect more accounts?',
    'upgrade_business': 'Upgrade to Business plan and connect up to 5 WhatsApp accounts.',
    'view_plans': 'View Plans',
    'connection_status': 'Connection Status',
    'whatsapp_connected': 'WhatsApp Connected',
    'whatsapp_disconnected': 'WhatsApp Disconnected',
    'number': 'Number',
    'disconnecting': 'Disconnecting...',
    'connect_whatsapp': 'Connect WhatsApp',
    'scan_qr': 'Scan the QR Code to connect your WhatsApp account',
    'generate_qr': 'Generate QR Code',
    'generating_qr': 'Generating QR Code...',
    'how_to_use': 'How to use:',
    'open_whatsapp': 'Open WhatsApp on your phone',
    'go_to_settings': 'Go to Settings → Linked devices',
    'tap_connect': 'Tap "Link a device"',
    'scan_code': 'Scan the QR Code above with your camera',
    'limit_reached': 'Account Limit Reached',
    'current_plan_allows': 'Your current plan allows only',
    'upgrade_for_more': 'Upgrade to Business plan and connect up to 5 WhatsApp accounts.',
    'upgrade': 'Upgrade',
    'need_help': 'Need help?',
    'qr_not_appearing': 'QR Code not showing?',
    'check_local': 'Make sure you\'re running the project locally, as WhatsApp blocks connections from cloud servers.',
    'still_questions': 'Still have questions?',
    'contact_support': 'Contact support through the settings page.',
  },
  'es-ES': {
    // Menu
    'dashboard': 'Panel',
    'sales_funnels': 'Embudos de Venta',
    'contacts': 'Contactos',
    'reports': 'Informes',
    'plans': 'Planes',
    'settings': 'Configuración',
    'whatsapp_connection': 'Conexión WhatsApp',
    'whatsapp_automation': 'Automatización WhatsApp',
    
    // Common
    'connected': 'Conectado',
    'disconnected': 'Desconectado',
    'connect': 'Conectar',
    'disconnect': 'Desconectar',
    'save': 'Guardar',
    'cancel': 'Cancelar',
    'delete': 'Eliminar',
    'edit': 'Editar',
    'create': 'Crear',
    'back': 'Volver',
    
    // Plans
    'choose_plan': 'Elige tu Plan Ideal',
    'monthly': 'Mensual',
    'yearly': 'Anual',
    'month': 'mes',
    'year': 'año',
    'current_plan': 'Plan Actual',
    'subscribe_now': 'Suscribirse Ahora',
    'start_free': 'Comenzar Gratis',
    'most_popular': 'Más Popular',
    'whatsapp_accounts': 'cuentas WhatsApp',
    'messages_per_hour': 'mensajes/hora',
    'unlimited_funnels': 'Embudos ilimitados',
    'unlimited_contacts': 'Contactos ilimitados',
    'email_support': 'Soporte por email',
    'priority_support': 'Soporte prioritario',
    'live_chat': 'Chat en vivo 24/7',
    'account_manager': 'Gerente de cuenta dedicado',
    'advanced_reports': 'Informes avanzados',
    'multiple_accounts': 'Múltiples cuentas',
    
    // Dashboard
    'hello': 'Hola',
    'your_sales_center': 'Tu centro de ventas automáticas en WhatsApp',
    'active_funnels': 'Embudos Activos',
    'messages_today': 'Mensajes Hoy',
    'active_contacts': 'Contactos Activos',
    'delivery_rate': 'Tasa de Entrega',
    'metrics_analysis': 'Análisis de Métricas',
    'track_performance': 'Seguimiento del rendimiento de tus conversaciones y conversiones',
    'last_7_days': 'en los últimos 7 días',
    'since_yesterday': 'desde ayer',
    'total': 'Total',
    'messages': 'Mensajes',
    'conversations': 'Conversaciones',
    'conversions': 'Conversiones',
    
    // Plans page
    'choose_ideal_plan': 'Elige tu Plan Ideal',
    'boost_sales': 'Potencia tus ventas con automatización inteligente en WhatsApp',
    'choose_best_plan': 'Elige el plan que mejor se adapta a tu negocio',
    'perfect_to_start': 'Perfecto para empezar',
    'for_professionals': 'Para profesionales y pequeñas empresas',
    'for_growing_companies': 'Para empresas en crescimento',
    'sales_funnels_limit': 'embudos de venta',
    'contacts_limit': 'contactos',
    'whats_included': 'Qué está incluido:',
    'per_month': '/mes',
    'save_offer_es': 'ahorra',
    
    // WhatsApp Connection
    'whatsapp_connection_title': 'Conexión WhatsApp',
    'manage_whatsapp': 'Gestiona la conexión de tu cuenta WhatsApp',
    'whatsapp_accounts_title': 'Cuentas WhatsApp',
    'of': 'de',
    'connected_accounts': 'conectadas',
    'plan_allows': 'permite',
    'account': 'cuenta',
    'accounts': 'cuentas',
    'want_more_accounts': '¿Quieres conectar más cuentas?',
    'upgrade_business': 'Actualiza al plan Business y conecta hasta 5 cuentas WhatsApp.',
    'view_plans': 'Ver Planes',
    'connection_status': 'Estado de Conexión',
    'whatsapp_connected': 'WhatsApp Conectado',
    'whatsapp_disconnected': 'WhatsApp Desconectado',
    'number': 'Número',
    'disconnecting': 'Desconectando...',
    'connect_whatsapp': 'Conectar WhatsApp',
    'scan_qr': 'Escanea el código QR para conectar tu cuenta WhatsApp',
    'generate_qr': 'Generar Código QR',
    'generating_qr': 'Generando Código QR...',
    'how_to_use': 'Cómo usar:',
    'open_whatsapp': 'Abre WhatsApp en tu teléfono',
    'go_to_settings': 'Ve a Configuración → Dispositivos vinculados',
    'tap_connect': 'Toca "Vincular un dispositivo"',
    'scan_code': 'Escanea el código QR con tu cámara',
    'limit_reached': 'Límite de Cuentas Alcanzado',
    'current_plan_allows': 'Tu plan actual permite solo',
    'upgrade_for_more': 'Actualiza al plan Business y conecta hasta 5 cuentas WhatsApp.',
    'upgrade': 'Actualizar',
    'need_help': '¿Necesitas ayuda?',
    'qr_not_appearing': '¿El código QR no aparece?',
    'check_local': 'Verifica que estés ejecutando el proyecto localmente, ya que WhatsApp bloquea conexiones desde servidores en la nube.',
    'still_questions': '¿Aún tienes dudas?',
    'contact_support': 'Contacta con soporte a través de la página de configuración.',
  },
};

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);

  useEffect(() => {
    // Carregar configurações diretamente do banco de dados (PostgreSQL)
    fetch('/api/user/settings', { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          setSettings(prev => ({
            companyName: data.companyName || data.company_name || prev.companyName,
            companyEmail: data.companyEmail || data.company_email || prev.companyEmail,
            timezone: data.timezone || prev.timezone,
            language: data.language || prev.language,
          }));
        }
      })
      .catch(error => {
        console.error("Erro ao carregar configurações do banco de dados:", error);
      });
  }, []);

  const updateSettings = async (newSettings: Settings) => {
    setSettings(newSettings);
    // Salvar diretamente no banco de dados (PostgreSQL)
    try {
      await fetch('/api/user/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newSettings),
      });
    } catch (error) {
      console.error("Erro ao salvar configurações no banco de dados:", error);
    }
  };

  const t = (key: string): string => {
    const langTranslations = translations[settings.language] || translations['pt-BR'];
    return langTranslations[key] || key;
  };

  const formatDate = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString(settings.language, {
      timeZone: settings.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const formatDateTime = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString(settings.language, {
      timeZone: settings.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, t, formatDate, formatDateTime }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
