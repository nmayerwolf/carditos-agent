import { logger } from '../lib/logger.js';
import { chat } from './claude.js';
import { storeMessage } from './conversations.js';
import type { Message as DbMessage } from '../lib/types.js';

export interface ConversationContext {
  conversationId: string;
  userId: string;
  recentMessages: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export async function processUserQuery(
  query: string,
  context: ConversationContext,
): Promise<{ response: string; latencyMs: number }> {
  try {
    const startTime = Date.now();

    // Get Claude response with RAG
    const response = await chat(query, {
      conversationHistory: context.recentMessages,
      maxContextMessages: 10,
    });

    const latencyMs = Date.now() - startTime;

    // Store outbound message
    await storeMessage(context.conversationId, context.userId, 'outbound', response);

    logger.info(
      {
        latencyMs,
        queryLength: query.length,
        responseLength: response.length,
      },
      'Query processed',
    );

    return { response, latencyMs };
  } catch (err) {
    logger.error(err, 'Failed to process query');
    throw err;
  }
}

export function getConversationContext(
  conversationMessages: DbMessage[],
): Array<{ role: 'user' | 'assistant'; content: string }> {
  return conversationMessages.map((msg) => ({
    role: msg.direction === 'inbound' ? 'user' : 'assistant',
    content: msg.content,
  }));
}
