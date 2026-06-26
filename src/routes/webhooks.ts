import { Request, Response } from 'express';
import { logger } from '../lib/logger.js';
import {
  getOrCreateUser,
  getOrCreateConversation,
  storeMessage,
  updateUser,
  getUserByPhone,
  getSuperadminPhones,
  getPendingUsers,
} from '../services/conversations.js';
import { kapsoClient } from '../services/whatsapp.js';
import { processUserQuery, getConversationContext } from '../services/orchestrator.js';
import { supabase } from '../db/client.js';
import { isRateLimited } from '../lib/rateLimiter.js';
import type { KapsoWebhookPayload } from '../lib/types.js';
import { WELCOME_MSG, ASK_NAME_MSG, PENDING_MSG, STILL_PENDING_MSG } from '../lib/messages.js';

const FALLBACK_ERROR_MSG = 'Tuve un problema técnico, intentá de nuevo en un momento. 🏉';

function extractMessageContent(msg: NonNullable<KapsoWebhookPayload['message']>): string | null {
  if (msg.type === 'text' && msg.text?.body) {
    return msg.text.body;
  }
  if (msg.type === 'audio') {
    const transcription = msg.kapso?.content?.trim();
    return transcription
      ? `[El usuario envió un audio. Transcripción]\n${transcription}`
      : null;
  }
  return `[${msg.type}]`;
}

async function notifySuperadmins(
  superadminPhones: string[],
  userName: string,
  userPhone: string,
): Promise<void> {
  const notification =
    `Nueva solicitud de acceso a Carditos:\n` +
    `Nombre: ${userName}\n` +
    `Tel: ${userPhone}\n\n` +
    `Respondé:\n` +
    `aprobar ${userPhone}\n` +
    `rechazar ${userPhone}`;

  for (const phone of superadminPhones) {
    try {
      await kapsoClient.sendMessage(phone, notification);
    } catch (err) {
      logger.error(err, `Failed to notify superadmin ${phone}`);
    }
  }
}

async function handleSuperadminCommand(
  command: string,
  superadminPhone: string,
): Promise<void> {
  const trimmed = command.trim().toLowerCase();
  const parts = trimmed.split(/\s+/);
  const action = parts[0];
  const targetRaw = parts.slice(1).join('');

  if (action === 'pendientes') {
    const pending = await getPendingUsers();
    if (pending.length === 0) {
      await kapsoClient.sendMessage(superadminPhone, 'No hay solicitudes pendientes.');
      return;
    }
    const list = pending
      .map((u) => `• ${u.name || '(sin nombre)'} — ${(u as unknown as Record<string, string>).phone_number} [${u.status}]`)
      .join('\n');
    await kapsoClient.sendMessage(superadminPhone, `Solicitudes pendientes:\n${list}`);
    return;
  }

  if (action === 'aprobar' || action === 'rechazar') {
    if (!targetRaw) {
      await kapsoClient.sendMessage(superadminPhone, `Uso: ${action} {telefono}`);
      return;
    }

    const user = await getUserByPhone(targetRaw);
    if (!user) {
      await kapsoClient.sendMessage(
        superadminPhone,
        `No encontré ningún usuario con ese número: ${targetRaw}`,
      );
      return;
    }

    const displayName = user.name || (user as unknown as Record<string, string>).phone_number;

    if (action === 'aprobar') {
      if (user.status === 'approved') {
        await kapsoClient.sendMessage(superadminPhone, `${displayName} ya estaba aprobado.`);
        return;
      }
      await updateUser(user.id, { status: 'approved' });
      const conversation = await getOrCreateConversation(user.id, undefined);
      await storeMessage(conversation.id, user.id, 'outbound', WELCOME_MSG);
      await kapsoClient.sendMessage((user as unknown as Record<string, string>).phone_number, WELCOME_MSG);
      await kapsoClient.sendMessage(superadminPhone, `✓ ${displayName} aprobado.`);
    } else {
      await updateUser(user.id, { status: 'rejected' });
      await kapsoClient.sendMessage(
        superadminPhone,
        `✗ ${displayName} rechazado.`,
      );
    }
    return;
  }

  // Help
  await kapsoClient.sendMessage(
    superadminPhone,
    'Comandos disponibles:\n• pendientes\n• aprobar {telefono}\n• rechazar {telefono}',
  );
}

export async function whatsappWebhookHandler(req: Request, res: Response) {
  res.json({ status: 'received' });

  try {
    const body = req.body as KapsoWebhookPayload;
    const msg = body.message;
    if (!msg || msg.kapso?.direction !== 'inbound') return;

    const phoneNumber = msg.from;

    kapsoClient.markAsRead(msg.id).catch(() => {});

    const messageContent = extractMessageContent(msg);

    // Audio sin transcripción
    if (msg.type === 'audio' && messageContent === null) {
      await kapsoClient.sendMessage(
        phoneNumber,
        'Recibí tu audio, pero todavía no puedo procesarlos. Mandame un mensaje de texto y te ayudo.',
      );
      return;
    }

    const content = messageContent ?? `[${msg.type}]`;

    // Chequear superadmin primero
    const superadminPhones = await getSuperadminPhones();
    if (superadminPhones.includes(phoneNumber)) {
      logger.info({ from: phoneNumber }, 'Superadmin command');
      await handleSuperadminCommand(content, phoneNumber);
      return;
    }

    if (isRateLimited(phoneNumber)) {
      logger.warn({ from: phoneNumber }, 'Rate limit exceeded');
      return;
    }

    try {
      const user = await getOrCreateUser(phoneNumber);
      const conversation = await getOrCreateConversation(user.id, body.conversation?.id);

      await storeMessage(conversation.id, user.id, 'inbound', content);

      const { data: recentMessages } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: false })
        .limit(20);

      const hasOutbound = (recentMessages || []).some((m) => m.direction === 'outbound');

      logger.info({ from: phoneNumber, status: user.status, type: msg.type }, 'Processing message');

      // Máquina de estados
      if (user.status === 'pending_name') {
        if (!hasOutbound) {
          await storeMessage(conversation.id, user.id, 'outbound', ASK_NAME_MSG);
          await kapsoClient.sendMessage(phoneNumber, ASK_NAME_MSG);
        } else {
          const name = content.trim().slice(0, 100);
          await updateUser(user.id, { name, status: 'pending_approval' });
          await storeMessage(conversation.id, user.id, 'outbound', PENDING_MSG);
          await kapsoClient.sendMessage(phoneNumber, PENDING_MSG);
          await notifySuperadmins(superadminPhones, name, phoneNumber);
        }
        return;
      }

      if (user.status === 'pending_approval') {
        await kapsoClient.sendMessage(phoneNumber, STILL_PENDING_MSG);
        return;
      }

      if (user.status === 'rejected') {
        return;
      }

      // approved
      if (!hasOutbound) {
        await storeMessage(conversation.id, user.id, 'outbound', WELCOME_MSG);
        await kapsoClient.sendMessage(phoneNumber, WELCOME_MSG);
        return;
      }

      const conversationHistory = getConversationContext(recentMessages || []).reverse();
      const { response } = await processUserQuery(content, {
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
        // noop
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
