// New, purpose-built floating launcher for ChatPanel. Positioned at
// bottom-right offset from the corner (not flush) so it never stacks
// under AppLayout's FloatingQueuePanel, which already owns the flush
// bottom-4 right-4 corner.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageCircle, X } from 'lucide-react';
import { ChatPanel } from './ChatPanel';

export function FloatingChatButton() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t('chat.title', { defaultValue: 'FieldOps Assistant' })}
        title={t('chat.title', { defaultValue: 'FieldOps Assistant' })}
        className="fixed bottom-4 right-24 z-[90] flex h-12 w-12 items-center justify-center rounded-full bg-oe-blue text-white shadow-lg transition-transform hover:scale-105 hover:bg-oe-blue-hover"
      >
        {open ? <X size={20} /> : <MessageCircle size={20} />}
      </button>
      {open && <ChatPanel onClose={() => setOpen(false)} />}
    </>
  );
}
