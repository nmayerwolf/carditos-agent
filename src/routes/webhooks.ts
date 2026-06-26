import { Request, Response } from 'express';
import { logger } from '../lib/logger.js';
import {
  getOrCreateUser,
  getOrCreateConversation,
  storeMessage,
} from '../services/conversations.js';
import { kapsoClient } from '../services/whatsapp.js';
import { processUserQuery, getConversationContext } from '../services/orchestrator.js';
import { supabase } from '../db/client.js';
import { isRateLimited } from '../lib/rateLimiter.js';
import type { KapsoWebhookPayload } from '../lib/types.js';

const FALLBACK_ERROR_MSG = 'Tuve un problema técnico, intentá de nuevo en un momento. 🏉';

export async function whatsappWebhookHandler(req: Request, res: Response) {
  // Respond immediately — Kapso requires fast 200
  res.json({ status: 'received' });

  try {
    const body = req.body as KapsoWebhookPayload;

    // Solo procesar mensajes inbound con texto
    const msg = body.message;
    if (!msg || msg.kapso?.direction !== 'inbound') return;

    const phoneNumber = msg.from;
    const messageContent = msg.type === 'text' && msg.text?.body ? msg.text.body : `[${msg.type}]`;

    logger.info({ from: phoneNumber, type: msg.type }, 'Processing inbound message');

    kapsoClient.markAsRead(msg.id).catch(() => {});

    if (isRateLimited(phoneNumber)) {
      logger.warn({ from: phoneNumber }, 'Rate limit exceeded');
      return;
    }

    try {
      const user = await getOrCreateUser(phoneNumber);
      const conversation = await getOrCreateConversation(user.id, body.conversation?.id);

      await storeMessage(conversation.id, user.id, 'inbound', messageContent);

      const { data: recentMessages } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: false })
        .limit(20);

      const conversationHistory = getConversationContext(recentMessages || []).reverse();

      const { response } = await processUserQuery(messageContent, {
        conversationId: conversation.id,
        userId: user.id,
        recentMessages: conversationHistory,
      });

      await kapsoClient.sendMessage(phoneNumber, response);
    } catch (msgErr) {
      logger.error(msgErr, 'Error processing message');
      try {
        await kapsoClient.sendMessage(phoneNumber, FALLBACK_ERROR_MSG);
      } catch {
        // si el fallback también falla, no hay nada más que hacer
      }
    }
  } catch (err) {
    logger.error(err, 'Webhook handler error');
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
