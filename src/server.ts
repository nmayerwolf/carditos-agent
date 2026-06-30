import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import { logger } from './lib/logger.js';
import { AppError } from './lib/errors.js';
import { healthHandler } from './routes/health.js';
import { whatsappWebhookHandler, whatsappWebhookVerify } from './routes/webhooks.js';
import { chatHandler } from './routes/chat.js';
import {
  adminPanelHandler,
  adminListUsersHandler,
  adminListMessagesHandler,
  adminApproveHandler,
  adminRejectHandler,
  adminUpdateUserHandler,
  adminDeleteUserHandler,
} from './routes/admin.js';

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Routes
app.get('/api/health', healthHandler);

// Chat endpoint (for testing)
app.post('/api/chat', chatHandler);

// WhatsApp webhooks
app.get('/webhooks/whatsapp', whatsappWebhookVerify);
app.post('/webhooks/whatsapp', whatsappWebhookHandler);

// Admin panel
app.get('/admin', adminPanelHandler);
app.get('/admin/users', adminListUsersHandler);
app.get('/admin/messages', adminListMessagesHandler);
app.post('/admin/users/:id/approve', adminApproveHandler);
app.post('/admin/users/:id/reject', adminRejectHandler);
app.put('/admin/users/:id', adminUpdateUserHandler);
app.delete('/admin/users/:id', adminDeleteUserHandler);

// 404
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: Error, req: Request, res: Response) => {
  if (err instanceof AppError) {
    logger.warn({ statusCode: err.statusCode, code: err.code }, err.message);
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
    });
  }

  logger.error(err, 'Unhandled error');
  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
  });
});

// Start server
app.listen(port, () => {
  logger.info(`Server running on port ${port}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
