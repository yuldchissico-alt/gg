FROM node:20-bullseye-slim

# Instalar Chromium e todas as bibliotecas necessárias para o Puppeteer / WhatsApp Web.js rodar no Linux
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf \
    libnss3 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpangocairo-1.0-0 \
    libxss1 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Configurar variáveis de ambiente do Puppeteer e Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    WHATSAPP_CHROME_PATH=/usr/bin/chromium \
    WHATSAPP_HEADLESS=true \
    NODE_ENV=production \
    PORT=10000

WORKDIR /app

# Copiar descritores de dependências
COPY package*.json ./

# Instalar dependências para compilação
RUN npm install

# Copiar todo o código-fonte do projeto
COPY . .

# Construir frontend Vite e bundle do servidor Express
RUN npm run build

# Criar diretório para persistência da sessão do WhatsApp
RUN mkdir -p /app/auth_info/wwebjs

# Render utiliza a porta 10000 por padrão (e injeta a variável PORT)
EXPOSE 10000

# Comando de inicialização em produção
CMD ["node", "dist/index.js"]
