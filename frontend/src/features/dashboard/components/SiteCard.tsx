// Dashboard restoration, Slice M: was CompactProjectCard.tsx's slot in
// the vendored dashboard ("projects" section). The card shell (avatar
// initial, title, tag row, footer with a count + arrow) is generic
// enough to keep, but nearly every specific field on that card --
// currency, classification standard, BOQ count/value -- has no FieldOps
// equivalent. Rebuilt around what a site actually carries: its type,
// address, how many crew clocked in today, and how many open alerts
// it has. Sites are FieldOps' real analog to "projects" -- a place with
// people and activity around it -- so this is the dashboard's nearest
// thing to a portfolio view, without inventing project/budget concepts
// this backend doesn't have.
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, MapPin, Users, Warehouse, Building2, Store, Wrench } from 'lucide-react';
import { Card } from '@/shared/ui';
import type { Site } from '../api';

const TYPE_ICON: Record<Site['type'], typeof Building2> = {
  job_site: Building2,
  depot: Warehouse,
  vendor: Store,
  shop: Wrench,
};

const TYPE_COLOR: Record<Site['type'], string> = {
  job_site: 'bg-oe-blue-subtle text-oe-blue-text',
  depot: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  vendor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  shop: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
};

export interface SiteCardProps {
  site: Site;
}

export function SiteCard({ site }: SiteCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const TypeIcon = TYPE_ICON[site.type];

  return (
    <Card
      hoverable
      padding="none"
      className="group relative cursor-pointer animate-card-in overflow-hidden rounded-xl bg-gradient-to-b from-surface-elevated to-surface-primary hover:border-oe-blue/40 hover:shadow-lg focus-within:ring-2 focus-within:ring-oe-blue/30 motion-safe:transition-all"
      onClick={() => navigate('/map')}
    >
      <div className="p-3.5">
        <div className="flex items-start gap-2.5">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ring-white/40 shadow-sm transition-transform duration-normal ease-oe group-hover:scale-105 dark:ring-white/5 ${TYPE_COLOR[site.type]}`}>
            <TypeIcon size={16} strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold tracking-tight text-content-primary">{site.name}</h3>
            {site.address ? (
              <p className="mt-0.5 flex items-center gap-1 truncate text-2xs text-content-tertiary">
                <MapPin size={10} className="shrink-0" />
                {site.address}
              </p>
            ) : (
              <p className="mt-0.5 text-2xs text-content-quaternary">
                {t('dashboard.sites_no_location', { defaultValue: 'No location set' })}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-border-light px-3.5 py-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-md bg-surface-secondary px-1.5 py-0.5 text-2xs font-medium text-content-secondary">
            <Users size={10} strokeWidth={2.25} />
            <span className="tabular-nums">{site.crew_today_count}</span>
            <span>{t('dashboard.site_crew_today', { defaultValue: 'crew today' })}</span>
          </span>
          {site.open_alerts_count > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md bg-semantic-error-bg px-1.5 py-0.5 text-2xs font-medium text-semantic-error">
              <AlertTriangle size={10} strokeWidth={2.25} />
              <span className="tabular-nums">{site.open_alerts_count}</span>
              <span>{t('dashboard.site_open_alerts', { defaultValue: 'open' })}</span>
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
