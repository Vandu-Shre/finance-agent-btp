# Finance Agent - SAP BTP Deployment Guide

This guide covers deploying the Finance Agent application to SAP BTP using the MTA (Multi-Target Application) approach.

**Note:** This application is configured for unauthenticated access (no XSUAA/UAA) for demo and simplicity purposes.

## Prerequisites

1. **SAP BTP Account** with Cloud Foundry environment
2. **Cloud Foundry CLI** installed
3. **MTA Build Tool (MBT)** installed
4. **Node.js** 18+ and npm 9+

### Install Tools

```bash
# Install Cloud Foundry CLI
# Download from: https://github.com/cloudfoundry/cli/releases

# Install MTA Build Tool
npm install -g mbt

# Verify installations
cf --version
mbt --version
```

## Deployment Steps

### 1. Login to SAP BTP

```bash
# Login to Cloud Foundry
cf login -a https://api.cf.<region>.hana.ondemand.com

# Target your org and space
cf target -o <your-org> -s <your-space>
```

### 2. Build MTA Archive

```bash
# From project root
mbt build

# This will:
# - Install backend dependencies
# - Build backend (TypeScript → JavaScript)
# - Install frontend dependencies
# - Build frontend (Vite production build)
# - Create mta_archives/finance-agent_1.0.0.mtar
```

### 3. Deploy to SAP BTP

```bash
# Deploy the MTA archive
cf deploy mta_archives/finance-agent_1.0.0.mtar

# This will:
# - Deploy backend application
# - Deploy approuter (serving frontend)
# - Start all applications
```

### 4. Verify Deployment

```bash
# Check application status
cf apps

# Expected output:
# name                          state     instances   memory   disk
# finance-agent-approuter       started   1/1         512M     512M
# finance-agent-backend         started   1/1         512M     1G

# Get application URL
cf app finance-agent-approuter

# Access the application at the displayed URL
```

## Application Architecture on BTP

```
User Browser
     ↓
SAP BTP (Cloud Foundry)
     ↓
[Application Router] (finance-agent-approuter)
  - Unauthenticated Access (No XSUAA)
  - Route Management
  - Serves Static Frontend
     ↓
  └─→ [Backend] (finance-agent-backend)
       - Express API
       - WebSocket Server
       - Business Logic
```

## Environment Variables

### Backend
Automatically set by Cloud Foundry:
- `PORT`: Application port
- `NODE_ENV`: production
- `VCAP_SERVICES`: Bound service credentials
- `VCAP_APPLICATION`: Application metadata

### Frontend
Built at deployment time, no runtime environment variables needed.

### Approuter
Configuration from environment variables and destinations:
- No authentication required
- Routes configured in xs-app.json

## Monitoring and Logs

### View Application Logs
```bash
# Real-time logs
cf logs finance-agent-approuter
cf logs finance-agent-backend

# Recent logs
cf logs finance-agent-approuter --recent
cf logs finance-agent-backend --recent
```

### Application Metrics
```bash
# App information
cf app finance-agent-backend

# App events
cf events finance-agent-backend

# App health
cf health finance-agent-backend
```

## Scaling

### Scale Backend
```bash
# Vertical scaling (memory/disk)
cf scale finance-agent-backend -m 1G -k 1G

# Horizontal scaling (instances)
cf scale finance-agent-backend -i 2
```

### Scale Approuter
```bash
# Increase instances for high availability
cf scale finance-agent-approuter -i 2
```

## Updates and Redeployment

### Update Application

```bash
# 1. Make changes to code
# 2. Rebuild MTA
mbt build

# 3. Redeploy (updates existing deployment)
cf deploy mta_archives/finance-agent_1.0.0.mtar
```

### Zero-Downtime Deployment

MTA deployment supports blue-green strategy:

```bash
# Deploy with strategy parameter
cf deploy mta_archives/finance-agent_1.0.0.mtar --strategy blue-green
```

## Troubleshooting

### Deployment Fails

```bash
# Check deployment status
cf dmol -i <operation-id>

# View deployment logs
cf logs finance-agent-backend --recent
```

### Application Won't Start

```bash
# Check app logs
cf logs finance-agent-backend --recent

# SSH into container (if enabled)
cf ssh finance-agent-backend

# Check environment variables
cf env finance-agent-backend
```

### WebSocket Connection Fails

1. Verify WebSocket enabled in xs-app.json
2. Check backend WebSocket endpoint is running
3. Verify no proxy timeout on route
4. Check browser console for errors

## Cleanup / Undeploy

```bash
# Undeploy entire MTA
cf undeploy finance-agent --delete-services

# This will:
# - Stop all applications
# - Delete all applications
```

## Cost Optimization

### Development/Test Environment
- Use smaller memory allocations
- Scale down to 1 instance
- Use free tier services where available

### Production Environment
- Use appropriate memory based on load
- Scale horizontally (multiple instances)
- Enable autoscaling if available
- Monitor and optimize resource usage

## Security Best Practices

1. **Never commit credentials** - Use environment variables for API keys
2. **Limit access** - Use Cloud Foundry space isolation
3. **Use HTTPS** - Enforced by SAP BTP
4. **Review access logs** - Monitor application access
5. **Keep dependencies updated** - Regular npm audit and updates

**Note:** This application is configured without authentication for demo purposes. For production use, consider implementing proper authentication and authorization.

## Support and Resources

- SAP BTP Documentation: https://help.sap.com/docs/btp
- Cloud Foundry Docs: https://docs.cloudfoundry.org
- MTA Guide: https://help.sap.com/docs/SAP_HANA_PLATFORM/4505d0bdaf4948449b7f7379d24d0f0d/
