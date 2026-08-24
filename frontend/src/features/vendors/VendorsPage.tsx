// Restoring Procurement's dead "Supplier Catalogs" chip: a real, small
// vendor directory -- not the catalog/pricing feature the old label
// implied (no per-vendor SKU/pricing concept exists here), just who
// they are, how to reach them, and what's actually been ordered from
// them. Renamed to "Vendors" in the UI, same honesty call this session
// already made for "5D Cost" -> "Site Cost Summary".
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Building2, Clock, ShoppingCart } from 'lucide-react';
import { PageHeader } from '@/shared/ui';
import { fmtCurrency } from '@/shared/lib/formatters';
import { listVendors } from './api';

export function VendorsPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({ queryKey: ['vendors'], queryFn: listVendors, retry: false });
  const vendors = data?.items ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <PageHeader
        srTitle={t('nav.vendors', { defaultValue: 'Vendors' })}
        subtitle={t('vendors.subtitle', { defaultValue: 'Who you order from, and what has actually been ordered from them.' })}
      />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-border-light bg-surface-secondary" />
          ))}
        </div>
      ) : vendors.length === 0 ? (
        <div className="rounded-xl border border-border-light bg-surface-elevated p-8 text-center">
          <Building2 size={24} className="mx-auto mb-2 text-content-quaternary" />
          <p className="text-sm font-medium text-content-secondary">{t('vendors.empty_title', { defaultValue: 'No vendors registered yet' })}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {vendors.map((v) => (
            <div key={v.id} className="rounded-xl border border-border-light bg-surface-elevated p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Building2 size={15} className="shrink-0 text-oe-blue" />
                    <span className="text-sm font-semibold text-content-primary">{v.name}</span>
                  </div>
                  {(v.contact_method || v.contact_address) && (
                    <p className="mt-1 truncate text-xs text-content-secondary">
                      {[v.contact_method, v.contact_address].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  {v.account_number && (
                    <p className="mt-0.5 text-2xs text-content-tertiary">
                      {t('vendors.account_number', { defaultValue: 'Account {{number}}', number: v.account_number })}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-sm font-semibold tabular-nums text-content-primary">{fmtCurrency(v.total_spend, 'USD')}</div>
                  <div className="mt-0.5 flex items-center justify-end gap-1 text-2xs text-content-tertiary">
                    <ShoppingCart size={11} />
                    {t('vendors.po_count', { defaultValue: '{{count}} PO', count: v.po_count })}
                  </div>
                </div>
              </div>
              {v.lead_time_days !== null && (
                <div className="mt-2 flex items-center gap-1 text-2xs text-content-quaternary">
                  <Clock size={11} />
                  {t('vendors.lead_time', { defaultValue: '{{days}}-day lead time', days: v.lead_time_days })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default VendorsPage;
