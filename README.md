# Finance Agent

A comprehensive full-stack AI-powered finance agent application with real-time chat capabilities, intelligent document processing, and enterprise-grade deployment support.

## 🌟 Overview

Finance Agent is an intelligent chatbot application designed for financial document analysis and interactive Q&A. It combines modern web technologies with AI capabilities to provide real-time, context-aware responses based on uploaded financial documents.

### Key Features

- 💬 **Real-time WebSocket Chat** - Instant bi-directional communication with streaming responses
- 📄 **Document Upload & Processing** - PDF, CSV, JSON, and plain-text upload with intelligent text extraction and vectorization
- 🧠 **AI-Powered Responses** - Azure OpenAI integration with GPT and embedding models
- 🔍 **Vector Search** - ChromaDB Cloud integration for semantic document search and retrieval, scoped per session
- 🗄️ **PostgreSQL Persistence** - Sessions, messages, and file metadata stored durably in a managed PostgreSQL database
- 🔑 **BTP Credential Store** - API keys fetched securely at runtime from SAP BTP Credential Store; no secrets in environment variables or code
- 🎨 **Modern UI** - SAP UI5 Web Components with React for enterprise-grade UX
- 📋 **OpenAPI 3.0 Specification** - Complete REST API documentation with interactive Swagger UI
- 🚀 **Cloud Deployment** - SAP BTP Cloud Foundry support with MTA deployment
- 🧪 **Comprehensive Testing** - Jest integration with coverage reporting
- 🤖 **CI/CD Pipeline** - GitHub Actions for automated testing and deployment
- 📦 **SDK Support** - Reusable TypeScript SDK (`@vs-fas/finance-agent`) and Python SDK (`vs-finance-agent-sdk`) for client applications

## 📁 Project Structure

```
finance-agent/
├── frontend/              # React + TypeScript + Vite + UI5 Web Components
│   ├── src/
│   │   ├── components/   # React components (ChatView, ChatMessage, FileUpload)
│   │   ├── api.ts        # WebSocket and HTTP API client
│   │   └── App.tsx       # Main application component
│   └── package.json
│
├── backend/              # Express + TypeScript API + AI Agent
│   ├── src/
│   │   ├── agent/       # LangChain-based finance agent
│   │   │   ├── agents/         # Agent implementations
│   │   │   ├── config/         # Azure OpenAI configuration
│   │   │   └── services/       # Vector store service (ChromaDB)
│   │   ├── routes/      # API routes (chat, files)
│   │   ├── services/    # Business logic (chat, file processing)
│   │   └── app.ts       # Express application with WebSocket support
│   └── package.json
│
├── sdk/                  # TypeScript SDK for client applications
│   ├── src/
│   │   ├── chat-client.ts    # Chat client with WebSocket support
│   │   ├── types.ts          # Type definitions
│   │   └── index.ts
│   └── examples/
│       └── example.ts        # Usage examples
│
├── approuter/            # SAP Application Router (Production)
│   ├── xs-app.json      # Route configuration (unauthenticated)
│   └── resources/       # Built frontend assets
│
├── approuter-dev/        # Development Application Router
│   ├── xs-app.json      # Development routes
│   └── default-env.json # Local development configuration
│
├── .github/
│   └── workflows/
│       └── deploy-app.yml    # CI/CD pipeline
│
└── mta.yaml             # Multi-Target Application descriptor for BTP
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm 9+
- Azure OpenAI account (for chat and embeddings)
- ChromaDB Cloud account (for vector storage)
- PostgreSQL database (for session/message/file persistence)
- SAP BTP Credential Store binding (for production; `.env` fallback for local dev)

### Environment Setup

1. **Copy environment template**
   ```bash
   cd backend
   cp .env.example .env
   ```

2. **Configure environment variables**
   Edit `backend/.env`:
   ```bash
   # Azure OpenAI Configuration
   AZURE_OPENAI_API_KEY=your_key_here
   AZURE_OPENAI_ENDPOINT=https://your-instance.openai.azure.com
   AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o
   AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME=text-embedding-3-small

   # Chroma Cloud Configuration
   CHROMA_API_KEY=your_chroma_key
   CHROMA_TENANT=your_tenant
   CHROMA_DATABASE=your_database
   CHROMA_COLLECTION_NAME=finance-docs

   # PostgreSQL Configuration
   DATABASE_URL=postgres://user:password@localhost:5432/finance_agent
   # Or use individual variables:
   # PGHOST=localhost
   # PGPORT=5432
   # PGDATABASE=finance_agent
   # PGUSER=your_user
   # PGPASSWORD=your_password
   ```

   In production on SAP BTP, Azure OpenAI and ChromaDB API keys are fetched automatically from the bound Credential Store service — no manual env var setup needed for those.

   See `docs/ENVIRONMENT_VARIABLES.md` for detailed configuration guide.

### Local Development

Provides a unified entry point that routes frontend and backend requests, mimicking production environment.

**Step 1: Start Backend**
```bash
cd backend
npm install
npm run dev
```
Backend runs on http://localhost:3001

**Step 2: Start Frontend**
```bash
cd frontend
npm install
npm run dev
```
Frontend runs on http://localhost:5173

**Step 3: Start Approuter**
```bash
cd approuter-dev
npm install
npm start
```

**Access the application:** http://localhost:5001
- Frontend: http://localhost:5001
- Backend API: http://localhost:5001/api/*
- WebSocket: ws://localhost:5001/api/chat

## 🏗️ Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         User Browser                         │
│  (React UI + WebSocket Client + File Upload)                │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ HTTP/WebSocket
                 │
┌────────────────▼────────────────────────────────────────────┐
│              Application Router (Approuter)                  │
│  • Routes: /api/* → Backend, /* → Frontend                  │
│  • WebSocket Proxying                                        │
│  • Static Asset Serving                                      │
└────────────────┬────────────────────────────────────────────┘
                 │
       ┌─────────┴──────────┐
       │                    │
       ▼                    ▼
┌─────────────┐    ┌───────────────────────────┐
│  Frontend   │    │         Backend           │
│             │    │  ┌─────────────────────┐  │
│  • React    │    │  │   Express Server    │  │
│  • UI5      │    │  │   • REST API        │  │
│  • Vite     │    │  │   • WebSocket       │  │
└─────────────┘    │  └──────────┬──────────┘  │
                   │             │              │
                   │  ┌──────────▼──────────┐  │
                   │  │   Finance Agent     │  │
                   │  │   (LangChain)       │  │
                   │  └──────────┬──────────┘  │
                   │             │              │
                   │    ┌───────────────────┐    │
                   │    │                   │    │
                   │    ▼       ▼      ▼    ▼    │
                   │  ┌──────┐ ┌────┐ ┌─────────┐│
                   │  │Vector│ │ PG │ │ Azure   ││
                   │  │Store │ │ DB │ │ OpenAI  ││
                   │  │      │ │    │ │         ││
                   │  │Chroma│ │Sess│ │ • GPT-4 ││
                   │  │ DB   │ │Msg │ │ • Embed ││
                   │  └──────┘ └────┘ └─────────┘│
                   │                             │
                   │  ┌─────────────────────┐    │
                   │  │  BTP Credential     │    │
                   │  │  Store              │    │
                   │  │  (API keys at       │    │
                   │  │   runtime)          │    │
                   │  └─────────────────────┘    │
                   └─────────────────────────────┘
```

### Component Details

#### Frontend (React + UI5)
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast HMR and optimized builds
- **UI Library**: SAP UI5 Web Components (@ui5/webcomponents-react)
- **Real-time Communication**: WebSocket client for chat streaming
- **File Handling**: Multipart form upload for PDFs
- **State Management**: React hooks

#### Backend (Express + TypeScript)
- **Framework**: Express 5 with TypeScript
- **WebSocket**: express-ws for real-time bidirectional communication
- **File Processing**:
  - Multer for multipart uploads
  - pdf-parse for PDF text extraction
- **AI Integration**:
  - LangChain for agent orchestration
  - Azure OpenAI for chat completions and embeddings
  - ChromaDB for vector storage and similarity search
- **Persistence**: PostgreSQL via `pg` connection pool — sessions, messages, and file metadata stored in `sessions`, `messages`, and `files` tables; also supports BTP VCAP_SERVICES binding for managed PostgreSQL
- **Credential Management**: BTP Credential Store integration — API keys fetched securely at runtime via the CredStore REST API; falls back to environment variables when BTP binding is not present
- **Testing**: Jest with comprehensive test coverage

#### AI Agent (LangChain)
- **Framework**: LangChain with OpenAI integration
- **Model**: Azure OpenAI GPT-4 (configurable)
- **Embeddings**: Azure OpenAI text-embedding models
- **Vector Store**: ChromaDB Cloud
- **Retrieval**: Semantic search with configurable similarity threshold
- **Context Management**: Document-based RAG (Retrieval Augmented Generation)

#### Application Router
- **Production**: SAP @sap/approuter for Cloud Foundry
- **Development**: Local approuter with nodemon hot reload
- **Features**:
  - Route management (API proxy, static assets)
  - WebSocket support
  - Compression
  - Cache control

## 🧪 Testing

### Run Tests

```bash
# Frontend tests
cd frontend
npm test                # Run tests
npm run test:coverage   # With coverage report

# Backend tests
cd backend
npm test                # Run tests
npm run test:coverage   # With coverage report
```

### Test Coverage

The project maintains >50% test coverage:
- Unit tests for services and utilities
- Integration tests for API endpoints
- Component tests for React components

Coverage reports are generated in `coverage/` directories.

## 🌐 Deployment

### Cloud Foundry (SAP BTP)

#### Prerequisites
- SAP BTP account with Cloud Foundry enabled
- cf CLI installed
- MTA Build Tool (mbt) installed

#### Quick Deployment

> **💡 Production Notes**:
> - **BTP Credential Store** is integrated — credentials are fetched securely at runtime via the bound credstore service
> - **IAS + XSUAA authentication** planned for future deployments
> - See [Security](#-security) section for details

See `docs/DEPLOYMENT.md` for comprehensive guide.

**Manual Deployment**

```bash
# 1. Build MTA archive
mbt build -p=cf

# 2. Login to Cloud Foundry
cf login -a https://api.cf.us10-001.hana.ondemand.com

# 3. Deploy
cf deploy mta_archives/finance-agent_1.0.0.mtar -f

# 4. Set environment variables
cf set-env finance-agent-backend AZURE_OPENAI_API_KEY "your-key"
cf set-env finance-agent-backend CHROMA_API_KEY "your-key"
# ... (set other env vars)

# 5. Restage application
cf restage finance-agent-backend
```

#### Deployment Architecture (BTP)

```
SAP BTP Cloud Foundry
├── finance-agent-approuter (512MB)
│   ├── Serves static frontend
│   ├── Routes /api/* to backend
│   └── WebSocket proxying
│
├── finance-agent-backend (512MB, 1GB disk)
│   ├── Express API
│   ├── WebSocket server
│   ├── AI agent
│   └── External connections:
│       ├── Azure OpenAI (via API)
│       ├── ChromaDB Cloud (via API)
│       ├── PostgreSQL (via VCAP_SERVICES binding)
│       └── BTP Credential Store (via VCAP_SERVICES binding)
│
├── finance-agent-db (PostgreSQL managed service)
│   └── Stores sessions, messages, file metadata
│
└── finance-agent-credstore (Credential Store managed service)
    └── Stores Azure OpenAI and ChromaDB API keys
```

No authentication services are configured (simplified for demo purposes).

### CI/CD Pipeline

GitHub Actions workflow (`.github/workflows/deploy-app.yml`) provides:

**On Push to Main:**
1. **Build & Test**
   - Install dependencies (frontend, backend, sdk)
   - Run tests with coverage
   - Check coverage thresholds (>50%)
   - Build frontend and backend

2. **Deploy** (on main branch)
   - Build MTA archive
   - Deploy to Cloud Foundry
   - Automatic environment setup

**Manual Trigger:**
- Workflow can be triggered manually via Actions tab

**Secrets Required:**
- `CF_API`: Cloud Foundry API endpoint
- `CF_USERNAME`: CF username
- `CF_PASSWORD`: CF password
- `CF_ORG`: CF organization
- `CF_SPACE`: CF space

## 📚 SDK Usage

The project includes a reusable TypeScript SDK for building client applications.

> **🔮 Planned Enhancement**: OAuth 2.0 authentication support (Authorization Code and Client Credentials flows) will be added to the SDK for secure integration with IAS + XSUAA in future releases. See [Security](#-security) section for the planned authentication architecture.

### Installation

```bash
cd sdk
npm install
npm run build
```

### Usage Example

```typescript
import { ChatClient } from '@finance-agent/sdk';

// Create client
const client = new ChatClient({
  baseUrl: 'http://localhost:3001',
  reconnectAttempts: 3
});

// Connect and send message
await client.connect();

// Stream responses
for await (const message of client.sendMessage('What is the revenue?')) {
  if (message.type === 'content') {
    console.log(message.content);
  }
}

// Upload file
await client.uploadFile(fileBuffer, 'report.pdf');

// List files
const files = await client.listFiles();

// Disconnect
await client.disconnect();
```

See `sdk/examples/example.ts` for complete examples.

## 📋 API Documentation

### OpenAPI 3.0 Specification

The Finance Agent API is fully documented with **OpenAPI 3.0** (formerly Swagger).

**Interactive Documentation (Swagger UI):**
```
http://localhost:3001/api-docs
```

**OpenAPI Specification Files:**
- YAML: `/openapi.yaml`
- JSON: `http://localhost:3001/api-docs.json`

**What's Documented:**
- ✅ All REST API endpoints (health, files, chat)
- ✅ Request/response schemas
- ✅ WebSocket protocol and message formats
- ✅ Error responses and status codes
- ✅ Authentication schemes (planned for future)
- ✅ Code examples and usage patterns

**Using the API Documentation:**

1. **Swagger UI** - Built-in interactive documentation
   ```bash
   npm run dev  # Start backend
   # Open http://localhost:3001/api-docs
   ```

2. **Import to Postman**
   ```
   Import → Link → http://localhost:3001/api-docs.json
   ```

3. **Generate Client SDKs**
   ```bash
   npx @openapitools/openapi-generator-cli generate \
     -i openapi.yaml \
     -g typescript-fetch \
     -o ./generated-client
   ```

4. **Validate Specification**
   ```bash
   npx @apidevtools/swagger-cli validate openapi.yaml
   ```

See [docs/OPENAPI.md](docs/OPENAPI.md) for complete documentation and usage guide.

## 🛠️ Technologies & Integrations

### Frontend Stack
- **React 18** - UI framework with hooks
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and dev server
- **SAP UI5 Web Components** - Enterprise UI library
  - @ui5/webcomponents-react
  - @ui5/webcomponents-fiori
- **WebSocket API** - Real-time communication

### Backend Stack
- **Node.js 18+** - JavaScript runtime
- **Express 5** - Web framework
- **TypeScript** - Type-safe server code
- **express-ws** - WebSocket support
- **Multer** - File upload handling
- **pdf-parse** - PDF text extraction
- **CORS** - Cross-origin support
- **Swagger UI** - Interactive API documentation
- **OpenAPI 3.0** - API specification standard
- **pg** - PostgreSQL client with connection pooling
- **BTP Credential Store** - Runtime secret management via VCAP_SERVICES

### AI & ML Stack
- **LangChain** - AI orchestration framework
  - @langchain/core
  - @langchain/community
  - @langchain/openai
- **Azure OpenAI** - LLM and embedding models
  - GPT-4 / GPT-4o for chat
  - text-embedding-3-small/large for vectors
- **ChromaDB** - Vector database
  - Cloud-hosted
  - Semantic similarity search
  - Document storage and retrieval

### Development & Testing
- **Jest** - Testing framework
- **ts-jest** - TypeScript support for Jest
- **Supertest** - HTTP assertion library
- **tsx** - TypeScript execution
- **Nodemon** - Hot reload for development

### Deployment & DevOps
- **Cloud Foundry** - PaaS deployment platform
- **SAP BTP** - Enterprise cloud platform
- **MTA** - Multi-Target Application framework
- **GitHub Actions** - CI/CD automation
- **Docker** - Containerization (optional)

### Routing & Proxy
- **SAP Application Router** - Enterprise routing
  - @sap/approuter
  - WebSocket support
  - Route configuration via xs-app.json

## 🔧 Configuration

### Backend Configuration

Key environment variables (see `backend/.env.example`):

```bash
# Azure OpenAI (loaded from BTP Credential Store in production; env var fallback for local dev)
AZURE_OPENAI_API_KEY=           # Your Azure OpenAI API key
AZURE_OPENAI_ENDPOINT=          # Azure OpenAI endpoint URL
AZURE_OPENAI_DEPLOYMENT_NAME=   # Chat model deployment (e.g., gpt-4o)
AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME=  # Embedding model

# Chroma DB (API key loaded from BTP Credential Store in production; env var fallback for local dev)
CHROMA_API_KEY=                 # ChromaDB Cloud API key
CHROMA_TENANT=                  # Your tenant name
CHROMA_DATABASE=                # Your database name
CHROMA_COLLECTION_NAME=         # Collection for documents

# PostgreSQL (use DATABASE_URL or individual PG* vars; also supports VCAP_SERVICES binding on BTP)
DATABASE_URL=                   # postgres://user:password@host:5432/dbname
# PGHOST=
# PGPORT=5432
# PGDATABASE=
# PGUSER=
# PGPASSWORD=

# Model Settings
TEMPERATURE=0.7                 # LLM temperature (0-1)

# Server
PORT=3001                       # Backend port
```

### Frontend Configuration

Built-time configuration in `frontend/vite.config.ts`:
- Development proxy to backend
- Build output optimization
- React plugin configuration

### Application Router Configuration

Route definitions in `approuter/xs-app.json`:
- API routes → backend
- Static routes → frontend resources
- WebSocket support enabled
- No authentication (authenticationMethod: "none")

## 🤝 Contributing

### Development Workflow

1. **Create feature branch**
   ```bash
   git checkout -b feature/your-feature
   ```

2. **Make changes and test**
   ```bash
   npm test
   npm run test:coverage
   ```

3. **Build and verify**
   ```bash
   npm run build
   ```

4. **Commit changes**
   ```bash
   git add .
   git commit -m "Add: your feature description"
   ```

5. **Push and create PR**
   ```bash
   git push origin feature/your-feature
   ```

### Code Style

- **TypeScript**: Strict mode enabled
- **Formatting**: Consistent indentation and naming
- **Testing**: Maintain >50% coverage
- **Commits**: Descriptive commit messages

## 🔐 Security

### Current Configuration
- **Authentication**: Disabled (for demo purposes)
- **CORS**: Enabled for development
- **File Uploads**: Validated file types (PDF only)
- **Environment Variables**: Sensitive data in .env (not committed)

### Future Production Enhancements

> **📋 Roadmap**: The following security enhancements are planned for production deployment. The current implementation uses simple environment variables for ease of development.

#### 1. Credential Management with BTP Credential Store

The backend integrates with **SAP BTP Credential Store** for secure API key management in production. On startup, the server reads the `VCAP_SERVICES` binding, fetches credentials via the CredStore REST API (with optional RSA-OAEP decryption), and sets them as environment variables before any other service initialises. When no binding is present (local dev), it falls back to `.env` values transparently.

**Credentials managed via CredStore:**
- `azure-openai-api-key` → `AZURE_OPENAI_API_KEY`
- `chroma-api-key` → `CHROMA_API_KEY`

**Benefits:**
- ✅ No secrets in environment variables or code
- ✅ Encryption at rest and in transit
- ✅ Audit logging for credential access
- ✅ Graceful fallback to `.env` for local development

**Setup on SAP BTP:**

1. **Create Credential Store Service Instance**
   ```bash
   cf create-service credstore free finance-agent-credstore
   ```

2. **Bind to backend in mta.yaml**
   ```yaml
   resources:
     - name: finance-agent-credstore
       type: org.cloudfoundry.managed-service
       parameters:
         service: credstore
         service-plan: free

   modules:
     - name: finance-agent-backend
       requires:
         - name: finance-agent-credstore
   ```

3. **Store Credentials** (via BTP Cockpit or CF CLI plugin)
   - Store `azure-openai-api-key` and `chroma-api-key` under your namespace in the credstore instance.

#### 2. Authentication & Authorization (Planned Future Enhancement)

The current implementation is **unauthenticated for demo purposes**. For production use, we plan to implement authentication using **SAP Identity Authentication Service (IAS) and XSUAA**.

**Planned Authentication Architecture:**

```
┌─────────────────────────────────────────────────────────────┐
│                    User Authentication                       │
│                                                              │
│  ┌──────────────┐         ┌─────────────────┐              │
│  │    IAS       │────────▶│     XSUAA       │              │
│  │  (Identity   │         │ (Authorization) │              │
│  │   Provider)  │         │                 │              │
│  └──────────────┘         └─────────────────┘              │
│         │                          │                        │
│         │                          │                        │
│         ▼                          ▼                        │
│  ┌──────────────────────────────────────┐                  │
│  │         Application Router            │                  │
│  │   • OAuth 2.0 flows                  │                  │
│  │   • JWT token validation             │                  │
│  └──────────────────────────────────────┘                  │
│                    │                                        │
│                    ▼                                        │
│         ┌────────────────────┐                             │
│         │  Backend + SDK     │                             │
│         └────────────────────┘                             │
└─────────────────────────────────────────────────────────────┘
```

**Planned OAuth 2.0 Flows:**

**A. Authorization Code Flow (User Authentication)** - *To be implemented*
- Use Case: Browser-based applications, interactive user login
- SDK Usage: Client applications authenticating end users
- Planned Implementation:
  ```typescript
  // SDK Configuration
  const client = new ChatClient({
    baseUrl: 'https://your-app.cfapps.sap.hana.ondemand.com',
    auth: {
      type: 'oauth2',
      flow: 'authorization_code',
      clientId: 'your-client-id',
      redirectUri: 'https://your-app/callback',
      tokenEndpoint: 'https://your-tenant.authentication.sap.hana.ondemand.com/oauth/token'
    }
  });
  ```

**B. Client Credentials Flow (Service-to-Service)** - *To be implemented*
- Use Case: Backend services, scheduled jobs, API integrations
- SDK Usage: Server-side applications, microservices communication
- Planned Implementation:
  ```typescript
  // SDK Configuration
  const client = new ChatClient({
    baseUrl: 'https://your-app.cfapps.sap.hana.ondemand.com',
    auth: {
      type: 'oauth2',
      flow: 'client_credentials',
      clientId: 'your-client-id',
      clientSecret: process.env.CLIENT_SECRET, // From Credential Store
      tokenEndpoint: 'https://your-tenant.authentication.sap.hana.ondemand.com/oauth/token'
    }
  });
  ```

**Planned Implementation Steps for Authentication:**

1. **Bind IAS and XSUAA Services** *(Future)*
   ```yaml
   # mta.yaml
   resources:
     - name: finance-agent-ias
       type: org.cloudfoundry.managed-service
       parameters:
         service: identity
         service-plan: application

     - name: finance-agent-xsuaa
       type: org.cloudfoundry.managed-service
       parameters:
         service: xsuaa
         service-plan: application
         path: ./xs-security.json

   modules:
     - name: finance-agent-approuter
       requires:
         - name: finance-agent-ias
         - name: finance-agent-xsuaa

     - name: finance-agent-backend
       requires:
         - name: finance-agent-xsuaa
   ```

2. **Configure xs-security.json** *(Future)*
   ```json
   {
     "xsappname": "finance-agent",
     "tenant-mode": "dedicated",
     "scopes": [
       {
         "name": "$XSAPPNAME.User",
         "description": "Finance Agent User"
       },
       {
         "name": "$XSAPPNAME.Admin",
         "description": "Finance Agent Administrator"
       }
     ],
     "role-templates": [
       {
         "name": "User",
         "scope-references": ["$XSAPPNAME.User"]
       },
       {
         "name": "Admin",
         "scope-references": ["$XSAPPNAME.Admin"]
       }
     ],
     "oauth2-configuration": {
       "grant-types": [
         "authorization_code",
         "client_credentials",
         "refresh_token"
       ],
       "redirect-uris": [
         "https://*.cfapps.*.hana.ondemand.com/**"
       ]
     }
   }
   ```

3. **Update Approuter Configuration** *(Future)*
   ```json
   {
     "authenticationMethod": "route",
     "routes": [
       {
         "source": "^/api/(.*)$",
         "target": "/api/$1",
         "destination": "backend",
         "authenticationType": "xsuaa",
         "csrfProtection": true
       }
     ]
   }
   ```

4. **Enhance SDK with Authentication Support** *(Future)*
   ```typescript
   // Planned SDK enhancement
   interface AuthConfig {
     type: 'oauth2' | 'bearer' | 'none';
     flow?: 'authorization_code' | 'client_credentials';
     clientId?: string;
     clientSecret?: string;
     tokenEndpoint?: string;
     redirectUri?: string;
   }

   // Planned features:
   // - Automatic token management
   // - Token refresh handling
   // - Session management
   ```

**Value Proposition for Planned Authentication:**
- 🔐 **Enterprise-grade security** - Industry-standard OAuth 2.0
- 👥 **User management** - Centralized identity management with IAS
- 🎫 **Fine-grained authorization** - Role-based access control with XSUAA
- 🔄 **Token management** - Automatic token refresh and validation
- 📱 **Multi-channel support** - Web, mobile, API clients
- 🔗 **Federation** - Support for corporate SSO and external IdPs
- 📊 **Audit trail** - Complete authentication and authorization logs

#### 3. Additional Security Best Practices (Current & Planned)

1. **Rate Limiting**: Implement API rate limiting to prevent abuse
2. **Request Validation**: Sanitize and validate all inputs
3. **HTTPS Only**: Enforce HTTPS in production
4. **API Key Rotation**: Regularly rotate credentials (automated with Credential Store)
5. **Error Handling**: Never expose sensitive data in error messages
6. **CORS Configuration**: Restrict allowed origins in production
7. **Content Security Policy**: Implement CSP headers
8. **Dependency Scanning**: Regular security audits with `npm audit`
9. **Secrets Scanning**: Use tools to prevent credential commits
10. **Logging**: Implement structured logging (avoid logging sensitive data)

## 📊 Monitoring & Logs

### Local Development
```bash
# Backend logs
cd backend && npm run dev

# View WebSocket connections
# Logs appear in terminal
```

### Cloud Foundry
```bash
# View logs
cf logs finance-agent-backend --recent
cf logs finance-agent-approuter --recent

# Stream logs
cf logs finance-agent-backend

# Check app status
cf app finance-agent-backend
```

## 🐛 Troubleshooting

### Common Issues

**WebSocket Connection Fails**
```bash
# Check backend is running
curl http://localhost:3001/api/health

# Check WebSocket endpoint
# Browser console should show connection status
```

**File Upload Fails**
- Ensure file is PDF
- Check file size (<10MB)
- Verify backend uploads directory exists

**Vector Store Errors**
- Verify ChromaDB credentials
- Check network connectivity
- Ensure collection exists

**PostgreSQL Connection Fails**
- Verify `DATABASE_URL` or individual `PG*` variables are set
- Ensure the database exists and the user has CREATE TABLE privileges
- On BTP, confirm the PostgreSQL service is bound in `mta.yaml`

**Credential Store / Missing API Key Errors**
- Locally: ensure `AZURE_OPENAI_API_KEY` and `CHROMA_API_KEY` are set in `.env`
- On BTP: confirm `finance-agent-credstore` is bound to the backend module and that `azure-openai-api-key` / `chroma-api-key` entries exist under the correct namespace

**Build Fails**
```bash
# Clean and rebuild
rm -rf node_modules package-lock.json
npm install
npm run build
```

## 📝 License

This project is proprietary and confidential.

## 🙏 Acknowledgments

- SAP UI5 team for Web Components
- LangChain for AI orchestration framework
- Azure OpenAI for language models
- ChromaDB for vector storage
- Open source community

## 📞 Support

For issues and questions:
1. Review troubleshooting section above
2. Check logs for error details
3. Review environment variable configuration

---

**Built with ❤️ using React, TypeScript, Express, LangChain, and Azure OpenAI**
