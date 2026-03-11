import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

let pool: Pool | null = null;
let db: any = null;

function initializeDatabase() {
  if (db) return db;
  
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.warn("DATABASE_URL is not set. Database operations will fail.");
    return null;
  }
  
  pool = new Pool({ connectionString: databaseUrl });
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
