import 'dotenv/config';
import { initConfig } from './agent/config/index.js';
import { initDb } from './services/db.service.js';

async function start(): Promise<void> {
  await initConfig();
  await initDb();

  const { default: app } = await import('./app.js');

  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
