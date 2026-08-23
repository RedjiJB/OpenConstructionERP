// DDC-CWICR-OE: DataDrivenConstruction · OpenConstructionERP
// Copyright (c) 2026 Artem Boiko / DataDrivenConstruction
/**
 * Route → lucide icon map for the top-bar page-title chip.
 *
 * The menu half of this map is DERIVED from `./navCatalog`, so a screen's
 * icon in the top bar is the same object as the icon on its sidebar row and
 * the two cannot drift (enforced by `navCatalog.test.ts`).
 *
 * D-Central FieldOps fork (Task #156, frontend-pruning pass): `EXTRA_ROUTE_ICONS`
 * used to carry ~90 hand-kept entries for child/detail/admin routes across
 * the full OpenConstructionERP surface. Only one of those routes survives
 * the pruning pass — `/` — plus one route the trimmed menu has no row for
 * at all: `/notifications`, reached from the header bell rather than the
 * sidebar (same as upstream).
 *
 * `getRouteIcon` does longest-prefix matching so detail routes resolve to
 * their parent module's icon.
 */
import { LayoutDashboard, Bell, type LucideIcon } from 'lucide-react';
import { navGroups } from './navCatalog';

/** Every screen the menu offers, taking each row's own icon. Derived so the
 *  sidebar and the top-bar chip can never disagree. */
const FROM_MENU: Record<string, LucideIcon> = (() => {
  const map: Record<string, LucideIcon> = {};
  for (const group of navGroups) {
    for (const item of group.items) {
      const path = item.to.split('?')[0]!;
      if (!(path in map)) map[path] = item.icon;
    }
  }
  return map;
})();

/** Routes the menu has no row for. Kept by hand because nothing declares
 *  them anywhere else. Merged under `FROM_MENU`, so a path the menu also
 *  names always takes the menu's icon. */
const EXTRA_ROUTE_ICONS: Record<string, LucideIcon> = {
  '/': LayoutDashboard,
  '/notifications': Bell,
};

const ROUTE_ICON_MAP: Record<string, LucideIcon> = { ...EXTRA_ROUTE_ICONS, ...FROM_MENU };

/** Pre-sorted route prefixes, longest first, so the first prefix that
 *  matches in `getRouteIcon` is also the most specific (longest) one. */
const SORTED_ROUTE_PREFIXES: readonly string[] = Object.keys(ROUTE_ICON_MAP).sort(
  (a, b) => b.length - a.length,
);

/**
 * Resolve the lucide icon for a pathname, or `null` when no route matches.
 *
 * Root `/` only matches an exact `/`; every other prefix also matches its
 * own child paths (`/equipment/123` → the `/equipment` icon).
 */
export function getRouteIcon(pathname: string): LucideIcon | null {
  if (!pathname) return null;
  const cleanPath = pathname.split('?')[0]!.split('#')[0]!;

  for (const prefix of SORTED_ROUTE_PREFIXES) {
    if (prefix === '/') {
      if (cleanPath === '/') return ROUTE_ICON_MAP['/']!;
      continue;
    }
    if (cleanPath === prefix || cleanPath.startsWith(prefix + '/')) {
      return ROUTE_ICON_MAP[prefix]!;
    }
  }
  return null;
}
