# 🔧 Troubleshooting - PilotZap

## Problemas Comuns e Soluções

### 🐛 Mensagens ficam "Aguardando pela mensagem... isto pode demorar um pouco"

#### Sintoma
- Algumas mensagens do funil não são enviadas
- Execução do funil fica presa
- Logs mostram processamento do nó mas sem próxima mensagem

#### Causa
A lógica de processamento de nós tinha uma condição invertida que impedia mensagens de serem processadas corretamente quando havia múltiplos nós sequenciais.

**Código problemático** (ANTES):
```typescript
// Lógica confusa - só processava próximo nó se NÃO fosse mensagem
if (currentNodeType !== 'message' || !flowData.edges.some(e => e.source === currentNode.id)) {
  setImmediate(() => this.processNextNode(executionId));
} else {
  setTimeout(() => this.processNextNode(executionId), humanDelay);
}
```

#### Solução ✅
**Código corrigido** (AGORA):
```typescript
// Sempre processa o próximo nó com delay humano (se houver)
const nextEdge = flowData.edges.find(e => e.source === currentNode.id);
if (nextEdge) {
  const humanDelay = 500 + Math.random() * 1000; // 0.5-1.5 segundos
  console.log(`⏭️ [FUNNEL] Agendando próximo nó em ${Math.round(humanDelay)}ms`);
  setTimeout(() => this.processNextNode(executionId), humanDelay);
} else {
  console.log(`🏁 [FUNNEL] Fim do funil alcançado`);
  // Marca como completo
}
```

#### Como verificar se está funcionando
1. **Verificar logs do Render** ou servidor local
2. Procurar por estas mensagens em ordem:
   ```
   📍 [FUNNEL] Nó processado: node-123 (message)
   ✅ [FUNNEL] Mensagem enviada com sucesso para 258...
   ⏭️ [FUNNEL] Agendando próximo nó em 850ms
   ➡️ [FUNNEL] Movendo do nó node-123 para node-456
   ```

3. Se ver apenas:
   ```
   📍 [FUNNEL] Nó processado: node-123 (message)
   ✅ [FUNNEL] Mensagem enviada com sucesso
   (sem próxima linha de agendamento)
   ```
   **Significa que o problema ainda existe!**

---

### 📱 WhatsApp desconecta após deploy

Ver: [RENDER_DISK_SETUP.md](./RENDER_DISK_SETUP.md)

---

### 🔄 Funil não inicia automaticamente

#### Sintoma
- Mensagem de gatilho é enviada
- Nada acontece no funil

#### Possíveis causas:

1. **Funil não está ativo**
   - **Solução**: Verificar status do funil no banco de dados
   - `SELECT * FROM funnels WHERE is_active = true`

2. **Frase gatilho não corresponde**
   - **Solução**: Verificar exatamente o trigger configurado
   - É case-sensitive? Espaços importam?

3. **Contacto não existe**
   - **Solução**: Ver logs para confirmar criação de contacto
   - Procurar por: `✅ Contacto criado/encontrado`

---

### ⏰ Delays não funcionam corretamente

#### Sintoma
- Nós de delay são ignorados
- Mensagens enviadas imediatamente

#### Verificação
Procurar nos logs:
```
⏰ [FUNNEL] Aguardando X minuto(s) antes de enviar a próxima mensagem
```

#### Possíveis problemas:

1. **SchedulerService não está rodando**
   - **Verificar**: `console.log` na inicialização
   - **Solução**: Garantir que `VERCEL=1` não está setado em produção no Render

2. **Tipo de nó incorreto**
   - **Verificar**: `nodeType` do nó no flowData
   - **Deve ser**: `"delay"`

3. **DelayValue inválido**
   - **Verificar**: `delayValue` e `delayUnit` no nó
   - **Solução**: Garantir valores válidos (número > 0)

---

### 📊 Analytics mostra dados incorretos

#### Sintoma
- Contagem de mensagens errada
- Funis ativos não aparecem

#### Solução
1. **Verificar queries no backend**
   - Ver `server/storage.ts` → `getAnalytics()`

2. **Verificar schema do banco**
   - Tabelas: `messages`, `funnel_executions`, `contacts`

3. **Forçar refresh**
   - React Query faz cache de 5 minutos
   - Recarregar página ou invalidar cache

---

### 🔌 Erro de conexão com banco de dados

#### Sintoma
```
Error: connect ECONNREFUSED
```

#### Solução
1. **Verificar `DATABASE_URL`** no `.env`
   - Formato correto: `postgresql://user:pass@host:5432/dbname`

2. **Verificar se PostgreSQL está rodando**
   ```bash
   # Local
   pg_isready
   
   # Render
   # Verificar no dashboard se o banco está "Available"
   ```

3. **Verificar limites de conexão**
   - PostgreSQL tem limite de conexões
   - Render Free Tier: 97 conexões

---

### 🚨 Erro 500 na API

#### Como investigar

1. **Ver logs completos** do Render
   - Dashboard → Logs → Ver últimas 100 linhas

2. **Procurar por stack trace**
   ```
   Error: <mensagem>
       at <arquivo>:<linha>
   ```

3. **Logs estruturados** ajudam:
   - `[BAILEYS]` - Problema com WhatsApp
   - `[FUNNEL]` - Problema com funis
   - `[DB]` - Problema com banco

---

### 💾 Disco persistente cheio

#### Sintoma
```
Error: ENOSPC: no space left on device
```

#### Solução
1. **Verificar uso** no Render Dashboard
   - Disks → Ver usage

2. **Limpar sessões antigas** (se necessário)
   ```bash
   # SSH no container (se disponível)
   du -sh /app/auth_info/baileys/*
   ```

3. **Aumentar tamanho** do disco
   - Dashboard → Disks → Edit → Aumentar GB

---

## 🔍 Logs Úteis

### Logs de Sucesso

```
✅ [BAILEYS] Mensagem enviada para 258...
✅ [FUNNEL] Mensagem enviada com sucesso
⏭️ [FUNNEL] Agendando próximo nó em 850ms
🏁 [FUNNEL] Fim do funil alcançado
```

### Logs de Problema

```
❌ [BAILEYS] Não conectado - impossível enviar
❌ [FUNNEL] Falha no envio para 258...
⚠️ [BAILEYS] 258... não encontrado no WhatsApp
```

---

## 📞 Como Reportar Bugs

Ao reportar um problema, inclua:

1. **Descrição clara** do que aconteceu
2. **Passos para reproduzir**
3. **Logs relevantes** (últimas 50-100 linhas)
4. **Ambiente**: Local, Render, Docker?
5. **Dados sensíveis REMOVIDOS** (números, tokens, etc.)

### Exemplo de Report

```
**Problema**: Mensagens não são enviadas no funil

**Passos**:
1. Criar funil com 3 nós de mensagem
2. Ativar funil
3. Enviar mensagem de gatilho
4. Apenas primeira mensagem é enviada

**Logs**:
```
📍 [FUNNEL] Nó processado: node-1 (message)
✅ [FUNNEL] Mensagem enviada com sucesso
(sem próximas linhas)
```

**Ambiente**: Render (produção)
**Versão**: [commit hash]
```

---

## 🛠️ Ferramentas de Debug

### 1. Logs em Tempo Real
```bash
# Render
render logs --tail

# Local
npm run dev
```

### 2. Verificar Estado do Banco
```sql
-- Ver execuções ativas
SELECT * FROM funnel_executions WHERE status = 'active';

-- Ver últimas mensagens
SELECT * FROM messages ORDER BY sent_at DESC LIMIT 10;

-- Ver funis ativos
SELECT * FROM funnels WHERE is_active = true;
```

### 3. Health Check
```bash
curl https://seu-app.onrender.com/api/health
```

---

**Última atualização**: Setembro 2026

