import { Request, Response } from 'express';
import { logger } from '../lib/logger.js';
import {
  getOrCreateUser,
  getOrCreateConversation,
  storeMessage,
} from '../services/conversations.js';
import { kapsoClient } from '../services/whatsapp.js';
import type { WhatsAppWebhookPayload } from '../lib/types.js';

export async function whatsappWebhookHandler(req: Request, res: Response) {
  try {
    const body = req.body as WhatsAppWebhookPayload;

    logger.info({ changes: body.entry?.[0]?.changes?.length }, 'Received WhatsApp webhook');

    // Extract messages from webhook
    if (!body.entry?.[0]?.changes?.[0]?.value?.messages) {
      return res.json({ status: 'received' });
    }

    const messages = body.entry[0].changes[0].value.messages;

    for (const msg of messages) {
      try {
        const phoneNumber = msg.from;
        const messageContent = msg.text?.body || `[${msg.type}]`;

        logger.info({ from: phoneNumber, type: msg.type }, 'Processing inbound message');

        // Get or create user
        const user = await getOrCreateUser(phoneNumber);

        // Get or create conversation
        const conversation = await getOrCreateConversation(user.id);

        // Store inbound message
        await storeMessage(conversation.id, user.id, 'inbound', messageContent);

        // Send echo response for now (TODO: integrate Claude)
        const responseText = `Echo: ${messageContent}`;
        await kapsoClient.sendMessage(phoneNumber, responseText);

        // Store outbound message
        await storeMessage(conversation.id, user.id, 'outbound', responseText);
      } catch (msgErr) {
        logger.error(msgErr, 'Error processing individual message');
        // Continue processing other messages
      }
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
