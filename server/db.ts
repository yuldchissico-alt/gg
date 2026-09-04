import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

let pool: Pool | null = null;
let db: any = null;

function initializeDatabase() {
  if (db) return db;
  
  if (!process.env.DATABASE_URL && typeof (process as any).loadEnvFile === 'function') {
    try {
      (process as any).loadEnvFile();
    } catch {
      // ignore
    }
  }

  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.warn("DATABASE_URL is not set. Database operations will fail.");
    return null;
  }
  
  pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
    // Pool tuning para estabilidade no Render
    max: 5,                        // Máximo de conexões simultâneas (Neon free tem limite baixo)
    min: 1,                        // Mantém 1 conexão mínima sempre viva
    idleTimeoutMillis: 30_000,     // Fecha conexões ociosas após 30s (Neon fecha em ~5min)
    connectionTimeoutMillis: 10_000, // Timeout de 10s ao tentar conectar
    keepAlive: true,               // TCP keep-alive para evitar que o firewall corte conexões idle
    keepAliveInitialDelayMillis: 10_000,
  });

  // Log de erros do pool (conexões mortas, timeouts, etc.)
  pool.on('error', (err) => {
    console.error('❌ pg.Pool error (idle client):', err.message);
  });

  db = drizzle(pool, { schema });
  return db;
}

export { initializeDatabase };
export const getDb = () => {
  if (!db) {
    return initializeDatabase();
  }
  return db;
};
export const getPool = () => {
  if (!pool) {
    initializeDatabase();
  }
  return pool;
};
