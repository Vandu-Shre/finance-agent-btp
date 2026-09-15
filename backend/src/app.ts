import express from 'express';
import expressWs from 'express-ws';
import expressWinston from 'express-winston';
import swaggerUi from 'swagger-ui-express';
import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fileRoutes from './routes/file.routes.js';
import chatRoutes from './routes/chat.routes.js';
import { xsuaaAuth, requireAppAccess } from './middleware/auth.js';
import { requestId } from './middleware/request-id.js';
import { errorHandler } from './middleware/error-handler.js';
import { logger } from './lib/logger.js';
import { prisma } from './services/db.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { app } = expressWs(express());

app.use(requestId);
app.use(express.json());

// HTTP request logging (skips /health to avoid noise)
app.use(expressWinston.logger({
  winstonInstance: logger,
  msg: 'HTTP {{req.method}} {{req.url}}',
  expressFormat: false,
  colorize: false,
  ignoredRoutes: ['/health'],
  dynamicMeta: (req) => ({ requestId: (req as any).requestId, userId: (req as any).user?.sub }),
}));

app.use(xsuaaAuth);
app.use(requireAppAccess);

// Load OpenAPI specification
const openApiPath = path.resolve(__dirname, '../../openapi.yaml');
let swaggerDocument: any;

try {
  const openApiContent = fs.readFileSync(openApiPath, 'utf8');
  swaggerDocument = yaml.load(openApiContent);
  logger.info('OpenAPI specification loaded');
} catch (error) {
  logger.warn('OpenAPI specification not found, Swagger UI will not be available');
}

// Swagger UI setup
if (swaggerDocument) {
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerDocument, {
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'Finance Agent API Documentation',
      customfavIcon: '/favicon.ico',
    })
  );
  logger.info('Swagger UI available', { path: '/api-docs' });
}

// Serve OpenAPI spec as JSON
app.get('/api-docs.json', (_req, res) => {
  if (swaggerDocument) {
    res.json(swaggerDocument);
  } else {
    res.status(404).json({ error: 'OpenAPI specification not found' });
  }
});

app.get('/', (_req, res) => {
  res.json({
    message: 'Welcome to the Finance Agent API',
    documentation: swaggerDocument ? '/api-docs' : null,
    openapi: swaggerDocument ? '/api-docs.json' : null,
  });
});

app.get('/health', async (_req, res) => {
  const checks: Record<string, 'ok' | 'error'> = {};
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch {
    checks.database = 'error';
  }

  const allOk = Object.values(checks).every(v => v === 'ok');
  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    checks,
  });
});

// File management routes
app.use('/api/files', fileRoutes);

// Chat routes
app.use('/api/chat', chatRoutes);

// Global error handler (must be last)
app.use(errorHandler);

export default app;
