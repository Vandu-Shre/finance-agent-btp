import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

function buildDatabaseUrl(): string {
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.VCAP_SERVICES) {
      throw new Error('VCAP_SERVICES is not set in production environment');
    }
    const vcap = JSON.parse(process.env.VCAP_SERVICES);
    const creds =
      vcap['postgresql-db']?.[0]?.credentials ||
      vcap['postgresql']?.[0]?.credentials;
    if (!creds) {
      throw new Error('No PostgreSQL credentials found in VCAP_SERVICES');
    }
    const { hostname, port, dbname, username, password, sslrootcert } = creds;

    let sslParams = 'sslmode=require';
    if (sslrootcert) {
      const certPath = join(tmpdir(), 'db-ca.pem');
      writeFileSync(certPath, sslrootcert);
      sslParams = `sslmode=verify-ca&sslrootcert=${certPath}`;
    }

    return `postgresql://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${hostname}:${port}/${dbname}?${sslParams}`;
  }

  // Local dev defaults to SQLite
  return process.env.DATABASE_URL ?? 'file:./dev.db';
}

// Ensure DATABASE_URL is set before PrismaClient reads it
process.env.DATABASE_URL = buildDatabaseUrl();

export const prisma = new PrismaClient();

export async function initDb(): Promise<void> {
  try {
    await prisma.$connect();
    console.log('✅ Database ready');
  } catch (error) {
    console.error('❌ Failed to connect to database:', error);
    throw error;
  }
}
