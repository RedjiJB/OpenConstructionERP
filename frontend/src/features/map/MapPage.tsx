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
import { listLocations, checkIn, type LocationPoint, type LocationPointType } from './api';
import { listResources } from '@/features/resources/api';
import { listEquipment } from '@/features/equipment/api';
import { fmtDate } from '@/shared/lib/formatters';
import { PageHeader } from '@/shared/ui';

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

function MarkerPin({ type }: { type: LocationPointType }) {
  const Icon = type === 'vehicle' ? Truck : Users;
  return (
    <div
      className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-white shadow-md ${
        type === 'vehicle' ? 'bg-oe-blue' : 'bg-oe-purple'
      }`}
    >
      <Icon size={15} />
    </div>
  );
}

function formatTimestamp(iso: string): string {
  return fmtDate(iso, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Manual "log a location" form -- the stand-in for a live feed until
 *  Phase 3's WhatsApp location-sharing exists. */
function CheckinForm() {
  const queryClient = useQueryClient();
  const [type, setType] = useState<LocationPointType>('crew');
  const [targetId, setTargetId] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: crewPage } = useQuery({
    queryKey: ['map', 'crew-options'],
    queryFn: () => listResources({ type: 'person', limit: 200 }),
  });
  const { data: equipmentPage } = useQuery({
    queryKey: ['map', 'equipment-options'],
    queryFn: () => listEquipment({ limit: 200 }),
  });

  const options = type === 'crew'
    ? (crewPage?.items ?? []).map((r) => ({ id: r.id, label: r.name }))
    : (equipmentPage?.items ?? []).map((e) => ({ id: e.id, label: e.name }));

  const mutation = useMutation({
    mutationFn: checkIn,
    onSuccess: () => {
      setTargetId('');
      setLat('');
      setLng('');
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['map', 'locations'] });
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : 'Check-in failed');
    },
  });

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setError('This browser has no geolocation support');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(String(pos.coords.latitude));
        setLng(String(pos.coords.longitude));
      },
      () => setError('Could not read this device’s location'),
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const latNum = Number(lat);
    const lngNum = Number(lng);
    if (!targetId) {
      setError('Choose who or what to check in');
      return;
    }
    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
      setError('Latitude and longitude must both be numbers');
      return;
    }
    mutation.mutate({ type, target_id: targetId, lat: latNum, lng: lngNum });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg border border-border bg-surface-elevated p-4">
      <div className="text-sm font-medium text-content-primary">Log a location</div>
      <p className="text-xs text-content-secondary">
        No live feed exists yet, so this is how a location gets on the map today -- record where someone or something actually is right now.
      </p>

      <div className="flex gap-2">
        {(['crew', 'vehicle'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => { setType(t); setTargetId(''); }}
            className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              type === t ? 'border-oe-blue bg-oe-blue/10 text-oe-blue' : 'border-border text-content-secondary hover:bg-surface-secondary'
            }`}
          >
            {t === 'crew' ? 'Crew' : 'Vehicle'}
          </button>
        ))}
      </div>

      <select
        value={targetId}
        onChange={(e) => setTargetId(e.target.value)}
        className="rounded-lg border border-border bg-surface-primary px-3 py-2 text-sm text-content-primary"
      >
        <option value="">{type === 'crew' ? 'Select a crew member' : 'Select a vehicle'}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </select>

      <div className="flex gap-2">
        <input
          type="text"
          inputMode="decimal"
          placeholder="Latitude"
          value={lat}
          onChange={(e) => setLat(e.target.value)}
          className="w-1/2 rounded-lg border border-border bg-surface-primary px-3 py-2 text-sm text-content-primary placeholder:text-content-tertiary"
        />
        <input
          type="text"
          inputMode="decimal"
          placeholder="Longitude"
          value={lng}
          onChange={(e) => setLng(e.target.value)}
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
        disabled={mutation.isPending}
        className="rounded-lg bg-oe-blue px-3 py-2 text-sm font-medium text-white hover:bg-oe-blue-hover disabled:opacity-50"
      >
        {mutation.isPending ? 'Logging…' : 'Log location'}
      </button>
    </form>
  );
}

export default function MapPage() {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<LocationPoint | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['map', 'locations'],
    queryFn: listLocations,
    refetchInterval: 30_000,
  });

  const points = data?.items ?? [];

  const initialViewState = useMemo(() => {
    if (points.length === 0) return DEFAULT_VIEW;
    const avgLat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
    const avgLng = points.reduce((sum, p) => sum + p.lng, 0) / points.length;
    return { longitude: avgLng, latitude: avgLat, zoom: 11 };
    // Only recomputed on first load -- re-centering under the user while
    // they're panning around would be disorienting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points.length > 0]);

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <PageHeader
        srTitle={t('nav.map', 'Map')}
        subtitle={t('map.subtitle', 'Crew and equipment, plotted from logged locations.')}
      />
    <div className="flex flex-1 gap-4 overflow-hidden">
      <div className="relative flex-1 overflow-hidden rounded-lg border border-border">
        <Map initialViewState={initialViewState} mapStyle={OSM_STYLE} style={{ width: '100%', height: '100%' }}>
          <NavigationControl position="top-right" showCompass={false} />
          {points.map((p) => (
            <Marker key={p.id} longitude={p.lng} latitude={p.lat} anchor="bottom" onClick={(e) => { e.originalEvent.stopPropagation(); setSelected(p); }}>
              <MarkerPin type={p.type} />
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
                <div className="mt-1 text-content-tertiary">{formatTimestamp(selected.timestamp)}</div>
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
