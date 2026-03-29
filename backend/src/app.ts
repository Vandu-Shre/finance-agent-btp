import express from 'express';
import expressWs from 'express-ws';
import swaggerUi from 'swagger-ui-express';
import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fileRoutes from './routes/file.routes.js';
import chatRoutes from './routes/chat.routes.js';
import chatService from './services/chat.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { app } = expressWs(express());

app.use(express.json());

// Load OpenAPI specification
const openApiPath = path.resolve(__dirname, '../../openapi.yaml');
let swaggerDocument: any;

try {
  const openApiContent = fs.readFileSync(openApiPath, 'utf8');
  swaggerDocument = yaml.load(openApiContent);
  console.log('✅ OpenAPI specification loaded');
} catch (error) {
  console.warn('⚠️  OpenAPI specification not found, Swagger UI will not be available');
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
  console.log('📚 Swagger UI available at /api-docs');
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

app.get('/health', (_req, res) => {
  const initStatus = chatService.getInitializationStatus();
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    services: {
      agent: initStatus.agentReady ? 'ready' : 'not ready',
      vectorStore: initStatus.vectorStoreReady ? 'ready' : 'not ready',
      initializing: initStatus.isInitializing,
    }
  });
});

// File management routes
app.use('/api/files', fileRoutes);

// Chat routes
app.use('/api/chat', chatRoutes);

export default app;
