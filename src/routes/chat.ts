import { Request, Response } from 'express';
import { logger } from '../lib/logger.js';
import {
  getOrCreateUser,
  getOrCreateConversation,
  storeMessage,
} from '../services/conversations.js';
import { processUserQuery, getConversationContext } from '../services/orchestrator.js';
import { supabase } from '../db/client.js';
import { InternalError, ValidationError } from '../lib/errors.js';

export async function chatHandler(req: Request, res: Response) {
  try {
    const { userId, phoneNumber, message } = req.body;

    // Validate input
    if (!message) {
      throw new ValidationError('message is required');
    }

    if (!userId && !phoneNumber) {
      throw new ValidationError('userId or phoneNumber is required');
    }

    let user;
    if (userId) {
      const { data: userData, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error || !userData) {
        throw new ValidationError('User not found');
      }
      user = userData;
    } else if (phoneNumber) {
      user = await getOrCreateUser(phoneNumber);
    } else {
      throw new InternalError('No user identifier');
    }

    // Get or create conversation
    const conversation = await getOrCreateConversation(user.id);

    // Store inbound message
    await storeMessage(conversation.id, user.id, 'inbound', message);

    // Get recent messages for context
    const { data: recentMessages, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (messagesError) {
      logger.error(messagesError, 'Failed to fetch messages');
    }

    const conversationHistory = getConversationContext(recentMessages || []).reverse();

    // Process query with Claude
    const { response, latencyMs } = await processUserQuery(message, {
      conversationId: conversation.id,
      userId: user.id,
      recentMessages: conversationHistory,
    });

    logger.info({ userId: user.id, latencyMs }, 'Chat request processed');

    res.json({
      status: 'success',
      response,
      latencyMs,
      conversationId: conversation.id,
      userId: user.id,
    });
  } catch (err) {
    logger.error(err, 'Chat handler error');

    if (err instanceof ValidationError) {
      return res.status(400).json({
        status: 'error',
        error: err.message,
        code: err.code,
      });
    }

    res.status(500).json({
      status: 'error',
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}
