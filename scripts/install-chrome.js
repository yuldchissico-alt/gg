#!/usr/bin/env node
// Instala o Chrome via puppeteer no ambiente Linux (Render, etc.)
// Executado automaticamente pelo postinstall do pnpm/npm.
import { execSync } from "child_process";
import { existsSync } from "fs";

if (process.platform !== "linux") {
  console.log("install-chrome: ignorado (não é Linux)");
  process.exit(0);
}

const cacheDir =
  process.env.PUPPETEER_CACHE_DIR || "/opt/render/.cache/puppeteer";

// Verifica se já existe algum executável chrome instalado para evitar
// reinstalar a cada deploy (economiza ~2 minutos de build)
const chromeBase = `${cacheDir}/chrome`;
if (existsSync(chromeBase)) {
  try {
    const { readdirSync } = await import("fs");
    const versions = readdirSync(chromeBase);
    for (const ver of versions) {
      const p = `${chromeBase}/${ver}/chrome-linux64/chrome`;
      if (existsSync(p)) {
        console.log(`install-chrome: Chrome já instalado em ${p} — skipping.`);
        process.exit(0);
      }
    }
  } catch {
    // ignora erro de leitura — tenta instalar mesmo assim
  }
}

console.log(`install-chrome: instalando Chrome em ${cacheDir} ...`);
try {
  execSync("npx puppeteer browsers install chrome", {
    stdio: "inherit",
    env: {
      ...process.env,
      PUPPETEER_CACHE_DIR: cacheDir,
    },
  });
  console.log("install-chrome: Chrome instalado com sucesso.");
} catch (err) {
  console.warn("install-chrome: falha ao instalar Chrome:", err.message);
  // Não lança — não deve impedir o build de continuar
}
