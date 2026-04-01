import {
  getAuthorizationUrl,
  exchangeCodeForToken,
  refreshAccessToken,
  xsuaaConfigFromBinding,
} from '../auth.js';
import type { XsuaaAuthCodeConfig, XsuaaServiceBinding } from '../auth.js';

const mockFetch = jest.fn();
global.fetch = mockFetch;

// Minimal valid btoa polyfill for Node test env (Node 18+ has it globally, but jest may not)
if (typeof globalThis.btoa === 'undefined') {
  globalThis.btoa = (s: string) => Buffer.from(s, 'binary').toString('base64');
}

const config: XsuaaAuthCodeConfig = {
  clientId: 'sb-finance-agent!t123',
  clientSecret: 'my-secret',
  authorizationUrl: 'https://subdomain.authentication.eu10.hana.ondemand.com/oauth/authorize',
  tokenUrl: 'https://subdomain.authentication.eu10.hana.ondemand.com/oauth/token',
  redirectUri: 'https://myapp.example.com/callback',
  scopes: ['openid', 'finance-agent!t123.user'],
};

describe('xsuaaConfigFromBinding', () => {
  const binding: XsuaaServiceBinding = {
    credentials: {
      clientid: 'sb-finance-agent!t123',
      clientsecret: 'my-secret',
      url: 'https://subdomain.authentication.eu10.hana.ondemand.com',
    },
  };

  it('should derive authorizationUrl and tokenUrl from binding url', () => {
    const result = xsuaaConfigFromBinding(binding, 'https://myapp.example.com/callback');

    expect(result.authorizationUrl).toBe(
      'https://subdomain.authentication.eu10.hana.ondemand.com/oauth/authorize'
    );
    expect(result.tokenUrl).toBe(
      'https://subdomain.authentication.eu10.hana.ondemand.com/oauth/token'
    );
  });

  it('should map clientId and clientSecret from binding', () => {
    const result = xsuaaConfigFromBinding(binding, 'https://myapp.example.com/callback');

    expect(result.clientId).toBe('sb-finance-agent!t123');
    expect(result.clientSecret).toBe('my-secret');
    expect(result.redirectUri).toBe('https://myapp.example.com/callback');
  });

  it('should strip trailing slash from binding url', () => {
    const bindingWithSlash: XsuaaServiceBinding = {
      credentials: { ...binding.credentials, url: binding.credentials.url + '/' },
    };
    const result = xsuaaConfigFromBinding(bindingWithSlash, 'https://myapp.example.com/callback');

    expect(result.tokenUrl).not.toContain('//oauth');
  });

  it('should forward optional scopes', () => {
    const result = xsuaaConfigFromBinding(binding, 'https://myapp.example.com/callback', [
      'openid',
      'finance-agent!t123.user',
    ]);

    expect(result.scopes).toEqual(['openid', 'finance-agent!t123.user']);
  });
});

describe('getAuthorizationUrl', () => {
  it('should include required OAuth2 parameters', () => {
    const url = new URL(getAuthorizationUrl(config));

    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('client_id')).toBe(config.clientId);
    expect(url.searchParams.get('redirect_uri')).toBe(config.redirectUri);
  });

  it('should include scopes joined by space', () => {
    const url = new URL(getAuthorizationUrl(config));

    expect(url.searchParams.get('scope')).toBe('openid finance-agent!t123.user');
  });

  it('should default scope to openid when no scopes configured', () => {
    const { scopes: _, ...configWithoutScopes } = config;
    const url = new URL(getAuthorizationUrl(configWithoutScopes));

    expect(url.searchParams.get('scope')).toBe('openid');
  });

  it('should include state when provided', () => {
    const url = new URL(getAuthorizationUrl(config, 'random-csrf-state'));

    expect(url.searchParams.get('state')).toBe('random-csrf-state');
  });

  it('should omit state when not provided', () => {
    const url = new URL(getAuthorizationUrl(config));

    expect(url.searchParams.has('state')).toBe(false);
  });
});

describe('exchangeCodeForToken', () => {
  beforeEach(() => mockFetch.mockReset());

  const successResponse = {
    access_token: 'eyJhbGciOiJSUzI1NiJ9.access',
    refresh_token: 'eyJhbGciOiJSUzI1NiJ9.refresh',
    expires_in: 43199,
    token_type: 'bearer',
  };

  it('should POST to tokenUrl with authorization_code grant', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => successResponse });

    await exchangeCodeForToken('auth-code-abc', config);

    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(config.tokenUrl);
    expect(options.method).toBe('POST');
    expect((options.body as string)).toContain('grant_type=authorization_code');
    expect((options.body as string)).toContain('code=auth-code-abc');
    expect((options.body as string)).toContain(encodeURIComponent(config.redirectUri));
  });

  it('should send Basic auth header', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => successResponse });

    await exchangeCodeForToken('auth-code-abc', config);

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    const expectedBasic = btoa(`${config.clientId}:${config.clientSecret}`);
    expect(headers['Authorization']).toBe(`Basic ${expectedBasic}`);
  });

  it('should return a mapped XsuaaTokenSet', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => successResponse });

    const result = await exchangeCodeForToken('auth-code-abc', config);

    expect(result).toEqual({
      accessToken: successResponse.access_token,
      refreshToken: successResponse.refresh_token,
      expiresIn: successResponse.expires_in,
      tokenType: successResponse.token_type,
    });
  });

  it('should throw on non-ok response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => '{"error":"invalid_grant"}',
    });

    await expect(exchangeCodeForToken('bad-code', config)).rejects.toThrow(
      'Token exchange failed (400)'
    );
  });
});

describe('refreshAccessToken', () => {
  beforeEach(() => mockFetch.mockReset());

  const refreshResponse = {
    access_token: 'eyJhbGciOiJSUzI1NiJ9.new-access',
    refresh_token: 'eyJhbGciOiJSUzI1NiJ9.new-refresh',
    expires_in: 43199,
    token_type: 'bearer',
  };

  it('should POST to tokenUrl with refresh_token grant', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => refreshResponse });

    await refreshAccessToken('old-refresh-token', config);

    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(config.tokenUrl);
    expect((options.body as string)).toContain('grant_type=refresh_token');
    expect((options.body as string)).toContain('refresh_token=old-refresh-token');
  });

  it('should return the new token set', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => refreshResponse });

    const result = await refreshAccessToken('old-refresh-token', config);

    expect(result.accessToken).toBe(refreshResponse.access_token);
    expect(result.refreshToken).toBe(refreshResponse.refresh_token);
  });

  it('should keep the old refresh token when XSUAA does not issue a new one', async () => {
    const { refresh_token: _, ...responseWithoutRefresh } = refreshResponse;
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => responseWithoutRefresh,
    });

    const result = await refreshAccessToken('old-refresh-token', config);

    expect(result.refreshToken).toBe('old-refresh-token');
  });

  it('should throw on non-ok response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => '{"error":"invalid_token"}',
    });

    await expect(refreshAccessToken('expired-token', config)).rejects.toThrow(
      'Token refresh failed (401)'
    );
  });
});
