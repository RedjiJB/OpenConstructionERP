// New, purpose-built chat panel -- see api.ts's header for why this
// isn't the vendored erp-chat feature reskinned. Deliberately simple:
// plain request/response (no streaming), no markdown rendering, no
// deep-link parsing -- read-only Q&A is the whole scope of this first
// slice (see docs/ARCHITECTURE.md's chat status entry for why write
// actions are a later, separate decision).
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Send, Bot, User } from 'lucide-react';
import { sendChatMessage, type ChatMessage } from './api';
import { getErrorMessage } from '@/shared/lib/api';

interface ChatPanelProps {
  onClose: () => void;
}

export function ChatPanel({ onClose }: ChatPanelProps) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setError(null);
    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setInput('');
    setSending(true);
    try {
      const result = await sendChatMessage(text, messages);
      setMessages([...nextMessages, { role: 'assistant', content: result.reply }]);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed bottom-20 right-24 z-[90] flex h-[32rem] w-96 max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-xl border border-border bg-surface-elevated shadow-2xl">
      <div className="flex items-center justify-between border-b border-border-light px-4 py-3">
        <div className="flex items-center gap-2">
          <Bot size={16} className="text-oe-blue" />
          <span className="text-sm font-semibold text-content-primary">
            {t('chat.title', { defaultValue: 'FieldOps Assistant' })}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('common.close', { defaultValue: 'Close' })}
          className="flex h-6 w-6 items-center justify-center rounded-lg text-content-tertiary hover:bg-surface-secondary hover:text-content-primary"
        >
          <X size={15} />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <p className="text-xs text-content-tertiary">
            {t('chat.empty_hint', {
              defaultValue: 'Ask about crew, equipment, active alerts, or payroll. I can only answer questions right now -- I can’t make any changes.',
            })}
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${m.role === 'user' ? 'bg-oe-blue/10 text-oe-blue' : 'bg-oe-purple/10 text-oe-purple'}`}>
              {m.role === 'user' ? <User size={12} /> : <Bot size={12} />}
            </div>
            <div className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-xs leading-relaxed ${m.role === 'user' ? 'bg-oe-blue text-white' : 'bg-surface-secondary text-content-primary'}`}>
              {m.content}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex gap-2">
            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-oe-purple/10 text-oe-purple">
              <Bot size={12} />
            </div>
            <div className="flex items-center gap-1 rounded-lg bg-surface-secondary px-3 py-2">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-content-tertiary [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-content-tertiary [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-content-tertiary" />
            </div>
          </div>
        )}
        {error && (
          <div className="rounded-lg bg-semantic-error-bg px-3 py-2 text-xs text-semantic-error">
            {error}
          </div>
        )}
      </div>

      <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-border-light p-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('chat.placeholder', { defaultValue: 'Ask a question…' })}
          disabled={sending}
          className="flex-1 rounded-lg border border-border bg-surface-primary px-3 py-2 text-sm text-content-primary placeholder:text-content-tertiary disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          aria-label={t('chat.send', { defaultValue: 'Send' })}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-oe-blue text-white hover:bg-oe-blue-hover disabled:opacity-50"
        >
          <Send size={15} />
        </button>
      </form>
    </div>
  );
}
