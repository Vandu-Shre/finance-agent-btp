# Finance Agent - Production Application Router

Production-ready Application Router for SAP BTP deployment.

## Overview

This Application Router is configured for production deployment on SAP BTP with:
- **Unauthenticated access** (no XSUAA) for demo and simplicity
- Compression enabled
- Proper cache headers for static assets
- WebSocket support for real-time chat

## Differences from Development Approuter

| Feature | Development (approuter-dev) | Production (approuter) |
|---------|----------------------------|------------------------|
| Configuration | default-env.json | Environment variables |
| Authentication | None | None (unauthenticated) |
| CSRF Protection | Disabled | Disabled |
| Cache Headers | No cache | Long-term caching for static assets |
| Hot Reload | Nodemon | Not applicable |
| Destinations | Hardcoded URLs | Cloud Foundry destinations |

## Route Configuration

### WebSocket Route (Chat)
- **Path**: `/api/chat`
- **Target**: Backend WebSocket endpoint
- **Authentication**: None
- **CSRF**: Disabled (WebSocket protocol)

### File Upload/Management Routes
- **Path**: `/api/files*`
- **Target**: Backend file management API
- **Authentication**: None
- **CSRF**: Disabled

### API Routes (REST)
- **Path**: `/api/*`
- **Target**: Backend REST API
- **Authentication**: None
- **CSRF**: Disabled

### Frontend Routes (Static Content)
- **Path**: `/*`
- **Target**: Frontend static files (from resources directory)
- **Authentication**: None
- **Cache**: 1 year (immutable assets with content hashing)
- **CSRF**: Disabled (static content)

## Deployment

Deployed as part of MTA (Multi-Target Application):

```bash
# Build MTA archive
mbt build

# Deploy to SAP BTP
cf deploy mta_archives/finance-agent_1.0.0.mtar
```

## Configuration

Configuration is provided via:
1. **xs-app.json** - Route definitions
2. **Environment variables** - Set by Cloud Foundry
3. **Destination configuration** - Backend destinations defined in mta.yaml

No authentication services required.

## Resource Requirements

- Memory: 512MB
- Disk: 512MB
- Instances: 1 (can be scaled)

## Features

- **Authentication Method**: none (unauthenticated for demo purposes)
- **CSRF Protection**: Disabled
- **Token Forwarding**: Disabled
- **Compression**: Enabled for responses > 2KB

## Monitoring

Access logs via:
```bash
cf logs finance-agent-approuter --recent
cf logs finance-agent-approuter # live tail
```

## Troubleshooting

**Routing Issues:**
- Check backend app URL in destination configuration
- Review xs-app.json route patterns
- Verify backend is running: `cf apps`

**WebSocket Issues:**
- Ensure websockets.enabled = true in xs-app.json
- Check backend WebSocket endpoint is running
- Verify no proxy timeouts on route

**Static Files Not Loading:**
- Verify frontend build artifacts are in resources/ directory
- Check cache headers in browser dev tools
- Clear browser cache if testing updates
