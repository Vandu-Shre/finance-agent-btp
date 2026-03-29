# Quick Reference: Environment Variables

## Summary of Configuration

This document lists all environment variables used by the Finance Agent backend.

## Required Environment Variables

### Azure OpenAI (Required)

| Variable | Description | Example |
|----------|-------------|---------|
| `AZURE_OPENAI_API_KEY` | Azure OpenAI API key | `abc123...` |
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI endpoint URL | `https://your-instance.openai.azure.com` |
| `AZURE_OPENAI_DEPLOYMENT_NAME` | Chat/LLM model deployment name | `gpt-4o`, `gpt-4`, `gpt-35-turbo` |
| `AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME` | Embedding model deployment name | `text-embedding-3-small` |
| `AZURE_OPENAI_API_VERSION` | Azure OpenAI API version | `2024-02-15-preview` |

### Chroma Cloud (Optional but Recommended)

| Variable | Description | Example | Set in mta.yaml? |
|----------|-------------|---------|------------------|
| `CHROMA_HOST` | Chroma Cloud API endpoint | `https://api.trychroma.com` | ✅ Yes |
| `CHROMA_API_KEY` | Chroma Cloud API key | `chr_abc123...` | ❌ No (set via CF) |
| `CHROMA_TENANT` | Chroma tenant name | `my-tenant` | ✅ Yes (update default) |
| `CHROMA_DATABASE` | Chroma database name | `production-db` | ✅ Yes (update default) |
| `CHROMA_COLLECTION_NAME` | Collection name for documents | `finance-docs` | ✅ Yes |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `TEMPERATURE` | LLM temperature (0-1) | `0.7` |
| `PORT` | Server port | `3001` |
| `NODE_ENV` | Node environment | `production` |

## What's in mta.yaml?

Currently configured in `mta.yaml`:

```yaml
properties:
  NODE_ENV: production
  CHROMA_HOST: https://api.trychroma.com
  CHROMA_TENANT: default_tenant
  CHROMA_DATABASE: default_database
  CHROMA_COLLECTION_NAME: finance-docs
```

## What's NOT in mta.yaml? (Security)

These must be set manually via Cloud Foundry:

- ❌ `CHROMA_API_KEY` - Sensitive credential
- ❌ `AZURE_OPENAI_API_KEY` - Sensitive credential
- ❌ `AZURE_OPENAI_ENDPOINT` - Organization-specific
- ❌ `AZURE_OPENAI_DEPLOYMENT_NAME` - Organization-specific
- ❌ `AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME` - Organization-specific

## How to Set Missing Variables

```bash
# Set Azure OpenAI configuration
cf set-env finance-agent-backend AZURE_OPENAI_API_KEY "your_key"
cf set-env finance-agent-backend AZURE_OPENAI_ENDPOINT "https://your-instance.openai.azure.com"
cf set-env finance-agent-backend AZURE_OPENAI_DEPLOYMENT_NAME "gpt-4o"
cf set-env finance-agent-backend AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME "text-embedding-3-small"

# Set Chroma Cloud API key
cf set-env finance-agent-backend CHROMA_API_KEY "chr_your_key"

# Update Chroma tenant/database (if different from defaults)
cf set-env finance-agent-backend CHROMA_TENANT "your-tenant"
cf set-env finance-agent-backend CHROMA_DATABASE "your-database"

# Restage to apply changes
cf restage finance-agent-backend
```

## Verification

Check all variables are set:

```bash
cf env finance-agent-backend | grep -E "(AZURE|CHROMA|NODE_ENV)"
```

## Development vs Production

### Development (.env file)

```bash
# backend/.env
AZURE_OPENAI_API_KEY=your_key
AZURE_OPENAI_ENDPOINT=https://your-instance.openai.azure.com
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o
AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME=text-embedding-3-small

CHROMA_HOST=https://api.trychroma.com
CHROMA_API_KEY=chr_dev_key
CHROMA_TENANT=dev-tenant
CHROMA_DATABASE=dev-database
CHROMA_COLLECTION_NAME=finance-docs-dev
```

### Production (Cloud Foundry)

- Set via `cf set-env` commands
- Use different Chroma database for production
- Use production API keys
- Enable monitoring

## Troubleshooting

### App won't start

```bash
# Check logs
cf logs finance-agent-backend --recent

# Common issues:
# - Missing AZURE_OPENAI_API_KEY
# - Missing AZURE_OPENAI_DEPLOYMENT_NAME
# - Missing CHROMA_API_KEY (if CHROMA_HOST is set)
```

### Vector store not working

```bash
# Verify Chroma configuration
cf env finance-agent-backend | grep CHROMA

# Check all 5 variables are set:
# CHROMA_HOST, CHROMA_API_KEY, CHROMA_TENANT, CHROMA_DATABASE, CHROMA_COLLECTION_NAME
```

### Changes not taking effect

```bash
# Always restage after setting environment variables
cf restage finance-agent-backend
```

## Best Practices

1. ✅ Use separate Chroma databases for dev/prod
2. ✅ Rotate API keys regularly
3. ✅ Use descriptive tenant/database names
4. ✅ Document your configuration
5. ✅ Never commit `.env` files
6. ✅ Test after deployment

## Support

- See `CLOUD_FOUNDRY_DEPLOYMENT.md` for detailed deployment guide
- See `MODEL_CONFIGURATION.md` for model setup guide
- See `CHROMA_CLOUD_SETUP.md` for Chroma Cloud setup
