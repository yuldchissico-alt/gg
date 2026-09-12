# 📚 Documentação PilotZap

Bem-vindo à documentação do PilotZap! Aqui você encontra todos os guias e referências técnicas do projeto.

---

## 📖 Documentos Disponíveis

### 🏗️ [Estrutura do Projeto](./PROJECT_STRUCTURE.md)
Entenda a organização completa do código, pastas e convenções utilizadas.

**Leia se você quer:**
- Conhecer a arquitetura do projeto
- Saber onde cada tipo de código fica
- Entender o fluxo de build
- Conhecer as tecnologias utilizadas

---

### 🔧 [Setup de Disco no Render](./RENDER_DISK_SETUP.md)
Guia passo a passo para configurar disco persistente no Render e manter o WhatsApp conectado após deploys.

**Leia se você precisa:**
- Fazer deploy no Render
- Evitar desconexão do WhatsApp após atualização
- Configurar persistência de dados
- Resolver problemas de sessão

---

### 📱 [Conexão WhatsApp](./WHATSAPP_CONNECTION.md)
Documentação sobre como conectar e gerenciar a conexão WhatsApp usando Baileys.

**Leia se você quer:**
- Entender como funciona a conexão WhatsApp
- Resolver problemas de conexão
- Conhecer requisitos e limitações
- Deploy em diferentes ambientes

---

### 🤖 [Regras para IA](./AI_RULES.md)
Diretrizes e contexto para assistentes de IA trabalharem no projeto.

**Leia se você:**
- Está usando assistentes de IA (Cursor, GitHub Copilot, etc.)
- Quer manter consistência no código gerado
- Precisa de contexto sobre padrões do projeto

---

### 🔧 [Troubleshooting](./TROUBLESHOOTING.md)
Guia de solução de problemas comuns do PilotZap.

**Leia se você tem:**
- Mensagens que não são enviadas no funil
- Problemas de conexão com banco de dados
- Erros 500 na API
- Analytics mostrando dados incorretos
- Qualquer outro problema técnico

---

## 🚀 Início Rápido

### Primeira vez no projeto?

1. 📖 Leia o [README principal](../README.md)
2. 🏗️ Entenda a [Estrutura do Projeto](./PROJECT_STRUCTURE.md)
3. 🔧 Configure o [ambiente local](../README.md#-início-rápido)

### Vai fazer deploy?

1. ☁️ Siga o [guia de deploy no Render](./RENDER_DISK_SETUP.md)
2. 📱 Configure a [conexão WhatsApp](./WHATSAPP_CONNECTION.md)
3. ✅ Teste tudo antes de usar em produção

---

## 📂 Estrutura de Pastas (Resumo)

```
pilotzap/
├── 📚 docs/              # Você está aqui!
│   ├── README.md         # Este arquivo
│   ├── PROJECT_STRUCTURE.md
│   ├── RENDER_DISK_SETUP.md
│   ├── WHATSAPP_CONNECTION.md
│   ├── TROUBLESHOOTING.md  # Novo!
│   └── AI_RULES.md
│
├── 🎨 client/            # Frontend (React)
├── 🔧 server/            # Backend (Express)
├── 🔄 shared/            # Código compartilhado
├── 🚀 .deploy/           # Arquivos de deploy
└── 📦 public/            # Assets públicos
```

---

## 🆘 Precisa de Ajuda?

### Problemas Comuns

| Problema | Solução |
|----------|---------|
| WhatsApp desconecta | [Setup de Disco no Render](./RENDER_DISK_SETUP.md) |
| Mensagens não enviadas | [Troubleshooting](./TROUBLESHOOTING.md) |
| Erro de build | Verifique `package.json` e dependências |
| Banco de dados | [Troubleshooting](./TROUBLESHOOTING.md) |
| QR Code não aparece | [Conexão WhatsApp](./WHATSAPP_CONNECTION.md) |

### Onde Procurar

1. **Documentação local** (esta pasta)
2. **README principal** ([../README.md](../README.md))
3. **Código comentado** no projeto
4. **Issues** no repositório

---

## 🤝 Contribuindo

Ao contribuir com documentação:

1. ✅ Mantenha linguagem clara e objetiva
2. ✅ Use emojis para facilitar navegação
3. ✅ Inclua exemplos práticos
4. ✅ Atualize este índice se adicionar novos docs
5. ✅ Use Markdown formatado corretamente

---

## 📝 Manutenção da Documentação

### Quando atualizar?

- ✏️ Mudanças na estrutura do projeto → [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md)
- ✏️ Novos passos de deploy → [RENDER_DISK_SETUP.md](./RENDER_DISK_SETUP.md)
- ✏️ Mudanças na conexão WhatsApp → [WHATSAPP_CONNECTION.md](./WHATSAPP_CONNECTION.md)
- ✏️ Novas funcionalidades → [README.md](../README.md)

### Checklist de Revisão

- [ ] Links funcionando
- [ ] Exemplos testados
- [ ] Screenshots atualizados (se aplicável)
- [ ] Sem informações sensíveis (tokens, senhas)
- [ ] Linguagem clara e acessível

---

**Última atualização**: Setembro 2026

