# Conexão WhatsApp - Guia (whatsapp-web.js)

## Requisitos

- O projeto usa `whatsapp-web.js` (WhatsApp Web via navegador/Puppeteer).
- Você precisa ter **Chrome/Chromium** disponível na máquina onde o servidor roda.

## Observação sobre Cloud (Replit/VPS/Datacenter)

Dependendo do IP/ambiente, o WhatsApp pode limitar/bloquear automações. Para desenvolvimento, o caminho mais estável é rodar **localmente** (IP residencial).

## Como rodar localmente

```bash
npm install
npm run dev
```

Abra `http://localhost:5000`, gere o QR Code e escaneie no WhatsApp (Aparelhos conectados).

## Variáveis de ambiente (whatsapp-web.js)

- `WHATSAPP_HEADLESS` (default: `true`): use `false` para abrir o Chrome visível (bom para debug).
- `WHATSAPP_CHROME_PATH` (opcional): caminho do executável do Chrome/Chromium se o Puppeteer não encontrar um.

## Sessões

As sessões ficam em `auth_info/wwebjs/session-<userId>`. Para “deslogar”, use o endpoint de disconnect no app ou apague essa pasta.
