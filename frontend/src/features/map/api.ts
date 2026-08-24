// New, purpose-built feature -- no vendored contract to match. This is
// the map the pruning pass cut along with the vendored Geo Hub module,
// rebuilt fresh against this backend's own real location data
// (vehicle_telemetry, crew_telemetry) instead.
import { apiGet, apiPost } from '@/shared/lib/api';

export type LocationPointType = 'crew' | 'vehicle';

export interface LocationPoint {
  id: string;
  type: LocationPointType;
  target_id: string;
  label: string;
  lat: number;
  lng: number;
  address: string | null;
  timestamp: string;
}

// Either lat/lng directly, or an address the backend forward-geocodes --
// never both required together.
export interface CheckinPayload {
  type: LocationPointType;
  target_id: string;
  lat?: number;
  lng?: number;
  address?: string;
}

export interface CheckinResult {
  id: string;
  type: LocationPointType;
  target_id: string;
  lat: number;
  lng: number;
  address: string | null;
  timestamp: string;
}

export function listLocations(): Promise<{ items: LocationPoint[] }> {
  return apiGet<{ items: LocationPoint[] }>('/v1/locations');
}

export function checkIn(payload: CheckinPayload): Promise<CheckinResult> {
  return apiPost<CheckinResult, CheckinPayload>('/v1/locations/checkin', payload);
}

export type SiteType = 'job_site' | 'depot' | 'vendor' | 'shop';

export interface MapSite {
  id: string;
  name: string;
  type: SiteType;
  address: string | null;
  lat: number | null;
  lng: number | null;
  crew_today_count: number;
  open_alerts_count: number;
}

export interface CreateSitePayload {
  name: string;
  type: SiteType;
  lat?: number;
  lng?: number;
  address?: string;
}

export function listMapSites(): Promise<{ items: MapSite[] }> {
  return apiGet<{ items: MapSite[] }>('/v1/sites');
}

export function createSite(payload: CreateSitePayload): Promise<MapSite> {
  return apiPost<MapSite, CreateSitePayload>('/v1/sites', payload);
}
