import { Request, Response } from 'express';
import { logger } from '../lib/logger.js';

export async function healthHandler(req: Request, res: Response) {
  try {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  } catch (err) {
    logger.error(err, 'Health check failed');
    res.status(500).json({ status: 'error' });
  }
}
