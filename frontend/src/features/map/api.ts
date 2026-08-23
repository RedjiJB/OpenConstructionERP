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

export interface CheckinPayload {
  type: LocationPointType;
  target_id: string;
  lat: number;
  lng: number;
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
