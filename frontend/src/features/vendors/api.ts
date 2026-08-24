// Restoring Procurement's dead "Supplier Catalogs" chip as a real
// "Vendors" directory -- not a catalog/pricing feature (no per-vendor
// SKU/pricing concept exists in this domain), just a real vendor list
// with what's actually been ordered from each one.
import { apiGet } from '@/shared/lib/api';

export interface Vendor {
  id: string;
  name: string;
  contact_method: string | null;
  contact_address: string | null;
  account_number: string | null;
  lead_time_days: number | null;
  po_count: number;
  total_spend: number;
}

export function listVendors(): Promise<{ items: Vendor[] }> {
  return apiGet<{ items: Vendor[] }>('/v1/vendors');
}
