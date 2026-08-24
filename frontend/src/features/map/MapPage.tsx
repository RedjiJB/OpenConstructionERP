// New, purpose-built map page -- see api.ts's header for why this
// doesn't adapt the vendored Geo Hub module (Cesium/MapLibre viewer
// wired to project pins and a `/api/v1/geo-hub/tiles/...` backend proxy
// this façade never implements). This page points MapLibre directly at
// a public OpenStreetMap raster tile server instead, and plots crew and
// vehicle markers from this backend's own real telemetry data.
//
// There is no live location feed yet -- no WhatsApp location-share
// integration, no vehicle OBD/GPS (both are Phase 3 scope) -- so a
// crew/vehicle only appears here once someone has actually logged a
// location for them, either the manual check-in form below or (once
// Phase 3 lands) a real telemetry ping. An empty map is the honest
// state until then, not a bug.
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Map, { Marker, Popup, NavigationControl, type StyleSpecification } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapPin, Truck, Users, Locate } from 'lucide-react';
import { listLocations, checkIn, listMapSites, createSite, type SiteType } from './api';
import { listResources } from '@/features/resources/api';
import { listEquipment } from '@/features/equipment/api';
import { fmtDate } from '@/shared/lib/formatters';
import { PageHeader } from '@/shared/ui';

type PointKind = 'crew' | 'vehicle' | 'site';

// One shape both marker sources (crew/vehicle telemetry, and the
// site directory) render through, matching the color/icon convention
// the dashboard's own map widget already established
// (DashboardSitesMap.tsx) -- site=blue MapPin, crew=purple Users,
// vehicle=amber Truck.
interface MapPoint {
  id: string;
  kind: PointKind;
  label: string;
  lat: number;
  lng: number;
  address: string | null;
  timestamp: string | null;
}

const SITE_TYPES: SiteType[] = ['job_site', 'depot', 'vendor', 'shop'];

// Direct-to-OpenStreetMap raster tiles. Free, no API key, standard OSM
// tile usage (attribution below is required and included) -- appropriate
// for a small internal tool's request volume; a self-hosted tile proxy
// is the upgrade path if that ever stops being true.
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

// Sod Boys Ltd operates around Ottawa/Ottawa Valley -- a reasonable
// default center when nothing has been logged yet. Re-centers on the
// data itself once any point exists (see initialViewState below).
const DEFAULT_VIEW = { longitude: -75.6972, latitude: 45.4215, zoom: 10 };

const KIND_ICON: Record<PointKind, typeof MapPin> = { site: MapPin, crew: Users, vehicle: Truck };
const KIND_COLOR: Record<PointKind, string> = { site: 'bg-oe-blue', crew: 'bg-oe-purple', vehicle: 'bg-amber-500' };

function MarkerPin({ kind }: { kind: PointKind }) {
  const Icon = KIND_ICON[kind];
  return (
    <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-white shadow-md ${KIND_COLOR[kind]}`}>
      <Icon size={15} />
    </div>
  );
}

function formatTimestamp(iso: string): string {
  return fmtDate(iso, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const SITE_TYPE_LABEL: Record<SiteType, string> = {
  job_site: 'Job site',
  depot: 'Depot',
  vendor: 'Vendor',
  shop: 'Shop',
};

/** Manual "log a location" form -- the stand-in for a live feed until
 *  Phase 3's WhatsApp location-sharing exists. Also doubles as the way
 *  to register a new site from the map, and accepts a typed address as
 *  an alternative to raw lat/lng (server forward-geocodes it). */
function CheckinForm() {
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<PointKind>('crew');
  const [targetId, setTargetId] = useState('');
  const [siteName, setSiteName] = useState('');
  const [siteType, setSiteType] = useState<SiteType>('job_site');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: crewPage } = useQuery({
    queryKey: ['map', 'crew-options'],
    queryFn: () => listResources({ type: 'person', limit: 200 }),
  });
  const { data: equipmentPage } = useQuery({
    queryKey: ['map', 'equipment-options'],
    queryFn: () => listEquipment({ limit: 200 }),
  });

  const options = kind === 'crew'
    ? (crewPage?.items ?? []).map((r) => ({ id: r.id, label: r.name }))
    : (equipmentPage?.items ?? []).map((e) => ({ id: e.id, label: e.name }));

  const resetFields = () => {
    setTargetId('');
    setSiteName('');
    setLat('');
    setLng('');
    setAddress('');
    setError(null);
  };

  const checkinMutation = useMutation({
    mutationFn: checkIn,
    onSuccess: () => {
      resetFields();
      void queryClient.invalidateQueries({ queryKey: ['map', 'locations'] });
    },
    onError: (err: unknown) => setError(err instanceof Error ? err.message : 'Check-in failed'),
  });

  const siteMutation = useMutation({
    mutationFn: createSite,
    onSuccess: () => {
      resetFields();
      void queryClient.invalidateQueries({ queryKey: ['map', 'sites'] });
    },
    onError: (err: unknown) => setError(err instanceof Error ? err.message : 'Could not register that site'),
  });

  const isPending = checkinMutation.isPending || siteMutation.isPending;

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setError('This browser has no geolocation support');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(String(pos.coords.latitude));
        setLng(String(pos.coords.longitude));
        setAddress('');
      },
      () => setError('Could not read this device’s location'),
    );
  };

  // Either a typed address (server resolves it) or both coordinates --
  // never neither.
  function resolveLocation(): { lat?: number; lng?: number; address?: string } | null {
    if (address.trim()) return { address: address.trim() };
    const latNum = Number(lat);
    const lngNum = Number(lng);
    if (Number.isFinite(latNum) && Number.isFinite(lngNum) && lat !== '' && lng !== '') {
      return { lat: latNum, lng: lngNum };
    }
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const location = resolveLocation();
    if (!location) {
      setError('Enter an address, or both latitude and longitude');
      return;
    }

    if (kind === 'site') {
      if (!siteName.trim()) {
        setError('Enter a site name');
        return;
      }
      siteMutation.mutate({ name: siteName.trim(), type: siteType, ...location });
      return;
    }

    if (!targetId) {
      setError('Choose who or what to check in');
      return;
    }
    checkinMutation.mutate({ type: kind, target_id: targetId, ...location });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg border border-border bg-surface-elevated p-4">
      <div className="text-sm font-medium text-content-primary">Log a location</div>
      <p className="text-xs text-content-secondary">
        No live feed exists yet, so this is how a location gets on the map today -- record where someone, something, or a site actually is.
      </p>

      <div className="flex gap-2">
        {(['crew', 'vehicle', 'site'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => { setKind(k); resetFields(); }}
            className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              kind === k ? 'border-oe-blue bg-oe-blue/10 text-oe-blue' : 'border-border text-content-secondary hover:bg-surface-secondary'
            }`}
          >
            {k === 'crew' ? 'Crew' : k === 'vehicle' ? 'Vehicle' : 'Site'}
          </button>
        ))}
      </div>

      {kind === 'site' ? (
        <>
          <input
            type="text"
            placeholder="Site name"
            value={siteName}
            onChange={(e) => setSiteName(e.target.value)}
            className="rounded-lg border border-border bg-surface-primary px-3 py-2 text-sm text-content-primary placeholder:text-content-tertiary"
          />
          <select
            value={siteType}
            onChange={(e) => setSiteType(e.target.value as SiteType)}
            className="rounded-lg border border-border bg-surface-primary px-3 py-2 text-sm text-content-primary"
          >
            {SITE_TYPES.map((t) => (
              <option key={t} value={t}>{SITE_TYPE_LABEL[t]}</option>
            ))}
          </select>
        </>
      ) : (
        <select
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
          className="rounded-lg border border-border bg-surface-primary px-3 py-2 text-sm text-content-primary"
        >
          <option value="">{kind === 'crew' ? 'Select a crew member' : 'Select a vehicle'}</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
      )}

      <input
        type="text"
        placeholder="Address (or enter coordinates below)"
        value={address}
        onChange={(e) => { setAddress(e.target.value); if (e.target.value) { setLat(''); setLng(''); } }}
        className="rounded-lg border border-border bg-surface-primary px-3 py-2 text-sm text-content-primary placeholder:text-content-tertiary"
      />

      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-border" />
        <span className="text-2xs uppercase tracking-wide text-content-tertiary">or</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          inputMode="decimal"
          placeholder="Latitude"
          value={lat}
          onChange={(e) => { setLat(e.target.value); if (e.target.value) setAddress(''); }}
          className="w-1/2 rounded-lg border border-border bg-surface-primary px-3 py-2 text-sm text-content-primary placeholder:text-content-tertiary"
        />
        <input
          type="text"
          inputMode="decimal"
          placeholder="Longitude"
          value={lng}
          onChange={(e) => { setLng(e.target.value); if (e.target.value) setAddress(''); }}
          className="w-1/2 rounded-lg border border-border bg-surface-primary px-3 py-2 text-sm text-content-primary placeholder:text-content-tertiary"
        />
      </div>

      <button
        type="button"
        onClick={useMyLocation}
        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-content-secondary hover:bg-surface-secondary"
      >
        <Locate size={13} /> Use my current location
      </button>

      {error && <div className="text-xs text-semantic-error">{error}</div>}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-oe-blue px-3 py-2 text-sm font-medium text-white hover:bg-oe-blue-hover disabled:opacity-50"
      >
        {isPending ? 'Logging…' : 'Log location'}
      </button>
    </form>
  );
}

export default function MapPage() {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<MapPoint | null>(null);

  const { data: locationsData, isLoading: locationsLoading } = useQuery({
    queryKey: ['map', 'locations'],
    queryFn: listLocations,
    refetchInterval: 30_000,
  });
  const { data: sitesData, isLoading: sitesLoading } = useQuery({
    queryKey: ['map', 'sites'],
    queryFn: listMapSites,
  });

  const isLoading = locationsLoading || sitesLoading;

  // Sites (unlike crew/vehicle telemetry) are permanent, registered
  // places, not transient pings -- always plotted regardless of any
  // check-in ever happening, and used to anchor the default view below
  // so it stays put near where work actually happens (HQ, depots) rather
  // than drifting toward wherever a crew member's last ping was.
  const sitePoints: MapPoint[] = useMemo(
    () =>
      (sitesData?.items ?? [])
        .filter((s) => s.lat !== null && s.lng !== null)
        .map((s) => ({
          id: s.id,
          kind: 'site' as const,
          label: s.name,
          lat: s.lat as number,
          lng: s.lng as number,
          address: s.address,
          timestamp: null,
        })),
    [sitesData],
  );

  const crewVehiclePoints: MapPoint[] = useMemo(
    () =>
      (locationsData?.items ?? []).map((p) => ({
        id: p.id,
        kind: p.type,
        label: p.label,
        lat: p.lat,
        lng: p.lng,
        address: p.address,
        timestamp: p.timestamp,
      })),
    [locationsData],
  );

  const points: MapPoint[] = useMemo(() => [...sitePoints, ...crewVehiclePoints], [sitePoints, crewVehiclePoints]);

  const initialViewState = useMemo(() => {
    // Anchor on sites when any exist -- they're the stable reference
    // points (HQ, depots, job sites); only fall back to averaging
    // crew/vehicle pings when no site has been registered yet.
    const anchor = sitePoints.length > 0 ? sitePoints : points;
    if (anchor.length === 0) return DEFAULT_VIEW;
    const avgLat = anchor.reduce((sum, p) => sum + p.lat, 0) / anchor.length;
    const avgLng = anchor.reduce((sum, p) => sum + p.lng, 0) / anchor.length;
    return { longitude: avgLng, latitude: avgLat, zoom: 11 };
    // Only recomputed on first load -- re-centering under the user while
    // they're panning around would be disorienting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points.length > 0]);

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <PageHeader
        srTitle={t('nav.map', 'Map')}
        subtitle={t('map.subtitle', 'Sites, crew, and equipment, plotted from logged locations.')}
      />
    <div className="flex flex-1 gap-4 overflow-hidden">
      <div className="relative flex-1 overflow-hidden rounded-lg border border-border">
        <Map initialViewState={initialViewState} mapStyle={OSM_STYLE} style={{ width: '100%', height: '100%' }}>
          <NavigationControl position="top-right" showCompass={false} />
          {points.map((p) => (
            <Marker key={`${p.kind}-${p.id}`} longitude={p.lng} latitude={p.lat} anchor="bottom" onClick={(e) => { e.originalEvent.stopPropagation(); setSelected(p); }}>
              <MarkerPin kind={p.kind} />
            </Marker>
          ))}
          {selected && (
            <Popup longitude={selected.lng} latitude={selected.lat} anchor="top" onClose={() => setSelected(null)} closeOnClick={false}>
              <div className="text-xs">
                <div className="font-semibold text-content-primary">{selected.label}</div>
                <div className="mt-1 flex items-center gap-1 text-content-secondary">
                  <MapPin size={11} />
                  {selected.address ?? `${selected.lat.toFixed(4)}, ${selected.lng.toFixed(4)}`}
                </div>
                {selected.timestamp && <div className="mt-1 text-content-tertiary">{formatTimestamp(selected.timestamp)}</div>}
              </div>
            </Popup>
          )}
        </Map>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface-primary/60">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-oe-blue border-t-transparent" />
          </div>
        )}
        {!isLoading && points.length === 0 && (
          <div className="pointer-events-none absolute inset-x-0 top-4 mx-auto w-fit rounded-lg bg-surface-elevated px-4 py-2 text-xs text-content-secondary shadow-sm">
            No locations logged yet -- check someone in below to see them here.
          </div>
        )}
      </div>
      <div className="w-80 shrink-0">
        <CheckinForm />
      </div>
    </div>
    </div>
  );
}
