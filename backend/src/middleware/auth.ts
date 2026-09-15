import { Request, Response, NextFunction } from 'express';
import { importSPKI, jwtVerify } from 'jose';
import { logger } from '../lib/logger.js';

export interface XsuaaUser {
  sub: string;
  email?: string;
  given_name?: string;
  family_name?: string;
  user_name?: string;
  scopes: string[];
  zid?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: XsuaaUser;
    }
  }
}

interface XsuaaCredentials {
  clientid: string;
  url: string;
  verificationkey: string;
  xsappname: string;
}

function readXsuaaCredentials(): XsuaaCredentials | null {
  const vcap = process.env.VCAP_SERVICES;
  if (!vcap) return null;

  try {
    const services = JSON.parse(vcap) as Record<string, Array<{ credentials: XsuaaCredentials }>>;
    const instances = services['xsuaa'];
    if (!instances?.length) return null;
    return instances[0]?.credentials ?? null;
  } catch {
    return null;
  }
}

// Cache the imported public key so we only parse it once
let _cachedKey: Awaited<ReturnType<typeof importSPKI>> | null = null;
let _cachedXsappname: string | null = null;

async function getVerificationKey(): Promise<{ key: Awaited<ReturnType<typeof importSPKI>>; xsappname: string } | null> {
  if (_cachedKey && _cachedXsappname) {
    return { key: _cachedKey, xsappname: _cachedXsappname };
  }

  const creds = readXsuaaCredentials();
  if (!creds?.verificationkey) return null;

  _cachedKey = await importSPKI(creds.verificationkey, 'RS256');
  _cachedXsappname = creds.xsappname;
  return { key: _cachedKey, xsappname: _cachedXsappname };
}

/**
 * Express middleware that enforces the app-level scope (`<xsappname>.user`).
 * Must be used after xsuaaAuth (which populates req.user and the cached xsappname).
 *
 * - No XSUAA binding (dev mode): dev-user bypasses the check.
 * - Deployed: user must have the `<xsappname>.user` scope in their token.
 */
export async function requireAppAccess(req: Request, res: Response, next: NextFunction): Promise<void> {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: 'Unauthenticated' });
    return;
  }
  // Dev mode bypass
  if (user.sub === 'dev-user') {
    next();
    return;
  }
  // Use the xsappname cached by xsuaaAuth's getVerificationKey call
  const requiredScope = _cachedXsappname ? `${_cachedXsappname}.user` : null;
  if (!requiredScope || user.scopes.includes(requiredScope)) {
    next();
    return;
  }
  res.status(403).json({ error: 'Insufficient permissions' });
}

/**
 * Express middleware that validates XSUAA JWT tokens.
 *
 * - Deployed (VCAP_SERVICES present): requires a valid Bearer token.
 * - Local development (no VCAP_SERVICES xsuaa binding): attaches a dev user
 *   and skips validation so the app can run without a BTP service instance.
 */
export async function xsuaaAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  let keyInfo: Awaited<ReturnType<typeof getVerificationKey>>;
  try {
    keyInfo = await getVerificationKey();
  } catch (err) {
    logger.error('Failed to load XSUAA verification key', { error: (err as Error).message });
    res.status(500).json({ error: 'Authentication service unavailable' });
    return;
  }

  // No XSUAA binding → local dev, attach a mock user and continue
  if (!keyInfo) {
    req.user = {
      sub: 'dev-user',
      email: 'dev@localhost',
      given_name: 'Dev',
      family_name: 'User',
      user_name: 'dev@localhost',
      scopes: [],
    };
    return next();
  }

  const authHeader = req.headers['authorization'];
  if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const { payload } = await jwtVerify(token, keyInfo.key, { algorithms: ['RS256'] });

    const rawScope = payload['scope'];
    const scopes = Array.isArray(rawScope)
      ? rawScope.map(String)
      : typeof rawScope === 'string'
        ? rawScope.split(' ')
        : [];

    const user: XsuaaUser = { sub: payload.sub ?? '', scopes };
    const email = payload['email'];
    const given_name = payload['given_name'];
    const family_name = payload['family_name'];
    const user_name = payload['user_name'];
    const zid = payload['zid'];
    if (typeof email === 'string') user.email = email;
    if (typeof given_name === 'string') user.given_name = given_name;
    if (typeof family_name === 'string') user.family_name = family_name;
    if (typeof user_name === 'string') user.user_name = user_name;
    if (typeof zid === 'string') user.zid = zid;
    req.user = user;

    next();
  } catch (err) {
    logger.error('JWT validation failed', { error: (err as Error).message });
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
