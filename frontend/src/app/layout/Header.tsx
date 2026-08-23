// DDC-CWICR-OE: DataDrivenConstruction · OpenConstructionERP
// Copyright (c) 2026 Artem Boiko / DataDrivenConstruction
import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, ChevronDown, ChevronRight, LogOut, Menu, CheckCircle2, XCircle, Loader2, Upload, Sun, Moon, Monitor } from 'lucide-react';
import clsx from 'clsx';
import { SUPPORTED_LANGUAGES, getLanguageByCode, changeLanguage } from '../i18n';
import { useAuthStore } from '@/stores/useAuthStore';
import { useUploadQueueStore } from '@/stores/useUploadQueueStore';
import { useThemeStore } from '@/stores/useThemeStore';
import { CountryFlag, ModuleInfoButton, PartnerLogoBadge } from '@/shared/ui';
import { usePartnerPack } from '@/shared/hooks/usePartnerPack';
import { NotificationBell } from '@/shared/ui/NotificationBell';
import { useI18nReady } from '@/shared/lib/useI18nReady';
import { isTauri } from '@/shared/lib/desktop';
import { getRouteIcon } from './routeIcons';
import { isModuleI18nKey } from '@/modules/_i18n';

/**
 * Map the English page titles passed from App.tsx routes to i18n keys.
 *
 * An entry must name the same key the screen's own `<h1>` uses, so the top bar,
 * the browser tab title and the page heading say one word. `titleKeyAgreement`
 * in `Header.titleKeys.test.ts` checks every route and fails on a disagreement,
 * on a route neither map knows, and on a stale exemption.
 *
 * This paragraph used to assert the three "can never disagree" and nothing
 * measured it. Nine of them did: the top bar read "Site Mobilisation" over a
 * page whose heading said "Site prep", and "PDF Takeoff" over "PDF
 * Measurements". Because the h1 is `sr-only`, that shipped as one product for a
 * sighted reader and a different one for a screen reader, and no reader saw
 * both halves to notice. An invariant worth stating in prose is worth a test;
 * without one this comment reads as verified and stops the next person looking.
 *
 * When a title has no entry here the heading falls back to the English
 * `defaultValue`, so adding a route without a mapping degrades gracefully
 * rather than showing a raw key. The test is what stops it staying that way.
 */
export const TITLE_I18N_MAP: Record<string, string> = {
  // Overview
  'Dashboard': 'nav.dashboard',
  'Projects': 'nav.projects',
  'New Project': 'projects.new_project',
  'Project': 'nav.projects',
  'Project Settings': 'nav.settings',
  // Legacy title of the module now called Documents. Kept so a page still
  // emitting the old title resolves to the current name rather than the old one.
  'Project Files': 'nav.documents',
  'Project Intelligence': 'nav.estimation_dashboard',
  // Estimation
  'Match Elements': 'match_elements.title',
  'AI Quick Estimate': 'nav.ai_estimate',
  'New BOQ': 'boq.new_estimate',
  'Bill of Quantities': 'boq.title',
  'BOQ Editor': 'boq.editor',
  'BOQ Templates': 'nav.templates',
  // Catalogues
  'Cost Database': 'costs.title',
  'Cost Explorer': 'nav.cost_explorer',
  'Import Cost Database': 'costs.import_title',
  // First-party module routes now state their title as a key, so these entries
  // only catch a module that still ships the English literal.
  'GAEB Exchange': 'nav.gaeb_exchange',
  'Resource Catalog': 'catalog.title',
  'Assemblies': 'nav.assemblies',
  'New Assembly': 'assemblies.new_assembly',
  // No locale names the single-assembly editor, so it takes the module's own
  // name. The keys these two used to point at, assemblies.new and
  // assemblies.editor, exist in no locale at all, which the defaultValue
  // fallback turned into a silently English heading.
  'Assembly Editor': 'assemblies.title',
  // Takeoff & CAD/BIM
  'Quantity Takeoff': 'nav.takeoff_overview',
  'PDF Takeoff': 'nav.pdf_measurements',
  'DWG Takeoff': 'nav.dwg_takeoff',
  'CAD/BIM Takeoff': 'nav.cad_takeoff',
  // #149: keyed on the <P title> App.tsx passes for /data-explorer. Both sides
  // renamed together; a miss here falls back to the raw English title.
  'CAD-BIM BI Explorer': 'nav.cad_bim_explorer',
  'BIM Viewer': 'nav.bim_viewer',
  'BIM Federations': 'nav.bim_federations',
  'BIM Rules': 'nav.bim_rules',
  'Clash Detection': 'nav.clash_detection',
  'Model Coordination': 'nav.coordination_hub',
  'EIR Matrix': 'nav.eir_matrix',
  'Geo Hub': 'sidebar.geo_hub',
  // AI
  'AI Agents': 'nav.ai_agents',
  'AI Cost Advisor': 'nav.ai_advisor',
  'AI Chat': 'nav.erp_chat',
  // Commercial
  'CRM': 'nav.crm',
  'Contracts': 'nav.contracts',
  'Subcontractors': 'nav.subcontractors',
  'Bid Management': 'nav.bid_management',
  'Tendering': 'nav.tendering',
  'Variations': 'nav.variations',
  'Supplier Catalogs': 'nav.supplier_catalogs',
  'Change Orders': 'nav.change_orders',
  // Property development
  'Property Development': 'nav.property_dev',
  'Property Development Dashboards': 'nav.property_dev_dashboards',
  'House Type Catalogue': 'nav.property_dev_house_types',
  'Document Templates': 'nav.property_dev_doc_templates',
  'Bulk Operations': 'nav.property_dev_bulk_operations',
  'Pricing Engine': 'nav.property_dev_pricing_engine',
  'Inventory Map': 'nav.property_dev_inventory_map',
  'Compliance Rule Builder': 'nav.compliance_rule_builder',
  'Accommodation': 'nav.accommodation',
  'Accommodation Calendar': 'nav.accommodation',
  // Planning
  '4D Schedule': 'nav.schedule',
  'Advanced Schedule': 'nav.schedule_advanced',
  'Tasks': 'tasks.title',
  '5D Cost Model': 'nav.5d_cost_model',
  'Risk Register': 'nav.risk_register',
  // Operations
  'Daily Diary': 'nav.daily_diary',
  'Field Reports': 'nav.field_reports',
  'Equipment & Fleet': 'nav.equipment',
  'Resources & Crew': 'nav.resources',
  'Service & Maintenance': 'nav.service',
  'Client & Partner Portal': 'nav.portal',
  'Asset Register': 'nav.assets',
  // Quality & safety
  'Validation': 'nav.validation',
  'Inspections': 'inspections.title',
  'NCR': 'ncr.title',
  'Punch List': 'nav.punchlist',
  'Quality Management': 'nav.qms',
  'Safety': 'safety.title',
  'HSE Management': 'nav.hse_advanced',
  'Carbon & ESG': 'nav.carbon',
  // Communication & documentation
  'Contacts': 'contacts.title',
  'Meetings': 'meetings.title',
  'RFI': 'rfi.title',
  'Submittals': 'submittals.title',
  'Transmittals': 'transmittals.title',
  'Correspondence': 'correspondence.title',
  'CDE': 'cde.title',
  'Project Photos': 'nav.photos',
  'Markups': 'nav.markups',
  'Documents': 'nav.documents',
  // Finance
  'Finance': 'finance.title',
  'Procurement': 'procurement.title',
  // Analytics
  'Reports': 'nav.reports',
  'Project Controls': 'nav.project_controls',
  'BI Dashboards': 'nav.bi_dashboards',
  'Dashboards': 'nav.snapshots',
  'Reporting Dashboards': 'nav.reporting_dashboards',
  'Analytics': 'nav.analytics',
  'Architecture Map': 'nav.architecture_map',
  'Sustainability': 'nav.sustainability',
  // Admin
  'User Management': 'sidebar.admin_grid.users',
  'Audit Log': 'sidebar.admin_grid.audit',
  'Governance': 'sidebar.admin_grid.governance',
  'Modules': 'nav.modules',
  // A module installed from the catalogue renders under a route that titles
  // every one of them "Module". The word was translated everywhere already, as
  // a filter label over in quantities, but a page heading has no business
  // reading its name out of another module's namespace, so the modules
  // namespace now carries it too.
  'Module': 'modules.module_title',
  'E-invoice Clearance': 'nav.einvoice_clearance',
  'Settings': 'nav.settings',
  'About': 'nav.about',
  'Not Found': 'error.not_found',

  /* The map had grown to cover about half the routes, and the half it missed
     included the opening screen of most modules: the heading and the browser
     tab printed English on an otherwise German session. Everything below is a
     route whose words are already translated under some key, so these are
     mappings and not new strings. Where the sidebar names the destination a
     little differently - "Allowances & Contingency" for the route titled
     "Allowances" - the sidebar wins, because the point of this map is that the
     two can never disagree. */

  // Estimation
  'AI Estimate Builder': 'nav.ai_estimator',
  'Assembly Library': 'nav.assembly_library',
  'Basis of Estimate': 'nav.estimate_basis',
  'Conceptual Estimate': 'nav.rom_estimate',
  'Estimate Copilot': 'nav.estimate_copilot',
  'Allowances': 'nav.allowances',
  'Preliminaries': 'nav.preliminaries',
  'Waste Factors': 'nav.waste_factors',
  'Production Norms': 'nav.norm_expansion',
  'Resource Summary': 'nav.resource_summary',
  'Cost Match': 'nav.cost_match',
  'Price Index': 'nav.price_index',
  'Source Data': 'source_data.title',
  'Databases & Resources': 'nav.setup_databases',
  'Currencies': 'nav.fx',
  // Takeoff & CAD/BIM
  'Point Cloud': 'nav.point_cloud',
  'Model Review': 'nav.model_review',
  'Model Issues': 'nav.model_issues',
  'Issues': 'nav.issues',
  'Clash Profiles': 'clash.profiles.title',
  'Design Options': 'nav.design_options',
  'Drawing Sheets': 'sheets.page_title',
  'Plan Room': 'nav.plan_room',
  'Project map': 'geo_hub.project_title',
  'Development map': 'geo_hub.development_title',
  // Commercial
  'Change Intelligence': 'nav.change_intelligence',
  'Claims Evidence': 'nav.claims_evidence',
  'Progress Claim': 'contracts.claim',
  'Withholding Tax': 'nav.tax_withholding',
  'Authority Submissions': 'authority_submission.title',
  'Review Authority': 'review_authority.title',
  'Interface Register': 'interface_management.title',
  'Management of Change': 'moc.title',
  'Event Reconciliation': 'nav.reconciliation',
  // Planning
  'Takt Planning': 'nav.takt',
  'Capacity Planning': 'nav.capacity_planning',
  'Resource Leveling': 'nav.resource_leveling',
  'Progress': 'nav.progress',
  'Construction Control': 'construction_control.title',
  // Field & site
  'Field Time': 'nav.field_time',
  'Labor Rates': 'nav.labor_rates',
  'Payroll': 'nav.payroll',
  'Certified Payroll': 'nav.certified_payroll',
  'Site Supervision': 'site_supervision.title',
  'Site Mobilisation': 'site_prep.title',
  'Site Logistics': 'nav.site_logistics',
  'Site Inventory': 'site_inventory.title',
  'Temporary Works': 'temporary_works.title',
  'Formwork': 'formwork.title',
  'Off-site / Prefab': 'nav.prefab',
  'Forms & checklists': 'nav.forms',
  // Quality, handover & sustainability
  'Commissioning': 'nav.commissioning',
  'Handover & Closeout': 'closeout.title',
  'Defects Liability': 'defects_liability.title',
  'ESG Site Performance': 'nav.esg',
  // Communication & documentation
  'Inbox': 'inbox.title',
  'Notifications': 'nav.notifications',
  'Deadlines': 'deadlines.title',
  'Phone Log': 'nav.phone_log',
  'Inbound Capture': 'nav.inbound_capture',
  'Email Delay Scan': 'nav.inbound_email',
  'Document Connectors': 'nav.connectors',
  'Approvals register': 'files.approvals.register_title',
  'Recycle Bin': 'files.trash.title',
  'Find Records': 'nav.find_records',
  'E-Signatures': 'signing.title',
  // Finance & analytics
  'Payment Clock': 'nav.payment_clock',
  'Cost-Value Reconciliation': 'nav.cvr',
  'Earned Value': 'nav.full_evm',
  'EAC Block Editor': 'eac.editor.title',
  'Value Realized': 'nav.value',
  'Portfolio': 'portfolio.title',
  'Route Classifier': 'project_route.title',
  'Post-calculation': 'postcalc.title',
  // Learning & admin
  'Cases': 'nav.cases',
  'How it works': 'howto.page_title',
  'Inside track': 'inside.page_title',
  'Module Builder': 'nav.module_builder',
  'Pipelines': 'nav.pipelines',
  'Integrations': 'nav.integrations',
  'Credentials': 'nav.credentials',
  'Teams and Visibility': 'teams.title',
  'Map': 'nav.map',
};

/**
 * Resolve the i18n key for a page title (or `null` when there is no mapping).
 * Shared with AppLayout so the browser-tab `document.title` translates the
 * same way the on-screen heading does.
 *
 * A module route states its title as a key already (`ModuleRoute.title`), so
 * such a title is its own answer. Without this the map would miss it, the tab
 * would print the raw key, and the heading and the tab would disagree about
 * the same page.
 */
export function resolvePageTitleKey(title: string | undefined): string | null {
  if (!title) return null;
  return TITLE_I18N_MAP[title] ?? (isModuleI18nKey(title) ? title : null);
}

interface HeaderProps {
  title?: string;
  onMenuClick?: () => void;
}

export function Header({ title, onMenuClick }: HeaderProps) {
  const { t, i18n } = useTranslation();
  // Header mounts at app boot, before lazy-loaded locale chunks arrive.
  // ``useTranslation`` doesn't always pick up bundle-added events under
  // React StrictMode (subscription gets churned by double-mount), so we
  // attach an external-store subscription that survives the remount and
  // forces a re-render whenever a new resource bundle is merged in. The
  // returned version number is unused — its role is to invalidate the
  // memoization React applies to this render.
  useI18nReady();
  // A partner pack drives the centered co-brand chip only. The secondary
  // header actions (search, Support, Subscribe) keep their full labelled
  // form whether or not a pack is active, so the top bar looks the same for
  // every operator. The chip sits in a flex-1 column that yields space, so it
  // never has to push the action buttons into icon-only mode to fit.
  const packActive = usePartnerPack().data?.active === true;
  const location = useLocation();
  const translatedTitle = title
    ? t(resolvePageTitleKey(title) ?? title, { defaultValue: title })
    : undefined;
  // Icon for the active module, mirroring the matching sidebar row. Shown as
  // a small chip before the top-bar title so each module is identifiable at
  // the very top. `null` when the route has no sidebar entry (then nothing
  // renders and the layout is unchanged).
  const RouteIcon = getRouteIcon(location.pathname);
  const currentLang = getLanguageByCode(i18n.language) ?? { code: 'en', name: 'English', flag: '', country: 'gb' };
  const openCommandPalette = useCallback(() => {
    // Dispatch Ctrl+K to open the CommandPalette managed by App.tsx
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
  }, []);

  return (
    <header
      className={clsx(
        'sticky z-30 relative',
        'flex h-header items-center justify-between gap-3 px-4 sm:px-6 lg:px-8',
        'bg-surface-primary/80 backdrop-blur-xl',
      )}
      // In the desktop shell the browser-style toolbar (h-9 = 36px) sits above
      // the header, so the header pins just below it instead of under it. In the
      // normal web build there is no toolbar and it pins to the true top.
      style={{ top: isTauri ? '36px' : 0 }}
    >
      {/* Soft hairline at the bottom — replaces a hard 1px border for
          a calmer modern-SaaS-style separation from the page below. */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      {/* ── Zone 1 (Workspace): mobile menu + project breadcrumb + title ── */}
      <div className="flex items-center gap-3 min-w-0 shrink">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            aria-label={t('common.open_menu', { defaultValue: 'Open menu' })}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-content-secondary hover:bg-surface-secondary lg:hidden"
          >
            <Menu size={20} />
          </button>
        )}

        {/* D-Central FieldOps fork (Task #156): ProjectSwitcher (the
            "Open this project" / "Switch Project" breadcrumb) managed a
            real multi-project workspace that has no backing concept
            here -- this deployment runs on one fixed synthetic project
            (see App.tsx). Its "Open this project" action pointed at the
            now-pruned /projects/:id route regardless. Dropped rather
            than left showing an empty project list. */}

        {translatedTitle && (
          <>
            {/* Breadcrumb separator — only shown on lg+ where the page
                title is visible. Subtle chevron so it reads as
                "ProjectName › PageTitle" hierarchy. */}
            <ChevronRight
              size={14}
              strokeWidth={1.75}
              className="hidden lg:block shrink-0 text-content-quaternary/60"
              aria-hidden
            />
            {/* text-base until xl: at lg widths the right cluster + project
                pill left too little room and module names truncated to
                "Estima..." (uniformity sweep S5 follow-up). */}
            <h1 className="hidden lg:flex items-center gap-2 min-w-0 text-base font-semibold text-content-primary xl:text-lg">
              {/* Module icon — mirrors the active route's sidebar icon so the
                  top title is visually tied to the module. Decorative
                  (aria-hidden); absent (no layout shift) when the route has
                  no sidebar entry. */}
              {RouteIcon && (
                <RouteIcon
                  size={18}
                  strokeWidth={1.75}
                  className="shrink-0 text-content-secondary"
                  aria-hidden
                />
              )}
              <span className="truncate">{translatedTitle}</span>
            </h1>
          </>
        )}

        {/* Collapsed module-info re-opener. When a page's info block is
            collapsed it vanishes from the page entirely (founder decision
            2026-06-06) and registers here: project pill › module name › THIS
            icon. One click re-expands it in the page.

            This is the ONLY re-open control in the product (founder
            2026-08-07). It sits outside the `translatedTitle` block on
            purpose: the title is `hidden lg:flex`, and below lg the icon is
            the sole way back, so gating it on the title would strand a
            collapsed block on every narrow screen. */}
        <ModuleInfoButton />
      </div>

      {/* ── Partner co-brand chip (center column) ───────────────────────
          Sits in a flexible column between the workspace zone (left) and the
          action cluster (right), centered within the clear space. The
          header's true midpoint is occupied by the search box and action
          buttons, so a chip pinned to the exact center lands on top of the
          search field (the "slides under search" bug). Centering it in the
          open gap keeps it fully visible and collision-free at every width,
          which is what an absolute overlay cannot guarantee on a busy header.
          Shown lg+; min-w-0 lets the column yield space instead of pushing
          the zones, and the chip's own name truncation keeps it from
          overflowing. Below lg the co-brand still shows in the dashboard
          banner. */}
      {packActive && (
        <div className="hidden lg:flex flex-1 min-w-0 items-center justify-center px-2">
          <PartnerLogoBadge variant="nav" />
        </div>
      )}

      {/* Right side — three zones separated by hairline dividers.
          Zone 2: Search · Zone 3: Notifications + Help · Zone 4: Account
          (Upload + Language + User). Each zone has internal `gap-1`,
          dividers between zones are 1px hairlines. */}
      <div className="flex items-center gap-2 shrink-0">
        {/* D-Central FieldOps fork (Task #156): ProjectJourneyButton
            opened a whole-platform lifecycle map whose ~60 route chips
            were built for OpenConstructionERP's full ~200-route surface
            -- only 4 of them survived this fork's pruning pass (see
            docs/ARCHITECTURE.md's Task #156 status entries). Rebuilding
            a meaningful "journey" for a flat 8-module tool doesn't make
            sense, so the button is dropped rather than left pointing at
            a mostly-dead-link dialog. */}

        {/* ── Zone 2 (Search) ──────────────────────────────────────── */}
        <button
          onClick={openCommandPalette}
          className={clsx(
            'hidden sm:flex',
            'h-8 items-center gap-2 rounded-lg px-3',
            // Solid-ish white background so the field doesn't dissolve into
            // the translucent header background; falls back to a dark tint
            // in dark mode so the chip stays readable on the dark blurred
            // topbar.
            'border border-border-light bg-white/85 backdrop-blur-sm dark:bg-surface-primary/70',
            'text-sm text-content-tertiary shadow-sm',
            'transition-colors duration-fast ease-oe',
            'hover:border-content-quaternary/40 hover:bg-white dark:hover:bg-surface-primary hover:text-content-secondary',
            // w-56 only at xl: at lg the wide search box squeezed the left
            // workspace zone and truncated the module title.
            'w-40 md:w-44 xl:w-56',
          )}
        >
          <Search size={14} strokeWidth={1.75} className="shrink-0" />
          <span className="truncate">{t('common.search')}</span>
          <kbd className="ml-auto inline-flex items-center gap-0.5 rounded border border-border-light bg-surface-primary px-1 py-px text-[9px] font-medium text-content-quaternary">
            ⌘K
          </kbd>
        </button>

        {/* Mobile search icon — collapses the search bar on tiny screens. */}
        <button
          onClick={openCommandPalette}
          aria-label={t('common.search', { defaultValue: 'Search' })}
          className={clsx(
            'flex sm:hidden',
            'h-8 w-8 items-center justify-center rounded-lg text-content-secondary hover:bg-surface-secondary transition-colors',
          )}
        >
          <Search size={16} />
        </button>

        {/* Hairline divider between Zone 2 and Zone 3. */}
        <div className="hidden sm:block h-4 w-px bg-border-light/70" aria-hidden />

        {/* ── Zone 3 (Notifications) ──────
            D-Central FieldOps fork: What's new, Build a module, Support
            us, and Subscribe were all OpenConstructionERP-the-product
            marketing/growth surfaces (external links to
            openconstructionerp.com, a module-marketplace wizard with no
            surviving destination route) -- dropped, not rebranded, since
            none of them describe this deployment. BugReportMenu and
            HelpMenu are dropped too: their content (a GitHub issue
            template against datadrivenconstruction/OpenConstructionERP,
            a support mailto to the vendor, an in-app "How it works" hub
            at the now-pruned /how-it-works) all pointed at the vendor's
            own support channels, not anything Sod Boys Ltd could stand
            behind -- there's no Sod-Boys-specific replacement to invent
            for a support flow that requires knowing the client's real
            internal process. */}
        <NotificationBell />

        {/* Hairline divider between Zone 3 and Zone 4. */}
        <div className="hidden sm:block h-4 w-px bg-border-light/70" aria-hidden />

        {/* ── Zone 4 (Account) ─────────────────────────────────────── */}
        <UploadQueueIndicator />
        <LanguageSwitcher
          currentLang={currentLang}
          // Load the target locale's lazy chunk BEFORE switching so every
          // string flips to the new language immediately, with no English
          // flash and no reload. See ``changeLanguage`` in app/i18n.
          onSelect={(code) => void changeLanguage(code)}
        />
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}

/* ── Theme Toggle ──────────────────────────────────────────────────────── */

/** Single icon-button that cycles light → dark → system. The icon swaps
 *  to mirror the *current* theme, not the *next* one (modern-SaaS
 *  convention) — users glance at it to see what mode they're in,
 *  click to advance. Lives in Zone 4 next to the avatar so theme +
 *  identity sit together. */
function ThemeToggle() {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  const cycle = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  };

  const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;
  const label =
    theme === 'light'
      ? t('settings.theme_light', { defaultValue: 'Light theme' })
      : theme === 'dark'
        ? t('settings.theme_dark', { defaultValue: 'Dark theme' })
        : t('settings.theme_system', { defaultValue: 'System theme' });

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={label}
      title={label}
      data-testid="theme-toggle"
      data-theme={theme}
      className="hidden sm:flex h-8 w-8 items-center justify-center rounded-lg text-content-tertiary hover:bg-surface-secondary hover:text-content-secondary transition-colors"
    >
      <Icon size={16} strokeWidth={1.75} />
    </button>
  );
}

/* ── Language Switcher Dropdown ─────────────────────────────────────────── */

function LanguageSwitcher({
  currentLang,
  onSelect,
}: {
  currentLang: (typeof SUPPORTED_LANGUAGES)[number] | undefined;
  onSelect: (code: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  // Guard AFTER all hooks so hook order stays stable across renders (Rules of
  // Hooks) - a conditional return before the hooks would crash the header the
  // moment currentLang is ever undefined.
  if (!currentLang) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`Language: ${currentLang.name}`}
        title={currentLang.name}
        className={clsx(
          'flex h-8 items-center gap-1.5 rounded-lg px-2',
          'text-xs font-medium text-content-secondary',
          'transition-all duration-fast ease-oe',
          'hover:bg-surface-secondary',
          open && 'bg-surface-secondary',
        )}
      >
        <CountryFlag code={currentLang.country} size={16} />
        <ChevronDown size={11} className={clsx('transition-transform duration-fast', open && 'rotate-180')} aria-hidden="true" />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-full mt-1.5 w-48 max-h-72 overflow-y-auto rounded-xl border border-border-light bg-surface-elevated shadow-lg animate-scale-in py-1">
          {SUPPORTED_LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              role="menuitem"
              onClick={() => { onSelect(lang.code); setOpen(false); }}
              className={clsx(
                'flex w-full items-center gap-2.5 px-3 py-1.5 text-sm transition-colors',
                lang.code === currentLang.code
                  ? 'bg-oe-blue-subtle text-oe-blue-text font-medium'
                  : 'text-content-primary hover:bg-surface-secondary',
              )}
            >
              <CountryFlag code={lang.country} size={16} />
              <span className="truncate text-xs">{lang.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── User Menu ─────────────────────────────────────────────────────────── */

/**
 * Route prefix → human component name, longest-prefix-wins.
 *
 * The bug report previously derived the "component" from a raw pathname,
 * which named the wrong screen (e.g. a deep-linked `/bim/<uuid>` reported as
 * the root). This table maps the current route to the screen the user is
 * actually on so a filed report points the maintainer at the right surface
 * (#168). Order does not matter — ``deriveComponentFromRoute`` picks the
 * longest matching prefix, so `/bim/federations` beats `/bim`.
 */
const ROUTE_COMPONENT_MAP: ReadonlyArray<readonly [string, string]> = [
  ['/bim/federations', 'BIM Federations'],
  ['/bim/rules', 'BIM Rules'],
  ['/bim', 'BIM Viewer'],
  ['/clash', 'Clash Detection'],
  ['/coordination', 'Model Coordination'],
  ['/assets', 'Asset Register'],
  ['/data-explorer', 'CAD-BIM BI Explorer'],
  ['/match-elements', 'CAD-BIM Match to Cost'],
  ['/boq', 'BOQ'],
  ['/templates', 'BOQ Templates'],
  ['/costs', 'Cost Database'],
  ['/catalog', 'Resource Catalog'],
  ['/assemblies', 'Assemblies'],
  ['/validation', 'Validation'],
  ['/compliance', 'Compliance'],
  ['/quantities', 'Quantity Takeoff'],
  ['/takeoff', 'PDF Takeoff'],
  ['/dwg-takeoff', 'DWG Takeoff'],
  ['/schedule', 'Schedule'],
  ['/5d', '5D Cost Model'],
  ['/analytics', 'Analytics'],
  ['/dashboards', 'Dashboards'],
  ['/reporting', 'Reporting'],
  ['/reports', 'Reports'],
  ['/tendering', 'Tendering'],
  ['/changeorders', 'Change Orders'],
  ['/photos', 'Project Photos'],
  ['/files', 'Documents'],
  ['/risks', 'Risk Register'],
  ['/markups', 'Markups'],
  ['/punchlist', 'Punch List'],
  ['/field-reports', 'Field Reports'],
  ['/finance', 'Finance'],
  ['/procurement', 'Procurement'],
  ['/safety', 'Safety'],
  ['/contacts', 'Contacts'],
  ['/tasks', 'Tasks'],
  ['/rfi', 'RFI'],
  ['/submittals', 'Submittals'],
  ['/correspondence', 'Correspondence'],
  ['/cde', 'CDE'],
  ['/transmittals', 'Transmittals'],
  ['/meetings', 'Meetings'],
  ['/inspections', 'Inspections'],
  ['/ncr', 'NCR'],
  ['/users', 'User Management'],
  ['/admin', 'Admin'],
  ['/approval-routes', 'Approval Routes'],
  ['/modules', 'Modules'],
  ['/setup', 'Setup'],
  ['/settings', 'Settings'],
  ['/integrations', 'Integrations'],
  ['/about', 'About'],
  ['/project-intelligence', 'Project Intelligence'],
  ['/service', 'Service & Maintenance'],
  ['/equipment', 'Equipment & Fleet'],
  ['/daily-diary', 'Daily Diary'],
  ['/portal', 'Client & Partner Portal'],
  ['/resources', 'Resources & Crew'],
  ['/contracts', 'Contracts'],
  ['/payment-clock', 'Payment Clock'],
  ['/tax-withholding', 'Withholding Tax'],
  ['/einvoice-clearance', 'E-invoice Clearance'],
  ['/inbound-email', 'Email Delay Scan'],
  ['/cost-match', 'Cost Match'],
  ['/full-evm', 'Earned Value'],
  ['/fx', 'Currencies'],
  ['/ai-estimate', 'AI Quick Estimate'],
  ['/ai-agents', 'AI Agents'],
  ['/advisor', 'AI Cost Advisor'],
  ['/chat', 'AI Chat'],
  ['/projects', 'Projects'],
];

/**
 * Resolve the human-readable component/screen name for a pathname.
 *
 * Picks the longest matching prefix from ``ROUTE_COMPONENT_MAP`` so nested
 * routes resolve to the most specific screen. A pathname inside a project
 * (``/projects/<id>/finance``) is matched by stripping the project prefix
 * first, then falling back to the project route. ``/`` (root) and anything
 * unknown resolve to a sensible generic ("Dashboard").
 */
export function deriveComponentFromRoute(pathname: string): string {
  if (!pathname || pathname === '/') return 'Dashboard';
  // Nested project routes carry the feature after /projects/<id>/. Match the
  // feature segment first so /projects/<id>/finance reports as "Finance"
  // rather than "Projects".
  const projectNested = pathname.match(/^\/projects\/[^/]+\/(.+)$/);
  const candidate = projectNested ? `/${projectNested[1]}` : pathname;
  let best: string | null = null;
  let bestLen = -1;
  for (const [prefix, name] of ROUTE_COMPONENT_MAP) {
    if (
      (candidate === prefix || candidate.startsWith(prefix + '/')) &&
      prefix.length > bestLen
    ) {
      best = name;
      bestLen = prefix.length;
    }
  }
  return best ?? 'Dashboard';
}

function UserMenu() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const userEmail = useAuthStore((s) => s.userEmail);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const userInitial = userEmail ? userEmail.charAt(0).toUpperCase() : 'U';

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="true"
        className={clsx(
          'relative flex h-8 w-8 items-center justify-center rounded-full',
          'bg-gradient-to-br from-oe-blue to-[#38bdf8] text-xs font-semibold text-white',
          'shadow-[0_1px_3px_rgba(0,122,255,0.25)]',
          'transition-all duration-fast ease-oe',
          'hover:opacity-90 hover:shadow-[0_2px_6px_rgba(0,122,255,0.35)]',
        )}
        title={userEmail ?? undefined}
        aria-label={t('auth.account', { defaultValue: 'Account menu' })}
      >
        {userInitial}
        {/* Online status dot — bottom-right of the avatar. Matches the
            UserBadge in the sidebar so the two surfaces feel coherent. */}
        <span
          aria-hidden
          className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5 items-center justify-center"
        >
          <span className="absolute inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400/70 animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-surface-primary" />
        </span>
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-full mt-1.5 w-48 rounded-xl border border-border-light bg-surface-elevated shadow-lg animate-scale-in py-1">
          {userEmail && (
            <>
              <div className="px-3 py-1.5 text-2xs text-content-tertiary truncate" title={userEmail}>
                {userEmail}
              </div>
              <div className="my-1 border-t border-border-light" role="separator" />
            </>
          )}
          {/* D-Central FieldOps fork (Task #156): Profile and Settings
              both navigated to /settings, which this fork's route
              pruning removed -- self-service profile/settings editing
              isn't wired (admin-provisioned only, see
              docs/ARCHITECTURE.md's Task #156 status entries). Dropped
              rather than left as dead links. */}
          <div className="my-1 border-t border-border-light" role="separator" />
          <button
            role="menuitem"
            onClick={() => { logout(); navigate('/login'); setOpen(false); }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-semantic-error hover:bg-semantic-error-bg transition-colors"
          >
            <LogOut size={14} />
            {t('auth.logout', 'Sign out')}
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Project Switcher (global dropdown in header) ─────────────────────── */

/**
 * Compute where to navigate after switching projects in the global picker.
 *
 * We stay on the same module but never keep a URL that points at an
 * entity (BOQ / BIM model / assembly / transmittal / …) owned by the
 * *previous* project — that entity doesn't belong to the new project,
 * so the page would either 404 or silently show stale data.
 *
 * Rules:
 *   `/projects/:oldId` or `/projects/:oldId/sub` → swap in the new id
 *       (e.g. /projects/AAA/finance → /projects/BBB/finance)
 *   `/<module>/:entityId` where `<module>` is one of the entity-scoped
 *       list-plus-detail modules → redirect to the module list `/<module>`
 *   everything else → stay on the same URL
 */
export function resolveRouteAfterProjectSwitch(
  pathname: string,
  newProjectId: string,
): string | null {
  const projectSub = pathname.match(/^\/projects\/[^/]+(\/.*)?$/);
  if (projectSub) {
    const suffix = projectSub[1] ?? '';
    return `/projects/${newProjectId}${suffix}`;
  }
  // Module-scoped detail routes.  The list lives at /<module>.
  const entityRoutes: Array<[RegExp, string]> = [
    [/^\/boq\/[^/]+/, '/boq'],
    [/^\/bim\/[^/]+/, '/bim'],
    [/^\/assemblies\/[^/]+/, '/assemblies'],
    [/^\/takeoff\/[^/]+/, '/takeoff'],
    [/^\/documents\/[^/]+/, '/documents'],
    [/^\/transmittals\/[^/]+/, '/transmittals'],
    [/^\/rfi\/[^/]+/, '/rfi'],
    [/^\/submittals\/[^/]+/, '/submittals'],
    [/^\/contacts\/[^/]+/, '/contacts'],
    [/^\/tasks\/[^/]+/, '/tasks'],
    [/^\/markups\/[^/]+/, '/markups'],
    [/^\/reports\/[^/]+/, '/reports'],
  ];
  for (const [re, list] of entityRoutes) {
    if (re.test(pathname)) return list;
  }
  return null;
}

/* ── Upload Queue Indicator ────────────────────────────────────────────── */

function UploadQueueIndicator() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const tasks = useUploadQueueStore((s) => s.tasks);
  const removeTask = useUploadQueueStore((s) => s.removeTask);
  const clearCompleted = useUploadQueueStore((s) => s.clearCompleted);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const activeTasks = tasks.filter((t) => t.status === 'processing' || t.status === 'queued');
  const completedTasks = tasks.filter((t) => t.status === 'completed');
  const errorTasks = tasks.filter((t) => t.status === 'error');
  const totalActive = activeTasks.length;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (tasks.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-label={t('queue.title', { defaultValue: 'Upload Queue' })}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={clsx(
          'relative flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
          totalActive > 0 ? 'text-oe-blue-text bg-oe-blue-subtle' : 'text-content-tertiary hover:bg-surface-secondary',
        )}
        title={t('queue.title', { defaultValue: 'Upload Queue' })}
      >
        {totalActive > 0 ? (
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
        ) : (
          <Upload size={16} aria-hidden="true" />
        )}
        {(totalActive > 0 || errorTasks.length > 0) && (
          <span className={`absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white ${
            errorTasks.length > 0 ? 'bg-semantic-error' : 'bg-oe-blue'
          }`}>
            {totalActive || errorTasks.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-border-light bg-surface-elevated shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-light">
            <h3 className="text-xs font-semibold text-content-primary">
              {t('queue.title', { defaultValue: 'Processing Queue' })}
            </h3>
            {completedTasks.length > 0 && (
              <button onClick={clearCompleted} className="text-2xs text-oe-blue hover:underline">
                {t('queue.clear_done', { defaultValue: 'Clear completed' })}
              </button>
            )}
          </div>
          <div className="max-h-64 overflow-y-auto">
            {tasks.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-content-tertiary">
                {t('queue.empty', { defaultValue: 'No tasks' })}
              </p>
            ) : (
              tasks.map((task) => (
                <div key={task.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-border-light last:border-0 hover:bg-surface-secondary/30">
                  <div className="shrink-0">
                    {task.status === 'processing' && <Loader2 size={14} className="text-oe-blue animate-spin" />}
                    {task.status === 'queued' && <Upload size={14} className="text-content-tertiary" />}
                    {task.status === 'completed' && <CheckCircle2 size={14} className="text-semantic-success" />}
                    {task.status === 'error' && <XCircle size={14} className="text-semantic-error" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-content-primary truncate">{task.filename}</p>
                    <div className="flex items-center gap-2">
                      {task.status === 'processing' && (
                        <>
                          <div className="flex-1 h-1 bg-surface-secondary rounded-full overflow-hidden">
                            <div className="h-full bg-oe-blue rounded-full transition-all duration-500" style={{ width: `${task.progress}%` }} />
                          </div>
                          <span className="text-2xs text-content-quaternary tabular-nums">{Math.round(task.progress)}%</span>
                        </>
                      )}
                      {task.status === 'completed' && task.resultUrl && (
                        <button onClick={() => { navigate(task.resultUrl!); setOpen(false); }} className="text-2xs text-oe-blue hover:underline">
                          {t('queue.open_result', { defaultValue: 'Open' })}
                        </button>
                      )}
                      {task.status === 'error' && (
                        <p className="text-2xs text-semantic-error truncate">{task.error || 'Failed'}</p>
                      )}
                      {task.message && task.status === 'processing' && (
                        <p className="text-2xs text-content-quaternary truncate">{task.message}</p>
                      )}
                    </div>
                  </div>
                  {(task.status === 'completed' || task.status === 'error') && (
                    <button
                      onClick={() => removeTask(task.id)}
                      aria-label={t('queue.remove_task', { defaultValue: 'Remove {{filename}} from queue', filename: task.filename })}
                      title={t('queue.remove_task_short', { defaultValue: 'Remove from queue' })}
                      className="shrink-0 p-1 rounded hover:bg-surface-secondary text-content-quaternary"
                    >
                      <XCircle size={12} aria-hidden="true" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
