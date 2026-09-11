// DDC-CWICR-OE: DataDrivenConstruction · OpenConstructionERP
// Copyright (c) 2026 Artem Boiko / DataDrivenConstruction
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import {
  Package,
  Search,
  Plus,
  X,
  Loader2,
  Trash2,
  Send,
} from 'lucide-react';
import {
  Button,
  Card,
  Badge,
  EmptyState,
  Breadcrumb,
  RecoveryCard,
  SkeletonTable,
  DismissibleInfo,
  IntroRichText,
  ModuleGuideButton,
} from '@/shared/ui';
import { RequiresProject } from '@/shared/auth/RequiresProject';
import { PageHeader } from '@/shared/ui/PageHeader';
import { MoneyDisplay } from '@/shared/ui/MoneyDisplay';
import { DateDisplay } from '@/shared/ui/DateDisplay';
import { ContactSearchInput } from '@/shared/ui/ContactSearchInput';
import { apiGet, apiPost, type Page } from '@/shared/lib/api';
import { TruncationNotice } from '@/shared/ui/TruncationNotice';
import { useToastStore } from '@/stores/useToastStore';
import { useProjectContextStore } from '@/stores/useProjectContextStore';
import { useActiveProjectId } from '@/shared/hooks/useActiveProjectId';
import { useAuthStore } from '@/stores/useAuthStore';
import { procurementGuide } from './procurementGuide';
import { InsightsPanel, InsightsToggleButton, useModuleInsights } from '@/features/insights';
import { buildProcurementInsights } from './procurementInsights';
import { POStatusPipeline } from './POStatusPipeline';
import { DeliveryCountdownBadge } from './DeliveryCountdownBadge';
import { fmtFixed } from '@/shared/lib/formatters';

/* ── Types ─────────────────────────────────────────────────────────────── */

interface PurchaseOrder {
  id: string;
  project_id: string;
  po_number: string;
  vendor_name: string;
  vendor_contact_id?: string | null;
  issue_date: string;
  delivery_date: string | null;
  // Money bug fix: the list endpoint (POResponse in backend/.../schemas.py)
  // returns `amount_total` + `currency_code` (amount is a Decimal-serialized
  // STRING), NOT `total_amount`/`currency`. The old field names were always
  // undefined, so MoneyDisplay rendered an em-dash for every PO. Match the
  // real wire contract here.
  amount_total: string | number;
  currency_code: string;
  status: string;
  description: string;
  line_items_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * One page of a project's purchase orders, envelope intact.
 *
 * Two useQuery calls in this file cache under `['procurement-po', projectId]`:
 * the Insights panel at page level and the Purchase Orders tab. React Query
 * keys are strings, so whichever runs first hands its value to the other -
 * they cannot hold different shapes. Both went through their own inline
 * `apiGet(...).then((res) => res.items.map(...))`, which agreed only because
 * someone kept them in step by hand. One function now, so the shape is not a
 * thing two call sites can disagree about, and the total survives.
 */
type POPage = Page<PurchaseOrder & { vendor_contact_id?: string | null }>;

async function fetchPOPage(projectId: string): Promise<POPage> {
  const page = await apiGet<POPage>(`/v1/procurement/?project_id=${projectId}`);
  return {
    ...page,
    items: page.items.map((po) => ({
      ...po,
      vendor_name: po.vendor_name ?? po.vendor_contact_id ?? '',
    })),
  };
}

interface POLineItemForm {
  description: string;
  quantity: string;
  unit: string;
  unit_rate: string;
  amount: string;
}

/** The purchase-order fields the create modal holds. There is no PATCH
 *  route for a purchase order (see the façade route header), so this form
 *  only ever serves the create flow - not an edit prefill. */
interface POFormState {
  vendor_contact_id: string;
  vendor_display: string;
  items: POLineItemForm[];
}

/**
 * Normalise a router-state buy-list handoff (from the Resource Summary
 * buy-list, F4 interop) into PO line-item form rows. Router state is untyped,
 * so every field is validated defensively: a non-array input, or an entry with
 * no description, is dropped. Quantities are the Decimal STRINGS the backend
 * served - carried through verbatim (never parsed to a float); unit_rate and
 * amount are left blank for the buyer to fill in from the supplier quote.
 */
export function parseIncomingBuyList(raw: unknown): POLineItemForm[] {
  if (!Array.isArray(raw)) return [];
  const lines: POLineItemForm[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const rec = entry as Record<string, unknown>;
    const description = typeof rec.description === 'string' ? rec.description.trim() : '';
    if (!description) continue;
    const unit = typeof rec.unit === 'string' ? rec.unit : '';
    const quantity =
      typeof rec.quantity === 'string'
        ? rec.quantity
        : typeof rec.quantity === 'number'
          ? String(rec.quantity)
          : '';
    lines.push({ description, quantity: quantity || '1', unit, unit_rate: '', amount: '' });
  }
  return lines;
}

/* ── Constants ────────────────────────────────────────────────────────── */

const inputCls =
  'h-10 w-full rounded-lg border border-border bg-surface-primary px-3 text-sm focus:outline-none focus:ring-2 focus:ring-oe-blue/30 focus:border-oe-blue';

// Only draft, issued, completed and cancelled are ever produced by this
// backend (see STATUS_MAP in the façade's procurement route) - the extras
// are kept as a defensive fallback so an unrecognised status still colours
// instead of falling through unstyled.
const PO_STATUS_COLORS: Record<
  string,
  'neutral' | 'blue' | 'success' | 'warning' | 'error'
> = {
  draft: 'neutral',
  issued: 'blue',
  completed: 'success',
  cancelled: 'error',
};

/* ── Main Page ────────────────────────────────────────────────────────── */

export function ProcurementPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const projectId = useActiveProjectId();
  const projectName = useProjectContextStore((s) => s.activeProjectName);

  // F4 interop: the Resource Summary buy-list hands its material lines over as
  // router state so a buyer can turn the estimate straight into a draft PO.
  // Parse it once per state change; the Purchase Orders tab consumes it and
  // pre-fills the create flow. We then clear the state (below) so a refresh or
  // back-navigation doesn't reopen the draft.
  const incomingBuyList = useMemo(
    () => parseIncomingBuyList((location.state as { buyList?: unknown } | null)?.buyList),
    [location.state],
  );

  const clearIncomingBuyList = useCallback(() => {
    navigate(location.pathname, { replace: true, state: null });
  }, [navigate, location.pathname]);

  // Module Insights panel. Charts the purchase orders THIS PAGE LOADED - the
  // register that carries each order's committed value, supplier and delivery
  // status - so a chart slice reads like the status badge on the row it came
  // from. The list reuses the ['procurement-po', projectId] query the Purchase
  // Orders tab already loads (same key and queryFn, so it is a cache hit and
  // the tab's own invalidations keep it fresh). Currency rides the finance
  // dashboard query. These hooks sit with the other top-level hooks, above any
  // conditional render, so the hook order stays stable.
  //
  // Known limit, stated rather than papered over: the list endpoint returns 50
  // orders by default and caps at 100, so on a project past that the totals
  // this panel reduces out of `insightOrders` describe a page, not a project.
  // A TruncationNotice next to a wrong number would read as coverage. The real
  // fix is server-side aggregates, and /v1/procurement/stats/ already computes
  // some of them for the reporting page - backend scope, not this wave.
  const { data: insightPage } = useQuery({
    queryKey: ['procurement-po', projectId],
    queryFn: () => fetchPOPage(projectId!),
    enabled: !!projectId,
  });
  const insightOrders = useMemo(() => insightPage?.items ?? [], [insightPage]);
  const { data: insightDashboard } = useQuery({
    queryKey: ['finance', 'dashboard', projectId],
    queryFn: () =>
      apiGet<{ currency: string }>(`/v1/finance/dashboard/?project_id=${projectId}`),
    enabled: !!projectId,
  });
  const insights = useModuleInsights('procurement', { defaultOpen: true });
  const { datasets: insightDatasets, builtins: insightBuiltins } = useMemo(
    () => buildProcurementInsights(insightOrders, insightDashboard?.currency || 'EUR', t),
    [insightOrders, insightDashboard, t],
  );

  return (
    <div className="space-y-5 animate-fade-in">
      <Breadcrumb
        items={[
          ...(projectName
            ? [{ label: projectName, to: `/projects/${projectId}` }]
            : []),
          { label: t('procurement.title', { defaultValue: 'Procurement' }) },
        ]}
      />

      {/* Header - the module name + icon live in the global top bar; the
          page renders only its subtitle. Project selection is global too.
          srTitle gives the page its single semantic <h1> (sr-only) for a11y. */}
      <PageHeader
        srTitle={t('procurement.title', { defaultValue: 'Procurement' })}
        subtitle={t('procurement.subtitle', {
          defaultValue: 'Purchase orders',
        })}
        actions={
          <>
            <InsightsToggleButton open={insights.open} onClick={insights.toggle} />
            <ModuleGuideButton content={procurementGuide} />
          </>
        }
      />

      {/* Module Insights panel - toggled by the header button. Placed high so
          its charts are visible the moment Procurement opens. */}
      <InsightsPanel
        open={insights.open}
        title={t('procurement.insights.title', { defaultValue: 'Procurement insights' })}
        datasets={insightDatasets}
        builtins={insightBuiltins}
        custom={insights.custom}
        onAdd={insights.addCustom}
        onUpdate={insights.updateCustom}
        onRemove={insights.removeCustom}
        onCollapse={() => insights.setOpen(false)}
      />

      {/* Canonical info block - where procurement sits in the money flow,
          with cross-module pills for the routes its results flow to. */}
      <DismissibleInfo
        storageKey="procurement"
        title={t('procurement.intro_title', {
          defaultValue: 'See committed spend before the invoice lands',
        })}
        more={
          t('procurement.intro_more', { defaultValue: '' })
            ? <IntroRichText text={t('procurement.intro_more')} />
            : undefined
        }
        links={[
          {
            label: t('nav.vendors', { defaultValue: 'Vendors' }),
            onClick: () => navigate('/vendors'),
          },
        ]}
      >
        {t('procurement.intro_body', {
          defaultValue:
            'Raise a purchase order to commit budget with a vendor, then issue it once it is ready to send. PO totals roll up into the project as committed spend.',
        })}
      </DismissibleInfo>

      {/* No-project warning */}
      {!projectId && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          {t('common.select_project_hint', { defaultValue: 'Select a project from the header to get started.' })}
        </div>
      )}

      {!projectId ? (
        <RequiresProject
          emptyHint={t('procurement.select_project', {
            defaultValue:
              'Open a project first to view its procurement data',
          })}
        >{null}</RequiresProject>
      ) : (
        <PurchaseOrdersTab
          projectId={projectId}
          incomingBuyList={incomingBuyList}
          onBuyListConsumed={clearIncomingBuyList}
        />
      )}
    </div>
  );
}

/* ── Purchase Orders Tab ──────────────────────────────────────────────── */

function PurchaseOrdersTab({
  projectId,
  incomingBuyList,
  onBuyListConsumed,
}: {
  projectId: string;
  incomingBuyList: POLineItemForm[];
  onBuyListConsumed: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const addToast = useToastStore((s) => s.addToast);
  const userRole = useAuthStore((s) => s.userRole);
  const isManager = userRole === 'admin' || userRole === 'manager';

  // Resolve the project's currency from the finance dashboard, shown next to
  // the order total (task #217). Empty string when the project has no
  // priced financial records yet. There is no per-PO currency selection -
  // the backend always stores a purchase order in the project's currency.
  const { data: poDashboard } = useQuery({
    queryKey: ['finance', 'dashboard', projectId],
    queryFn: () =>
      apiGet<{ currency: string }>(`/v1/finance/dashboard/?project_id=${projectId}`),
  });
  const projectCurrency = poDashboard?.currency || '';

  /* ── PO create modal state ──
     There is no PATCH route for a purchase order (see the façade route
     header), so this modal only ever creates a new draft PO. */
  const [showCreate, setShowCreate] = useState(false);
  // True only while the create modal is showing lines handed over from the
  // Resource Summary buy-list (F4 interop), so we can surface a one-line hint
  // telling the buyer to add a supplier + rates. Reset whenever the modal closes.
  const [prefilledFromBuyList, setPrefilledFromBuyList] = useState(false);
  const emptyLine: POLineItemForm = { description: '', quantity: '1', unit: '', unit_rate: '', amount: '' };

  const [poForm, setPoForm] = useState<POFormState>({
    vendor_contact_id: '',
    vendor_display: '',
    items: [{ ...emptyLine }] as POLineItemForm[],
  });
  const [poErrors, setPoErrors] = useState<Record<string, string>>({});
  const [poTaxInput, setPoTaxInput] = useState('0');
  const firstFieldRef = useRef<HTMLDivElement>(null);

  const emptyPoForm: POFormState = {
    vendor_contact_id: '', vendor_display: '', items: [{ ...emptyLine }] as POLineItemForm[],
  };

  const closeModal = () => {
    setShowCreate(false);
    setPrefilledFromBuyList(false);
    setPoForm({ ...emptyPoForm, items: [{ ...emptyLine }] });
    setPoTaxInput('0');
    setPoErrors({});
  };

  // Escape key handler
  useEffect(() => {
    if (!showCreate) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCreate]);

  // F4 interop: when Procurement was opened from the Resource Summary buy-list,
  // pre-fill the create flow with those material lines and open it. A ref makes
  // this a once-only hand-off, so reopening or editing the modal afterwards is
  // never clobbered; once consumed we ask the parent to clear the router state
  // so the draft is not reopened on a refresh or back-navigation.
  const buyListConsumedRef = useRef(false);
  useEffect(() => {
    if (buyListConsumedRef.current) return;
    if (incomingBuyList.length === 0) return;
    buyListConsumedRef.current = true;
    setPoForm((f) => ({ ...f, items: incomingBuyList.map((li) => ({ ...li })) }));
    setPrefilledFromBuyList(true);
    setShowCreate(true);
    onBuyListConsumed();
  }, [incomingBuyList, onBuyListConsumed]);

  // Auto-calc line amounts
  const updateLineItem = (idx: number, field: keyof POLineItemForm, value: string) => {
    setPoForm((prev) => {
      const items: POLineItemForm[] = prev.items.map((li, i) => (i === idx ? { ...li, [field]: value } : li));
      const updated = items[idx];
      if (updated && (field === 'quantity' || field === 'unit_rate')) {
        const qty = parseFloat(updated.quantity || '0');
        const rate = parseFloat(updated.unit_rate || '0');
        updated.amount = (qty * rate).toFixed(2);
      }
      return { ...prev, items };
    });
  };

  const addLineItem = () => {
    setPoForm((prev) => ({ ...prev, items: [...prev.items, { ...emptyLine }] }));
  };

  const removeLineItem = (idx: number) => {
    setPoForm((prev) => {
      const items = prev.items.filter((_, i) => i !== idx);
      return { ...prev, items: items.length === 0 ? [{ ...emptyLine }] : items };
    });
  };

  // Computed totals
  const poSubtotal = poForm.items.reduce((s, li) => s + parseFloat(li.amount || '0'), 0);
  const poTotal = poSubtotal + parseFloat(poTaxInput || '0');
  // What to show as the amount prefix in the modal - the resolved project
  // currency, else a neutral label (never EUR). There is no per-PO
  // selector: the backend always stores the order in the project currency.
  const displayCurrency =
    projectCurrency ||
    t('procurement.project_currency', { defaultValue: 'project currency' });

  const canSubmitPO = poForm.items.some((li) => li.description.trim().length > 0);

  const validatePO = (): boolean => {
    const e: Record<string, string> = {};
    const hasAnyItem = poForm.items.some((li) => li.description.trim());
    if (!hasAnyItem) e.items = t('validation.required', { defaultValue: 'Add at least one item' });
    setPoErrors(e);
    return Object.keys(e).length === 0;
  };

  // Only vendor_contact_id, amount_total and each item's description/quantity
  // reach the backend (see CreatePOBody in the façade's procurement route) -
  // po_type, delivery_date, currency and payment terms have no domain
  // backing for a freeform PO, so the form never collects them.
  const createPOMut = useMutation({
    mutationFn: (data: typeof poForm) =>
      apiPost<Record<string, never>>('/v1/procurement/', {
        project_id: projectId,
        vendor_contact_id: data.vendor_contact_id || undefined,
        amount_total: String(poTotal.toFixed(2)),
        items: data.items
          .filter((li) => li.description.trim())
          .map((li) => ({
            description: li.description,
            quantity: li.quantity || '1',
          })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procurement-po', projectId] });
      closeModal();
      addToast({ type: 'success', title: t('procurement.po_created', { defaultValue: 'Purchase order created' }) });
    },
    onError: (e: Error) =>
      addToast({ type: 'error', title: t('common.error', { defaultValue: 'Error' }), message: e.message }),
  });

  /* ── PO issue ──
     Transitions a draft PO to `issued`. The backend enforces the FSM (only
     compiled/draft -> sent_to_office/issued; see sendPurchaseOrder in
     domain/purchaseOrders.ts) and audit-logs the transition. After success
     we re-run the PO list query so the status pipeline and button
     visibility update in place. */
  const issuePOMut = useMutation({
    mutationFn: (poId: string) =>
      apiPost(`/v1/procurement/${poId}/issue/`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procurement-po', projectId] });
      addToast({
        type: 'success',
        title: t('procurement.po_issued_toast', {
          defaultValue: 'Purchase order issued',
        }),
      });
    },
    onError: (e: Error) =>
      addToast({
        type: 'error',
        title: t('common.error', { defaultValue: 'Error' }),
        message: e.message,
      }),
  });

  const { data: ordersPage, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['procurement-po', projectId],
    queryFn: () => fetchPOPage(projectId),
  });
  const orders = ordersPage?.items;

  const filtered = useMemo(() => {
    if (!orders) return [];
    if (!search) return orders;
    const q = search.toLowerCase();
    return orders.filter(
      (po) =>
        (po.po_number ?? '').toLowerCase().includes(q) ||
        (po.vendor_name ?? '').toLowerCase().includes(q),
    );
  }, [orders, search]);

  if (isLoading) return <SkeletonTable rows={5} columns={6} />;

  if (isError) {
    return (
      <Card className="py-12">
        <RecoveryCard error={error} onRetry={() => refetch()} />
      </Card>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <>
        <EmptyState
          icon={<Package size={28} strokeWidth={1.5} />}
          title={t('procurement.no_po', {
            defaultValue: 'No purchase orders yet',
          })}
          description={t('procurement.no_po_desc', {
            defaultValue: 'Create your first purchase order to start tracking procurement.',
          })}
          action={{
            label: t('procurement.new_po', { defaultValue: 'New Purchase Order' }),
            onClick: () => setShowCreate(true),
          }}
        />
        {showCreate && renderPOModal()}
      </>
    );
  }

  /* ── Render PO create modal ── */
  function renderPOModal() {
    const modalTitle = t('procurement.new_po', { defaultValue: 'New Purchase Order' });
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-lg animate-fade-in">
        <div className="w-full max-w-5xl bg-surface-elevated rounded-xl shadow-xl border border-border animate-card-in mx-4 max-h-[88vh] flex flex-col" role="dialog" aria-modal="true" aria-label={modalTitle}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-border-light sticky top-0 z-10 bg-surface-elevated rounded-t-xl">
            <h2 className="text-lg font-semibold text-content-primary">
              {modalTitle}
            </h2>
            <button
              onClick={closeModal}
              aria-label={t('common.close', { defaultValue: 'Close' })}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-content-tertiary hover:bg-surface-secondary hover:text-content-primary transition-colors"
            >
              <X size={18} />
            </button>
          </div>
          <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
            {/* F4 interop hint: shown only when the lines were pre-filled from
                the Resource Summary buy-list, to explain the auto-opened modal
                and prompt the buyer for the supplier + rates the buy-list omits. */}
            {prefilledFromBuyList && (
              <div className="rounded-lg border border-oe-blue/30 bg-oe-blue/5 px-3.5 py-2.5 text-xs text-content-secondary">
                {t('procurement.prefilled_from_buy_list', {
                  defaultValue:
                    'These lines came from the estimate buy-list. Pick a supplier and enter rates, then save to create the draft purchase order.',
                })}
              </div>
            )}
            {/* ── Section: Order Details ── */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-content-tertiary mb-3">
                {t('procurement.section_order_details', { defaultValue: 'Order Details' })}
              </h3>
              <div ref={firstFieldRef}>
                <label className="block text-sm font-medium text-content-primary mb-1.5">
                  {t('procurement.vendor', { defaultValue: 'Vendor' })}
                </label>
                <ContactSearchInput
                  value={poForm.vendor_contact_id}
                  displayValue={poForm.vendor_display}
                  onChange={(id, name) => setPoForm((f) => ({ ...f, vendor_contact_id: id, vendor_display: name }))}
                  placeholder={t('procurement.search_vendor', { defaultValue: 'Search vendor...' })}
                  showBrowse
                  browseContactTypes={['supplier', 'subcontractor']}
                />
              </div>
            </div>

            {/* ── Section: Items ── */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-content-tertiary mb-3">
                {t('procurement.section_items', { defaultValue: 'Items' })} <span className="text-semantic-error">*</span>
              </h3>
              <div className="space-y-2">
                {/* Header row */}
                <div className="hidden sm:grid grid-cols-[1fr_70px_60px_80px_80px_32px] gap-2 text-2xs font-medium text-content-tertiary uppercase tracking-wider px-1">
                  <span>{t('procurement.item_description', { defaultValue: 'Description' })}</span>
                  <span>{t('procurement.item_qty', { defaultValue: 'Qty' })}</span>
                  <span>{t('procurement.item_unit', { defaultValue: 'Unit' })}</span>
                  <span>{t('procurement.item_rate', { defaultValue: 'Rate' })}</span>
                  <span>{t('procurement.item_amount', { defaultValue: 'Amount' })}</span>
                  <span />
                </div>
                {poForm.items.map((li, idx) => (
                  <div key={`item-${li.description.slice(0, 20)}-${idx}`} className="grid grid-cols-1 sm:grid-cols-[1fr_70px_60px_80px_80px_32px] gap-2 items-start">
                    <input
                      value={li.description}
                      onChange={(e) => updateLineItem(idx, 'description', e.target.value)}
                      placeholder={t('procurement.item_desc_placeholder', { defaultValue: 'Item description' })}
                      aria-label={t('procurement.item_description_for', {
                        defaultValue: 'Description for line {{line}}',
                        line: idx + 1,
                      })}
                      className={clsx(inputCls, 'h-9 text-xs')}
                    />
                    <input
                      type="number"
                      step="any"
                      value={li.quantity}
                      onChange={(e) => updateLineItem(idx, 'quantity', e.target.value)}
                      placeholder="1"
                      aria-label={t('procurement.item_qty_for', {
                        defaultValue: 'Quantity for line {{line}}',
                        line: idx + 1,
                      })}
                      className={clsx(inputCls, 'h-9 text-xs')}
                    />
                    <input
                      value={li.unit}
                      onChange={(e) => updateLineItem(idx, 'unit', e.target.value)}
                      placeholder="pcs"
                      aria-label={t('procurement.item_unit_for', {
                        defaultValue: 'Unit for line {{line}}',
                        line: idx + 1,
                      })}
                      className={clsx(inputCls, 'h-9 text-xs')}
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={li.unit_rate}
                      onChange={(e) => updateLineItem(idx, 'unit_rate', e.target.value)}
                      placeholder="0.00"
                      aria-label={t('procurement.item_rate_for', {
                        defaultValue: 'Unit rate for line {{line}}',
                        line: idx + 1,
                      })}
                      className={clsx(inputCls, 'h-9 text-xs')}
                    />
                    <input
                      type="text"
                      readOnly
                      value={li.amount && li.amount !== '0.00' ? li.amount : ''}
                      placeholder="0.00"
                      aria-label={t('procurement.item_amount_for', {
                        defaultValue: 'Amount for line {{line}}',
                        line: idx + 1,
                      })}
                      className={clsx(inputCls, 'h-9 text-xs bg-surface-secondary/50 cursor-default')}
                      tabIndex={-1}
                    />
                    <button
                      type="button"
                      onClick={() => removeLineItem(idx)}
                      className="flex h-9 w-8 items-center justify-center rounded-lg text-content-tertiary hover:text-semantic-error hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                      title={t('common.remove', { defaultValue: 'Remove' })}
                      aria-label={t('procurement.remove_line', {
                        defaultValue: 'Remove line {{line}}',
                        line: idx + 1,
                      })}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Plus size={14} />}
                  onClick={addLineItem}
                  className="mt-1"
                >
                  {t('procurement.add_item', { defaultValue: 'Add Item' })}
                </Button>
              </div>
              {poErrors.items && <p className="mt-1.5 text-xs text-semantic-error">{poErrors.items}</p>}

              {/* Totals */}
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-content-secondary">{t('procurement.subtotal', { defaultValue: 'Subtotal' })}</span>
                  <span className="tabular-nums font-medium text-content-primary">{displayCurrency} {fmtFixed(poSubtotal, 2)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-content-secondary">{t('procurement.tax', { defaultValue: 'Tax' })}</span>
                  <div className="relative w-32">
                    <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-2xs text-content-tertiary font-medium">
                      {projectCurrency}
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      value={poTaxInput}
                      onChange={(e) => setPoTaxInput(e.target.value)}
                      className={clsx(inputCls, 'h-8 text-xs pl-10 text-right')}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-surface-secondary/60 px-3 py-2.5">
                  <span className="text-sm font-semibold text-content-primary">{t('procurement.total', { defaultValue: 'Total' })}</span>
                  <span className="text-base font-bold tabular-nums text-content-primary">{displayCurrency} {fmtFixed(poTotal, 2)}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border-light sticky bottom-0 z-10 bg-surface-elevated rounded-b-xl">
            <Button variant="ghost" onClick={closeModal} disabled={createPOMut.isPending}>
              {t('common.cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (!validatePO()) return;
                createPOMut.mutate(poForm);
              }}
              disabled={createPOMut.isPending || !canSubmitPO}
            >
              {createPOMut.isPending ? (
                <Loader2 size={16} className="animate-spin mr-1.5" />
              ) : (
                <Plus size={16} className="mr-1.5" />
              )}
              <span>{t('common.create', { defaultValue: 'Create' })}</span>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
    <Card padding="none">
      {/* Search + New PO button */}
      <div className="p-4 border-b border-border-light flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-content-tertiary">
            <Search size={16} />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('procurement.search_po', {
              defaultValue: 'Search by PO # or vendor...',
            })}
            aria-label={t('procurement.search_po', {
              defaultValue: 'Search by PO # or vendor...',
            })}
            className="h-10 w-full rounded-lg border border-border bg-surface-primary pl-10 pr-3 text-sm text-content-primary placeholder:text-content-tertiary focus:outline-none focus:ring-2 focus:ring-oe-blue focus:border-transparent"
          />
        </div>
        <div className="shrink-0">
          <Button
            variant="primary"
            size="sm"
            icon={<Plus size={14} />}
            onClick={() => setShowCreate(true)}
          >
            {t('procurement.new_po', { defaultValue: 'New Purchase Order' })}
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="responsive-table w-full text-sm">
          <thead>
            <tr className="border-b border-border-light bg-surface-secondary/50">
              <th className="px-4 py-3 text-left font-medium text-content-tertiary">
                {t('procurement.po_number', { defaultValue: 'PO #' })}
              </th>
              <th className="px-4 py-3 text-left font-medium text-content-tertiary">
                {t('procurement.vendor', { defaultValue: 'Vendor' })}
              </th>
              <th className="px-4 py-3 text-left font-medium text-content-tertiary">
                {t('procurement.issue_date', { defaultValue: 'Date' })}
              </th>
              <th className="px-4 py-3 text-left font-medium text-content-tertiary">
                {t('procurement.delivery_date', { defaultValue: 'Delivery' })}
              </th>
              <th className="px-4 py-3 text-right font-medium text-content-tertiary">
                {t('procurement.amount', { defaultValue: 'Amount' })}
              </th>
              <th className="px-4 py-3 text-center font-medium text-content-tertiary">
                {t('common.status', { defaultValue: 'Status' })}
              </th>
              <th className="px-4 py-3 text-right font-medium text-content-tertiary">
                {t('common.actions', { defaultValue: 'Actions' })}
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-content-tertiary">
                  {t('procurement.no_po_match', { defaultValue: 'No matching purchase orders' })}
                </td>
              </tr>
            ) : filtered.map((po) => (
              <tr
                key={po.id}
                className="border-b border-border-light hover:bg-surface-secondary/30 transition-colors"
              >
                <td className="px-4 py-3 font-mono text-xs text-content-primary" data-label={t('procurement.po_number', { defaultValue: 'PO #' })}>
                  {po.po_number}
                </td>
                <td className="px-4 py-3 text-content-secondary" data-label={t('procurement.vendor', { defaultValue: 'Vendor' })}>
                  {po.vendor_name}
                </td>
                <td className="px-4 py-3 text-content-secondary" data-label={t('procurement.issue_date', { defaultValue: 'Date' })}>
                  <DateDisplay value={po.issue_date} />
                </td>
                <td className="px-4 py-3 text-content-secondary" data-label={t('procurement.delivery_date', { defaultValue: 'Delivery' })}>
                  <div className="flex flex-col items-start gap-1">
                    <DateDisplay value={po.delivery_date} />
                    <DeliveryCountdownBadge
                      deliveryDate={po.delivery_date}
                      status={po.status}
                    />
                  </div>
                </td>
                <td className="px-4 py-3 text-right" data-label={t('procurement.amount', { defaultValue: 'Amount' })}>
                  {/* Money bug fix: feed MoneyDisplay the REAL wire fields
                      `amount_total` (Decimal string) + `currency_code`. The
                      old `po.total_amount`/`po.currency` did not exist on the
                      list response, so every row showed an em-dash. MoneyDisplay
                      accepts string amounts and parses them internally, so no
                      Number() wrapping is needed here. */}
                  <MoneyDisplay amount={po.amount_total} currency={po.currency_code} />
                </td>
                <td className="px-4 py-3 text-center" data-label={t('common.status', { defaultValue: 'Status' })}>
                  <div className="flex flex-col items-center gap-1">
                    <Badge
                      variant={PO_STATUS_COLORS[po.status] ?? 'neutral'}
                      size="sm"
                    >
                      {t(`procurement.po_status_${po.status}`, {
                        defaultValue: po.status,
                      })}
                    </Badge>
                    {/* Visual life-cycle indicator - collapses to a red bar
                        when cancelled, otherwise shows draft/issued/completed.
                        Only these four statuses are ever produced by this
                        backend (see STATUS_MAP in the façade's procurement
                        route). */}
                    <POStatusPipeline status={po.status} />
                  </div>
                </td>
                <td className="px-4 py-3 text-right" data-label={t('common.actions', { defaultValue: 'Actions' })}>
                  {isManager && po.status === 'draft' && (
                  <div className="flex items-center justify-end gap-1 flex-wrap">
                    {/* Issue is the only real workflow action this backend
                        supports beyond create (see registerProcurementRoutes
                        in the façade). It requires the PO to still be a
                        draft - sendPurchaseOrder rejects any other status. */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => issuePOMut.mutate(po.id)}
                      disabled={issuePOMut.isPending}
                      title={t('procurement.action_issue', { defaultValue: 'Issue PO' })}
                      aria-label={t('procurement.action_issue', { defaultValue: 'Issue PO' })}
                    >
                      {issuePOMut.isPending && issuePOMut.variables === po.id ? (
                        <Loader2 size={14} className="animate-spin mr-1" />
                      ) : (
                        <Send size={14} className="mr-1" />
                      )}
                      {t('procurement.action_issue_short', { defaultValue: 'Issue' })}
                    </Button>
                  </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* The search box above filters the rows already loaded, so a register
          cut at 50 answers "no matching purchase orders" for a PO that exists
          on page 2. Reads the server page, not `filtered`. */}
      {ordersPage && <TruncationNotice page={ordersPage} className="mt-3" />}
    </Card>

    {/* PO Create Modal */}
    {showCreate && renderPOModal()}
    </>
  );
}
