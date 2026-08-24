// Restoring BI Dashboards, Slice R: a fixed page of five real,
// live-computed KPIs -- not the vendored 2685-line generic BI engine
// (KPI-definition DSL, dashboard/widget builder, drill-downs, scheduled
// reports, alert rules, a starter-pack installer). No formula editor,
// no persistence -- every number here traces to a real row in Postgres.
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Users, Clock, ShoppingCart, Timer } from 'lucide-react';
import { PageHeader } from '@/shared/ui';
import { fmtCurrency } from '@/shared/lib/formatters';
import { getKpis } from './api';

function KpiCard({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border-light bg-surface-elevated p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-content-primary">
        {icon}
        {label}
      </div>
      {children}
    </div>
  );
}

export function BIDashboardsPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({ queryKey: ['bi-kpis'], queryFn: getKpis, retry: false, staleTime: 30_000 });

  return (
    <div className="mx-auto max-w-4xl p-4">
      <PageHeader
        srTitle={t('nav.bi_dashboards', { defaultValue: 'BI Dashboards' })}
        subtitle={t('bi_dashboards.subtitle', { defaultValue: 'Live operational KPIs, computed from real crew, alert, purchase order, and timeclock data.' })}
      />

      {isLoading ? (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl border border-border-light bg-surface-secondary" />
          ))}
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <KpiCard icon={<AlertTriangle size={16} className="text-semantic-error" />} label={t('bi_dashboards.open_alerts', { defaultValue: 'Open alerts' })}>
            <div className="flex items-baseline gap-4">
              <div>
                <div className="text-2xl font-bold tabular-nums text-semantic-error">{data?.open_alerts.critical ?? 0}</div>
                <div className="text-2xs text-content-tertiary">{t('bi_dashboards.critical', { defaultValue: 'Critical' })}</div>
              </div>
              <div>
                <div className="text-2xl font-bold tabular-nums text-content-secondary">{data?.open_alerts.routine ?? 0}</div>
                <div className="text-2xs text-content-tertiary">{t('bi_dashboards.routine', { defaultValue: 'Routine' })}</div>
              </div>
            </div>
          </KpiCard>

          <KpiCard icon={<Users size={16} className="text-oe-blue" />} label={t('bi_dashboards.crew_utilization', { defaultValue: 'Crew utilization today' })}>
            <div className="text-2xl font-bold tabular-nums text-content-primary">
              {data?.crew_utilization.utilization_pct != null ? `${data.crew_utilization.utilization_pct}%` : '—'}
            </div>
            <div className="text-2xs text-content-tertiary">
              {t('bi_dashboards.clocked_in_of', {
                defaultValue: '{{in}} of {{total}} clocked in',
                in: data?.crew_utilization.clocked_in_today ?? 0,
                total: data?.crew_utilization.active_crew ?? 0,
              })}
            </div>
          </KpiCard>

          <KpiCard icon={<Clock size={16} className="text-oe-blue" />} label={t('bi_dashboards.avg_resolution', { defaultValue: 'Avg. alert resolution (30d)' })}>
            <div className="text-2xl font-bold tabular-nums text-content-primary">
              {data?.avg_alert_resolution.avg_resolution_hours != null ? `${data.avg_alert_resolution.avg_resolution_hours}h` : '—'}
            </div>
            <div className="text-2xs text-content-tertiary">
              {t('bi_dashboards.resolved_count', { defaultValue: '{{count}} resolved', count: data?.avg_alert_resolution.resolved_count ?? 0 })}
            </div>
          </KpiCard>

          <KpiCard icon={<Timer size={16} className="text-oe-blue" />} label={t('bi_dashboards.timeclock_hours', { defaultValue: 'Timeclock hours this week' })}>
            <div className="text-2xl font-bold tabular-nums text-content-primary">{data?.timeclock_hours_this_week.total_hours ?? 0}h</div>
          </KpiCard>

          <div className="sm:col-span-2">
            <KpiCard icon={<ShoppingCart size={16} className="text-oe-blue" />} label={t('bi_dashboards.po_spend', { defaultValue: 'Purchase order spend this month, by vendor' })}>
              {data && data.po_spend_this_month.length > 0 ? (
                <div className="divide-y divide-border-light/60">
                  {data.po_spend_this_month.map((row) => (
                    <div key={row.vendor_id ?? 'none'} className="flex items-center justify-between py-1.5 text-sm">
                      <span className="text-content-secondary">{row.vendor_name}</span>
                      <span className="font-semibold tabular-nums text-content-primary">{fmtCurrency(row.total_cost, 'USD')}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-content-tertiary">{t('bi_dashboards.no_spend', { defaultValue: 'No purchase orders this month.' })}</p>
              )}
            </KpiCard>
          </div>
        </div>
      )}
    </div>
  );
}

export default BIDashboardsPage;
