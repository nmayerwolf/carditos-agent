import { supabase } from '../db/client.js';
import { logger } from '../lib/logger.js';
import type { Conversation, User, Message } from '../lib/types.js';

export async function getUserByPhone(phoneNumber: string): Promise<User | null> {
  const normalized = phoneNumber.replace(/\D/g, '');
  const { data } = await supabase
    .from('users')
    .select('*')
    .like('phone_number', `%${normalized.slice(-10)}%`)
    .limit(1)
    .maybeSingle();
  return data ? (data as User) : null;
}

export async function updateUser(
  userId: string,
  updates: Partial<Pick<User, 'name' | 'status'>>,
): Promise<void> {
  const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.status !== undefined) dbUpdates.status = updates.status;

  const { error } = await supabase.from('users').update(dbUpdates).eq('id', userId);
  if (error) {
    logger.error(error, 'Failed to update user');
    throw error;
  }
}

export async function getSuperadminPhones(): Promise<string[]> {
  const { data } = await supabase.from('superadmins').select('phone_number');
  return (data || []).map((s) => s.phone_number as string);
}

export async function getPendingUsers(): Promise<User[]> {
  const { data } = await supabase
    .from('users')
    .select('*')
    .in('status', ['pending_name', 'pending_approval'])
    .order('created_at', { ascending: true });
  return (data || []) as User[];
}

export async function getOrCreateUser(phoneNumber: string): Promise<User> {
  const { data: existingUser } = await supabase
    .from('users')
    .select('*')
    .eq('phone_number', phoneNumber)
    .single();

  if (existingUser) {
    return existingUser as User;
  }

  const { data: newUser, error } = await supabase
    .from('users')
    .insert([
      {
        phone_number: phoneNumber,
        club_role: 'coach_infantil',
      },
    ])
    .select()
    .single();

  if (error) {
    logger.error(error, 'Failed to create user');
    throw error;
  }

  return newUser as User;
}

const CONVERSATION_TTL_HOURS = 24;

export async function getOrCreateConversation(
  userId: string,
  whatsappConversationId?: string,
): Promise<Conversation> {
  const ttlCutoff = new Date(Date.now() - CONVERSATION_TTL_HOURS * 60 * 60 * 1000).toISOString();

  const { data: existingConv } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_id', userId)
    .is('ended_at', null)
    .gte('started_at', ttlCutoff)
    .order('started_at', { ascending: false })
    .limit(1)
    .single();

  if (existingConv) {
    return existingConv as Conversation;
  }

  const { data: newConv, error } = await supabase
    .from('conversations')
    .insert([
      {
        user_id: userId,
        whatsapp_conversation_id: whatsappConversationId,
      },
    ])
    .select()
    .single();

  if (error) {
    logger.error(error, 'Failed to create conversation');
    throw error;
  }

  return newConv as Conversation;
}

export async function storeMessage(
  conversationId: string,
  userId: string,
  direction: 'inbound' | 'outbound',
  content: string,
  mediaUrl?: string,
  tokensUsed?: number,
): Promise<Message> {
  const { data: message, error } = await supabase
    .from('messages')
    .insert([
      {
        conversation_id: conversationId,
        user_id: userId,
        direction,
        content,
        media_url: mediaUrl,
        tokens_used: tokensUsed ?? null,
      },
    ])
    .select()
    .single();

  if (error) {
    logger.error(error, 'Failed to store message');
    throw error;
  }

  return message as Message;
}
