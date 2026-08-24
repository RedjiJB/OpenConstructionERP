// DDC-CWICR-OE: DataDrivenConstruction · OpenConstructionERP
// Copyright (c) 2026 Artem Boiko / DataDrivenConstruction
//
// The app's screen catalogue: every route the sidebar exposes, its label key,
// its icon and the group it belongs to.
//
// D-Central FieldOps fork (Task #156, frontend-pruning pass): this used to
// list ~200 screens across 19 thematic groups. Only 8 modules have any real
// backing in this project's REST façade (see docs/ARCHITECTURE.md's Task
// #156 status entries), so this catalogue now lists exactly those, in one
// group. Every consumer (Sidebar, routeIcons.ts, CommandPalette.tsx,
// navCatalog.test.ts) picks up the trim automatically.
//
// Adding a screen: add it here. Every consumer picks it up.

import type { LucideIcon } from 'lucide-react';

import {
  LayoutDashboard,
  Truck,
  Users,
  Timer,
  Warehouse,
  Package,
  Wallet,
  ShieldCheck,
  Map,
  Inbox,
  Webhook,
  Settings,
  BarChart3,
  ClipboardList,
  Building2,
} from 'lucide-react';

export interface NavItem {
  labelKey: string;
  /** Human English fallback shown until the `labelKey` locale string is
   *  added, passed to i18next as `defaultValue` so the row never renders a
   *  raw key (mirrors `NavGroup.defaultLabel`). */
  defaultLabel?: string;
  to: string;
  icon: LucideIcon;
  badge?: string;
  highlight?: boolean;
  moduleKey?: string;
  advancedOnly?: boolean; // Hidden in simple mode
  tourId?: string; // data-tour attribute for onboarding
  /** Optional "when to use this" one-liner. Surfaced in the row's hover
   *  tooltip after the label. */
  helpKey?: string;
  defaultHelp?: string;
  /** Optional role gate — hide the entry unless the JWT role matches. */
  roleGate?: ('admin' | 'manager' | 'editor' | 'viewer')[];
  /** Hide entirely unless the current JWT role is `admin`. */
  adminOnly?: boolean;
}

export interface NavGroup {
  id: string;
  labelKey: string;
  defaultLabel?: string;
  descriptionKey?: string;
  defaultDescription?: string;
  items: NavItem[];
  defaultOpen: boolean;
  hideInSimple?: boolean;
  separator?: boolean;
  dynamicGroupKey?: string;
}

// One group: the 8 façade-backed modules, the landing page, and Inbox
// (added on request -- unlike Notifications, which stays reached only
// from the header bell, same as upstream; routeIcons.ts still gives it
// an icon via EXTRA_ROUTE_ICONS for the top-bar title chip).
export const navGroups: NavGroup[] = [
  {
    id: 'grp_overview',
    labelKey: 'sidebar.group.overview',
    defaultLabel: 'Overview',
    defaultOpen: true,
    items: [
      { labelKey: 'nav.dashboard', to: '/', icon: LayoutDashboard },
      { labelKey: 'inbox.title', defaultLabel: 'Inbox', to: '/inbox', icon: Inbox },
      { labelKey: 'nav.equipment', to: '/equipment', icon: Truck },
      { labelKey: 'nav.resources', to: '/resources', icon: Users },
      { labelKey: 'nav.field_time', to: '/field-time', icon: Timer },
      { labelKey: 'site_inventory.title', to: '/site-inventory', icon: Warehouse },
      { labelKey: 'procurement.title', to: '/procurement', icon: Package },
      { labelKey: 'nav.payroll', to: '/payroll', icon: Wallet },
      { labelKey: 'teams.title', defaultLabel: 'Teams and visibility', to: '/teams', icon: ShieldCheck },
      { labelKey: 'nav.map', defaultLabel: 'Map', to: '/map', icon: Map },
      { labelKey: 'webhook_targets.title', defaultLabel: 'Notification Webhooks', to: '/admin/webhook-targets', icon: Webhook, adminOnly: true },
      { labelKey: 'nav.settings', defaultLabel: 'Settings', to: '/settings', icon: Settings },
      { labelKey: 'nav.bi_dashboards', defaultLabel: 'BI Dashboards', to: '/bi-dashboards', icon: BarChart3 },
      { labelKey: 'nav.field_reports', defaultLabel: 'Field Reports', to: '/field-reports', icon: ClipboardList },
      { labelKey: 'nav.vendors', defaultLabel: 'Vendors', to: '/vendors', icon: Building2 },
    ],
  },
];
