// Site Cost Summary -- the real replacement for the "5D Cost" chip.
// "5D Cost" specifically means cost-loaded-schedule/BIM integration,
// which nothing in this domain backs; this is a real number (budget vs.
// two real spend sources: purchase orders and labour), not that.
import { apiGet, apiPatch } from '@/shared/lib/api';

export interface SiteCostSummary {
  budget: number | null;
  po_spend: number;
  labour_spend: number;
  total_spend: number;
  variance: number | null;
}

export interface SiteOption {
  id: string;
  name: string;
}

export function listSiteOptions(): Promise<{ items: SiteOption[] }> {
  return apiGet<{ items: SiteOption[] }>('/v1/sites');
}

export function getSiteCostSummary(siteId: string): Promise<SiteCostSummary> {
  return apiGet<SiteCostSummary>(`/v1/sites/${siteId}/cost-summary`);
}

export function setSiteBudget(siteId: string, budget: number | null): Promise<{ id: string; budget: number | null }> {
  return apiPatch<{ id: string; budget: number | null }, { budget: number | null }>(`/v1/sites/${siteId}/budget`, { budget });
}
