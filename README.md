# 🚀 PilotZap

**Automação Profissional para WhatsApp**

Sistema completo de automação de marketing via WhatsApp com funis inteligentes, campanhas automatizadas e gestão de contactos.

---

## ✨ Funcionalidades

### 🤖 Automação
- ✅ Funis de conversação personalizáveis (drag & drop)
- ✅ Respostas automáticas baseadas em gatilhos
- ✅ Campanhas programadas
- ✅ Templates de mensagens reutilizáveis

### 📊 Gestão
- ✅ Gestão completa de contactos
- ✅ Tags e segmentação
- ✅ Analytics e relatórios
- ✅ Histórico de conversas

### 💬 WhatsApp
- ✅ Conexão via Baileys (sem Puppeteer)
- ✅ Multi-device suportado
- ✅ Envio de texto, imagens, vídeos e documentos
- ✅ Sessão persistente (mantém conexão após deploys)

---

## 🛠️ Stack Tecnológica

### Frontend
- **React 18** + **TypeScript**
- **Vite** (build tool)
- **Tailwind CSS** + **shadcn/ui**
- **React Query** (data fetching)
- **ReactFlow** (editor visual de funis)

### Backend
- **Node.js** + **Express**
- **TypeScript**
- **PostgreSQL** + **Drizzle ORM**
- **Baileys** (WhatsApp Web API)
- **node-cron** (agendamento)

---

## 📋 Pré-requisitos

- **Node.js** 20+
- **PostgreSQL** 14+
- **npm** ou **pnpm**

---

## 🚀 Início Rápido

### 1. Clonar o repositório
```bash
git clone <seu-repo>
cd pilotzap
```

### 2. Instalar dependências
```bash
npm install
```

### 3. Configurar ambiente
```bash
cp .env.example .env
```

Edite `.env` e adicione:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/pilotzap
NODE_ENV=development
PORT=5000
```

### 4. Configurar banco de dados
```bash
npm run db:push
```

### 5. Iniciar em desenvolvimento
```bash
npm run dev
```

Acesse: http://localhost:5000

---

## 📦 Build para Produção

```bash
# Build frontend + backend
npm run build

# Iniciar em produção
npm start
```

---

## 🐳 Deploy com Docker

```bash
# Build da imagem
docker build -t pilotzap -f .deploy/Dockerfile .

# Executar container
docker run -p 10000:10000 \
  -e DATABASE_URL="postgresql://..." \
  -e NODE_ENV=production \
  -v $(pwd)/auth_info:/app/auth_info \
  pilotzap
```

---

## ☁️ Deploy no Render

1. **Criar novo Web Service** no [Render](https://render.com)
2. **Conectar repositório Git**
3. **Configurar**:
   - Build Command: `npm ci && npm run build`
   - Start Command: `node dist/index.js`
4. **Adicionar variáveis de ambiente**:
   - `DATABASE_URL` - String de conexão PostgreSQL
   - `NODE_ENV` - `production`
5. **Adicionar Disco Persistente**:
   - Name: `pilotzap-auth-data`
   - Mount Path: `/app/auth_info`
   - Size: `1 GB`

📖 **Guia detalhado**: [docs/RENDER_DISK_SETUP.md](./docs/RENDER_DISK_SETUP.md)

---

## 📁 Estrutura do Projeto

```
pilotzap/
├── client/          # Frontend React
├── server/          # Backend Express
├── shared/          # Código compartilhado (tipos, schemas)
├── docs/            # Documentação
├── .deploy/         # Arquivos de deploy
└── public/          # Assets públicos
```

📖 **Documentação completa**: [docs/PROJECT_STRUCTURE.md](./docs/PROJECT_STRUCTURE.md)

---

## 🔐 Segurança

- ✅ Autenticação por sessão
- ✅ Credenciais WhatsApp nunca commitadas
- ✅ Variáveis de ambiente para secrets
- ✅ Sessões criptografadas

---

## 📚 Documentação

- 📖 [Estrutura do Projeto](./docs/PROJECT_STRUCTURE.md)
- 🔧 [Setup de Disco no Render](./docs/RENDER_DISK_SETUP.md)
- 📱 [Conexão WhatsApp](./docs/WHATSAPP_CONNECTION.md)
- 🤖 [Regras para IA](./docs/AI_RULES.md)

---

## 🧪 Scripts Disponíveis

```bash
npm run dev      # Desenvolvimento (frontend + backend)
npm run build    # Build produção
npm start        # Iniciar produção
npm run check    # Type checking
npm run db:push  # Atualizar schema do banco
```

---

## 🐛 Troubleshooting

### WhatsApp desconecta após deploy
**Solução**: Configurar disco persistente no Render  
📖 [docs/RENDER_DISK_SETUP.md](./docs/RENDER_DISK_SETUP.md)

### Erro de conexão com banco
**Verificar**: `DATABASE_URL` no `.env` está correto

### Erro ao escanear QR Code
**Solução**: Verificar logs do servidor para detalhes  
📖 [docs/WHATSAPP_CONNECTION.md](./docs/WHATSAPP_CONNECTION.md)

---

## 📄 Licença

MIT

---

## 🤝 Contribuindo

Contribuições são bem-vindas! Por favor:

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/MinhaFeature`)
3. Commit suas mudanças (`git commit -m 'feat: Adiciona MinhaFeature'`)
4. Push para a branch (`git push origin feature/MinhaFeature`)
5. Abra um Pull Request

---

## 📞 Suporte

Para dúvidas ou suporte, consulte a documentação em `docs/` ou abra uma issue no repositório.

---

**Feito com ❤️ para automação profissional de WhatsApp**
