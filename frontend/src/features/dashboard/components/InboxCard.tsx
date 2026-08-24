// Dashboard restoration, Slice L: purpose-built, not adapted from the
// vendored features/inbox/InboxPanel.tsx. That panel models a per-user,
// reversible triage state (acknowledge/dismiss/restore, with an actual
// "Undo" button) layered on top of the underlying item -- "dismissing an
// approval never decides it". This domain's resolveAlert/
// acknowledgeNotification are real, one-way, global actions with no
// "unresolve" -- wiring the vendored panel's buttons to them would put a
// working-looking Undo control next to an action that cannot really be
// undone. See src/facade/routes/inbox.ts for the full reasoning.
//
// Also no fabricated "approvals" bucket: this domain has no PO-approval
// gate, so the inbox is alerts + notifications only, each with a single
// honest action -- "Resolve" / "Acknowledge" -- not a decision, just an
// acknowledgement that someone saw it.
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Bell, Check, ChevronDown, ChevronUp, ExternalLink, Inbox as InboxIcon, Loader2 } from 'lucide-react';
import { acknowledgeInboxItem, fetchInbox, type InboxItem } from '../api';

// Collapsed by default -- a busy inbox otherwise pushes every widget
// below it down the page. Expanding reveals the rest inside its own
// scroll container (matching the vendored InboxPanel.tsx's own
// max-h-[360px]/max-h-[640px] pattern) rather than growing the page
// unbounded. "Open full inbox" links to the real /inbox page (see
// InboxPage.tsx) -- a second, independent way to see everything besides
// the in-place toggle.
const COLLAPSED_ROW_COUNT = 4;

export function formatTimeAgo(iso: string, t: ReturnType<typeof useTranslation>['t']): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return t('notifications.just_now', { defaultValue: 'Just now' });
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t('time.minutes_ago', { defaultValue: '{{count}}m ago', count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('time.hours_ago', { defaultValue: '{{count}}h ago', count: hours });
  const days = Math.floor(hours / 24);
  return t('time.days_ago', { defaultValue: '{{count}}d ago', count: days });
}

export function InboxRow({ item }: { item: InboxItem }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [justAcked, setJustAcked] = useState(false);

  const mutation = useMutation({
    mutationFn: () => acknowledgeInboxItem(item.id),
    onSuccess: () => {
      setJustAcked(true);
      void queryClient.invalidateQueries({ queryKey: ['facade-inbox'] });
    },
  });

  const Icon = item.source === 'alert' ? AlertTriangle : Bell;
  const color = item.severity === 'critical' ? 'text-semantic-error' : 'text-oe-blue';
  const bg = item.severity === 'critical' ? 'bg-semantic-error-bg' : 'bg-oe-blue-subtle';
  const clickable = Boolean(item.action_url);

  // The navigate target is its own control, not a wrapping <button>, so
  // the Resolve/Mark-as-seen button never ends up nested inside another
  // button (invalid HTML, and it silently breaks the inner click).
  const rowBody = (
    <>
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${bg}`}>
        <Icon size={14} className={color} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-content-primary">{item.title}</p>
        <span className="text-2xs text-content-quaternary">{formatTimeAgo(item.timestamp, t)}</span>
      </div>
    </>
  );

  return (
    <div className="flex items-start gap-1 py-1">
      {clickable ? (
        <button
          type="button"
          onClick={() => navigate(item.action_url!)}
          className="group flex min-w-0 flex-1 items-start gap-3 rounded-lg px-1 py-1 text-left transition-colors hover:bg-surface-tertiary"
        >
          {rowBody}
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 items-start gap-3 px-1 py-1">{rowBody}</div>
      )}
      <button
        type="button"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending || justAcked}
        title={item.source === 'alert' ? t('inbox.action_resolve', { defaultValue: 'Resolve' }) : t('inbox.action_acknowledge', { defaultValue: 'Mark as seen' })}
        className="mt-1 shrink-0 rounded-md p-1 text-content-quaternary transition-colors hover:bg-surface-tertiary hover:text-content-primary disabled:pointer-events-none disabled:opacity-40"
      >
        {mutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
      </button>
    </div>
  );
}

export function InboxCard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['facade-inbox'],
    queryFn: () => fetchInbox(50),
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: false,
  });

  const items = data?.items ?? [];
  const visibleItems = expanded ? items : items.slice(0, COLLAPSED_ROW_COUNT);
  const hiddenCount = items.length - visibleItems.length;

  return (
    <div className="rounded-xl border border-border-light bg-surface-elevated/90 p-4 animate-card-in">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-content-primary">
          <InboxIcon size={15} className="text-oe-blue" />
          {t('inbox.title', { defaultValue: 'Inbox' })}
        </h3>
        <div className="flex items-center gap-2">
          {data && data.total > 0 && (
            <span className="text-2xs tabular-nums text-content-tertiary">{data.total}</span>
          )}
          <button
            type="button"
            onClick={() => navigate('/inbox')}
            title={t('inbox.open_full', { defaultValue: 'Open full inbox' })}
            className="rounded-md p-1 text-content-quaternary transition-colors hover:bg-surface-tertiary hover:text-content-primary"
          >
            <ExternalLink size={13} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
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
        <div className="py-8 text-center">
          <InboxIcon size={24} className="mx-auto mb-2 text-content-quaternary" />
          <p className="text-xs font-medium text-content-secondary">
            {t('inbox.empty_title', { defaultValue: "You're all caught up" })}
          </p>
        </div>
      ) : (
        <>
          <div className={expanded ? 'max-h-[420px] divide-y divide-border-light/60 overflow-y-auto' : 'divide-y divide-border-light/60'}>
            {visibleItems.map((item) => (
              <InboxRow key={item.id} item={item} />
            ))}
          </div>
          {items.length > COLLAPSED_ROW_COUNT && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-2 flex w-full items-center justify-center gap-1 rounded-md py-1.5 text-2xs font-medium text-content-tertiary transition-colors hover:bg-surface-tertiary hover:text-content-primary"
            >
              {expanded ? (
                <>
                  {t('inbox.show_less', { defaultValue: 'Show less' })}
                  <ChevronUp size={12} />
                </>
              ) : (
                <>
                  {t('inbox.show_more', { defaultValue: 'Show {{count}} more', count: hiddenCount })}
                  <ChevronDown size={12} />
                </>
              )}
            </button>
          )}
        </>
      )}
    </div>
  );
}
