// Dashboard restoration, Slice I: was DashboardProjectsMap.tsx, plotting
// vendored "projects" that had no native location and needed client-side
// Nominatim geocoding (with a region-centroid fallback) to appear on the
// map at all. FieldOps' sites (src/domain/sites.ts) already carry a real
// address and lat/lng, so all of that geocoding/caching machinery is
// gone -- a site with no coordinates on file just doesn't get a pin,
// same as the honest "no data yet" stance MapPage.tsx already takes for
// crew/vehicle telemetry.
//
// Extended to also plot crew and vehicle locations (from the same
// GET /api/v1/locations MapPage.tsx already uses) -- the dashboard
// widget is a summary of everything on the map, not just sites.
//
// Tiles come straight from public OpenStreetMap (see MapPage.tsx's own
// comment) rather than the vendored basemap.ts proxy, which points at
// the pruned Geo Hub's `/api/v1/geo-hub/tiles/...` backend this façade
// never implements.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Map as MapIcon, MapPin, Users, Truck } from 'lucide-react';
import clsx from 'clsx';
import type { MapRef, MarkerProps, StyleSpecification } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

type MapLibreModule = typeof import('react-map-gl/maplibre');

const OSM_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
};

export type DashboardMapMarkerKind = 'site' | 'crew' | 'vehicle';

export interface DashboardMapMarker {
  id: string;
  kind: DashboardMapMarkerKind;
  name: string;
  lat: number | null;
  lng: number | null;
}

interface DashboardSitesMapProps {
  markers: DashboardMapMarker[];
  className?: string;
  heightClass?: string;
}

interface PlottedMarker {
  id: string;
  kind: DashboardMapMarkerKind;
  name: string;
  lat: number;
  lng: number;
}

const KIND_ICON: Record<DashboardMapMarkerKind, typeof MapPin> = {
  site: MapPin,
  crew: Users,
  vehicle: Truck,
};

// Full literal class strings, not runtime-concatenated -- Tailwind's
// scanner only picks up class names it can find as-written in the source.
const KIND_COLOR: Record<DashboardMapMarkerKind, string> = {
  site: 'bg-oe-blue shadow-oe-blue/40',
  crew: 'bg-oe-purple shadow-oe-purple/40',
  vehicle: 'bg-amber-500 shadow-amber-500/40',
};

const KIND_PING_COLOR: Record<DashboardMapMarkerKind, string> = {
  site: 'bg-oe-blue/25',
  crew: 'bg-oe-purple/25',
  vehicle: 'bg-amber-500/25',
};

export function DashboardSitesMap({ markers, className, heightClass: heightClassProp }: DashboardSitesMapProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [mapLib, setMapLib] = useState<MapLibreModule | null>(null);
  const mapRef = useRef<MapRef | null>(null);

  useEffect(() => {
    let cancelled = false;
    import('react-map-gl/maplibre').then((mod) => {
      if (!cancelled) setMapLib(mod);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const plotted = useMemo<PlottedMarker[]>(
    () =>
      markers
        .filter((m): m is DashboardMapMarker & { lat: number; lng: number } => Number.isFinite(m.lat) && Number.isFinite(m.lng))
        .map((m) => ({ id: m.id, kind: m.kind, name: m.name, lat: m.lat, lng: m.lng })),
    [markers],
  );

  const initialView = useMemo(() => {
    if (plotted.length === 0) {
      return { longitude: -75.6972, latitude: 45.4215, zoom: 8 };
    }
    if (plotted.length === 1) {
      const only = plotted[0]!;
      return { longitude: only.lng, latitude: only.lat, zoom: 11 };
    }
    const lats = plotted.map((m) => m.lat);
    const lngs = plotted.map((m) => m.lng);
    return {
      longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2,
      latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
      zoom: 8,
    };
  }, [plotted]);

  useEffect(() => {
    if (plotted.length < 2) return;
    const map = mapRef.current;
    if (!map) return;
    const lats = plotted.map((m) => m.lat);
    const lngs = plotted.map((m) => m.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const pad = Math.max(0.05, (maxLat - minLat) * 0.1);
    map.fitBounds(
      [
        [minLng - pad, minLat - pad],
        [maxLng + pad, maxLat + pad],
      ],
      {
        padding: { top: 18, bottom: 8, left: 12, right: 12 },
        duration: 600,
        maxZoom: 13,
      },
    );
  }, [plotted]);

  if (markers.length === 0) {
    return null;
  }

  const Map = mapLib?.default;
  const Marker = mapLib?.Marker;

  const heightClass =
    heightClassProp ??
    (markers.length <= 3 ? 'h-48' : markers.length <= 6 ? 'h-56' : 'h-64');

  return (
    <div
      className={clsx(
        'relative overflow-hidden rounded-xl border border-border-light',
        'bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50/30',
        'dark:from-slate-900 dark:via-slate-900/60 dark:to-slate-800',
        heightClass,
        className,
      )}
    >
      {Map && Marker ? (
        <Map
          ref={(instance: MapRef | null) => {
            mapRef.current = instance;
          }}
          initialViewState={initialView}
          mapStyle={OSM_STYLE}
          style={{ width: '100%', height: '100%' }}
          interactive
          dragRotate={false}
          attributionControl={false}
        >
          {plotted.map((m) => {
            const Icon = KIND_ICON[m.kind];
            return (
              <Marker
                key={m.id}
                longitude={m.lng}
                latitude={m.lat}
                anchor="bottom"
                onClick={(e: Parameters<NonNullable<MarkerProps['onClick']>>[0]) => {
                  e.originalEvent.stopPropagation();
                  navigate('/map');
                }}
              >
                <div
                  className="relative flex h-7 w-7 items-center justify-center cursor-pointer group"
                  title={m.name}
                  aria-label={m.name}
                >
                  <span className={clsx('absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity animate-ping', KIND_PING_COLOR[m.kind])} />
                  <span className={clsx('relative flex h-5 w-5 items-center justify-center rounded-full text-white shadow-md ring-2 ring-white', KIND_COLOR[m.kind])}>
                    <Icon size={10} strokeWidth={2.25} />
                  </span>
                </div>
              </Marker>
            );
          })}
        </Map>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-content-tertiary">
          <MapIcon size={24} strokeWidth={1.5} />
        </div>
      )}

      <div className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-md bg-surface-elevated/90 backdrop-blur-sm px-2 py-1 shadow-sm">
        <MapIcon size={11} className="text-oe-blue" strokeWidth={2} />
        <span className="text-[11px] font-medium text-content-primary">
          {t('dashboard.map_title', { defaultValue: 'Locations' })}
        </span>
        <span className="text-[10px] text-content-tertiary tabular-nums">
          {plotted.length}/{markers.length}
        </span>
      </div>
    </div>
  );
}
