# Finance Agent on SAP BTP

A full-stack AI agent for interactive financial document analysis, built on SAP BTP Cloud Foundry. Upload financial documents, ask questions in natural language, and get grounded, context-aware answers — powered by a LangChain tool-calling agent with RAG over ChromaDB and Azure OpenAI.

## How it works

1. **Upload** — drop a PDF, CSV, or JSON financial document into the UI
2. **Index** — the backend extracts text, generates embeddings via Azure OpenAI, and stores chunks in ChromaDB Cloud (scoped to your user)
3. **Chat** — send a natural-language question; the LangChain agent decides whether to call the vector-search tool, retrieves relevant chunks, and synthesises an answer with GPT-4o
4. **Persist** — sessions, messages, and file metadata are stored in a managed PostgreSQL database on BTP

Authentication is handled by XSUAA: the backend validates JWT tokens and enforces the `FinanceAgentUser` role. Each user has an isolated file store and chat session.

## Architecture

```
Browser (React + SAP UI5)
    │  HTTP / WebSocket
    ▼
SAP Application Router          ← OAuth 2.0 / XSUAA JWT
    │
    ├──▶ Frontend (static)
    └──▶ Backend (Express + TypeScript)
              │
              ├── XSUAA JWT middleware   ← token validation + scope check
              ├── Finance Agent (LangChain tool-calling)
              │       └── vector-search tool → ChromaDB Cloud
              ├── Azure OpenAI           ← GPT-4o chat + embeddings
              ├── PostgreSQL             ← sessions, messages, file metadata
              └── BTP Credential Store   ← API keys at runtime
```

## Screenshots

**Chat interface**
![Chat Page](img/ChatPage.png)

**File management**
![Files Page](img/FilesPage.png)

**ChromaDB vector store**
![Chroma Screenshots](img/ChromaScreenshots.png)

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, SAP UI5 Web Components |
| Backend | Node.js 18, Express 5, TypeScript, express-ws |
| AI agent | LangChain, Azure OpenAI (GPT-4o + text-embedding-3) |
| Vector store | ChromaDB Cloud (per-user namespacing) |
| Database | PostgreSQL (BTP managed service) |
| Auth | XSUAA JWT validation, `FinanceAgentUser` role |
| Secrets | BTP Credential Store (falls back to `.env` locally) |
| Deployment | SAP BTP Cloud Foundry, MTA, GitHub Actions CI/CD |

## Project structure

```
finance-agent/
├── frontend/          # React + UI5 chat UI
├── backend/           # Express API + LangChain agent
│   └── src/
│       ├── agent/     # Finance agent, vector-store service
│       ├── middleware/ # XSUAA JWT auth + scope enforcement
│       ├── routes/    # /api/chat (WebSocket), /api/files
│       └── services/  # ChatService, FileService, per-user session manager
├── sdk/               # TypeScript client SDK
├── approuter/         # SAP Application Router (production)
├── approuter-dev/     # Local development approuter
└── mta.yaml           # BTP Multi-Target Application descriptor
```

## Getting started

### Prerequisites

- Node.js 18+
- Azure OpenAI resource (chat + embedding deployments)
- ChromaDB Cloud account
- PostgreSQL database (local or BTP managed)

### Local development

**1. Configure environment**

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env`:

```bash
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_INSTANCE_NAME=
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o
AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME=text-embedding-3-small

CHROMA_API_KEY=
CHROMA_TENANT=
CHROMA_DATABASE=
CHROMA_COLLECTION_NAME=finance-docs

DATABASE_URL=postgres://user:password@localhost:5432/finance_agent
```

On BTP, `AZURE_OPENAI_API_KEY` and `CHROMA_API_KEY` are fetched automatically from the bound Credential Store service — no manual setup needed.

**2. Start the backend**

```bash
cd backend && npm install && npm run dev
# Runs on http://localhost:3001
```

**3. Start the frontend**

```bash
cd frontend && npm install && npm run dev
# Runs on http://localhost:5173
```

**4. Start the dev approuter**

```bash
cd approuter-dev && npm install && npm start
# Access at http://localhost:5001
```

### Run tests

```bash
cd backend && npm test
cd frontend && npm test
```

## Deployment to SAP BTP

### Prerequisites

- SAP BTP account with Cloud Foundry enabled
- `cf` CLI and `mbt` (MTA Build Tool) installed
- XSUAA service instance bound (see `mta.yaml`)
- Credential Store service instance with `azure-openai-api-key` and `chroma-api-key` entries

### Deploy

```bash
# Build MTA archive
mbt build -p=cf

# Login
cf login -a https://api.cf.<region>.hana.ondemand.com

# Deploy
cf deploy mta_archives/finance-agent_1.0.0.mtar -f
```

### BTP services used

| Service | Purpose |
|---|---|
| `xsuaa` | JWT token issuance and validation |
| `postgresql-db` | Sessions, messages, file metadata |
| `credstore` | Azure OpenAI + ChromaDB API keys at runtime |

### CI/CD

GitHub Actions (`.github/workflows/deploy-app.yml`) runs tests, builds the MTA archive, and deploys to Cloud Foundry on push to `main`.

Required secrets: `CF_API`, `CF_USERNAME`, `CF_PASSWORD`, `CF_ORG`, `CF_SPACE`.

## Security

- **XSUAA JWT validation** — every request requires a valid Bearer token issued by the bound XSUAA instance
- **Scope enforcement** — users must hold the `FinanceAgentUser` role collection (`<xsappname>.user` scope); others receive 403
- **Per-user isolation** — file records and chat sessions are scoped to the authenticated user's `sub`; cross-user access returns 404
- **BTP Credential Store** — API keys are never stored in environment variables or source code in production; fetched at runtime via the CredStore REST API with RSA-OAEP decryption
- **File validation** — uploads capped at 10 MB; MIME type checked server-side

## Troubleshooting

**WebSocket connection fails**
```bash
curl http://localhost:3001/health
```

**ChromaDB errors** — verify `CHROMA_API_KEY`, `CHROMA_TENANT`, and `CHROMA_DATABASE` are set correctly.

**PostgreSQL connection fails** — check `DATABASE_URL` locally; on BTP confirm the `postgresql-db` service is bound in `mta.yaml`.

**Missing API key on BTP** — confirm `finance-agent-credstore` is bound to the backend module and that `azure-openai-api-key` / `chroma-api-key` entries exist in the correct namespace.

**403 from backend** — the authenticated user does not have the `FinanceAgentUser` role collection assigned in the BTP subaccount.

## License

Apache License 2.0 — see [LICENSE](LICENSE).
