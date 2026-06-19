export interface User {
  id: string;
  phoneNumber: string;
  name?: string;
  clubRole: 'coach_infantil' | 'coach_juvenil' | 'admin';
  createdAt: Date;
  updatedAt: Date;
}

export interface Conversation {
  id: string;
  userId: string;
  whatsappConversationId?: string;
  startedAt: Date;
  endedAt?: Date;
}

export interface Message {
  id: string;
  conversationId: string;
  userId: string;
  direction: 'inbound' | 'outbound';
  content: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'audio' | 'document' | 'video';
  tokensUsed?: number;
  latencyMs?: number;
  createdAt: Date;
}

export interface WhatsAppWebhookPayload {
  entry: Array<{
    id: string;
    changes: Array<{
      field: string;
      value: {
        messaging_product: string;
        metadata: {
          phone_number_id: string;
          display_phone_number: string;
        };
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          type: 'text' | 'image' | 'audio' | 'document';
          text?: { body: string };
          image?: { link: string };
          audio?: { link: string };
          document?: { link: string };
        }>;
        statuses?: Array<{
          id: string;
          status: 'delivered' | 'read' | 'failed';
          timestamp: string;
        }>;
      };
    }>;
  }>;
}

export interface ChatRequest {
  userId: string;
  conversationId: string;
  message: string;
  mediaUrl?: string;
}

export interface ChatResponse {
  status: 'success' | 'error';
  response?: string;
  latencyMs?: number;
  tokensUsed?: number;
  cachedTokens?: number;
  conversationId: string;
  error?: string;
}
