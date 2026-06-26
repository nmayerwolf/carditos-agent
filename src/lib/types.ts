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

export interface KapsoWebhookPayload {
  message?: {
    id: string;
    from: string;
    type: 'text' | 'image' | 'audio' | 'document' | 'video';
    text?: { body: string };
    audio?: { id: string; mime_type?: string };
    kapso?: {
      direction: 'inbound' | 'outbound';
      content: string;
      has_media: boolean;
    };
    timestamp: string;
  };
  conversation?: {
    id: string;
    phone_number: string;
    contact_name?: string;
  };
  phone_number_id?: string;
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
