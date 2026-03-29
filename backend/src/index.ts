import 'dotenv/config';
import { loadCredentials } from './services/credstore.service.js';
import { initDb } from './services/db.service.js';

const CREDSTORE_NAMESPACE = 'finance-agent';

async function start(): Promise<void> {
  // Fetch API keys from BTP Credential Store before any module (config) is loaded.
  // Dynamic import of app is intentional — config/index.ts validates env vars at
  // module load time, so credentials must be in process.env first.
  await loadCredentials(CREDSTORE_NAMESPACE);

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
