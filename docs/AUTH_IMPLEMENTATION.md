# Authentication Implementation Guide

Analysis of changes required to implement OAuth 2.0 authentication (IAS + XSUAA) for the Finance Agent.

---

## Authorization Code Flow

Intended for browser-based/user-facing clients. The AppRouter handles the OAuth2 redirect dance (redirect → IAS login → token exchange) once XSUAA is bound.

### Infrastructure / Config

| File | Change |
|---|---|
| `mta.yaml` | Add `finance-agent-xsuaa` resource; bind to approuter and backend; set `forwardAuthToken: true` on backend destination |
| `approuter/xs-app.json` | Change `authenticationMethod` to `route`; set `authenticationType: "xsuaa"` on each route |
| `xs-security.json` | New file — define scopes, role-templates, OAuth2 grant types and redirect URIs |

### Backend

1. **JWT validation middleware** — new file (`src/middleware/jwt.middleware.ts`):
   - Verify JWT signature against XSUAA's public key endpoint
   - Reject with `401` if missing or invalid
   - Attach decoded claims to `req.user`

2. **`app.ts`** — register middleware before all routes (one line, gates everything)

3. **`file.routes.ts`** — replace the `x-session-id` fallback (line 24) with `req.user.sub` or equivalent claim. Trivial.

4. **`chat.routes.ts` / WebSocket** — WebSocket upgrades don't carry `Authorization` headers the same way as HTTP. JWT arrives via the initial HTTP upgrade request headers; must be extracted and validated at connection time (`ws.on('connection')`) and session scoped to that user. Moderate effort.

> **Note:** The standard browser `WebSocket` API doesn't support custom headers. If the frontend needs to authenticate WS connections, the token would need to be passed as a query parameter on the WebSocket URL and validated server-side (with care — query params appear in logs).

### SDK

Minimal changes — structurally already ready:
- `authToken?: string` exists in config (`types.ts`)
- `Authorization: Bearer <token>` is already sent on WebSocket headers
- For Authorization Code flow, the consumer obtains the token externally and passes it in — no token acquisition logic needed in the SDK
- Verify all HTTP request methods consistently forward the token header

### Effort Summary

| Layer | Effort |
|---|---|
| `mta.yaml` + `xs-app.json` + `xs-security.json` | Small (config-only) |
| Backend JWT middleware | Medium (~60–80 lines, XSUAA key endpoint integration) |
| WebSocket auth in `chat.routes.ts` | Medium (token extraction at upgrade, session scoping) |
| File routes user identity | Trivial |
| SDK | Minimal |

---

## Client Credentials Flow

Intended for service-to-service integrations. The SDK owns the token lifecycle — it acquires, caches, and refreshes tokens independently.

### Infrastructure / Config

Same as Authorization Code flow, with one addition:
- `xs-security.json` — add `client_credentials` to the `grant-types` list

The AppRouter is mostly uninvolved. No redirect/login flow is needed; the SDK attaches the token before the request leaves the client. You could even bypass the approuter and hit the backend directly with a Bearer token. Only `forwardAuthToken: true` in `mta.yaml` is strictly needed.

### Backend

Identical to Authorization Code flow. The JWT validation middleware is the same — the difference is only in what claims the token carries (no user identity like `sub`/`email`; instead carries `client_id` and granted scopes).

### SDK

This is where the bulk of additional effort lives compared to Authorization Code flow. The SDK needs to own the full token lifecycle:

- Accept `clientId`, `clientSecret`, and `tokenEndpoint` in `ChatClientConfig`
- Implement token fetch (POST to token endpoint with `grant_type=client_credentials`)
- Cache the token and track expiry
- Auto-refresh before expiry
- Retry a failed request once on `401` with a fresh token

Estimated ~80–120 lines of new logic in `chat-client.ts` plus additions to `types.ts`.

**WebSocket** — no browser constraint. Since the SDK runs server-side (Node.js), it can set `Authorization` headers on the WebSocket upgrade request directly. The awkward query-param workaround from Authorization Code flow is not needed.

### Effort Summary

| Layer | Effort |
|---|---|
| `mta.yaml` + `xs-security.json` | Small |
| Backend JWT middleware | Medium (same as Auth Code) |
| WebSocket auth | Simple (Node.js sets headers directly) |
| SDK token acquisition | Moderate (new, built into SDK) |
| SDK token caching / refresh | Moderate (new logic) |

---

## Side-by-Side Comparison

| Layer | Authorization Code | Client Credentials |
|---|---|---|
| AppRouter config | Medium (redirect flow setup) | Trivial (`forwardAuthToken: true`) |
| `xs-security.json` | Add grant type | Same |
| Backend JWT middleware | Medium (new, same for both) | Same |
| WebSocket auth | Tricky (browser header limitation) | Simple (Node.js sets headers directly) |
| SDK token acquisition | None (consumer's responsibility) | Moderate (built into SDK) |
| SDK token caching / refresh | None | Moderate (new logic needed) |

**Net:** Client credentials is simpler end-to-end except the SDK needs to grow token management logic that Authorization Code flow doesn't require.
