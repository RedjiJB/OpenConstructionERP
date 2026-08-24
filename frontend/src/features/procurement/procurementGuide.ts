// DDC-CWICR-OE: DataDrivenConstruction · OpenConstructionERP
// Copyright (c) 2026 Artem Boiko / DataDrivenConstruction
//
// procurementGuide - "How it works" content for the Procurement module.
// Consumed by <ModuleGuideButton content={procurementGuide} /> on ProcurementPage.
//
// i18n: every key carries its inline English default and is read via
// t(key, { defaultValue }). These keys are NOT added to en.ts or any
// locale file; the inline defaults are the single source of truth.

import type { ModuleGuideContent } from '@/shared/ui';

export const procurementGuide: ModuleGuideContent = {
  titleKey: 'guide.procurement.title',
  titleDefault: 'Procurement',
  introKey: 'guide.procurement.intro',
  introDefault:
    'Procurement is where you raise purchase orders with a vendor and track them from draft through to issued.',
  sections: [
    {
      icon: 'Workflow',
      titleKey: 'guide.procurement.tabs.title',
      titleDefault: 'Purchase orders',
      bodyKey: 'guide.procurement.tabs.body',
      bodyDefault:
        'The Purchase Orders tab lists every order raised against the active project, with its vendor, dates, amount and status.',
    },
    {
      icon: 'PencilLine',
      titleKey: 'guide.procurement.create.title',
      titleDefault: 'Raise a purchase order',
      bodyKey: 'guide.procurement.create.body',
      bodyDefault:
        'Click New Purchase Order and pick the vendor. Add line items with a description and quantity, and set the order total. Currency defaults to the project currency.',
    },
    {
      icon: 'Send',
      titleKey: 'guide.procurement.lifecycle.title',
      titleDefault: 'Issue to the vendor',
      bodyKey: 'guide.procurement.lifecycle.body',
      bodyDefault:
        'A new order starts as a draft. Issue it once it is ready to send to the vendor; the status updates to reflect where the order stands.',
    },
    {
      icon: 'Database',
      titleKey: 'guide.procurement.vendors.title',
      titleDefault: 'Vendors',
      bodyKey: 'guide.procurement.vendors.body',
      bodyDefault:
        'The Vendors page lists every vendor with their contact details and the total you have spent with them across your purchase orders.',
    },
  ],
  ctaKey: 'guide.procurement.cta',
  ctaDefault: 'Raise your first purchase order',
};
