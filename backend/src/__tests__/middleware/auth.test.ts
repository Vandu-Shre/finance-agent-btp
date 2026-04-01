jest.mock('jose', () => ({
  importSPKI: jest.fn(),
  jwtVerify: jest.fn(),
}));

import { importSPKI, jwtVerify } from 'jose';
import { xsuaaAuth } from '../../middleware/auth.js';
import type { Request, Response, NextFunction } from 'express';

const mockImportSPKI = importSPKI as jest.Mock;
const mockJwtVerify = jwtVerify as jest.Mock;

function makeReq(headers: Record<string, string> = {}): Request {
  return { headers } as unknown as Request;
}

function makeRes(): { res: Response; status: jest.Mock; json: jest.Mock } {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const res = { status, json } as unknown as Response;
  return { res, status, json };
}

const VALID_VCAP = JSON.stringify({
  xsuaa: [
    {
      credentials: {
        clientid: 'test-client',
        url: 'https://tenant.authentication.sap.hana.ondemand.com',
        verificationkey: '-----BEGIN PUBLIC KEY-----\ntest-key\n-----END PUBLIC KEY-----',
        xsappname: 'test-app',
      },
    },
  ],
});

/**
 * NOTE: auth.ts caches the imported public key in module-level variables
 * (_cachedKey, _cachedXsappname). Tests are ordered so that:
 *   1. Dev-mode tests run first → cache stays null (no VCAP_SERVICES / no xsuaa binding)
 *   2. Key-loading-failure test runs before any test that successfully loads a key
 *   3. Deployed-mode tests run last – cache is populated after the first successful call
 *      and remains set, but all tests in that group mock jwtVerify explicitly so they
 *      are unaffected by the cached key value.
 */
describe('xsuaaAuth middleware', () => {
  const origVcap = process.env.VCAP_SERVICES;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.VCAP_SERVICES;
  });

  afterAll(() => {
    if (origVcap !== undefined) {
      process.env.VCAP_SERVICES = origVcap;
    } else {
      delete process.env.VCAP_SERVICES;
    }
  });

  // ─── 1. Dev mode (runs before anything sets the cache) ──────────────────────

  describe('Dev mode (no xsuaa binding)', () => {
    it('attaches a dev user and calls next() when VCAP_SERVICES is absent', async () => {
      const req = makeReq();
      const { res } = makeRes();
      const next: NextFunction = jest.fn();

      await xsuaaAuth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect((req as any).user).toMatchObject({
        sub: 'dev-user',
        email: 'dev@localhost',
        given_name: 'Dev',
        family_name: 'User',
        user_name: 'dev@localhost',
        scopes: [],
      });
    });

    it('does not send any HTTP response in dev mode', async () => {
      const req = makeReq();
      const { res, status } = makeRes();
      const next: NextFunction = jest.fn();

      await xsuaaAuth(req, res, next);

      expect(status).not.toHaveBeenCalled();
    });

    it('falls back to dev mode when VCAP_SERVICES JSON is malformed', async () => {
      process.env.VCAP_SERVICES = 'not-valid-json{';
      const req = makeReq();
      const { res } = makeRes();
      const next: NextFunction = jest.fn();

      await xsuaaAuth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect((req as any).user?.sub).toBe('dev-user');
    });

    it('falls back to dev mode when VCAP_SERVICES has no xsuaa binding', async () => {
      process.env.VCAP_SERVICES = JSON.stringify({ 'postgresql-db': [] });
      const req = makeReq();
      const { res } = makeRes();
      const next: NextFunction = jest.fn();

      await xsuaaAuth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect((req as any).user?.sub).toBe('dev-user');
    });
  });

  // ─── 2. Key-loading failure (must run before cache is populated) ─────────────

  describe('Key loading failure', () => {
    it('returns 500 when importSPKI throws', async () => {
      process.env.VCAP_SERVICES = VALID_VCAP;
      mockImportSPKI.mockRejectedValue(new Error('invalid key format'));
      jest.spyOn(console, 'error').mockImplementation(() => {});

      const req = makeReq({ authorization: 'Bearer some.token' });
      const { res, status, json } = makeRes();
      const next: NextFunction = jest.fn();

      await xsuaaAuth(req, res, next);

      expect(status).toHaveBeenCalledWith(500);
      expect(json).toHaveBeenCalledWith({ error: 'Authentication service unavailable' });
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ─── 3. Deployed mode (cache is populated after the first passing test) ──────

  describe('Deployed mode', () => {
    const mockKey = { type: 'CryptoKey', algorithm: { name: 'RSASSA-PKCS1-v1_5' } };

    beforeEach(() => {
      process.env.VCAP_SERVICES = VALID_VCAP;
      mockImportSPKI.mockResolvedValue(mockKey);
    });

    it('returns 401 when Authorization header is missing', async () => {
      const req = makeReq({});
      const { res, status, json } = makeRes();
      const next: NextFunction = jest.fn();

      await xsuaaAuth(req, res, next);

      expect(status).toHaveBeenCalledWith(401);
      expect(json).toHaveBeenCalledWith({ error: 'Missing or invalid Authorization header' });
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 401 when Authorization scheme is not Bearer', async () => {
      const req = makeReq({ authorization: 'Basic dXNlcjpwYXNz' });
      const { res, status, json } = makeRes();
      const next: NextFunction = jest.fn();

      await xsuaaAuth(req, res, next);

      expect(status).toHaveBeenCalledWith(401);
      expect(json).toHaveBeenCalledWith({ error: 'Missing or invalid Authorization header' });
    });

    it('returns 401 when JWT verification fails', async () => {
      mockJwtVerify.mockRejectedValue(new Error('JWTExpired'));
      jest.spyOn(console, 'error').mockImplementation(() => {});

      const req = makeReq({ authorization: 'Bearer expired.token.here' });
      const { res, status, json } = makeRes();
      const next: NextFunction = jest.fn();

      await xsuaaAuth(req, res, next);

      expect(status).toHaveBeenCalledWith(401);
      expect(json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
      expect(next).not.toHaveBeenCalled();
    });

    it('attaches full user profile and calls next() for a valid JWT', async () => {
      mockJwtVerify.mockResolvedValue({
        payload: {
          sub: 'user-abc',
          email: 'alice@example.com',
          given_name: 'Alice',
          family_name: 'Smith',
          user_name: 'alice@example.com',
          zid: 'zone-42',
          scope: ['finance-agent.read', 'finance-agent.write'],
        },
      });

      const req = makeReq({ authorization: 'Bearer valid.jwt.token' });
      const { res } = makeRes();
      const next: NextFunction = jest.fn();

      await xsuaaAuth(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect((req as any).user).toEqual({
        sub: 'user-abc',
        email: 'alice@example.com',
        given_name: 'Alice',
        family_name: 'Smith',
        user_name: 'alice@example.com',
        zid: 'zone-42',
        scopes: ['finance-agent.read', 'finance-agent.write'],
      });
    });

    it('parses space-separated scope string into an array', async () => {
      mockJwtVerify.mockResolvedValue({
        payload: { sub: 'u1', scope: 'openid profile email' },
      });

      const req = makeReq({ authorization: 'Bearer tok' });
      const { res } = makeRes();
      const next: NextFunction = jest.fn();

      await xsuaaAuth(req, res, next);

      expect((req as any).user?.scopes).toEqual(['openid', 'profile', 'email']);
    });

    it('handles array scope claim', async () => {
      mockJwtVerify.mockResolvedValue({
        payload: { sub: 'u1', scope: ['read', 'write'] },
      });

      const req = makeReq({ authorization: 'Bearer tok' });
      const { res } = makeRes();
      const next: NextFunction = jest.fn();

      await xsuaaAuth(req, res, next);

      expect((req as any).user?.scopes).toEqual(['read', 'write']);
    });

    it('produces empty scopes when scope claim is absent', async () => {
      mockJwtVerify.mockResolvedValue({
        payload: { sub: 'u1' },
      });

      const req = makeReq({ authorization: 'Bearer tok' });
      const { res } = makeRes();
      const next: NextFunction = jest.fn();

      await xsuaaAuth(req, res, next);

      expect((req as any).user?.scopes).toEqual([]);
    });

    it('omits optional user fields that are absent from the token payload', async () => {
      mockJwtVerify.mockResolvedValue({
        payload: { sub: 'minimal-user' },
      });

      const req = makeReq({ authorization: 'Bearer tok' });
      const { res } = makeRes();
      const next: NextFunction = jest.fn();

      await xsuaaAuth(req, res, next);

      const user = (req as any).user;
      expect(user.sub).toBe('minimal-user');
      expect(user.email).toBeUndefined();
      expect(user.given_name).toBeUndefined();
      expect(user.family_name).toBeUndefined();
      expect(user.zid).toBeUndefined();
    });
  });
});
