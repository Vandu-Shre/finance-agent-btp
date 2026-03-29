# Finance Agent - App Router

This directory contains the SAP Application Router configuration that routes requests between the frontend and backend.

## Setup

```bash
npm install
```

## Configuration

The approuter is configured to:
- Route `/api/*` requests to the backend (http://localhost:3000)
- Route all other requests to the frontend (http://localhost:5173)

## Running

Make sure both frontend and backend are running first:

**Terminal 1 - Backend:**
```bash
cd ../backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd ../frontend
npm run dev
```

**Terminal 3 - Approuter:**
```bash
cd ../approuter
npm start
```

The approuter will be available at http://localhost:5000

## Files

- `package.json` - Dependencies and scripts
- `xs-app.json` - Routing configuration
- `default-env.json` - Destination configuration for local development
- `.gitignore` - Files to ignore in git

## Usage

Once all three services are running, access the application through the approuter at:
- Frontend: http://localhost:5000
- Backend API: http://localhost:5000/api/*
