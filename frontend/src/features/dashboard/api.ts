// Dashboard restoration, Slice I/J: real site data (src/domain/sites.ts
// on the backend) to feed the map/weather widget, and system health for
// the status widget -- both replacing vendored concepts this façade
// doesn't have (the "projects" model, and a pgvector probe).
import { apiGet, apiPost } from '@/shared/lib/api';

export type SiteType = 'job_site' | 'depot' | 'vendor' | 'shop';

export interface Site {
  id: string;
  name: string;
  type: SiteType;
  address: string | null;
  lat: number | null;
  lng: number | null;
  crew_today_count: number;
  open_alerts_count: number;
}

export function listSites(): Promise<{ items: Site[] }> {
  return apiGet<{ items: Site[] }>('/v1/sites');
}

export interface SystemStatus {
  api: { status: string; version: string };
  database: { status: string };
  ai: { providers: { name: string; configured: boolean }[]; configured: boolean };
}

export function getSystemStatus(): Promise<SystemStatus> {
  return apiGet<SystemStatus>('/v1/system/status');
}

export type ActivityEntryType =
  | 'alert_raised' | 'alert_resolved'
  | 'notification_raised' | 'notification_acknowledged'
  | 'purchase_order_created' | 'purchase_order_fulfilled'
  | 'document_uploaded'
  | 'timeclock_in' | 'timeclock_out';

export interface ActivityEntry {
  id: string;
  type: ActivityEntryType;
  title: string;
  actor_name: string | null;
  timestamp: string;
  action_url: string | null;
}

export function listActivity(limit = 20): Promise<{ items: ActivityEntry[] }> {
  return apiGet<{ items: ActivityEntry[] }>(`/v1/activity?limit=${limit}`);
}

export interface InboxItem {
  id: string;
  source: 'alert' | 'notification';
  title: string;
  severity: 'critical' | 'info';
  timestamp: string;
  action_url: string | null;
}

export interface InboxResponse {
  items: InboxItem[];
  total: number;
  unresolved_alerts_count: number;
  unacknowledged_notifications_count: number;
}

export function fetchInbox(limit = 20): Promise<InboxResponse> {
  return apiGet<InboxResponse>(`/v1/dashboard/inbox?limit=${limit}`);
}

export function acknowledgeInboxItem(id: string): Promise<{ id: string; resolved: boolean }> {
  return apiPost<{ id: string; resolved: boolean }>(`/v1/dashboard/inbox/${encodeURIComponent(id)}/acknowledge`, {});
}
