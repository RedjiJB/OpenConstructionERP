// Dashboard restoration, Slice I: the "Project locations & weather" card
// from the vendored (now-deleted) DashboardPage.tsx, reassembled around
// real sites instead of estimating "projects". Self-fetching, same
// pattern as the vendored PortfolioOverview widget used to be -- the
// caller just drops <DashboardMapWeather /> in and it owns its own data.
//
// The map also plots crew and vehicle locations (the same real telemetry
// MapPage.tsx already reads via GET /api/v1/locations) alongside sites --
// a dashboard summary of "everything on the map", not sites alone. The
// weather panel stays site-only: a crew member's or vehicle's transient
// last-known position isn't a place to forecast weather for.
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { MapPin } from 'lucide-react';
import { listSites } from '../api';
import { listLocations } from '@/features/map/api';
import { DashboardSitesMap, type DashboardMapMarker } from './DashboardSitesMap';
import { DashboardSitesPanel } from './DashboardSitesPanel';

export function DashboardMapWeather() {
  const { t } = useTranslation();
  const { data: sitesData } = useQuery({
    queryKey: ['dashboard-sites'],
    queryFn: () => listSites(),
    staleTime: 60_000,
  });
  const { data: locationsData } = useQuery({
    queryKey: ['dashboard-locations'],
    queryFn: () => listLocations(),
    staleTime: 30_000,
  });

  const sites = sitesData?.items ?? [];
  const locations = locationsData?.items ?? [];

  const markers: DashboardMapMarker[] = [
    ...sites.map((s): DashboardMapMarker => ({ id: `site:${s.id}`, kind: 'site', name: s.name, lat: s.lat, lng: s.lng })),
    ...locations.map((l): DashboardMapMarker => ({ id: `${l.type}:${l.target_id}`, kind: l.type, name: l.label, lat: l.lat, lng: l.lng })),
  ];

  if (sites.length === 0 && locations.length === 0) return null;

  return (
    <div className="rounded-xl border border-border-light bg-surface-primary/70 p-5 animate-card-in">
      <div className="mb-4 flex items-center gap-2">
        <MapPin size={16} className="text-oe-blue" />
        <h3 className="text-sm font-semibold text-content-primary">
          {t('dashboard.map_section_title', { defaultValue: 'Locations & weather' })}
        </h3>
      </div>
      {/* Fixed panel width, map fills the rest -- this widget now sits on
          its own full-width row (see HomePage.tsx), so a fraction-based
          split would stretch the weather panel absurdly wide on a large
          screen. A fixed 380px keeps it a comfortable, consistent size
          regardless of how much total width the widget has. */}
      <div className="grid grid-cols-1 gap-4 lg:h-[22rem] lg:grid-cols-[1fr_380px]">
        <DashboardSitesMap className="lg:h-full" markers={markers} />
        <DashboardSitesPanel sites={sites} />
      </div>
    </div>
  );
}
