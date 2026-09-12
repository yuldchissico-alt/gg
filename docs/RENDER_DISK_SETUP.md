# 📦 Configuração de Disco Persistente no Render

## Por que é importante?

O Render **apaga todos os arquivos** quando você faz deploy de uma nova versão. Sem um disco persistente, a sessão do WhatsApp seria perdida a cada atualização, e você teria que escanear o QR Code novamente.

## ✅ Solução: Disco Persistente

Um disco persistente mantém os dados mesmo após deploys. O projeto já está configurado para salvar as sessões do Baileys em `/app/auth_info`.

---

## 🔧 Como Configurar no Render

### Opção 1: Criar Novo Disco (Primeira vez)

1. **Acesse seu serviço no Render Dashboard**
   - Vá para: https://dashboard.render.com
   - Selecione o serviço `pilotzap`

2. **Navegue até a aba "Disks"**
   - No menu lateral, clique em **"Disks"**

3. **Adicionar novo disco**
   - Clique em **"Add Disk"**
   - **Name**: `pilotzap-auth-data`
   - **Mount Path**: `/app/auth_info`
   - **Size**: `1 GB` (suficiente para sessões)
   - Clique em **"Save"**

4. **Reiniciar o serviço**
   - Após adicionar o disco, o Render vai pedir para reiniciar
   - Clique em **"Manual Deploy"** > **"Deploy latest commit"**

### Opção 2: Disco Já Existe (Atualizar nome)

Se você já tem um disco chamado `pilotzap-wwebjs-data`:

1. **Vá para a aba "Disks"**
2. **Edite o disco existente**
   - Clique no disco `pilotzap-wwebjs-data`
   - **NÃO mude o Mount Path** (deve continuar `/app/auth_info`)
   - Opcionalmente, renomeie para `pilotzap-auth-data` (cosmético)
3. **Salvar**

**IMPORTANTE**: O Mount Path **DEVE** ser `/app/auth_info` — é onde o código salva as sessões!

---

## 📁 Estrutura de Pastas no Disco

```
/app/auth_info/
├── baileys/
│   └── session-default-user/
│       ├── creds.json          ← Credenciais da sessão (MANTÉM LOGIN)
│       ├── app-state-sync-*.json
│       └── pre-keys-*.json
└── (outros arquivos temporários)
```

---

## 🧪 Como Testar

1. **Conectar o WhatsApp**
   - Acesse seu app no Render
   - Vá para a página de Conexão
   - Escaneie o QR Code

2. **Verificar conexão**
   - Deve mostrar "Conectado" com seu número

3. **Fazer um deploy de teste**
   ```bash
   git commit --allow-empty -m "Test: verificar persistência"
   git push
   ```

4. **Aguardar o deploy terminar** (~2-3 minutos)

5. **Verificar se mantém conectado**
   - Acesse a página de Conexão novamente
   - Deve mostrar **"Conectado"** sem precisar escanear QR Code novamente
   - Se pedir QR Code novamente = disco não está configurado corretamente

---

## ⚠️ Problemas Comuns

### Problema 1: Ainda desconecta após deploy
**Causa**: Mount Path incorreto ou disco não está anexado

**Solução**:
1. Verificar na aba "Disks" se o Mount Path é **exatamente** `/app/auth_info`
2. Verificar nos logs do deploy se aparece:
   ```
   🔄 [RECONEXÃO DB] Verificando sessão salva para default-user...
   🔄 [default-user] Sessão salva detectada — reconectando automaticamente...
   ```

### Problema 2: "Nenhum disco persistente detectado"
**Causa**: Disco não foi criado ou não está anexado ao serviço

**Solução**:
1. Criar o disco seguindo as instruções acima
2. Reiniciar o serviço após criar o disco

### Problema 3: Disco cheio
**Causa**: Disco de 1GB está cheio (raro, mas pode acontecer)

**Solução**:
1. Aumentar o tamanho do disco na aba "Disks"
2. OU limpar arquivos antigos (sessões corrompidas)

---

## 📊 Verificar Uso do Disco

No dashboard do Render:
- Vá para **"Disks"**
- Veja **"Usage"** do disco `pilotzap-auth-data`
- Deve mostrar alguns MB usados (sessões são pequenas)

---

## 🔐 Segurança

- ✅ O arquivo `creds.json` contém as credenciais da sessão do WhatsApp
- ✅ O disco é privado e apenas acessível pelo seu serviço
- ✅ Backups automáticos são feitos pelo Render (dependendo do plano)
- ⚠️ **NUNCA** commite arquivos de `auth_info/` no Git (já está no `.gitignore`)

---

## 🎯 Resultado Final

Com o disco persistente configurado corretamente:

✅ Você pode fazer **deploy quantas vezes quiser**  
✅ O WhatsApp **permanece conectado** após cada deploy  
✅ **Não precisa** escanear QR Code novamente  
✅ As **conversas continuam** de onde pararam  

---

## 📚 Documentação Oficial

- [Render Disks Documentation](https://render.com/docs/disks)
- [Baileys Multi-Device Documentation](https://github.com/WhiskeySockets/Baileys#multi-device)

