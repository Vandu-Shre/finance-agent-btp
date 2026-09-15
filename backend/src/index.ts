import 'dotenv/config';
import { logger } from './lib/logger.js';
import { initConfig } from './agent/config/index.js';
import { initDb } from './services/db.service.js';

async function start(): Promise<void> {
  await initConfig();
  await initDb();

  const { default: app } = await import('./app.js');

  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    logger.info('Server started', { port: PORT });
  });
}

start().catch((err) => {
  logger.error('Failed to start server', { error: (err as Error).message, stack: (err as Error).stack });
  process.exit(1);
});
