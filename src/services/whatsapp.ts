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
        Authorization: `Bearer ${KAPSO_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async sendMessage(toPhoneNumber: string, message: string): Promise<string> {
    try {
      const response = await this.client.post(`/${KAPSO_PHONE_NUMBER_ID}/messages`, {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: toPhoneNumber,
        type: 'text',
        text: {
          body: message,
        },
      });

      const messageId = response.data?.messages?.[0]?.id;
      logger.info({ to: toPhoneNumber, messageId }, 'Message sent');
      return messageId;
    } catch (err) {
      logger.error(err, 'Failed to send message');
      throw err;
    }
  }
}

export const kapsoClient = new KapsoClient();
