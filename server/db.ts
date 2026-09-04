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
    ssl: { rejectUnauthorized: false }
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
