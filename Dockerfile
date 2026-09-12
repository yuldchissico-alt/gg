FROM node:20-bullseye-slim

# Instalar apenas dependências básicas necessárias
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Configurar variáveis de ambiente
ENV NODE_ENV=production \
    PORT=10000

WORKDIR /app

# Copiar descritores de dependências
COPY package.json package-lock.json* ./

# Instalar TODAS as dependências (incluindo devDependencies para poder compilar)
RUN npm ci

# Copiar todo o código-fonte do projeto
COPY . .

# Compilar frontend (Vite) e servidor (esbuild)
RUN npm run build

# Remover devDependencies após o build para reduzir tamanho da imagem
RUN npm prune --production

# Criar diretório para persistência da sessão do WhatsApp (Baileys)
# (Este diretório deve ser montado como Disk no Render para persistir entre deploys)
RUN mkdir -p /app/auth_info/baileys

# Render utiliza a porta 10000 por padrao (e injeta a variavel PORT)
EXPOSE 10000

# Iniciar servidor em producao
CMD ["node", "dist/index.js"]
