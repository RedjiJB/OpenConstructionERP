// New, purpose-built feature -- no vendored contract to match (the old
// erp-chat feature this replaced talked to OpenConstructionERP's own
// backend and was removed in the pruning pass; see AppLayout.tsx's
// comment for why it wasn't just re-pointed at this endpoint instead).
import { apiPost } from '@/shared/lib/api';

export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatTurnResult {
  reply: string;
  toolCalls: { name: string; arguments: Record<string, unknown> }[];
}

export function sendChatMessage(message: string, history: ChatMessage[]): Promise<ChatTurnResult> {
  return apiPost<ChatTurnResult>('/v1/chat', { message, history });
}
