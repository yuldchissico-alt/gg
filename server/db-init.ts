import { getDb } from "./db";
import { sql } from "drizzle-orm";

const MAX_DB_RETRIES = 5;
const DB_RETRY_DELAY_MS = 3_000;

async function waitForDatabase(): Promise<boolean> {
  for (let attempt = 1; attempt <= MAX_DB_RETRIES; attempt++) {
    try {
      const db = getDb();
      if (!db) return false;
      await db.execute(sql`SELECT 1`);
      console.log(`✅ Conexão com o banco de dados verificada (tentativa ${attempt})`);
      return true;
    } catch (err: any) {
      console.warn(`⚠️ DB não acessível (tentativa ${attempt}/${MAX_DB_RETRIES}): ${err?.message}`);
      if (attempt < MAX_DB_RETRIES) {
        await new Promise(r => setTimeout(r, DB_RETRY_DELAY_MS));
      }
    }
  }
  return false;
}

export async function initializeDatabase() {
  try {
    const db = getDb();
    if (!db) {
      console.warn('Database not initialized - DATABASE_URL not set');
      return;
    }
    console.log('Verificando conexão com o banco de dados Neon PostgreSQL...');

    const connected = await waitForDatabase();
    if (!connected) {
      console.error('❌ Não foi possível conectar ao banco de dados após múltiplas tentativas.');
      return;
    }

    console.log('🚀 Criando tabelas se não existirem...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_settings (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        timezone VARCHAR DEFAULT 'America/Sao_Paulo',
        notifications_enabled BOOLEAN DEFAULT true,
        auto_reply_enabled BOOLEAN DEFAULT false,
        auto_reply_message TEXT,
        business_hours_start VARCHAR DEFAULT '08:00',
        business_hours_end VARCHAR DEFAULT '18:00',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        action VARCHAR NOT NULL,
        resource_type VARCHAR,
        resource_id VARCHAR,
        details JSONB,
        ip_address VARCHAR,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR DEFAULT 'info',
        is_read BOOLEAN DEFAULT false,
        action_url VARCHAR,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS conversation_messages (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        contact_id VARCHAR NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
        direction VARCHAR NOT NULL,
        type message_type NOT NULL,
        content TEXT NOT NULL,
        media_url VARCHAR,
        external_id VARCHAR,
        status VARCHAR DEFAULT 'received',
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS tags (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR NOT NULL,
        color VARCHAR DEFAULT '#000000',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS contact_tags (
        contact_id VARCHAR NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
        tag_id VARCHAR NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (contact_id, tag_id)
      );

      ALTER TABLE users ADD COLUMN IF NOT EXISTS password VARCHAR;
      ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS company_name VARCHAR DEFAULT 'Pilot Zap';
      ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS company_email VARCHAR DEFAULT 'contato@pilotzap.com';
      ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS language VARCHAR DEFAULT 'pt-BR';
    `);

    // Criar / Atualizar usuário yuldchissico11@gmail.com
    await db.execute(sql`
      INSERT INTO users (id, email, password, first_name, last_name, plan_type)
      VALUES ('default-user', 'yuldchissico11@gmail.com', 'yuld0000', 'Yuld', 'Chissico', 'pro')
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        password = EXCLUDED.password,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        plan_type = 'pro';

      INSERT INTO user_settings (user_id, company_name, company_email, language, timezone)
      VALUES ('default-user', 'Pilot Zap', 'contato@pilotzap.com', 'pt-BR', 'Africa/Maputo')
      ON CONFLICT (user_id) DO NOTHING;
    `);

    console.log('✅ Usuário yuldchissico11@gmail.com criado/atualizado com sucesso no banco de dados!');
    console.log('✅ Configurações e tabelas do banco de dados foram sincronizadas no Neon com sucesso!');
  } catch (error) {
    console.error('Falha ao conectar ou sincronizar tabelas no banco de dados:', error);
  }
}



