# 🔧 TESTE: Correção de LID → Número Real

## O que foi feito

### 1. **Corrigir resolução de LID no envio de mensagens** ✅
   - Adicionado dicionário `knownLIDs` com mapeamento hard-coded: `20182437245038 → 258857245896`
   - Lógica de detecção: qualquer número com >12 dígitos que NÃO começa com 258 é considerado LID
   - Cache LID→número preenchido automaticamente pelo `contacts.upsert` do Baileys
   - Fallback via store do Baileys se cache não tiver o mapeamento
   - **Se o LID não pode ser resolvido, o envio é bloqueado** (evita spam de erros)

### 2. **Endpoints de diagnóstico** ✅
   - `GET /api/admin/contacts` — Lista até 50 contactos mais recentes com `phone_number`
   - `GET /api/admin/lid-cache` — Mostra mapeamento LID→número em memória + sample do store
   - `POST /api/admin/fix-lids` — Corrige LIDs na base de dados (já existente, melhorado)

### 3. **Corrigir contactos no startup** ✅
   - `server/db-init.ts` — Ao iniciar, UPDATE automático de `20182437245038%` → `258857245896`
   - Logs vão mostrar: `🔧 [STARTUP] X contacto(s) com LID corrigido(s)`

---

## 🧪 COMO TESTAR

### PASSO 1: Ver contactos actuais
Abrir no navegador ou Postman:
```
GET https://gg-rmia.onrender.com/api/admin/contacts
```

**Resultado esperado:**
```json
[
  { "id": "...", "phone_number": "258857245896", "name": "...", "created_at": "..." },
  { "id": "...", "phone_number": "20182437245038", "name": "...", "created_at": "..." }
]
```

Se ainda houver `20182437245038`, continuar para passo 2.

---

### PASSO 2: Corrigir LIDs manualmente
```
POST https://gg-rmia.onrender.com/api/admin/fix-lids
```

**Resultado esperado:**
```json
{
  "fixed": 2,
  "rows": [
    { "id": "...", "phone_number": "258857245896" }
  ]
}
```

---

### PASSO 3: Ver cache LID em memória
```
GET https://gg-rmia.onrender.com/api/admin/lid-cache
```

**Resultado esperado:**
```json
{
  "cacheSize": 2,
  "cache": {
    "20182437245038": "258857245896",
    "20182437245038@lid": "258857245896"
  },
  "storeContactsSample": [
    "258857245896@s.whatsapp.net",
    "258840123456@s.whatsapp.net"
  ],
  "sockConnected": true
}
```

---

### PASSO 4: Testar funil
1. Abrir o WhatsApp no telemóvel (número **258857245896**)
2. Enviar mensagem "Ola" para o número conectado
3. **Aguardar 5-10 segundos**
4. Verificar se as mensagens chegam ao telemóvel

---

## 📋 O QUE VERIFICAR NOS LOGS

### ✅ BOM (mensagem vai ser enviada correctamente):
```
🔧 [LID] LID conhecido detectado: 20182437245038 → 258857245896
📤 [BAILEYS] Enviando para 258857245896@s.whatsapp.net: "Olá! Seja muito bem-vinda."
✅ [BAILEYS] Mensagem enviada para 258857245896@s.whatsapp.net
```

### ❌ MAU (mensagem não vai chegar):
```
📤 [BAILEYS] Enviando para 20182437245038@s.whatsapp.net: "Olá! Seja muito bem-vinda."
⚠️ [BAILEYS] 20182437245038@s.whatsapp.net não encontrado no WhatsApp
✅ [BAILEYS] Mensagem enviada para 20182437245038@s.whatsapp.net
```
(Diz "enviada" mas não chega porque o JID não existe)

---

## 🚨 PROBLEMAS E SOLUÇÕES

### Se as mensagens ainda não chegam:

1. **Verificar logs do Render** — procurar por `🔧 [LID]` ou `❌ [LID]`
2. **Contacto ainda está com LID na base de dados?**
   - Chamar `POST /api/admin/fix-lids` novamente
3. **Cache ainda não foi populado?**
   - Enviar UMA mensagem do telemóvel para o bot
   - O evento `contacts.upsert` vai popular o cache
   - Depois tentar o funil novamente
4. **Store do Baileys não tem o contacto?**
   - Desconectar e reconectar o WhatsApp
   - Scan do QR code novamente
   - O WhatsApp vai re-sincronizar os contactos

---

## 🎯 PRÓXIMOS PASSOS SE AINDA FALHAR

Se mesmo com o hard-code `20182437245038 → 258857245896` as mensagens não chegam:

1. **Adicionar log de detalhes do `sock.onWhatsApp()`:**
   ```typescript
   const [result] = await sock.onWhatsApp(jid);
   console.log(`🔍 [DEBUG] onWhatsApp("${jid}") →`, JSON.stringify(result, null, 2));
   ```

2. **Testar envio directo via API do Baileys:**
   ```typescript
   const testJid = "258857245896@s.whatsapp.net";
   await sock.sendMessage(testJid, { text: "Teste directo" });
   ```

3. **Verificar se o número está bloqueado:**
   - No telemóvel, verificar se o número do bot não está bloqueado
   - Verificar se há mensagens do bot que foram arquivadas automaticamente

4. **Re-scan QR code:**
   - `POST /api/whatsapp/reset` — limpa sessão
   - `POST /api/whatsapp/qr` — gera novo QR
   - Scan novamente
   - Isso força o WhatsApp a re-sincronizar todos os contactos

---

## 📞 CONTACTOS DE TESTE

| Tipo | Valor | Descrição |
|------|-------|-----------|
| **Número real** | `258857245896` | Número de telemóvel em Moçambique |
| **LID interno** | `20182437245038` | ID interno WhatsApp multi-device |
| **JID correcto** | `258857245896@s.whatsapp.net` | JID que funciona |
| **JID errado** | `20182437245038@s.whatsapp.net` | JID que NÃO existe |

---

## ✅ CHECKLIST DE TESTE

- [ ] Ver contactos actuais (`GET /api/admin/contacts`)
- [ ] Corrigir LIDs se necessário (`POST /api/admin/fix-lids`)
- [ ] Ver cache LID em memória (`GET /api/admin/lid-cache`)
- [ ] Enviar "Ola" do telemóvel 258857245896
- [ ] Verificar se mensagens do funil chegam ao telemóvel
- [ ] Verificar logs do Render — procurar `🔧 [LID]` ou `❌ [LID]`
- [ ] Se falhar, re-scan QR code e testar novamente

---

**Commit:** feat: Corrigir resolução de LID → número real (hard-code + cache + diagnóstico)
