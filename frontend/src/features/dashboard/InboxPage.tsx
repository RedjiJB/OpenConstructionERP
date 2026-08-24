// Dashboard restoration follow-up: a real, sidebar-accessible /inbox
// page -- the dashboard's InboxCard widget only ever showed a capped,
// collapsible peek. This page fetches the full list (no cap) and reuses
// InboxCard's own row rendering (InboxRow) so the resolve/acknowledge
// action and its wiring live in exactly one place.
//
// Not an adaptation of the vendored features/inbox/InboxPage.tsx --
// that page is built against InboxPanel.tsx's per-user reversible
// triage contract this domain doesn't have (see InboxCard.tsx's own
// header comment for the full reasoning). Left untouched and unrouted,
// same as every other pruned vendored page.
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Inbox as InboxIcon } from 'lucide-react';
import { PageHeader } from '@/shared/ui';
import { fetchInbox } from './api';
import { InboxRow } from './components/InboxCard';

export default function InboxPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ['facade-inbox'],
    queryFn: () => fetchInbox(200),
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: false,
  });

  const items = data?.items ?? [];

  return (
    <div className="mx-auto max-w-3xl p-4">
      <PageHeader
        srTitle={t('inbox.title', { defaultValue: 'Inbox' })}
        subtitle={t('inbox.rail_hint', { defaultValue: 'Approvals and alerts that need you, newest first.' })}
      />

      <div className="mt-4 rounded-xl border border-border-light bg-surface-elevated/90 p-4">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 animate-pulse">
                <div className="h-7 w-7 shrink-0 rounded-md bg-surface-secondary" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-3/4 rounded bg-surface-secondary" />
                  <div className="h-2.5 w-1/3 rounded bg-surface-secondary" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center">
            <InboxIcon size={28} className="mx-auto mb-2 text-content-quaternary" />
            <p className="text-sm font-medium text-content-secondary">
              {t('inbox.empty_title', { defaultValue: "You're all caught up" })}
            </p>
            <p className="mt-0.5 text-xs text-content-tertiary">
              {t('inbox.empty_desc', { defaultValue: 'Pending approvals and alerts will appear here.' })}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border-light/60">
            {items.map((item) => (
              <InboxRow key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
