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

const WELCOME_MSG =
  'Soy Carditos, el asistente de rugby del club. Te puedo ayudar con cuatro cosas concretas:\n\n' +
  '*Reglamento y modalidades de juego* por categoría — formatos, reglas específicas de infantiles y juveniles, qué se puede y qué no según la edad.\n\n' +
  '*Ejercicios y drills* — calentamiento, técnica, planificación de sesión, juegos para entrenar tackle, ruck, pase, lo que necesites.\n\n' +
  '*Manejo del grupo* — motivación, conflictos entre chicos, cómo hablar con los padres, dinámica del vestuario.\n\n' +
  '*Decisiones de entrenamiento* — si tenés una situación concreta del partido o del entreno y querés pensar cómo encararlo, acá estamos.\n\n' +
  '¿Qué categoría entrenás?';

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

      const hasOutbound = (recentMessages || []).some((m) => m.direction === 'outbound');
      const conversationHistory = getConversationContext(recentMessages || []).reverse();

      if (!hasOutbound) {
        await storeMessage(conversation.id, user.id, 'outbound', WELCOME_MSG);
        await kapsoClient.sendMessage(phoneNumber, WELCOME_MSG);
        return;
      }

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
