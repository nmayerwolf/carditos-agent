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

        // Get recent messages for context
        const { data: recentMessages } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conversation.id)
          .order('created_at', { ascending: false })
          .limit(20);

        const conversationHistory = getConversationContext(recentMessages || []).reverse();

        // Process query with Claude
        const { response } = await processUserQuery(messageContent, {
          conversationId: conversation.id,
          userId: user.id,
          recentMessages: conversationHistory,
        });

        // Send response
        await kapsoClient.sendMessage(phoneNumber, response);
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
