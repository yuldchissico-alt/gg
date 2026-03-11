# Deploy na Vercel

## O que foi adaptado

- Frontend (Vite) sai em `dist/public`.
- Backend vira uma Function da Vercel em `api/[...path].ts` e expÃµe os endpoints em `/api/*`.
- Scheduler (cron/background) Ã© **desativado** automaticamente quando `VERCEL=1`.

## Como configurar na Vercel

- **Framework preset:** Other
- **Build Command:** `npm run vercel-build`
- **Output Directory:** `dist/public`

## VariÃ¡veis de ambiente

- `DATABASE_URL` (obrigatÃ³ria para features com banco)

## LimitaÃ§Ãµes importantes

- **WhatsApp via `whatsapp-web.js` nÃ£o Ã© recomendado na Vercel.**
  - A Vercel Ã© serverless (sem processo persistente) e executar Chrome/Puppeteer costuma falhar ou ser instÃ¡vel.
  - Para produÃ§Ã£o, use **WhatsApp Business Cloud API** ou rode o conector do WhatsApp em um serviÃ§o separado (VM/VPS/worker) e integre via webhooks/API.
- **Agendamentos/cron** nÃ£o rodam em serverless.
  - O sistema de scheduler foi desativado em `VERCEL=1`.

