// Restoring Field Reports, Slice S: a small, real API surface -- not
// the vendored page's template/approval/signature/attachment suite,
// re-scoped from project_id (no project concept here) to site_id.
import { apiGet, apiPost } from '@/shared/lib/api';

export interface FieldReportSummary {
  id: string;
  site_id: string;
  site_name: string;
  report_date: string;
  notes: string;
  created_by: string | null;
  created_at: string;
}

export interface FieldReportWorkforceEntry {
  crew_member_id: string;
  name: string;
}

export interface FieldReportEquipmentEntry {
  vehicle_id: string;
  plate: string;
}

export interface FieldReportDetail extends FieldReportSummary {
  author_name: string | null;
  workforce: FieldReportWorkforceEntry[];
  equipment: FieldReportEquipmentEntry[];
}

export function listFieldReports(siteId?: string): Promise<{ items: FieldReportSummary[] }> {
  const query = siteId ? `?site_id=${encodeURIComponent(siteId)}` : '';
  return apiGet<{ items: FieldReportSummary[] }>(`/v1/field-reports${query}`);
}

export function getFieldReport(id: string): Promise<FieldReportDetail> {
  return apiGet<FieldReportDetail>(`/v1/field-reports/${encodeURIComponent(id)}`);
}

export function createFieldReport(payload: { site_id: string; report_date: string; notes: string }): Promise<FieldReportSummary> {
  return apiPost<FieldReportSummary>('/v1/field-reports', payload);
}
