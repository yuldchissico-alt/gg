import type { VercelRequest, VercelResponse } from "@vercel/node";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { registerRoutes } from "../server/routes";
import { initializeDatabase } from "../server/db-init";

let appPromise: Promise<Express> | undefined;

async function getApp(): Promise<Express> {
  if (appPromise) return appPromise;

  appPromise = (async () => {
    const app = express();
    app.set("etag", false);

    app.use(express.json({ limit: "50mb" }));
    app.use(express.urlencoded({ limit: "50mb", extended: false }));

    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith("/api")) {
        res.setHeader("Cache-Control", "no-store");
      }
      next();
    });

    // Minimal API logging for Vercel
    app.use((req: Request, res: Response, next: NextFunction) => {
      const startedAt = Date.now();
      res.on("finish", () => {
        if (req.path.startsWith("/api")) {
          const duration = Date.now() - startedAt;
          console.log(`${req.method} ${req.path} ${res.statusCode} in ${duration}ms`);
        }
      });
      next();
    });

    await initializeDatabase();
    await registerRoutes(app);

    // Ensure we always return JSON for errors
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err?.status || err?.statusCode || 500;
      const message = err?.message || "Internal Server Error";
      res.status(status).json({ message });
    });

    return app;
  })();

  return appPromise;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const app = await getApp();
  return app(req as any, res as any);
}
