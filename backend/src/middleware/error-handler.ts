import type { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger.js';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  logger.error('Unhandled request error', {
    requestId: req.requestId,
    method: req.method,
    url: req.url,
    error: err.message,
    stack: err.stack,
  });
  res.status(500).json({ error: 'Internal server error', requestId: req.requestId });
}
