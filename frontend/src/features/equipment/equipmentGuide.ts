// DDC-CWICR-OE: DataDrivenConstruction · OpenConstructionERP
// Copyright (c) 2026 Artem Boiko / DataDrivenConstruction
//
// equipmentGuide - "How it works" content for the Equipment & Fleet module.
// Consumed by <ModuleGuideButton content={equipmentGuide} /> on EquipmentPage.
//
// i18n: every key carries its inline English default and is read via
// t(key, { defaultValue }). These keys are NOT added to en.ts or any
// locale file; the inline defaults are the single source of truth.

import type { ModuleGuideContent } from '@/shared/ui';

export const equipmentGuide: ModuleGuideContent = {
  titleKey: 'guide.equipment.title',
  titleDefault: 'Equipment & Fleet',
  introKey: 'guide.equipment.intro',
  introDefault:
    'Equipment & Fleet is the register for every owned, rented or leased machine on your sites. Use it to track identity, running hours and utilisation, and to assign active plant to crews.',
  sections: [
    {
      icon: 'Database',
      titleKey: 'guide.equipment.assets.title',
      titleDefault: 'Register your assets',
      bodyKey: 'guide.equipment.assets.body',
      bodyDefault:
        'Each asset is one machine with a unique code, a type, an ownership (owned, rented or leased) and a status. New Asset opens a form for identity, lifecycle, financial value, telemetry and location. The Assets table lists code, name, type, status, location and running hours, and you can search or filter by status and ownership.',
    },
    {
      icon: 'Workflow',
      titleKey: 'guide.equipment.utilization.title',
      titleDefault: 'Utilisation and telemetry',
      bodyKey: 'guide.equipment.utilization.body',
      bodyDefault:
        'Open an asset to see its hour meter and location, drawn from real telemetry readings the fleet already reports -- there is no manual reading-entry step to keep this current.',
    },
    {
      icon: 'Layers',
      titleKey: 'guide.equipment.types.title',
      titleDefault: 'Types classify assets',
      bodyKey: 'guide.equipment.types.body',
      bodyDefault:
        'The Types tab is a reference list of categories used to classify assets, such as excavator, crane or generator. Each asset references a type by code. The list is read-only.',
    },
  ],
  ctaKey: 'guide.equipment.cta',
  ctaDefault: 'Register your first asset',
};
