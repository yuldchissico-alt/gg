# 📁 Estrutura do Projeto PilotZap

## 🗂️ Organização de Pastas

```
pilotzap/
├── 📄 Arquivos de Configuração (Raiz)
│   ├── package.json              # Dependências e scripts do projeto
│   ├── tsconfig.json             # Configuração TypeScript
│   ├── vite.config.ts            # Configuração Vite (frontend)
│   ├── tailwind.config.ts        # Configuração Tailwind CSS
│   ├── postcss.config.js         # Configuração PostCSS
│   ├── drizzle.config.ts         # Configuração Drizzle ORM
│   ├── components.json           # Configuração shadcn/ui
│   └── .npmrc                    # Configuração NPM
│
├── 🚀 .deploy/                   # Arquivos de Deploy
│   ├── Dockerfile                # Container Docker
│   ├── render.yaml               # Configuração Render
│   ├── Procfile                  # Configuração Heroku
│   └── .dockerignore             # Arquivos ignorados no Docker
│
├── 📚 docs/                      # Documentação
│   ├── PROJECT_STRUCTURE.md      # Este arquivo
│   ├── RENDER_DISK_SETUP.md      # Configuração de disco no Render
│   ├── WHATSAPP_CONNECTION.md    # Guia de conexão WhatsApp
│   └── AI_RULES.md               # Regras para assistentes de IA
│
├── 🎨 client/                    # Frontend (React + Vite)
│   ├── index.html                # HTML principal
│   ├── src/
│   │   ├── main.tsx              # Entry point React
│   │   ├── App.tsx               # Componente raiz
│   │   ├── pages/                # Páginas da aplicação
│   │   │   ├── landing.tsx       # Landing page
│   │   │   ├── login.tsx         # Página de login
│   │   │   ├── dashboard.tsx     # Dashboard principal
│   │   │   ├── connection.tsx    # Conexão WhatsApp
│   │   │   ├── contacts.tsx      # Gestão de contactos
│   │   │   ├── campaigns.tsx     # Campanhas
│   │   │   ├── funnel-builder.tsx # Criador de funis
│   │   │   ├── funnel-editor.tsx  # Editor de funis
│   │   │   ├── templates.tsx     # Templates de mensagens
│   │   │   ├── analytics.tsx     # Analytics
│   │   │   └── settings.tsx      # Configurações
│   │   ├── components/           # Componentes React
│   │   │   ├── ui/               # Componentes shadcn/ui
│   │   │   ├── sidebar.tsx       # Barra lateral
│   │   │   ├── funnel-canvas.tsx # Canvas de funil
│   │   │   └── ...
│   │   ├── contexts/             # Contextos React
│   │   │   └── SettingsContext.tsx
│   │   ├── hooks/                # Custom hooks
│   │   │   └── use-toast.ts
│   │   ├── lib/                  # Utilitários
│   │   │   ├── queryClient.ts    # React Query
│   │   │   └── utils.ts
│   │   └── assets/               # Assets do cliente
│   │       ├── logo-dashboard-old.png
│   │       └── whatsapp-icon.png
│   └── public/                   # Assets públicos
│
├── 🔧 server/                    # Backend (Express + Node.js)
│   ├── index.ts                  # Entry point do servidor
│   ├── routes.ts                 # Rotas da API
│   ├── db.ts                     # Conexão ao banco de dados
│   ├── db-init.ts                # Inicialização do banco
│   ├── storage.ts                # Camada de storage/queries
│   ├── services/                 # Serviços de negócio
│   │   ├── whatsappService.ts    # Serviço WhatsApp (Baileys)
│   │   ├── funnelService.ts      # Serviço de funis
│   │   ├── funnelJsonConverter.ts # Conversor JSON→Flow
│   │   └── schedulerService.ts   # Agendamento de tarefas
│   └── middleware/               # Middlewares Express
│       └── ...
│
├── 🔄 shared/                    # Código Compartilhado
│   ├── schema.ts                 # Schema do banco (Drizzle)
│   ├── api-types.ts              # Tipos TypeScript da API
│   ├── funnel-json-types.ts      # Tipos e validação de funis JSON
│   └── plan-limits.ts            # Limites de planos
│
├── 📦 public/                    # Assets públicos servidos
│   └── favicon.png               # Favicon do app
│
├── 🏗️ dist/                      # Build de produção (gerado)
│   ├── public/                   # Frontend compilado
│   └── index.js                  # Backend compilado
│
├── 🔐 auth_info/                 # Dados de autenticação (ignorado no Git)
│   └── baileys/                  # Sessões do Baileys
│       └── session-{userId}/     # Por usuário
│           ├── creds.json        # Credenciais WhatsApp
│           └── ...
│
└── 📝 Outros
    ├── .env                      # Variáveis de ambiente (não versionado)
    ├── .env.example              # Exemplo de .env
    ├── .gitignore                # Arquivos ignorados no Git
    ├── .vscode/                  # Configuração VS Code
    └── README.md                 # Documentação principal
```

---

## 🎯 Convenções de Organização

### 1. **Separação Cliente/Servidor**
- **`client/`**: Todo o código do frontend (React)
- **`server/`**: Todo o código do backend (Express)
- **`shared/`**: Código compartilhado entre ambos

### 2. **Documentação Centralizada**
- **`docs/`**: Toda documentação técnica
- **`README.md`**: Visão geral do projeto

### 3. **Deploy Isolado**
- **`.deploy/`**: Arquivos de configuração de deploy
- Cópias na raiz para compatibilidade com plataformas

### 4. **Configurações na Raiz**
- Arquivos de configuração de ferramentas ficam na raiz
- Facilita o descobrimento por ferramentas de build

---

## 📦 Fluxo de Build

### Desenvolvimento
```bash
npm run dev
```
- Vite serve o frontend em modo dev
- tsx executa o backend com hot reload
- Proxy Vite redireciona `/api/*` para o backend

### Produção
```bash
npm run build
```
1. **Frontend**: Vite compila React → `dist/public/`
2. **Backend**: esbuild bundlea Express → `dist/index.js`

```bash
npm start
```
- Executa `node dist/index.js`
- Serve frontend estático de `dist/public/`
- API disponível em `/api/*`

---

## 🗄️ Banco de Dados

### Schema
- Definido em: `shared/schema.ts`
- ORM: Drizzle ORM
- Migrations: `drizzle-kit push`

### Tabelas Principais
- `users` - Usuários do sistema
- `whatsapp_connections` - Conexões WhatsApp
- `contacts` - Contactos
- `funnels` - Funis de conversação
- `funnel_executions` - Execuções de funis
- `messages` - Histórico de mensagens
- `campaigns` - Campanhas
- `message_templates` - Templates

---

## 🔌 Integração WhatsApp

### Biblioteca: @whiskeysockets/baileys
- **Não usa Puppeteer/Chrome** (mais leve)
- **Multi-device** suportado
- Sessões salvas em: `auth_info/baileys/`

### Persistência
- **Desenvolvimento**: Local
- **Produção (Render)**: Disco persistente em `/app/auth_info`

---

## 🎨 Frontend

### Stack
- **React 18** - UI framework
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **shadcn/ui** - Componentes
- **React Query** - Data fetching
- **Wouter** - Routing
- **ReactFlow** - Editor de funis

### Páginas
- `/` - Landing page
- `/login` - Login
- `/dashboard` - Dashboard
- `/connection` - Conexão WhatsApp
- `/contacts` - Gestão de contactos
- `/campaigns` - Campanhas
- `/funnel-builder` - Lista de funis
- `/funnel-editor/:id` - Editor de funil
- `/templates` - Templates
- `/analytics` - Analytics
- `/settings` - Configurações

---

## 🔧 Backend

### Stack
- **Express** - Web framework
- **TypeScript** - Type safety
- **Drizzle ORM** - Database
- **Baileys** - WhatsApp
- **node-cron** - Agendamento

### Endpoints Principais
- `GET /api/health` - Health check
- `POST /api/login` - Login
- `GET /api/whatsapp/status` - Status WhatsApp
- `GET /api/whatsapp/qr` - QR Code
- `POST /api/whatsapp/disconnect` - Desconectar
- `GET /api/contacts` - Listar contactos
- `GET /api/funnels` - Listar funis
- `POST /api/campaigns` - Criar campanha
- `GET /api/analytics` - Analytics

---

## 🚀 Deploy

### Plataformas Suportadas
- ✅ **Render** (recomendado)
- ✅ **Heroku** (via Procfile)
- ✅ **Docker** (qualquer cloud)
- ✅ **VPS** (via npm start)

### Variáveis de Ambiente
```env
DATABASE_URL=postgresql://...
NODE_ENV=production
PORT=10000
```

---

## 📊 Monitoramento

### Logs
- Formato estruturado com emojis
- Níveis: info, warn, error
- Prefixos por serviço: `[BAILEYS]`, `[FUNNEL]`, etc.

### Health Check
- Endpoint: `GET /api/health`
- Verifica: DB, WhatsApp, Sistema

---

## 🔐 Segurança

### Autenticação
- Session-based com express-session
- Sessões salvas no banco (PostgreSQL)

### WhatsApp
- Credenciais nunca commitadas (`.gitignore`)
- Sessões criptografadas pelo Baileys
- Disco persistente com acesso restrito

---

## 📚 Documentação Adicional

- [Setup de Disco no Render](./RENDER_DISK_SETUP.md)
- [Conexão WhatsApp](./WHATSAPP_CONNECTION.md)
- [Regras para IA](./AI_RULES.md)

