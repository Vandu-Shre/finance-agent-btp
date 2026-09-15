import { randomUUID } from 'crypto';
import type { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const id = (req.headers['x-request-id'] as string) ?? randomUUID();
  req.requestId = id;
  res.setHeader('x-request-id', id);
  next();
}
