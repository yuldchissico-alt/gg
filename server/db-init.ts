import { getDb } from "./db";
import { sql } from "drizzle-orm";

export async function initializeDatabase() {
  try {
    const db = getDb();
    if (!db) {
      console.warn('Database not initialized - DATABASE_URL not set');
      return;
    }
    console.log('Verifying database connection...');
    await db.execute(sql`SELECT 1`);
    console.log('Database connection verified successfully.');
  } catch (error) {
    console.error('Failed to connect to the database:', error);
  }
}
