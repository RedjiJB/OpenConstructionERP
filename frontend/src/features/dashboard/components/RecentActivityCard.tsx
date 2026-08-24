// Dashboard restoration, Slice K: purpose-built, not adapted from the
// vendored shared/ui/ActivityFeed.tsx. That component's shape
// (entity_type/entity_id/url/icon-name/action-for-coloring) is richer
// than src/domain/activity.ts's honest event list can actually back --
// most of these synthesized events (an alert resolved, a notification
// acknowledged) have no real destination page to link to, and inventing
// one would be worse than not linking at all. Same "new, purpose-built"
// call as MapPage.tsx made for the same reason. ActivityFeed.tsx itself
// is left alone (it has zero remaining consumers after DashboardPage.tsx
// was deleted, but nothing here depends on it either).
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, CheckCircle2, Bell, BellRing, ShoppingCart, PackageCheck,
  FileText, LogIn, LogOut, Activity, ChevronDown, ChevronUp, type LucideIcon,
} from 'lucide-react';
import { listActivity, type ActivityEntry, type ActivityEntryType } from '../api';

// Same collapse/expand pattern as InboxCard.tsx, for the same reason --
// a busy feed otherwise pushes the rest of the dashboard down. Expanding
// reveals the rest inside its own scroll container rather than growing
// the page unbounded.
const COLLAPSED_ROW_COUNT = 5;

const ICON_MAP: Record<ActivityEntryType, LucideIcon> = {
  alert_raised: AlertTriangle,
  alert_resolved: CheckCircle2,
  notification_raised: Bell,
  notification_acknowledged: BellRing,
  purchase_order_created: ShoppingCart,
  purchase_order_fulfilled: PackageCheck,
  document_uploaded: FileText,
  timeclock_in: LogIn,
  timeclock_out: LogOut,
};

const COLOR_MAP: Record<ActivityEntryType, string> = {
  alert_raised: 'text-semantic-error',
  alert_resolved: 'text-semantic-success',
  notification_raised: 'text-oe-blue',
  notification_acknowledged: 'text-semantic-success',
  purchase_order_created: 'text-oe-blue',
  purchase_order_fulfilled: 'text-semantic-success',
  document_uploaded: 'text-content-tertiary',
  timeclock_in: 'text-semantic-success',
  timeclock_out: 'text-content-tertiary',
};

function formatTimeAgo(iso: string, t: ReturnType<typeof useTranslation>['t']): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return t('notifications.just_now', { defaultValue: 'Just now' });
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t('time.minutes_ago', { defaultValue: '{{count}}m ago', count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('time.hours_ago', { defaultValue: '{{count}}h ago', count: hours });
  const days = Math.floor(hours / 24);
  return t('time.days_ago', { defaultValue: '{{count}}d ago', count: days });
}

export function RecentActivityCard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['facade-recent-activity'],
    queryFn: () => listActivity(50),
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: false,
  });

  const items: ActivityEntry[] = data?.items ?? [];
  const visibleItems = expanded ? items : items.slice(0, COLLAPSED_ROW_COUNT);
  const hiddenCount = items.length - visibleItems.length;

  return (
    <div className="rounded-xl border border-border-light bg-surface-elevated/90 p-4 animate-card-in">
      <h3 className="mb-3 text-sm font-semibold text-content-primary">
        {t('dashboard.recent_activity', { defaultValue: 'Recent activity' })}
      </h3>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 animate-pulse">
              <div className="h-7 w-7 shrink-0 rounded-full bg-surface-secondary" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-3/4 rounded bg-surface-secondary" />
                <div className="h-2.5 w-1/3 rounded bg-surface-secondary" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="py-8 text-center">
          <Activity size={24} className="mx-auto mb-2 text-content-quaternary" />
          <p className="text-xs text-content-tertiary">
            {t('activity.no_activity', { defaultValue: 'No recent activity' })}
          </p>
        </div>
      ) : (
        <>
          <div className={expanded ? 'max-h-[420px] space-y-0.5 overflow-y-auto' : 'space-y-0.5'}>
            {visibleItems.map((entry) => {
              const Icon = ICON_MAP[entry.type] ?? Activity;
              const rowContent = (
                <>
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-secondary">
                    <Icon size={14} className={COLOR_MAP[entry.type]} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-xs leading-snug text-content-primary">{entry.title}</p>
                    <div className="mt-0.5 flex items-center gap-2">
                      {entry.actor_name && (
                        <span className="truncate text-2xs text-content-tertiary">{entry.actor_name}</span>
                      )}
                      <span className="text-2xs text-content-quaternary">·</span>
                      <span className="whitespace-nowrap text-2xs text-content-quaternary">{formatTimeAgo(entry.timestamp, t)}</span>
                    </div>
                  </div>
                </>
              );
              return entry.action_url ? (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => navigate(entry.action_url!)}
                  className="flex w-full items-start gap-3 rounded-lg px-1 py-2 text-left transition-colors hover:bg-surface-tertiary"
                >
                  {rowContent}
                </button>
              ) : (
                <div key={entry.id} className="flex items-start gap-3 rounded-lg px-1 py-2">
                  {rowContent}
                </div>
              );
            })}
          </div>
          {items.length > COLLAPSED_ROW_COUNT && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-2 flex w-full items-center justify-center gap-1 rounded-md py-1.5 text-2xs font-medium text-content-tertiary transition-colors hover:bg-surface-tertiary hover:text-content-primary"
            >
              {expanded ? (
                <>
                  {t('activity.show_less', { defaultValue: 'Show less' })}
                  <ChevronUp size={12} />
                </>
              ) : (
                <>
                  {t('activity.show_more', { defaultValue: 'Show {{count}} more', count: hiddenCount })}
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
