import { Request, Response } from 'express';
import { logger } from '../lib/logger.js';

export async function whatsappWebhookHandler(req: Request, res: Response) {
  try {
    const body = req.body;

    // Verify webhook secret (TODO: implement signature verification)
    // const signature = req.headers['x-hub-signature-256'];
    // if (!verifySignature(signature, body)) {
    //   throw new UnauthorizedError('Invalid webhook signature');
    // }

    logger.info({ body }, 'Received WhatsApp webhook');

    // Extract messages from webhook
    if (!body.entry?.[0]?.changes?.[0]?.value?.messages) {
      return res.json({ status: 'received' });
    }

    const messages = body.entry[0].changes[0].value.messages;
    for (const msg of messages) {
      logger.info({ from: msg.from, type: msg.type }, 'Processing message');
      // TODO: Route to chat service
    }

    res.json({ status: 'received' });
  } catch (err) {
    logger.error(err, 'Webhook handler error');
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}

export async function whatsappWebhookVerify(req: Request, res: Response) {
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const verifyToken = process.env.KAPSO_WEBHOOK_VERIFY_TOKEN;
  if (!verifyToken) {
    logger.warn('KAPSO_WEBHOOK_VERIFY_TOKEN not set');
    return res.sendStatus(403);
  }

  if (token === verifyToken) {
    logger.info('Webhook verified');
    res.send(challenge);
  } else {
    logger.warn({ token }, 'Webhook verification failed');
    res.sendStatus(403);
  }
}
