// Restoring BI Dashboards, Slice R: a small, real API surface for one
// fixed page of live KPIs -- not the vendored generic BI engine (KPI
// definitions, dashboard/widget CRUD, drill-downs, scheduled reports,
// alert rules, a starter-pack installer).
import { apiGet } from '@/shared/lib/api';

export interface OpenAlertsBySeverity {
  critical: number;
  routine: number;
}

export interface CrewUtilization {
  clocked_in_today: number;
  active_crew: number;
  utilization_pct: number | null;
}

export interface AvgAlertResolution {
  avg_resolution_hours: number | null;
  resolved_count: number;
}

export interface PoSpendRow {
  vendor_id: string | null;
  vendor_name: string;
  total_cost: number;
}

export interface TimeclockHours {
  total_hours: number;
}

export interface Kpis {
  open_alerts: OpenAlertsBySeverity;
  crew_utilization: CrewUtilization;
  avg_alert_resolution: AvgAlertResolution;
  po_spend_this_month: PoSpendRow[];
  timeclock_hours_this_week: TimeclockHours;
}

export function getKpis(): Promise<Kpis> {
  return apiGet<Kpis>('/v1/bi/kpis');
}
