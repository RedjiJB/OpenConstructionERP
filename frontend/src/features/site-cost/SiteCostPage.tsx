// Site Cost Summary -- the real replacement for the "5D Cost" chip. Kept
// at the /5d URL so the dead chip that pointed here resolves to
// something real, but labeled "Site Cost Summary" everywhere in the UI,
// never "5D Cost" -- that label specifically means cost-loaded-
// schedule/BIM integration, which nothing in this domain backs.
// Presenting this as "5D Cost" would itself be the dishonest-label
// problem this restoration exists to avoid.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DollarSign, Wallet, Users, ShoppingCart, Scale } from 'lucide-react';
import { PageHeader } from '@/shared/ui';
import { useToastStore } from '@/stores/useToastStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { getErrorMessage } from '@/shared/lib/api';
import { fmtCurrency } from '@/shared/lib/formatters';
import { listSiteOptions, getSiteCostSummary, setSiteBudget } from './api';

function StatCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: 'error' | 'success' }) {
  return (
    <div className="rounded-xl border border-border-light bg-surface-elevated p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-content-primary">
        {icon}
        {label}
      </div>
      <div
        className={
          'text-2xl font-bold tabular-nums ' +
          (tone === 'error' ? 'text-semantic-error' : tone === 'success' ? 'text-semantic-success' : 'text-content-primary')
        }
      >
        {value}
      </div>
    </div>
  );
}

export function SiteCostPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  const isAdmin = useAuthStore((s) => s.userRole) === 'admin';
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [budgetInput, setBudgetInput] = useState('');
  const [savingBudget, setSavingBudget] = useState(false);

  const sitesQ = useQuery({ queryKey: ['site-cost', 'sites'], queryFn: listSiteOptions });
  const sites = sitesQ.data?.items ?? [];
  const activeSiteId = selectedSiteId || sites[0]?.id || '';

  const summaryQ = useQuery({
    queryKey: ['site-cost', 'summary', activeSiteId],
    queryFn: () => getSiteCostSummary(activeSiteId),
    enabled: !!activeSiteId,
  });

  const summary = summaryQ.data;
  const currentBudgetLabel = summary?.budget != null ? fmtCurrency(summary.budget, 'USD') : t('site_cost.no_budget', { defaultValue: 'Not set' });

  const saveBudget = async () => {
    const parsed = budgetInput.trim() === '' ? null : Number(budgetInput);
    if (parsed !== null && !Number.isFinite(parsed)) {
      addToast({ type: 'error', title: t('site_cost.invalid_budget', { defaultValue: 'Enter a valid number' }) });
      return;
    }
    setSavingBudget(true);
    try {
      await setSiteBudget(activeSiteId, parsed);
      await qc.invalidateQueries({ queryKey: ['site-cost', 'summary', activeSiteId] });
      setBudgetInput('');
      addToast({ type: 'success', title: t('site_cost.budget_saved', { defaultValue: 'Budget updated' }) });
    } catch (err) {
      addToast({ type: 'error', title: getErrorMessage(err) });
    } finally {
      setSavingBudget(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl p-4">
      <PageHeader
        srTitle={t('nav.site_cost', { defaultValue: 'Site Cost Summary' })}
        subtitle={t('site_cost.subtitle', {
          defaultValue: 'Real spend against a budget, for one site -- purchase orders and crew labour, both traced to real rows.',
        })}
      />

      <div className="mt-4">
        <label className="mb-1 block text-xs font-medium text-content-secondary">
          {t('site_cost.select_site', { defaultValue: 'Site' })}
        </label>
        <select
          value={activeSiteId}
          onChange={(e) => setSelectedSiteId(e.target.value)}
          className="h-9 w-full max-w-sm rounded-lg border border-border bg-surface-primary px-3 text-sm focus:outline-none focus:ring-2 focus:ring-oe-blue/30 focus:border-oe-blue"
        >
          {sites.length === 0 && <option value="">{t('site_cost.no_sites', { defaultValue: 'No sites registered' })}</option>}
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {summaryQ.isLoading ? (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-border-light bg-surface-secondary" />
          ))}
        </div>
      ) : summary ? (
        <>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <StatCard icon={<Wallet size={16} className="text-oe-blue" />} label={t('site_cost.budget', { defaultValue: 'Budget' })} value={currentBudgetLabel} />
            <StatCard icon={<ShoppingCart size={16} className="text-oe-blue" />} label={t('site_cost.po_spend', { defaultValue: 'Purchase order spend' })} value={fmtCurrency(summary.po_spend, 'USD')} />
            <StatCard icon={<Users size={16} className="text-oe-blue" />} label={t('site_cost.labour_spend', { defaultValue: 'Labour spend' })} value={fmtCurrency(summary.labour_spend, 'USD')} />
            <StatCard icon={<DollarSign size={16} className="text-oe-blue" />} label={t('site_cost.total_spend', { defaultValue: 'Total spend' })} value={fmtCurrency(summary.total_spend, 'USD')} />
          </div>

          {summary.variance != null && (
            <div className="mt-4">
              <StatCard
                icon={<Scale size={16} className={summary.variance < 0 ? 'text-semantic-error' : 'text-semantic-success'} />}
                label={t('site_cost.variance', { defaultValue: 'Budget variance' })}
                value={fmtCurrency(summary.variance, 'USD')}
                tone={summary.variance < 0 ? 'error' : 'success'}
              />
            </div>
          )}

          {isAdmin && (
            <div className="mt-5 rounded-xl border border-border-light bg-surface-elevated p-4">
              <div className="mb-2 text-sm font-semibold text-content-primary">
                {t('site_cost.set_budget', { defaultValue: 'Set budget' })}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder={t('site_cost.budget_placeholder', { defaultValue: 'Leave blank to clear' })}
                  value={budgetInput}
                  onChange={(e) => setBudgetInput(e.target.value)}
                  className="h-9 w-48 rounded-lg border border-border bg-surface-primary px-3 text-sm focus:outline-none focus:ring-2 focus:ring-oe-blue/30 focus:border-oe-blue"
                />
                <button
                  type="button"
                  onClick={() => void saveBudget()}
                  disabled={savingBudget}
                  className="inline-flex h-9 items-center rounded-lg bg-oe-blue px-3.5 text-sm font-medium text-white hover:bg-oe-blue/90 disabled:opacity-50"
                >
                  {t('common.save', { defaultValue: 'Save' })}
                </button>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

export default SiteCostPage;
