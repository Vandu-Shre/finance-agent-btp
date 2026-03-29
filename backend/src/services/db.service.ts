import pg from 'pg';

const { Pool } = pg;

let pool: pg.Pool | null = null;

function getConnectionConfig(): pg.PoolConfig {
  // BTP binding via VCAP_SERVICES takes precedence
  if (process.env.VCAP_SERVICES) {
    try {
      const vcap = JSON.parse(process.env.VCAP_SERVICES);
      const creds =
        vcap['postgresql-db']?.[0]?.credentials ||
        vcap['postgresql']?.[0]?.credentials;
      if (creds) {
        return {
          host: creds.hostname,
          port: Number(creds.port),
          database: creds.dbname,
          user: creds.username,
          password: creds.password,
          ssl: { rejectUnauthorized: false },
          max: 5,
        };
      }
    } catch {
      // fall through to DATABASE_URL
    }
  }

  // Local dev: DATABASE_URL or individual PG* vars
  return {
    connectionString:
      process.env.DATABASE_URL || 'postgresql://localhost:5432/finance_agent',
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    max: 5,
  };
}

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool(getConnectionConfig());
    pool.on('error', (err) => {
      console.error('PostgreSQL pool error:', err.message);
    });
  }
  return pool;
}

/**
 * Create tables if they do not already exist.
 * Called once at server startup.
 */
export async function initDb(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id          VARCHAR(255) PRIMARY KEY,
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS messages (
        id          VARCHAR(255) PRIMARY KEY,
        session_id  VARCHAR(255) NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        text        TEXT         NOT NULL,
        sender      VARCHAR(50)  NOT NULL,
        timestamp   TIMESTAMPTZ  NOT NULL,
        metadata    JSONB
      );

      CREATE TABLE IF NOT EXISTS files (
        id           VARCHAR(255) PRIMARY KEY,
        session_id   VARCHAR(255) NOT NULL,
        file_name    VARCHAR(255) NOT NULL,
        stored_name  VARCHAR(255) NOT NULL UNIQUE,
        mime_type    VARCHAR(100),
        size_bytes   INTEGER,
        upload_date  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );
    `);
    console.log('✅ Database schema ready');
  } catch (error) {
    console.error('❌ Failed to initialize database schema:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Execute a query and return rows.
 */
export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
  const result = await getPool().query(sql, params);
  return result.rows as T[];
}

/**
 * Fire-and-forget write — logs errors but never throws.
 */
export function persist(sql: string, params: any[]): void {
  query(sql, params).catch((err: Error) =>
    console.error('DB persist failed:', err.message)
  );
}
