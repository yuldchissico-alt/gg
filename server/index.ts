if (!process.env.DATABASE_URL && typeof (process as any).loadEnvFile === 'function') {
  try {
    (process as any).loadEnvFile();
  } catch {
    // ignore
  }
}

// ── Proteção global: evita que erros não capturados derrubem o processo ──────
// Erros do Chromium/WhatsApp não devem causar "Exited with status 1"
process.on("uncaughtException", (err) => {
  console.error("❌ [uncaughtException] Erro não capturado (processo continua):", err?.message || err);
});

process.on("unhandledRejection", (reason) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  console.error("❌ [unhandledRejection] Promise rejeitada não tratada (processo continua):", msg);
});

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initializeDatabase } from "./db-init";

const app = express();
app.set("etag", false);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    await initializeDatabase();
  } catch (err: any) {
    console.error("❌ Falha ao inicializar banco de dados (servidor continua):", err?.message || err);
  }

  let server: any;
  try {
    server = await registerRoutes(app);
  } catch (err: any) {
    console.error("❌ Falha ao registar rotas:", err?.message || err);
    process.exit(1);
  }

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    // Não relançar o erro — evita uncaughtException em prod
    console.error(`[Express error handler] ${status} — ${message}`);
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: process.platform !== 'win32',
  }, () => {
    log(`serving on http://localhost:${port}`);
    // Inicializar WhatsApp em background sem bloquear o startup do servidor
    import("./services/whatsappService").then(({ whatsappService }) => {
      whatsappService.getConnectionStatus("default-user").then(async (status) => {
        if (status.connected) {
          log("✅ WhatsApp já conectado (sessão salva)");
        } else {
          // Tenta inicializar o cliente em background para acelerar a primeira conexão
          // (não aguarda — não bloqueia o servidor)
          whatsappService.getQRCode("default-user").catch(() => {
            // Silencioso — pode falhar se não houver sessão, é esperado
          });
        }
      }).catch(console.error);
    });
  });

  // ── Graceful shutdown: fecha DB pool e Chromium antes de sair ─────────────
  const shutdown = async (signal: string) => {
    log(`🛑 ${signal} recebido — encerrando graciosamente...`);

    server.close(async () => {
      try {
        const { whatsappService } = await import("./services/whatsappService");
        await whatsappService.destroy();
      } catch { /* ignore */ }

      try {
        const { getPool } = await import("./db");
        const pool = getPool();
        if (pool) await pool.end();
        log("✅ Pool do banco de dados encerrado.");
      } catch { /* ignore */ }

      process.exit(0);
    });

    // Forçar saída se demorar mais de 15s
    setTimeout(() => {
      log("⚠️ Graceful shutdown excedeu 15s — forçando saída.");
      process.exit(1);
    }, 15_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT",  () => shutdown("SIGINT"));
})().catch((err) => {
  console.error("❌ Falha fatal no startup:", err?.message || err);
  process.exit(1);
});
