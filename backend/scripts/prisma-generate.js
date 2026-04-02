/**
 * Runs the correct prisma generate based on NODE_ENV.
 * Used as a postinstall hook so CF buildpack staging (NODE_ENV=production)
 * generates the PostgreSQL client instead of the default SQLite one.
 */
import { execSync } from 'child_process';

if (process.env.NODE_ENV === 'production') {
  execSync(
    'node scripts/prisma-compose.js prod && prisma generate --schema=prisma/schema.prod.prisma',
    { stdio: 'inherit', shell: true }
  );
}
