#!/usr/bin/env node
// Instala o Chrome via puppeteer no ambiente Linux (Render, etc.)
// Executado automaticamente pelo postinstall do pnpm/npm.
import { execSync } from "child_process";
import { existsSync, readdirSync } from "fs";

if (process.platform !== "linux") {
  console.log("[install-chrome] ignorado (não é Linux)");
  process.exit(0);
}

const cacheDir =
  process.env.PUPPETEER_CACHE_DIR || "/opt/render/.cache/puppeteer";

console.log(`[install-chrome] PUPPETEER_CACHE_DIR = ${cacheDir}`);
console.log(`[install-chrome] HOME = ${process.env.HOME}`);
console.log(`[install-chrome] NODE_VERSION = ${process.version}`);

// Verifica se já existe algum executável chrome instalado
function findInstalledChrome(base) {
  const chromeBase = `${base}/chrome`;
  if (!existsSync(chromeBase)) return null;
  try {
    const versions = readdirSync(chromeBase).sort().reverse();
    for (const ver of versions) {
      for (const sub of ["chrome-linux64", "chrome-linux"]) {
        const p = `${chromeBase}/${ver}/${sub}/chrome`;
        if (existsSync(p)) return p;
      }
    }
  } catch { /* ignore */ }
  return null;
}

const existing = findInstalledChrome(cacheDir);
if (existing) {
  console.log(`[install-chrome] Chrome já instalado em ${existing} — skipping.`);
  process.exit(0);
}

// Também verificar o cache padrão do puppeteer (~/.cache/puppeteer)
const homeCache = `${process.env.HOME || "/root"}/.cache/puppeteer`;
const homeExisting = findInstalledChrome(homeCache);
if (homeExisting) {
  console.log(`[install-chrome] Chrome já instalado em ${homeExisting} — skipping.`);
  process.exit(0);
}

console.log(`[install-chrome] Instalando Chrome em ${cacheDir} ...`);
try {
  execSync("npx puppeteer browsers install chrome", {
    stdio: "inherit",
    timeout: 300_000, // 5 minutos
    env: {
      ...process.env,
      PUPPETEER_CACHE_DIR: cacheDir,
    },
  });

  const installed = findInstalledChrome(cacheDir);
  if (installed) {
    console.log(`[install-chrome] ✅ Chrome instalado com sucesso em: ${installed}`);
  } else {
    console.warn(`[install-chrome] ⚠️ Comando completou mas Chrome não encontrado em ${cacheDir}`);
  }
} catch (err) {
  console.warn("[install-chrome] ❌ Falha ao instalar Chrome:", err.message);
  // Não lança — não deve impedir o build de continuar
  process.exit(0);
}
