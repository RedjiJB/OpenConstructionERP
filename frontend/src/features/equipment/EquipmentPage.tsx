// DDC-CWICR-OE: DataDrivenConstruction · OpenConstructionERP
// Copyright (c) 2026 Artem Boiko / DataDrivenConstruction
import { useState, useMemo, useEffect, Fragment, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import clsx from 'clsx';
import {
  Truck,
  Plus,
  Search,
  X,
  Loader2,
  Activity,
  AlertTriangle,
  MapPin,
  Pencil,
  Trash2,
  Save,
  Info,
  Tags,
  Gauge,
  Users,
  Network,
  ArrowRight,
} from 'lucide-react';
import {
  Button,
  Card,
  Badge,
  EmptyState,
  Breadcrumb,
  SkeletonTable,
  ConfirmDialog,
  DismissibleInfo,
  IntroRichText,
  ModuleGuideButton,
  CollapsibleSection,
} from '@/shared/ui';
import { DateDisplay } from '@/shared/ui/DateDisplay';
import { PageHeader } from '@/shared/ui/PageHeader';
import { TruncationNotice } from '@/shared/ui/TruncationNotice';
import { useToastStore } from '@/stores/useToastStore';
import { getErrorMessage } from '@/shared/lib/api';
import { useTabKeyboardNav } from '@/shared/hooks/useTabKeyboardNav';
import {
  listEquipment,
  getEquipment,
  createEquipment,
  updateEquipment,
  deleteEquipment,
  listTelemetry,
  recordTelemetry,
  listTypes,
  type Equipment,
  type EquipmentStatus,
  type Ownership,
  type CreateEquipmentPayload,
  type EquipmentType as ApiEquipmentType,
} from './api';
import { equipmentGuide } from './equipmentGuide';
import { InsightsPanel, InsightsToggleButton, useModuleInsights } from '@/features/insights';
import { buildEquipmentInsights } from './equipmentInsights';
import { fmtPercent, fmtFixed } from '@/shared/lib/formatters';

// English fallbacks for the computed `equipment.ownership_*` keys. The default used to be
// the raw value, so until the key lands in a locale the screen shows the bare
// enum token to every reader, English included. Unknown values still fall
// through to the previous default.
const EQUIPMENT_OWNERSHIP_LABELS: Record<string, string> = {
  owned: 'Owned', rented: 'Rented', leased: 'Leased'
};

// English fallbacks for the computed `equipment.status_*` keys. The default used to be
// the raw value, so until the key lands in a locale the screen shows the bare
// enum token to every reader, English included. Unknown values still fall
// through to the previous default.
const EQUIPMENT_STATUS_LABELS: Record<string, string> = {
  active: 'Active', under_maintenance: 'Under maintenance', decommissioned: 'Decommissioned',
  reserved: 'Reserved'
};


const EQUIPMENT_TAB_IDS = ['assets', 'types'] as const;
type PageTab = (typeof EQUIPMENT_TAB_IDS)[number];

const STATUS_VARIANT: Record<
  EquipmentStatus,
  'neutral' | 'blue' | 'success' | 'warning' | 'error'
> = {
  active: 'success',
  under_maintenance: 'warning',
  decommissioned: 'neutral',
  reserved: 'blue',
};

const inputCls =
  'h-9 w-full rounded-lg border border-border bg-surface-primary px-3 text-sm focus:outline-none focus:ring-2 focus:ring-oe-blue/30 focus:border-oe-blue';

const labelCls = 'block text-xs font-medium text-content-secondary mb-1';

function toNum(n: number | string | null | undefined): number {
  if (n === null || n === undefined) return 0;
  return typeof n === 'number' ? n : Number(n) || 0;
}

/* ── How-it-works flow + module integrations ───────────────────────────── */

/** A compact inline link to a sibling module (keeps the flow copy readable). */
function ModLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="font-medium text-oe-blue-text hover:underline">
      {children}
    </Link>
  );
}

/**
 * Explains, in one glance, what the fleet register does and how it connects to
 * the rest of the platform: register a machine, log its meter readings, then
 * assign it to a crew in Resources. The founder's ask is that every module
 * make its integrations obvious, so the connection is a link.
 */
function HowEquipmentWorks() {
  const { t } = useTranslation();

  const steps: { icon: ReactNode; title: string; desc: string }[] = [
    {
      icon: <Truck size={14} className="text-oe-blue" />,
      title: t('equipment.flow_1_title', { defaultValue: 'Register' }),
      desc: t('equipment.flow_1_desc', {
        defaultValue: 'Add every owned, rented or leased machine to the fleet register.',
      }),
    },
    {
      icon: <Gauge size={14} className="text-oe-blue" />,
      title: t('equipment.flow_2_title', { defaultValue: 'Log readings' }),
      desc: t('equipment.flow_2_desc', {
        defaultValue: 'Record hour-meter and odometer readings to track real utilisation.',
      }),
    },
    {
      icon: <Users size={14} className="text-oe-blue" />,
      title: t('equipment.flow_3_title', { defaultValue: 'Assign' }),
      desc: t('equipment.flow_3_desc', {
        defaultValue: 'Assign active plant to crews from the Resources module.',
      }),
    },
  ];

  return (
    <CollapsibleSection
      storageKey="equipment.how"
      icon={<Network size={15} className="text-oe-blue" />}
      title={t('equipment.flow_title', { defaultValue: 'How the fleet fits together' })}
    >
      <p className="text-xs text-content-tertiary">
        {t('equipment.flow_intro', {
          defaultValue:
            'The register keeps every machine and its running hours in one place, ready to assign to a crew.',
        })}
      </p>

      <ol className="mt-3 flex flex-col gap-2 lg:flex-row lg:items-stretch">
        {steps.map((s, i) => (
          <Fragment key={s.title}>
            <li className="flex-1 rounded-lg border border-border-light bg-surface-secondary/40 p-3">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-oe-blue-subtle text-2xs font-bold text-oe-blue-text">
                  {i + 1}
                </span>
                <span className="flex items-center gap-1 text-xs font-semibold text-content-primary">
                  {s.icon}
                  {s.title}
                </span>
              </div>
              <p className="mt-1.5 text-2xs leading-relaxed text-content-tertiary">{s.desc}</p>
            </li>
            {i < steps.length - 1 && (
              <li
                aria-hidden="true"
                className="hidden shrink-0 items-center self-center text-content-quaternary lg:flex"
              >
                <ArrowRight size={16} />
              </li>
            )}
          </Fragment>
        ))}
      </ol>

      <div className="mt-3 flex flex-col gap-1.5 border-t border-border-light pt-3 text-2xs text-content-tertiary sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5 sm:gap-y-1">
        <span className="font-medium text-content-secondary">
          {t('equipment.flow_connects', { defaultValue: 'Connects with:' })}
        </span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <ModLink to="/resources">
            {t('equipment.mod_resources', { defaultValue: 'Resources & Crew' })}
          </ModLink>
        </span>
      </div>
    </CollapsibleSection>
  );
}

export function EquipmentPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [pageTab, setPageTab] = useState<PageTab>('assets');
  const onTabKeyDown = useTabKeyboardNav<PageTab>({
    ids: EQUIPMENT_TAB_IDS,
    activeId: pageTab,
    onChange: setPageTab,
    orientation: 'horizontal',
  });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [ownershipFilter, setOwnershipFilter] = useState<string>('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const eqQ = useQuery({
    queryKey: ['equipment', 'list', statusFilter, ownershipFilter],
    queryFn: () =>
      listEquipment({
        limit: 200,
        status: statusFilter || undefined,
        ownership: ownershipFilter || undefined,
      }),
  });

  // The fleet is not single-currency; use the most common configured
  // currency among loaded units so the Fleet Intelligence money cells render
  // in something meaningful rather than an em-dash.
  const fleetCurrency = useMemo(() => {
    const items = eqQ.data?.items ?? [];
    const counts = new Map<string, number>();
    for (const it of items) {
      const c = (it.currency || '').trim();
      if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    let best: string | undefined;
    let bestN = 0;
    for (const [c, n] of counts) {
      if (n > bestN) {
        best = c;
        bestN = n;
      }
    }
    return best;
  }, [eqQ.data]);

  const filtered = useMemo(() => {
    const items = eqQ.data?.items ?? [];
    const s = search.toLowerCase();
    if (!s) return items;
    return items.filter(
      (it) =>
        it.code.toLowerCase().includes(s) ||
        it.name.toLowerCase().includes(s) ||
        (it.manufacturer || '').toLowerCase().includes(s) ||
        (it.model || '').toLowerCase().includes(s) ||
        (it.serial || '').toLowerCase().includes(s),
    );
  }, [eqQ.data, search]);

  /* `total` counts the rows the query matched, and the status and ownership
     selects are sent to the server, which applies them before it counts. So
     while either is set the number describes that query rather than the fleet,
     and an answer to a question nobody asked cannot be used to say the fleet
     is empty. The search box is deliberately not part of this test: it filters
     the loaded page here rather than travelling to the server, so it leaves
     `total` alone, and a zero total with neither select set really does mean
     an empty register. */
  const registerMayHold =
    (eqQ.data?.total ?? 0) > 0 || Boolean(statusFilter) || Boolean(ownershipFilter);

  /* Wider than the test above, on purpose. Anything that narrowed what reached
     the screen is worth offering to undo, including the search that left
     `total` untouched. */
  const filtersActive = Boolean(search.trim() || statusFilter || ownershipFilter);
  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setOwnershipFilter('');
  };

  // Module Insights - reads the loaded fleet register (charts, KPIs). Kept
  // among the top hooks, above every conditional render, so hook order is
  // stable no matter which tab or drawer is open.
  const insights = useModuleInsights('equipment', { defaultOpen: true });
  const { datasets: insightDatasets, builtins: insightBuiltins } = useMemo(
    () => buildEquipmentInsights(eqQ.data?.items ?? [], fleetCurrency || '', t),
    [eqQ.data, fleetCurrency, t],
  );

  return (
    <div className="space-y-5">
      <Breadcrumb
        items={[
          {
            label: t('nav.equipment', { defaultValue: 'Equipment & Fleet' }),
          },
        ]}
      />

      <PageHeader
        srTitle={t('equipment.title', { defaultValue: 'Equipment & Fleet' })}
        subtitle={t('equipment.subtitle', {
          defaultValue: 'Track equipment assets and utilization.',
        })}
        actions={
          <>
            <InsightsToggleButton open={insights.open} onClick={insights.toggle} />
            {/* "How it works" guide - explains the fleet register, telemetry,
                maintenance and certification flow. Sits at the head of the
                action cluster; its closing CTA opens the New Asset form. */}
            <ModuleGuideButton
              content={equipmentGuide}
              onCta={() => setCreateOpen(true)}
            />
            <Button
              variant="primary"
              size="sm"
              icon={<Plus size={14} />}
              onClick={() => setCreateOpen(true)}
            >
              {t('equipment.new', { defaultValue: 'New Asset' })}
            </Button>
          </>
        }
      />

      <InsightsPanel
        open={insights.open}
        title={t('equipment.insights.title', { defaultValue: 'Fleet insights' })}
        datasets={insightDatasets}
        builtins={insightBuiltins}
        custom={insights.custom}
        onAdd={insights.addCustom}
        onUpdate={insights.updateCustom}
        onRemove={insights.removeCustom}
        onCollapse={() => insights.setOpen(false)}
      />

      <DismissibleInfo
        storageKey="equipment"
        title={t('equipment.intro_title', {
          defaultValue: 'Keep unsafe plant off the site',
        })}
        more={
          t('equipment.intro_more', { defaultValue: '' })
            ? <IntroRichText text={t('equipment.intro_more')} />
            : undefined
        }
        links={[
          {
            label: t('equipment.intro_link_resources', { defaultValue: 'Resources' }),
            onClick: () => navigate('/resources'),
          },
        ]}
      >
        {t('equipment.intro_body', {
          defaultValue:
            'Register every owned, rented or leased machine, then open an asset to see its hour meter, odometer and telemetry history.',
        })}
      </DismissibleInfo>

      <HowEquipmentWorks />

      <div className="border-b border-border-light">
        <nav
          className="flex gap-1 -mb-px"
          role="tablist"
          aria-label={t('equipment.tabs_aria', { defaultValue: 'Equipment sections' })}
          onKeyDown={onTabKeyDown}
        >
          {(
            [
              { id: 'assets', label: t('equipment.tab_assets', { defaultValue: 'Assets' }), icon: Truck },
              { id: 'types', label: t('equipment.tab_types', { defaultValue: 'Types' }), icon: Tags },
            ] as { id: PageTab; label: string; icon: React.ElementType }[]
          ).map((pt) => {
            const Icon = pt.icon;
            const active = pageTab === pt.id;
            return (
              <button
                key={pt.id}
                type="button"
                role="tab"
                id={`equipment-tab-${pt.id}`}
                aria-selected={active}
                aria-controls={`equipment-panel-${pt.id}`}
                tabIndex={active ? 0 : -1}
                onClick={() => setPageTab(pt.id)}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
                  active
                    ? 'border-oe-blue text-oe-blue'
                    : 'border-transparent text-content-secondary hover:text-content-primary',
                )}
              >
                <Icon size={14} />
                {pt.label}
              </button>
            );
          })}
        </nav>
      </div>

      {pageTab === 'types' ? (
        <TypesPage />
      ) : (
      <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-content-tertiary"
          />
          <input
            type="text"
            placeholder={t('common.search', { defaultValue: 'Search…' })}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={clsx(inputCls, 'pl-8')}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={clsx(inputCls, 'max-w-[180px]')}
        >
          <option value="">
            {t('common.all_statuses', { defaultValue: 'All statuses' })}
          </option>
          {(
            ['active', 'under_maintenance', 'decommissioned', 'reserved'] as EquipmentStatus[]
          ).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={ownershipFilter}
          onChange={(e) => setOwnershipFilter(e.target.value)}
          className={clsx(inputCls, 'max-w-[160px]')}
        >
          <option value="">
            {t('equipment.all_ownership', { defaultValue: 'All ownership' })}
          </option>
          {(['owned', 'rented', 'leased'] as Ownership[]).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>

      <Card padding="none">
        {/* Driven by the SERVER page, not by `filtered`. The search box narrows
            what is on screen and cannot reach the units the server withheld, so
            a search that finds nothing in the first 200 still has to say the
            register was only partly read. The status and ownership selects do
            travel to the server, and `total` counts what they filtered to. */}
        {eqQ.data && <TruncationNotice page={eqQ.data} className="px-4 pt-3" />}
        {eqQ.isLoading ? (
          <div className="p-4">
            <SkeletonTable rows={8} columns={5} />
          </div>
        ) : eqQ.isError ? (
          <EmptyState
            icon={<AlertTriangle size={22} />}
            title={t('equipment.load_error', {
              defaultValue: 'Could not load equipment',
            })}
            description={getErrorMessage(eqQ.error)}
            action={{
              label: t('common.retry', { defaultValue: 'Retry' }),
              onClick: () => {
                void eqQ.refetch();
              },
            }}
          />
        ) : filtered.length === 0 ? (
          /* "No equipment yet" is a claim about the register, not about what
             reached the screen. A search matching none of the loaded page, and
             units the server withheld past that page, both leave `filtered`
             empty while the register holds hundreds: the invitation to register
             a first asset then sits directly beneath a notice reading 200 of
             340. The count alone is no better, because the two selects are
             applied by the server before it counts and so can drive it to zero
             on a full fleet. Only `registerMayHold` separates the cases, and it
             says why. */
          registerMayHold ? (
            <EmptyState
              icon={<Truck size={22} />}
              title={t('common.no_results', { defaultValue: 'No results found' })}
              action={
                filtersActive
                  ? {
                      label: t('common.clear_filters', {
                        defaultValue: 'Clear filters',
                      }),
                      onClick: clearFilters,
                    }
                  : undefined
              }
            />
          ) : (
            <EmptyState
              icon={<Truck size={22} />}
              title={t('equipment.empty', { defaultValue: 'No equipment yet' })}
              description={t('equipment.empty_desc', {
                defaultValue:
                  'Register equipment to track utilization, maintenance schedules and certifications.',
              })}
              action={{
                label: t('equipment.new', { defaultValue: 'New Asset' }),
                onClick: () => setCreateOpen(true),
              }}
            />
          )
        ) : (
          <AssetTable rows={filtered} onSelect={setSelectedId} />
        )}
      </Card>
      </>
      )}

      {selectedId && (
        <DetailDrawer id={selectedId} onClose={() => setSelectedId(null)} />
      )}

      {createOpen && (
        <EquipmentFormModal
          mode="create"
          onClose={() => setCreateOpen(false)}
        />
      )}
    </div>
  );
}

/* ─── Table ─── */

function AssetTable({
  rows,
  onSelect,
}: {
  rows: Equipment[];
  onSelect: (id: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-surface-secondary text-content-tertiary text-xs uppercase tracking-wide">
          <tr>
            <th className="px-4 py-2.5 text-left">
              {t('equipment.col_code', { defaultValue: 'Code' })}
            </th>
            <th className="px-4 py-2.5 text-left">
              {t('equipment.col_name', { defaultValue: 'Name' })}
            </th>
            <th className="px-4 py-2.5 text-left">
              {t('equipment.col_type', { defaultValue: 'Type' })}
            </th>
            <th className="px-4 py-2.5 text-left">
              {t('equipment.col_status', { defaultValue: 'Status' })}
            </th>
            <th className="px-4 py-2.5 text-left">
              {t('equipment.col_location', { defaultValue: 'Location' })}
            </th>
            <th className="px-4 py-2.5 text-right">
              {t('equipment.col_hours', { defaultValue: 'Hours' })}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              onClick={() => onSelect(r.id)}
              className="border-t border-border-light hover:bg-surface-secondary cursor-pointer"
            >
              <td className="px-4 py-2 font-mono text-xs text-content-secondary">
                {r.code}
              </td>
              <td className="px-4 py-2">
                <div className="font-medium text-content-primary truncate max-w-[280px]">
                  {r.name}
                </div>
                {(r.manufacturer || r.model) && (
                  <div className="text-xs text-content-tertiary truncate max-w-[280px]">
                    {[r.manufacturer, r.model].filter(Boolean).join(' · ')}
                  </div>
                )}
              </td>
              <td className="px-4 py-2 text-content-secondary text-xs">
                {r.type_code}
              </td>
              <td className="px-4 py-2">
                <Badge variant={STATUS_VARIANT[r.status]} dot>
                  {r.status}
                </Badge>
              </td>
              <td className="px-4 py-2 text-xs text-content-secondary max-w-[220px]">
                {r.location_lat !== null &&
                r.location_lng !== null &&
                r.location_lat !== undefined &&
                r.location_lng !== undefined ? (
                  <div className="flex flex-col gap-0.5">
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={11} className="shrink-0 text-content-tertiary" />
                      {fmtFixed(r.location_lat, 2)}, {fmtFixed(r.location_lng, 2)}
                    </span>
                    {/* Reverse-geocoded address (Nominatim). Not part of the
                        Equipment contract upstream ships -- the façade rides
                        it in metadata rather than a field this type never had. */}
                    {typeof r.metadata.address === 'string' && r.metadata.address && (
                      <span className="truncate text-content-tertiary" title={r.metadata.address}>
                        {r.metadata.address}
                      </span>
                    )}
                  </div>
                ) : (
                  '—'
                )}
              </td>
              <td className="px-4 py-2 text-right text-xs tabular-nums">
                {fmtFixed(toNum(r.hour_meter), 0)} h
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Detail Drawer ─── */

function DetailDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  // Edit + delete UI state — both gated to the loaded equipment so the
  // header buttons can't fire stale operations against a different id.
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Fetch the single record via the dedicated endpoint. The previous
  // implementation listed up to 500 units and `.find()`-ed the row, which
  // (a) silently returned "asset no longer exists" for any fleet larger
  // than 500 units and (b) refetched the whole list on every drawer open.
  // A 404 here is a genuine "not found"; React Query keeps it in `error`.
  const eqQ = useQuery({
    queryKey: ['equipment', 'detail', id],
    queryFn: () => getEquipment(id),
  });
  const eq = eqQ.data;

  // Close on Escape — symmetric with EquipmentFormModal so keyboard
  // users get a predictable dismissal. Skipped while a destructive
  // confirm/delete is in flight so we don't tear the drawer out from
  // under an in-progress request, and while a child modal is open
  // (that modal handles its own Escape).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.key === 'Escape' &&
        !deleting &&
        !editOpen &&
        !deleteOpen
      ) {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [deleting, editOpen, deleteOpen, onClose]);

  const handleDelete = async () => {
    if (!eq) return;
    setDeleting(true);
    try {
      await deleteEquipment(eq.id);
      addToast({
        type: 'success',
        title: t('equipment.deleted', {
          defaultValue: '{{name}} deleted',
          name: eq.name,
        }),
      });
      // Invalidate every cached query that referenced this asset so the
      // list page and any open child drawers (telemetry) drop their stale
      // rows.
      qc.invalidateQueries({ queryKey: ['equipment'] });
      setDeleteOpen(false);
      onClose();
    } catch (err) {
      addToast({ type: 'error', title: getErrorMessage(err) });
    } finally {
      setDeleting(false);
    }
  };

  const telemetryQ = useQuery({
    queryKey: ['equipment', 'telemetry', id],
    queryFn: () => listTelemetry(id, { limit: 50 }),
    enabled: !!id,
  });

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="equipment-drawer-title"
    >
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative h-full w-full max-w-2xl overflow-y-auto bg-surface-elevated shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border-light bg-surface-elevated px-5 py-3 gap-3">
          <div className="min-w-0 flex-1">
            <h2
              id="equipment-drawer-title"
              className="text-base font-semibold truncate"
            >
              {eq ? `${eq.code} · ${eq.name}` : t('common.loading', { defaultValue: 'Loading…' })}
            </h2>
            {eq?.serial && (
              <p className="text-xs text-content-tertiary">SN: {eq.serial}</p>
            )}
          </div>
          {/* Action toolbar — Edit + Delete + Close. Disabled while the
              equipment is still loading so the buttons cannot fire
              against an undefined id. Each control is its own
              accessible button with aria-label rather than a tooltip-
              only icon, so screen-reader users get the same affordance. */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => navigate('/resources')}
              className="inline-flex items-center gap-1.5 rounded-md border border-border-light bg-surface-primary px-2.5 py-1.5 text-xs font-medium text-content-secondary hover:text-oe-blue-text hover:border-oe-blue hover:bg-oe-blue-subtle transition-colors"
              aria-label={t('equipment.view_assignments', {
                defaultValue: 'View assignments',
              })}
              title={t('equipment.view_assignments_hint', {
                defaultValue: 'Open the crew and resource assignments for this fleet',
              })}
            >
              <Users size={12} />
              {t('equipment.view_assignments', {
                defaultValue: 'View assignments',
              })}
            </button>
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              disabled={!eq}
              className="inline-flex items-center gap-1.5 rounded-md border border-border-light bg-surface-primary px-2.5 py-1.5 text-xs font-medium text-content-secondary hover:text-oe-blue-text hover:border-oe-blue hover:bg-oe-blue-subtle transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={t('common.edit', { defaultValue: 'Edit' })}
              title={t('equipment.edit_hint', {
                defaultValue: 'Edit equipment details',
              })}
            >
              <Pencil size={12} />
              {t('common.edit', { defaultValue: 'Edit' })}
            </button>
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              disabled={!eq}
              className="inline-flex items-center gap-1.5 rounded-md border border-border-light bg-surface-primary px-2.5 py-1.5 text-xs font-medium text-content-secondary hover:text-rose-600 hover:border-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={t('common.delete', { defaultValue: 'Delete' })}
              title={t('equipment.delete_hint', {
                defaultValue: 'Permanently remove this asset',
              })}
            >
              <Trash2 size={12} />
              {t('common.delete', { defaultValue: 'Delete' })}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="ml-1 rounded p-1 hover:bg-surface-secondary"
              aria-label={t('common.close', { defaultValue: 'Close' })}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {!eq && eqQ.isLoading && (
          <div className="p-5">
            <SkeletonTable rows={6} columns={3} />
          </div>
        )}

        {!eq && !eqQ.isLoading && (
          <div className="p-5">
            <EmptyState
              icon={<AlertTriangle size={20} />}
              title={
                eqQ.isError
                  ? t('equipment.detail_error', {
                      defaultValue: 'Could not load this asset',
                    })
                  : t('equipment.detail_not_found', {
                      defaultValue: 'This asset no longer exists',
                    })
              }
              description={
                eqQ.isError ? getErrorMessage(eqQ.error) : undefined
              }
              action={
                eqQ.isError
                  ? {
                      label: t('common.retry', { defaultValue: 'Retry' }),
                      onClick: () => {
                        void eqQ.refetch();
                      },
                    }
                  : {
                      label: t('common.close', { defaultValue: 'Close' }),
                      onClick: onClose,
                    }
              }
            />
          </div>
        )}

        {eq && (
          <>
            <div className="grid grid-cols-2 gap-3 p-5 text-sm border-b border-border-light sm:grid-cols-4">
              <KV
                label={t('equipment.col_status', { defaultValue: 'Status' })}
                value={
                  <Badge variant={STATUS_VARIANT[eq.status]} dot>
                    {eq.status}
                  </Badge>
                }
              />
              <KV
                label={t('equipment.col_type', { defaultValue: 'Type' })}
                value={eq.type_code}
              />
              <KV
                label={t('equipment.ownership', { defaultValue: 'Ownership' })}
                value={eq.ownership}
              />
              <KV
                label={t('equipment.col_hours', { defaultValue: 'Hours' })}
                value={`${fmtFixed(toNum(eq.hour_meter), 0)} h`}
              />
            </div>

            <div className="p-5 space-y-3">
              <UtilizationTab
                equipment={eq}
                telemetry={telemetryQ.data ?? []}
                loading={telemetryQ.isLoading}
              />
            </div>
          </>
        )}
      </div>

      {/* Edit modal — only mounts when the user clicks "Edit" AND the
          equipment record has finished loading. The modal is portalled
          to fixed positioning so it escapes the drawer's overflow-y. */}
      {editOpen && eq && (
        <EquipmentFormModal
          mode="edit"
          existing={eq}
          onClose={() => setEditOpen(false)}
        />
      )}
      {/* Delete confirmation — destructive action, intentionally requires
          a second click. The danger-variant ConfirmDialog already
          handles focus trapping + Escape. */}
      <ConfirmDialog
        open={deleteOpen}
        title={t('equipment.delete_title', {
          defaultValue: 'Delete equipment?',
        })}
        message={
          eq
            ? t('equipment.delete_message', {
                defaultValue:
                  'Delete "{{name}}" ({{code}})? This removes all telemetry linked to this asset. This action cannot be undone.',
                name: eq.name,
                code: eq.code,
              })
            : ''
        }
        confirmLabel={t('common.delete', { defaultValue: 'Delete' })}
        cancelLabel={t('common.cancel', { defaultValue: 'Cancel' })}
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
        loading={deleting}
      />
    </div>
  );
}

/* ── Section header with tooltip + Add button ─────────────────────────── */

function SectionHeader({
  title,
  tooltip,
  addLabel,
  onAdd,
}: {
  title: string;
  tooltip: string;
  addLabel: string;
  onAdd: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5">
        <h3 className="text-sm font-semibold text-content-primary">{title}</h3>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-full p-0.5 text-content-tertiary hover:text-oe-blue hover:bg-oe-blue/10"
          title={tooltip}
          aria-label={t('common.info', { defaultValue: 'Info' })}
        >
          <Info size={13} strokeWidth={2} />
        </button>
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex items-center gap-1.5 rounded-md border border-border-light bg-surface-primary px-2.5 py-1 text-xs font-medium text-content-secondary hover:text-oe-blue-text hover:border-oe-blue hover:bg-oe-blue-subtle transition-colors"
      >
        <Plus size={12} />
        {addLabel}
      </button>
    </div>
  );
}

function UtilizationTab({
  equipment,
  telemetry,
  loading,
}: {
  equipment: Equipment;
  telemetry: { id: string; recorded_at: string; fuel_level?: number | string | null; hour_meter?: number | string | null; odometer_km?: number | string | null; engine_status?: string | null }[];
  loading: boolean;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  const [meterOpen, setMeterOpen] = useState(false);
  return (
    <div className="space-y-3">
      <SectionHeader
        title={t('equipment.utilization.title', {
          defaultValue: 'Utilization & telemetry',
        })}
        tooltip={t('equipment.utilization.tooltip', {
          defaultValue: 'Hour-meter, odometer and fuel-level readings logged for this asset.',
        })}
        addLabel={t('equipment.utilization.add_meter', {
          defaultValue: 'Log meter reading',
        })}
        onAdd={() => setMeterOpen(true)}
      />
      <div className="grid grid-cols-3 gap-2">
        <Card padding="sm">
          <p className="text-xs text-content-tertiary">
            {t('equipment.hour_meter', { defaultValue: 'Hour meter' })}
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {fmtFixed(toNum(equipment.hour_meter), 0)} h
          </p>
        </Card>
        <Card padding="sm">
          <p className="text-xs text-content-tertiary">
            {t('equipment.odometer', { defaultValue: 'Odometer' })}
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {fmtFixed(toNum(equipment.odometer_km), 0)} km
          </p>
        </Card>
        <Card padding="sm">
          <p className="text-xs text-content-tertiary">
            {t('equipment.last_telemetry', { defaultValue: 'Last reading' })}
          </p>
          <p className="mt-1 text-xs">
            {equipment.last_telemetry_at ? (
              <DateDisplay value={equipment.last_telemetry_at} />
            ) : (
              '—'
            )}
          </p>
        </Card>
      </div>

      {loading && <SkeletonTable rows={4} columns={4} />}
      {!loading && telemetry.length === 0 && (
        <EmptyState
          icon={<Activity size={20} />}
          title={t('equipment.no_telemetry', {
            defaultValue: 'No telemetry recorded',
          })}
        />
      )}
      {!loading && telemetry.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border-light">
          <table className="w-full text-xs">
            <thead className="bg-surface-secondary text-content-tertiary uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2 text-left">
                  {t('equipment.recorded_at', { defaultValue: 'Recorded at' })}
                </th>
                <th className="px-3 py-2 text-right">
                  {t('equipment.col_hours', { defaultValue: 'Hours' })}
                </th>
                <th className="px-3 py-2 text-right">
                  {t('equipment.km', { defaultValue: 'km' })}
                </th>
                <th className="px-3 py-2 text-right">
                  {t('equipment.fuel_level', { defaultValue: 'Fuel %' })}
                </th>
                <th className="px-3 py-2 text-left">
                  {t('equipment.engine_status', {
                    defaultValue: 'Engine',
                  })}
                </th>
              </tr>
            </thead>
            <tbody>
              {telemetry.map((r) => (
                <tr key={r.id} className="border-t border-border-light">
                  <td className="px-3 py-2 text-content-secondary">
                    <DateDisplay value={r.recorded_at} />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.hour_meter !== null && r.hour_meter !== undefined
                      ? fmtFixed(toNum(r.hour_meter), 0)
                      : '—'}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.odometer_km !== null && r.odometer_km !== undefined
                      ? fmtFixed(toNum(r.odometer_km), 0)
                      : '—'}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.fuel_level !== null && r.fuel_level !== undefined
                      ? fmtPercent(toNum(r.fuel_level), 0)
                      : '—'}
                  </td>
                  <td className="px-3 py-2 text-content-secondary">
                    {r.engine_status || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {meterOpen && (
        <MeterReadingModal
          equipmentId={equipment.id}
          onClose={() => setMeterOpen(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['equipment'] });
            addToast({
              type: 'success',
              title: t('equipment.telemetry.recorded', {
                defaultValue: 'Reading recorded',
              }),
            });
          }}
        />
      )}
    </div>
  );
}

/* ── MeterReadingModal — single-shot telemetry POST ─────────────────── */

function MeterReadingModal({
  equipmentId,
  onClose,
  onSaved,
}: {
  equipmentId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const addToast = useToastStore((s) => s.addToast);
  const [busy, setBusy] = useState(false);
  const [recordedAt, setRecordedAt] = useState(() =>
    new Date().toISOString().slice(0, 16),
  );
  const [hourMeter, setHourMeter] = useState('');
  const [odometer, setOdometer] = useState('');
  const [fuelLevel, setFuelLevel] = useState('');
  const [engineStatus, setEngineStatus] = useState('');

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', h, { capture: true });
    return () =>
      document.removeEventListener('keydown', h, { capture: true });
  }, [busy, onClose]);

  const submit = async () => {
    setBusy(true);
    try {
      const toNumOpt = (v: string): number | undefined => {
        if (v.trim() === '') return undefined;
        const n = Number(v.replace(',', '.'));
        return Number.isFinite(n) ? n : undefined;
      };
      await recordTelemetry(equipmentId, {
        recorded_at: new Date(recordedAt).toISOString(),
        hour_meter: toNumOpt(hourMeter),
        odometer_km: toNumOpt(odometer),
        fuel_level: toNumOpt(fuelLevel),
        engine_status: engineStatus.trim() || undefined,
      });
      onSaved();
      onClose();
    } catch (err) {
      addToast({ type: 'error', title: getErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-3"
      onClick={() => !busy && onClose()}
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      <div
        className="relative w-full max-w-md rounded-xl bg-surface-elevated p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-content-primary">
            {t('equipment.telemetry.new_title', {
              defaultValue: 'Log meter reading',
            })}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded p-1 hover:bg-surface-secondary disabled:opacity-50"
            aria-label={t('common.close', { defaultValue: 'Close' })}
          >
            <X size={16} />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className={labelCls}>
              {t('equipment.telemetry.recorded_at', {
                defaultValue: 'Recorded at',
              })}
            </label>
            <input
              type="datetime-local"
              value={recordedAt}
              onChange={(e) => setRecordedAt(e.target.value)}
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>
                {t('equipment.hour_meter', { defaultValue: 'Hour meter' })}
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={hourMeter}
                onChange={(e) => setHourMeter(e.target.value)}
                className={inputCls}
                placeholder="1234"
              />
            </div>
            <div>
              <label className={labelCls}>
                {t('equipment.odometer', { defaultValue: 'Odometer (km)' })}
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={odometer}
                onChange={(e) => setOdometer(e.target.value)}
                className={inputCls}
                placeholder="42000"
              />
            </div>
            <div>
              <label className={labelCls}>
                {t('equipment.fuel_level', { defaultValue: 'Fuel %' })}
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={fuelLevel}
                onChange={(e) => setFuelLevel(e.target.value)}
                className={inputCls}
                placeholder="80"
              />
            </div>
            <div>
              <label className={labelCls}>
                {t('equipment.engine_status', { defaultValue: 'Engine' })}
              </label>
              <input
                value={engineStatus}
                onChange={(e) => setEngineStatus(e.target.value)}
                className={inputCls}
                placeholder="idle, running, off"
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t('common.cancel', { defaultValue: 'Cancel' })}
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            loading={busy}
            icon={busy ? <Loader2 size={14} /> : <Gauge size={14} />}
          >
            {t('common.save', { defaultValue: 'Save' })}
          </Button>
        </div>
      </div>
    </div>
  );
}

function KV({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-content-tertiary">
        {label}
      </p>
      <p className="mt-0.5 text-sm text-content-primary">{value}</p>
    </div>
  );
}

/* ─── Types page — flat catalogue of EquipmentType ───────────────── */

/**
 * Read-only catalogue of equipment types. There is no create/edit/delete
 * backend for types (only the list route exists), so this page shows the
 * taxonomy without offering affordances that would silently fail.
 */
function TypesPage() {
  const { t } = useTranslation();

  const typesQ = useQuery({
    queryKey: ['equipment', 'types'],
    queryFn: () => listTypes(),
  });

  /* No truncation notice here on purpose: the route reads the whole taxonomy
     in one query, so `total` can never exceed what `items` already holds. */
  const rows: ApiEquipmentType[] = typesQ.data?.items ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <h2 className="text-base font-semibold text-content-primary">
            {t('equipment.type.page_title', {
              defaultValue: 'Equipment types',
            })}
          </h2>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-full p-0.5 text-content-tertiary hover:text-oe-blue hover:bg-oe-blue/10"
            title={t('equipment.type.page_tooltip', {
              defaultValue:
                'Reference list of equipment categories used to classify assets (excavator, crane, generator, …). Each asset references a type by code. This catalogue is read-only.',
            })}
            aria-label={t('common.info', { defaultValue: 'Info' })}
          >
            <Info size={13} strokeWidth={2} />
          </button>
        </div>
      </div>

      <Card padding="none">
        {typesQ.isLoading ? (
          <div className="p-4">
            <SkeletonTable rows={6} columns={3} />
          </div>
        ) : typesQ.isError ? (
          <EmptyState
            icon={<AlertTriangle size={22} />}
            title={t('equipment.type.load_error', {
              defaultValue: 'Could not load equipment types',
            })}
            description={getErrorMessage(typesQ.error)}
            action={{
              label: t('common.retry', { defaultValue: 'Retry' }),
              onClick: () => {
                void typesQ.refetch();
              },
            }}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Tags size={22} />}
            title={t('equipment.type.empty', {
              defaultValue: 'No equipment types yet',
            })}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-secondary text-content-tertiary text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-2.5 text-left">
                    {t('equipment.type.code', { defaultValue: 'Code' })}
                  </th>
                  <th className="px-4 py-2.5 text-left">
                    {t('equipment.type.name', { defaultValue: 'Name' })}
                  </th>
                  <th className="px-4 py-2.5 text-left">
                    {t('equipment.type.category', { defaultValue: 'Category' })}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-border-light">
                    <td className="px-4 py-2 font-mono text-xs text-content-secondary">
                      {r.code}
                    </td>
                    <td className="px-4 py-2 text-content-primary">{r.name}</td>
                    <td className="px-4 py-2 text-content-secondary text-xs">
                      {r.category}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ─── Equipment form modal (create + edit) ────────────────────────────
 *
 * Single component used for both new-asset registration and editing an
 * existing record. Centralising create + edit in one form keeps the
 * field list, validation rules and UX in lock-step — when a senior
 * reviewer adds a new property (warranty_expiry, GPS provider, …)
 * they only touch one component.
 *
 * Mode semantics:
 *   • mode="create" — POST /api/v1/equipment/equipment/. ``existing`` MUST be omitted.
 *   • mode="edit"   — PATCH /api/v1/equipment/equipment/{id}. ``existing`` is required;
 *                     fields are pre-filled from it and only changed
 *                     fields end up in the PATCH body (avoids touching
 *                     server-managed columns like depreciation_method
 *                     when the user only edits the name).
 *
 * All numeric inputs accept blank strings to mean "no value"; converted
 * to ``number | undefined`` on submit so the backend's Decimal columns
 * receive nulls instead of zeros when the field is intentionally empty.
 */

interface EquipmentFormState {
  code: string;
  name: string;
  type_code: string;
  manufacturer: string;
  model: string;
  serial: string;
  ownership: Ownership;
  status: EquipmentStatus;
  year: string;                   // text input — empty = unset
  purchase_date: string;          // ISO yyyy-mm-dd, empty = unset
  purchase_value: string;
  currency: string;
  useful_life_years: string;
  residual_value: string;
  hour_meter: string;
  odometer_km: string;
  location_lat: string;
  location_lng: string;
  notes: string;
}

function _toFormState(eq: Equipment | undefined): EquipmentFormState {
  // Decimal/numeric columns come back as ``number | string`` from the
  // backend (depending on JSON serialiser). Normalise to string so the
  // <input> stays controlled and round-trips losslessly.
  const numStr = (v: number | string | null | undefined): string =>
    v === null || v === undefined || v === '' ? '' : String(v);
  return {
    code: eq?.code ?? '',
    name: eq?.name ?? '',
    type_code: eq?.type_code ?? 'other',
    manufacturer: eq?.manufacturer ?? '',
    model: eq?.model ?? '',
    serial: eq?.serial ?? '',
    ownership: (eq?.ownership ?? 'owned') as Ownership,
    status: (eq?.status ?? 'active') as EquipmentStatus,
    year: eq?.year ? String(eq.year) : '',
    purchase_date: eq?.purchase_date ?? '',
    purchase_value: numStr(eq?.purchase_value),
    currency: eq?.currency ?? '',
    useful_life_years: eq?.useful_life_years
      ? String(eq.useful_life_years)
      : '',
    residual_value: numStr(eq?.residual_value),
    hour_meter: numStr(eq?.hour_meter),
    odometer_km: numStr(eq?.odometer_km),
    location_lat: numStr(eq?.location_lat),
    location_lng: numStr(eq?.location_lng),
    notes: eq?.notes ?? '',
  };
}

function _toPayload(
  form: EquipmentFormState,
): CreateEquipmentPayload {
  // Empty-string → undefined so backend models leave server-managed
  // defaults (e.g. depreciation_method, decimal columns) alone.
  const toOptStr = (v: string): string | undefined =>
    v.trim() === '' ? undefined : v.trim();
  const toOptNum = (v: string): number | undefined => {
    if (v.trim() === '') return undefined;
    const n = Number(v.replace(',', '.'));
    return Number.isFinite(n) ? n : undefined;
  };
  return {
    code: form.code.trim(),
    name: form.name.trim(),
    type_code: form.type_code.trim() || 'other',
    manufacturer: toOptStr(form.manufacturer),
    model: toOptStr(form.model),
    serial: toOptStr(form.serial),
    year: toOptNum(form.year),
    ownership: form.ownership,
    status: form.status,
    location_lat: toOptNum(form.location_lat),
    location_lng: toOptNum(form.location_lng),
    hour_meter: toOptNum(form.hour_meter),
    odometer_km: toOptNum(form.odometer_km),
    purchase_date: toOptStr(form.purchase_date),
    purchase_value: toOptNum(form.purchase_value),
    // Required by depreciation_value_at — previously collected by the
    // form but silently dropped here, so depreciation never computed and
    // the lat/lng inputs were inert. Now round-tripped.
    useful_life_years: toOptNum(form.useful_life_years),
    residual_value: toOptNum(form.residual_value),
    currency: toOptStr(form.currency),
    notes: toOptStr(form.notes),
  };
}

interface EquipmentFormModalProps {
  mode: 'create' | 'edit';
  existing?: Equipment;
  onClose: () => void;
}

function EquipmentFormModal({
  mode,
  existing,
  onClose,
}: EquipmentFormModalProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<EquipmentFormState>(() =>
    _toFormState(existing),
  );

  // Close on Escape — symmetric with the rest of the modal stack so
  // keyboard users get a predictable dismissal.
  // No focus trap here (the existing CreateModal didn't have one
  // either) — handled separately when we add the design-system Modal.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handler, { capture: true });
    return () =>
      document.removeEventListener('keydown', handler, { capture: true });
  }, [busy, onClose]);

  const submit = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      addToast({
        type: 'error',
        title: t('equipment.code_name_required', {
          defaultValue: 'Code and name are required',
        }),
      });
      return;
    }
    setBusy(true);
    try {
      const payload = _toPayload(form);
      if (mode === 'edit' && existing) {
        // Diff against the original so server-managed columns aren't
        // touched when only the name was changed. This also keeps PATCH
        // requests small and audit logs readable.
        const originalPayload = _toPayload(_toFormState(existing));
        const diff: Partial<CreateEquipmentPayload> = {};
        // Index through ``unknown`` first to satisfy strict-mode TS —
        // CreateEquipmentPayload doesn't carry an index signature, so
        // we explicitly opt into property-bag semantics for the diff.
        const originalRecord = originalPayload as unknown as Record<
          string,
          unknown
        >;
        const newRecord = payload as unknown as Record<string, unknown>;
        const diffRecord = diff as unknown as Record<string, unknown>;
        (Object.keys(payload) as (keyof CreateEquipmentPayload)[]).forEach(
          (k) => {
            if (originalRecord[k] !== newRecord[k]) {
              diffRecord[k] = newRecord[k];
            }
          },
        );
        if (Object.keys(diff).length === 0) {
          // Nothing changed — close without surprising the user with a
          // toast that says "updated" when nothing actually changed.
          onClose();
          return;
        }
        await updateEquipment(existing.id, diff);
        addToast({
          type: 'success',
          title: t('equipment.updated', {
            defaultValue: '{{name}} updated',
            name: form.name.trim(),
          }),
        });
      } else {
        await createEquipment(payload);
        addToast({
          type: 'success',
          title: t('equipment.created', { defaultValue: 'Equipment created' }),
        });
      }
      // Invalidate the whole equipment query family so every dashboard
      // (list view + detail drawer + fleet kpis) re-fetches.
      qc.invalidateQueries({ queryKey: ['equipment'] });
      onClose();
    } catch (err) {
      addToast({ type: 'error', title: getErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const set = <K extends keyof EquipmentFormState>(
    key: K,
    value: EquipmentFormState[K],
  ): void => setForm((prev) => ({ ...prev, [key]: value }));

  const isEdit = mode === 'edit';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-3"
      onClick={() => !busy && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="equipment-form-title"
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      <div
        className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-xl bg-surface-elevated p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2
            id="equipment-form-title"
            className="text-lg font-semibold text-content-primary"
          >
            {isEdit
              ? t('equipment.edit_title', {
                  defaultValue: 'Edit equipment',
                })
              : t('equipment.new', { defaultValue: 'New Asset' })}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded p-1 hover:bg-surface-secondary disabled:opacity-50"
            aria-label={t('common.close', { defaultValue: 'Close' })}
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
          {/* ── Section: Identity ─────────────────────────────────── */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-content-tertiary mb-2">
              {t('equipment.section_identity', {
                defaultValue: 'Identity',
              })}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>
                  {t('equipment.col_code', { defaultValue: 'Code' })}{' '}
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  value={form.code}
                  onChange={(e) => set('code', e.target.value)}
                  className={inputCls}
                  placeholder="EXC-001"
                  // Code is the human-readable handle for the asset and
                  // is also used in URLs / barcodes — disallow editing
                  // on existing records to keep cross-references stable.
                  disabled={isEdit}
                  title={
                    isEdit
                      ? t('equipment.code_immutable_hint', {
                          defaultValue:
                            'Asset code is immutable after creation to keep barcodes / external references stable.',
                        })
                      : undefined
                  }
                />
              </div>
              <div>
                <label className={labelCls}>
                  {t('equipment.col_type', { defaultValue: 'Type code' })}
                </label>
                <input
                  value={form.type_code}
                  onChange={(e) => set('type_code', e.target.value)}
                  className={inputCls}
                  placeholder="excavator, crane, generator…"
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>
                  {t('equipment.col_name', { defaultValue: 'Name' })}{' '}
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  className={inputCls}
                  placeholder={t('equipment.name_placeholder', {
                    defaultValue: 'CAT 320 Excavator – Site A',
                  })}
                />
              </div>
              <div>
                <label className={labelCls}>
                  {t('equipment.manufacturer', { defaultValue: 'Manufacturer' })}
                </label>
                <input
                  value={form.manufacturer}
                  onChange={(e) => set('manufacturer', e.target.value)}
                  className={inputCls}
                  placeholder="Caterpillar"
                />
              </div>
              <div>
                <label className={labelCls}>
                  {t('equipment.model', { defaultValue: 'Model' })}
                </label>
                <input
                  value={form.model}
                  onChange={(e) => set('model', e.target.value)}
                  className={inputCls}
                  placeholder="320 GC"
                />
              </div>
              <div>
                <label className={labelCls}>
                  {t('equipment.serial', { defaultValue: 'Serial number' })}
                </label>
                <input
                  value={form.serial}
                  onChange={(e) => set('serial', e.target.value)}
                  className={inputCls}
                  placeholder="VIN / serial / asset number"
                />
              </div>
              <div>
                <label className={labelCls}>
                  {t('equipment.year', { defaultValue: 'Year of manufacture' })}
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1900}
                  max={new Date().getFullYear() + 1}
                  value={form.year}
                  onChange={(e) => set('year', e.target.value)}
                  className={inputCls}
                  placeholder="2022"
                />
              </div>
            </div>
          </section>

          {/* ── Section: Lifecycle ──────────────────────────────── */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-content-tertiary mb-2">
              {t('equipment.section_lifecycle', {
                defaultValue: 'Lifecycle & status',
              })}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>
                  {t('equipment.ownership', { defaultValue: 'Ownership' })}
                </label>
                <select
                  value={form.ownership}
                  onChange={(e) =>
                    set('ownership', e.target.value as Ownership)
                  }
                  className={inputCls}
                >
                  {(['owned', 'rented', 'leased'] as Ownership[]).map((o) => (
                    <option key={o} value={o}>
                      {t(`equipment.ownership_${o}`, {
                        defaultValue: EQUIPMENT_OWNERSHIP_LABELS[o] ?? o,
                      })}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>
                  {t('equipment.col_status', { defaultValue: 'Status' })}
                </label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    set('status', e.target.value as EquipmentStatus)
                  }
                  className={inputCls}
                >
                  {(
                    [
                      'active',
                      'under_maintenance',
                      'decommissioned',
                      'reserved',
                    ] as EquipmentStatus[]
                  ).map((s) => (
                    <option key={s} value={s}>
                      {t(`equipment.status_${s}`, {
                        defaultValue: EQUIPMENT_STATUS_LABELS[s] ?? s,
                      })}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>
                  {t('equipment.purchase_date', {
                    defaultValue: 'Purchase / start date',
                  })}
                </label>
                <input
                  type="date"
                  value={form.purchase_date}
                  onChange={(e) => set('purchase_date', e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>
                  {t('equipment.useful_life_years', {
                    defaultValue: 'Useful life (years)',
                  })}
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={100}
                  value={form.useful_life_years}
                  onChange={(e) => set('useful_life_years', e.target.value)}
                  className={inputCls}
                  placeholder="10"
                />
              </div>
            </div>
          </section>

          {/* ── Section: Financial ─────────────────────────────── */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-content-tertiary mb-2">
              {t('equipment.section_financial', {
                defaultValue: 'Financial',
              })}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>
                  {t('equipment.purchase_value', {
                    defaultValue: 'Purchase value',
                  })}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.purchase_value}
                  onChange={(e) => set('purchase_value', e.target.value)}
                  className={inputCls}
                  placeholder="125000"
                />
              </div>
              <div>
                <label className={labelCls}>
                  {t('equipment.residual_value', {
                    defaultValue: 'Residual value',
                  })}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.residual_value}
                  onChange={(e) => set('residual_value', e.target.value)}
                  className={inputCls}
                  placeholder="15000"
                />
              </div>
              <div>
                <label className={labelCls}>
                  {t('equipment.currency', { defaultValue: 'Currency' })}
                </label>
                <input
                  value={form.currency}
                  onChange={(e) => set('currency', e.target.value.toUpperCase().slice(0, 3))}
                  className={inputCls}
                  placeholder="EUR"
                  maxLength={3}
                />
              </div>
            </div>
          </section>

          {/* ── Section: Telemetry & location ───────────────── */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-content-tertiary mb-2">
              {t('equipment.section_telemetry', {
                defaultValue: 'Telemetry & location',
              })}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>
                  {t('equipment.hour_meter', { defaultValue: 'Hour meter' })}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.hour_meter}
                  onChange={(e) => set('hour_meter', e.target.value)}
                  className={inputCls}
                  placeholder="1234"
                />
              </div>
              <div>
                <label className={labelCls}>
                  {t('equipment.odometer_km', { defaultValue: 'Odometer (km)' })}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.odometer_km}
                  onChange={(e) => set('odometer_km', e.target.value)}
                  className={inputCls}
                  placeholder="42000"
                />
              </div>
              <div>
                <label className={labelCls}>
                  {t('equipment.location_lat', {
                    defaultValue: 'Location latitude',
                  })}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.location_lat}
                  onChange={(e) => set('location_lat', e.target.value)}
                  className={inputCls}
                  placeholder="52.5200"
                />
              </div>
              <div>
                <label className={labelCls}>
                  {t('equipment.location_lng', {
                    defaultValue: 'Location longitude',
                  })}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.location_lng}
                  onChange={(e) => set('location_lng', e.target.value)}
                  className={inputCls}
                  placeholder="13.4050"
                />
              </div>
            </div>
          </section>

          {/* ── Section: Notes ───────────────────────────────── */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-content-tertiary mb-2">
              {t('equipment.section_notes', { defaultValue: 'Notes' })}
            </h3>
            <textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              className={clsx(inputCls, 'min-h-[80px] py-2 leading-snug')}
              placeholder={t('equipment.notes_placeholder', {
                defaultValue:
                  'Operator notes, warranty contact, attachments, certificate IDs…',
              })}
              maxLength={2000}
              rows={3}
            />
          </section>
        </div>

        <div className="flex justify-end gap-2 mt-5 sticky bottom-0 pt-3 -mx-5 -mb-5 px-5 pb-3 bg-surface-elevated border-t border-border-light">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t('common.cancel', { defaultValue: 'Cancel' })}
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            loading={busy}
            icon={
              busy ? (
                <Loader2 size={14} />
              ) : isEdit ? (
                <Save size={14} />
              ) : (
                <Plus size={14} />
              )
            }
          >
            {isEdit
              ? t('common.save', { defaultValue: 'Save changes' })
              : t('common.create', { defaultValue: 'Create' })}
          </Button>
        </div>
      </div>
    </div>
  );
}
