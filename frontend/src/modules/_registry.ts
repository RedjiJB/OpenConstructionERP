// DDC-CWICR-OE: DataDrivenConstruction · OpenConstructionERP
// Copyright (c) 2026 Artem Boiko / DataDrivenConstruction
/**
 * Central module registry.
 *
 * Every optional module must be registered here.  Only the tiny `manifest`
 * objects are imported eagerly — the actual page components use React.lazy()
 * inside the manifest, so they are code-split automatically by Vite.
 *
 * To add a new module:
 *   1. Create `frontend/src/modules/<name>/manifest.ts`
 *   2. Import it here and add to MODULE_REGISTRY
 *   3. Done — routes and sidebar pick it up automatically
 */

import type {
  ModuleManifest,
  ModuleRoute,
  ModuleNavItem,
} from './_types';

/* ── Module manifest imports ───────────────────────────────────────── */
//
// D-Central FieldOps fork (Task #156, frontend-pruning pass): none of
// these ~17 optional modules (assemblies, methodology, validation,
// schedule, 5D cost model, tendering, reports, sustainability, cost
// benchmarks, PDF takeoff, collaboration, risk analysis, GAEB exchange,
// regional exchange, IFC/RVT converters, pipelines) are among the 8
// modules this project's REST façade backs — see docs/ARCHITECTURE.md's
// Task #156 status entries. The registry is emptied rather than each
// manifest file deleted, so re-enabling any of them later (should this
// fork's scope ever grow) is a one-line change, not a file recovery.

/* ── Registry ──────────────────────────────────────────────────────── */

export const MODULE_REGISTRY: ModuleManifest[] = [];

/* ── Helper functions ──────────────────────────────────────────────── */

/** All routes from all registered modules (flat list). */
export function getAllModuleRoutes(): ModuleRoute[] {
  return MODULE_REGISTRY.flatMap((m) => m.routes);
}

/** Nav items for a specific sidebar group id. */
export function getModuleNavItems(groupId: string): ModuleNavItem[] {
  return MODULE_REGISTRY.flatMap((m) =>
    m.navItems.filter((item) => item.group === groupId),
  );
}

/** Default enabled state for all modules (used by useModuleStore). */
export function getModuleDefaults(): Record<string, boolean> {
  const defaults: Record<string, boolean> = {};
  for (const m of MODULE_REGISTRY) {
    defaults[m.id] = m.defaultEnabled;
  }
  return defaults;
}

/** Get all module IDs that depend on a given module key. */
export function getModuleDependents(moduleKey: string): string[] {
  return MODULE_REGISTRY
    .filter((m) => m.depends?.includes(moduleKey))
    .map((m) => m.id);
}

/** Get the dependency list for a specific module. */
export function getModuleDependencies(moduleId: string): string[] {
  const mod = MODULE_REGISTRY.find((m) => m.id === moduleId);
  return mod?.depends ?? [];
}

/** Group modules by their category field. */
export function getModulesByCategory(): Record<string, ModuleManifest[]> {
  const groups: Record<string, ModuleManifest[]> = {};
  for (const m of MODULE_REGISTRY) {
    if (!groups[m.category]) groups[m.category] = [];
    groups[m.category]!.push(m);
  }
  return groups;
}

/**
 * Collect all module-bundled translations, merged by language code.
 * Returns `{ en: { 'collab.title': 'Collaboration', ... }, de: { ... } }`.
 */
export function getModuleTranslations(): Record<string, Record<string, string>> {
  const merged: Record<string, Record<string, string>> = {};
  for (const mod of MODULE_REGISTRY) {
    if (!mod.translations) continue;
    for (const [lang, keys] of Object.entries(mod.translations)) {
      if (!merged[lang]) merged[lang] = {};
      Object.assign(merged[lang], keys);
    }
  }
  return merged;
}
