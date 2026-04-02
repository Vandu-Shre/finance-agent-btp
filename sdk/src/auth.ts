/**
 * XSUAA Authorization Code flow helpers.
 *
 * Use this when the SDK is consumed outside of an SAP approuter — e.g. a
 * standalone Node.js service, a different BTP app, or a custom frontend.
 * The approuter handles this flow automatically when it is present; these
 * helpers let you replicate it yourself.
 *
 * Typical usage:
 *  1. Redirect the user to `getAuthorizationUrl(config, state)`.
 *  2. XSUAA redirects back to your redirectUri with ?code=... and ?state=...
 *  3. Call `exchangeCodeForToken(code, config)` to get access + refresh tokens.
 *  4. Pass `tokenSet.accessToken` as `authToken` in FinanceAgentConfig.
 *  5. When the access token expires, call `refreshAccessToken(refreshToken, config)`.
 */

/**
 * Shape of a single XSUAA service binding entry as found in VCAP_SERVICES.
 */
export interface XsuaaServiceBinding {
  credentials: {
    clientid: string;
    clientsecret: string;
    /** Base OAuth2 server URL, e.g. https://subdomain.authentication.eu10.hana.ondemand.com */
    url: string;
  };
}

/**
 * Configuration for the XSUAA Authorization Code flow.
 */
export interface XsuaaAuthCodeConfig {
  /** OAuth2 client ID (`credentials.clientid` from the XSUAA binding) */
  clientId: string;
  /** OAuth2 client secret (`credentials.clientsecret` from the XSUAA binding) */
  clientSecret: string;
  /** Authorization endpoint, e.g. `{binding.url}/oauth/authorize` */
  authorizationUrl: string;
  /** Token endpoint, e.g. `{binding.url}/oauth/token` */
  tokenUrl: string;
  /**
   * Redirect URI registered in xs-security.json oauth2-configuration.redirect-uris.
   * Must match exactly what XSUAA has on record.
   */
  redirectUri: string;
  /**
   * OAuth2 scopes to request.
   * Defaults to `['openid']`. Add your app scope, e.g. `['openid', 'finance-agent!t123.user']`.
   */
  scopes?: string[];
}

/** Access + refresh token pair returned after a successful token exchange or refresh */
export interface XsuaaTokenSet {
  accessToken: string;
  refreshToken?: string;
  /** Lifetime of the access token in seconds */
  expiresIn: number;
  tokenType: string;
}

/**
 * Convert a raw XSUAA service binding (from VCAP_SERVICES) into an
 * `XsuaaAuthCodeConfig`. You still need to provide `redirectUri` since
 * it is application-specific and not part of the binding.
 *
 * @example
 * const vcap = JSON.parse(process.env.VCAP_SERVICES ?? '{}');
 * const config = xsuaaConfigFromBinding(vcap['xsuaa'][0], 'https://myapp.example.com/callback');
 */
export function xsuaaConfigFromBinding(
  binding: XsuaaServiceBinding,
  redirectUri: string,
  scopes?: string[]
): XsuaaAuthCodeConfig {
  const baseUrl = binding.credentials.url.replace(/\/$/, '');
  return {
    clientId: binding.credentials.clientid,
    clientSecret: binding.credentials.clientsecret,
    authorizationUrl: `${baseUrl}/oauth/authorize`,
    tokenUrl: `${baseUrl}/oauth/token`,
    redirectUri,
    scopes,
  };
}

/**
 * Build the XSUAA login URL to redirect the user to.
 *
 * Store `state` in the user's session before redirecting; verify it matches
 * when XSUAA calls your redirect URI to prevent CSRF attacks.
 *
 * @param config - Authorization code flow configuration
 * @param state  - Opaque string you generate and later verify (recommended)
 * @returns Full authorization URL
 */
export function getAuthorizationUrl(config: XsuaaAuthCodeConfig, state?: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: (config.scopes ?? ['openid']).join(' '),
  });
  if (state) params.set('state', state);
  return `${config.authorizationUrl}?${params.toString()}`;
}

/**
 * Exchange an authorization code (received at your redirect URI) for tokens.
 *
 * @param code   - The `code` query parameter from the XSUAA redirect
 * @param config - Authorization code flow configuration
 * @returns Token set containing access token (and refresh token if issued)
 */
export async function exchangeCodeForToken(
  code: string,
  config: XsuaaAuthCodeConfig
): Promise<XsuaaTokenSet> {
  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${config.clientId}:${config.clientSecret}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.redirectUri,
    }).toString(),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Token exchange failed (${response.status}): ${body}`);
  }

  return parseTokenResponse(await response.json());
}

/**
 * Refresh an expired access token using the refresh token from a previous
 * `exchangeCodeForToken` call.
 *
 * XSUAA may issue a new refresh token in the response; always use the
 * returned `refreshToken` for subsequent refreshes.
 *
 * @param refreshToken - Refresh token from the previous XsuaaTokenSet
 * @param config       - Needs only clientId, clientSecret, and tokenUrl
 */
export async function refreshAccessToken(
  refreshToken: string,
  config: Pick<XsuaaAuthCodeConfig, 'clientId' | 'clientSecret' | 'tokenUrl'>
): Promise<XsuaaTokenSet> {
  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${config.clientId}:${config.clientSecret}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Token refresh failed (${response.status}): ${body}`);
  }

  const data = await response.json();
  return {
    ...parseTokenResponse(data),
    // XSUAA may or may not issue a new refresh token; keep the old one if not
    refreshToken: (data.refresh_token as string | undefined) ?? refreshToken,
  };
}

function parseTokenResponse(data: Record<string, unknown>): XsuaaTokenSet {
  return {
    accessToken: data['access_token'] as string,
    refreshToken: data['refresh_token'] as string | undefined,
    expiresIn: data['expires_in'] as number,
    tokenType: data['token_type'] as string,
  };
}
