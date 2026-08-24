// DDC-CWICR-OE: DataDrivenConstruction · OpenConstructionERP
// Copyright (c) 2026 Artem Boiko / DataDrivenConstruction
//
// D-Central FieldOps fork (Task #156, frontend-pruning pass): this file
// used to declare ~200 lazy()+<Route> pairs for OpenConstructionERP's
// full estimating/BIM/bid-management surface. Of that surface, only 8
// modules have any real backing in this project's REST façade (see
// docs/ARCHITECTURE.md's Task #156 status entries): notifications,
// equipment/fleet, field-time, site-inventory, procurement, payroll,
// resources, and teams. Every other route -- BOQ, BIM, scheduling,
// estimating, property development, the ~170 other modules -- is
// deliberately not mounted here: there is no backend behind them, and a
// route that renders a page which then 404s on every request would be
// worse than no route at all. Self-service auth (signup, forgot-
// password) and user-management CRUD are pruned the same way: this
// backend is admin-provisioned only, via MCP tools, not REST.
//
// This is a deliberate, accepted fork of the upstream App.tsx -- kept in
// place in the vendored submodule per the approved plan, not merged
// back upstream. The dynamic module-registry mechanism
// (useModuleRouteElements / MODULE_REGISTRY) is left wired but the
// registry itself is now empty (see src/modules/_registry.ts) since
// none of its ~17 optional modules (assemblies, schedule, tendering,
// etc.) are among the 8 kept ones either.
import { Suspense, lazy, useState, useCallback, useEffect, useLayoutEffect, useContext, createContext } from 'react';
import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { AppLayout } from './layout';
import { LoginPage, AuthedHome } from '@/features/auth';
import { useModuleRouteElements } from '@/modules/ModuleRoutes';
import { Logo, ShortcutsDialog, CommandPalette, ToastContainer, BackgroundInstallBanner, ErrorBoundary, NotFoundPage, OfflineBanner, PWAInstallPrompt } from '@/shared/ui';
import GlobalSearchModal from '@/features/search/GlobalSearchModal';
import { useGlobalSearchStore } from '@/stores/useGlobalSearchStore';
import { FloatingQueuePanel } from './layout/FloatingQueuePanel';
import { useAuthStore } from '@/stores/useAuthStore';
import { useThemeStore } from '@/stores/useThemeStore';
import { usePreferencesStore } from '@/stores/usePreferencesStore';
import { hydrateInfoBlocksFromServer } from '@/stores/useInfoBlockPrefsStore';
import { useProjectContextStore } from '@/stores/useProjectContextStore';
import { ddcVerifyIntegrity, ddcInjectMeta, DDC_ORIGIN } from '@/shared/lib/ddc-integrity';
import { NavigationProgress } from '@/shared/lib/navigationProgress';
import { useKeyboardShortcuts } from '@/shared/hooks/useKeyboardShortcuts';
import { useTranslation } from 'react-i18next';
import { getLanguageByCode } from './i18n';
import { initErrorLogger } from '@/shared/lib/errorLogger';
import { installDesktopExternalLinks } from '@/shared/lib/desktop';

// Lazy-loaded pages — code-split into separate chunks. Only the 8 kept
// modules plus the new custom landing page.
const HomePage = lazy(() => import('@/features/home/HomePage'));
const NotificationsPage = lazy(() =>
  import('@/features/notifications/NotificationsPage').then((m) => ({ default: m.NotificationsPage }))
);
const EquipmentPage = lazy(() =>
  import('@/features/equipment').then((m) => ({ default: m.EquipmentPage }))
);
const ResourcesPage = lazy(() =>
  import('@/features/resources').then((m) => ({ default: m.ResourcesPage }))
);
const FieldTimePage = lazy(() =>
  import('@/features/field-time').then((m) => ({ default: m.FieldTimePage }))
);
const SiteInventoryPage = lazy(() =>
  import('@/features/site-inventory/SiteInventoryPage').then((m) => ({ default: m.SiteInventoryPage }))
);
const ProcurementPage = lazy(() =>
  import('@/features/procurement/ProcurementPage').then((m) => ({ default: m.ProcurementPage }))
);
const PayrollPage = lazy(() => import('@/features/payroll/PayrollPage'));
const TeamsPage = lazy(() => import('@/features/teams'));
const MapPage = lazy(() => import('@/features/map/MapPage'));
const InboxPage = lazy(() => import('@/features/dashboard/InboxPage'));
const WebhookTargetsPage = lazy(() => import('@/features/admin/WebhookTargetsPage'));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'));
const BIDashboardsPage = lazy(() => import('@/features/bi-dashboards/BIDashboardsPage'));
const FieldReportsPage = lazy(() => import('@/features/fieldreports/FieldReportsPage'));
const VendorsPage = lazy(() => import('@/features/vendors/VendorsPage'));
const SiteCostPage = lazy(() => import('@/features/site-cost/SiteCostPage'));

// This backend has no Projects module, but several kept pages
// (site-inventory, procurement, payroll, teams, field-time) are gated
// client-side on `useProjectContextStore`'s activeProjectId -- a real
// structural fact of the vendored frontend, documented in each façade
// route's own file header. Rather than build a Projects screen with
// nothing behind it, one fixed synthetic project is established once
// per session so those pages work without asking the user to pick
// something that doesn't exist.
const SYNTHETIC_PROJECT_ID = 'fieldops';
const SYNTHETIC_PROJECT_NAME = 'Field Operations';

function LoadingScreen() {
  return (
    <div className="flex h-screen items-center justify-center bg-surface-secondary">
      <div className="flex flex-col items-center gap-3 animate-fade-in">
        <Logo size="lg" animate />
        <div className="h-1 w-16 overflow-hidden rounded-full bg-surface-secondary">
          <div className="h-full w-8 animate-shimmer rounded-full bg-oe-blue opacity-60" />
        </div>
      </div>
    </div>
  );
}

// Small inline loader for lazy page chunks — shown inside the main content
// area while the layout (sidebar + header) stays visible. Prevents the
// full-screen dark flash when navigating between code-split routes.
function PageLoadingInline() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-oe-blue border-t-transparent" />
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const location = useLocation();
  if (!isAuthenticated) {
    const next = `${location.pathname}${location.search}`;
    const qs = next && next !== '/' ? `?next=${encodeURIComponent(next)}` : '';
    return <Navigate to={`/login${qs}`} replace />;
  }
  return <>{children}</>;
}

// Lets each page hand its header title up to the persistent AppShell.
const PageTitleContext = createContext<(title: string) => void>(() => {});

// The persistent application shell. AppShell hoists AppLayout (sidebar +
// header) above the router <Outlet/> so the chrome mounts exactly once
// and only the page area swaps between navigations.
function AppShell() {
  const [title, setTitle] = useState('');
  const location = useLocation();
  return (
    <RequireAuth>
      <AppLayout title={title}>
        <Suspense fallback={<PageLoadingInline />}>
          <ErrorBoundary key={location.pathname}>
            <PageTitleContext.Provider value={setTitle}>
              <Outlet />
            </PageTitleContext.Provider>
          </ErrorBoundary>
        </Suspense>
      </AppLayout>
    </RequireAuth>
  );
}

// Per-page wrapper kept at every route call site. Publishes the page's
// header title to the surrounding AppShell.
function P({ title, children }: { title: string; children: React.ReactNode }) {
  const setTitle = useContext(PageTitleContext);
  useLayoutEffect(() => {
    setTitle(title);
  }, [setTitle, title]);
  return <>{children}</>;
}

/** Mounts global keyboard shortcuts, the shortcuts help dialog, and the command palette. */
function GlobalShortcuts() {
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const handleToggleShortcuts = useCallback(() => {
    setShortcutsOpen((prev) => !prev);
  }, []);

  const noop = useCallback(() => {}, []);

  useKeyboardShortcuts({
    onOpenSearch: noop,
    onToggleShortcutsDialog: handleToggleShortcuts,
  });

  const openGlobalSearch = useGlobalSearchStore((s) => s.openModal);
  const toggleGlobalSearch = useGlobalSearchStore((s) => s.toggleModal);
  const closeGlobalSearch = useGlobalSearchStore((s) => s.closeModal);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const tag = (e.target as HTMLElement)?.tagName;
      const isTextField =
        tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      if (mod && e.shiftKey && (e.key === 'K' || e.key === 'k')) {
        e.preventDefault();
        if (!useGlobalSearchStore.getState().open) {
          setPaletteOpen(false);
        }
        toggleGlobalSearch();
        return;
      }

      if (isTextField) return;

      if (mod && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen((prev) => {
          const next = !prev;
          if (next) closeGlobalSearch();
          return next;
        });
      }
      if (e.key === '/' && !mod) {
        e.preventDefault();
        closeGlobalSearch();
        setPaletteOpen(true);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [toggleGlobalSearch, openGlobalSearch, closeGlobalSearch]);

  return (
    <>
      <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <GlobalSearchModal />
    </>
  );
}

// Run once at module load — synchronous, before any render
useAuthStore.getState().loadFromStorage();
useThemeStore.getState().init();

// Refresh the authoritative role from the server so a user whose role was
// changed by an admin sees the correct UI immediately on the next page load.
useAuthStore.getState().syncRoleFromServer();

// Initialize the anonymized error logger (global handlers for unhandled errors)
initErrorLogger();

// Inject DDC origin meta tags + subtle console banner. These provide
// provenance fingerprints: if someone clones the UI and serves it
// unmodified, the meta tags and console message are direct evidence of
// the origin. Removing them is not a functional break, but does prove
// the distribution was tampered with.
if (typeof document !== 'undefined') {
  ddcInjectMeta();
}
if (typeof window !== 'undefined' && typeof console !== 'undefined') {
  try {
    // eslint-disable-next-line no-console
    console.info(
      `%c${DDC_ORIGIN}%c · Artem Boiko · datadrivenconstruction.io`,
      'color:#0071E3;font-weight:700',
      'color:#64748b',
    );
  } catch { /* noop */ }
}

/** Keeps <html dir="..."> and lang attribute in sync with the active i18n language. */
function useDocumentDirection() {
  const { i18n } = useTranslation();

  useEffect(() => {
    const lang = getLanguageByCode(i18n.language);
    const dir = (lang && 'dir' in lang && lang.dir === 'rtl') ? 'rtl' : 'ltr';
    document.documentElement.dir = dir;
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  useEffect(() => {
    const handler = (lng: string) => {
      const lang = getLanguageByCode(lng);
      const dir = (lang && 'dir' in lang && lang.dir === 'rtl') ? 'rtl' : 'ltr';
      document.documentElement.dir = dir;
      document.documentElement.lang = lng;
    };
    i18n.on('languageChanged', handler);
    return () => { i18n.off('languageChanged', handler); };
  }, [i18n]);
}

export default function App() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  useDocumentDirection();

  // DDC-CWICR-OE integrity verification
  if (typeof window !== 'undefined') {
    (window as any).__ddc_oe = ddcVerifyIntegrity();
  }

  // Desktop shell: outbound links must be handed to the OS browser. No-op
  // in a normal web build.
  useEffect(() => {
    installDesktopExternalLinks();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    // Per-user module info-card collapse state, so a card the user
    // collapsed stays collapsed on every browser and device.
    void hydrateInfoBlocksFromServer();
    // Establish the one synthetic project this backend's project-gated
    // pages need, once per authenticated session. See the constants'
    // comment above for why this exists instead of a real Projects page.
    if (!useProjectContextStore.getState().activeProjectId) {
      useProjectContextStore.getState().setActiveProject(SYNTHETIC_PROJECT_ID, SYNTHETIC_PROJECT_NAME);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      void usePreferencesStore.getState().hydrateFromServer();
    }
  }, [isAuthenticated]);

  // Dynamic routes from the module registry (lazy-loaded) — empty today
  // (src/modules/_registry.ts), kept wired for structural symmetry with
  // upstream rather than ripped out.
  const moduleRoutes = useModuleRouteElements({ Wrapper: P });

  return (
    <Suspense fallback={<LoadingScreen />}>
      <NavigationProgress />
      <OfflineBanner />
      {isAuthenticated && <GlobalShortcuts />}
      <Routes>
        {/* Auth — public. Self-signup and forgot-password are pruned:
            this backend is admin-provisioned only (register_user /
            reset_user_password MCP tools), not a REST self-service flow. */}
        <Route path="/login" element={isAuthenticated ? <AuthedHome /> : <LoginPage />} />

        {/* App — all protected, all real pages. Every route below shares
            one persistent <AppShell/> (sidebar + header mount once). */}
        <Route element={<AppShell />}>
          <Route path="/" element={<P title="Dashboard"><HomePage /></P>} />
          <Route path="/dashboard" element={<P title="Dashboard"><HomePage /></P>} />

          <Route path="/notifications" element={<P title="Notifications"><NotificationsPage /></P>} />
          <Route path="/equipment" element={<P title="Equipment & Fleet"><EquipmentPage /></P>} />
          <Route path="/resources" element={<P title="Resources & Crew"><ResourcesPage /></P>} />
          <Route path="/field-time" element={<P title="Field Time"><FieldTimePage /></P>} />
          <Route path="/site-inventory" element={<P title="Site Inventory"><SiteInventoryPage /></P>} />
          <Route path="/procurement" element={<P title="Procurement"><ProcurementPage /></P>} />
          <Route path="/payroll" element={<P title="Payroll"><PayrollPage /></P>} />
          <Route path="/teams" element={<P title="Teams and Visibility"><TeamsPage /></P>} />
          <Route path="/map" element={<P title="Map"><MapPage /></P>} />
          <Route path="/inbox" element={<P title="Inbox"><InboxPage /></P>} />
          <Route path="/admin/webhook-targets" element={<P title="Notification Webhooks"><WebhookTargetsPage /></P>} />
          <Route path="/settings" element={<P title="Settings"><SettingsPage /></P>} />
          <Route path="/bi-dashboards" element={<P title="BI Dashboards"><BIDashboardsPage /></P>} />
          <Route path="/field-reports" element={<P title="Field Reports"><FieldReportsPage /></P>} />
          <Route path="/vendors" element={<P title="Vendors"><VendorsPage /></P>} />
          <Route path="/5d" element={<P title="Site Cost Summary"><SiteCostPage /></P>} />

          {/* Plugin module routes — lazy-loaded, empty registry today */}
          {moduleRoutes}

          {/* 404 — catch-all for unknown routes */}
          <Route path="*" element={isAuthenticated ? <P title="Not Found"><NotFoundPage /></P> : <Navigate to="/login" replace />} />
        </Route>
      </Routes>
      <ToastContainer />
      <BackgroundInstallBanner />
      <FloatingQueuePanel />
      <PWAInstallPrompt />
      {/* DDC-CWICR-OE */}
      <span aria-hidden="true" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
        {'​‌‍​‌‍​'}
        DataDrivenConstruction·CWICR·OpenConstructionERP·2026
      </span>
    </Suspense>
  );
}
