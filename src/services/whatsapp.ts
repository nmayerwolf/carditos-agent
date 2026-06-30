import axios, { AxiosInstance } from 'axios';
import { logger } from '../lib/logger.js';

const KAPSO_API_URL = process.env.KAPSO_API_URL || 'https://api.kapso.ai/meta/whatsapp/v24.0';
const KAPSO_API_KEY = process.env.KAPSO_API_KEY;
const KAPSO_PHONE_NUMBER_ID = process.env.KAPSO_PHONE_NUMBER_ID;

if (!KAPSO_API_KEY || !KAPSO_PHONE_NUMBER_ID) {
  logger.warn('Kapso credentials not configured');
}

class KapsoClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: KAPSO_API_URL,
      headers: {
        'X-API-Key': KAPSO_API_KEY,
        'Content-Type': 'application/json',
      },
    });
  }

  async markAsRead(messageId: string): Promise<void> {
    try {
      await this.client.post(`/${KAPSO_PHONE_NUMBER_ID}/messages`, {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      });
    } catch (err) {
      logger.warn(err, 'Failed to mark message as read');
    }
  }

  private splitMessage(message: string, limit = 4096): string[] {
    if (message.length <= limit) return [message];

    const chunks: string[] = [];
    const lines = message.split('\n');
    let current = '';

    for (const line of lines) {
      const candidate = current ? `${current}\n${line}` : line;
      if (candidate.length > limit) {
        if (current) chunks.push(current);
        // If a single line exceeds limit, hard-cut it
        current = line.length > limit ? line.slice(0, limit) : line;
      } else {
        current = candidate;
      }
    }
    if (current) chunks.push(current);
    return chunks;
  }

  async sendMessage(toPhoneNumber: string, message: string): Promise<string> {
    try {
      const chunks = this.splitMessage(message);
      let lastMessageId = '';

      for (const chunk of chunks) {
        const response = await this.client.post(`/${KAPSO_PHONE_NUMBER_ID}/messages`, {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: toPhoneNumber,
          type: 'text',
          text: { body: chunk },
        });
        lastMessageId = response.data?.messages?.[0]?.id ?? '';
      }

      logger.info(
        { to: toPhoneNumber, messageId: lastMessageId, parts: chunks.length },
        'Message sent',
      );
      return lastMessageId;
    } catch (err) {
      logger.error(err, 'Failed to send message');
      throw err;
    }
  }
}

export const kapsoClient = new KapsoClient();
