// This fork routes 17 of ~179 vendored pages; PLAYBOOKS is vendored
// content written for the full app. The real bug this covers: a case
// whose steps dead-end partway through a pruned page (BOQ, Finance,
// Portfolio, ...) still counted as "N cases" on a real module's Cases
// pill, the same dead-affordance problem already fixed elsewhere in
// this project for body-content chips. playbooksForRoute/caseCountByRoute
// must only count a playbook for a route if every step it takes lands
// somewhere real in this fork.
import { describe, expect, it } from 'vitest';
import { caseCountByRoute, normalizeCaseRoute, playbooksForRoute } from './playbookModules';

const KEPT_ROUTES = new Set([
  '/', '/dashboard', '/notifications', '/equipment', '/resources', '/field-time',
  '/site-inventory', '/procurement', '/payroll', '/teams', '/map', '/inbox',
  '/admin/webhook-targets', '/settings', '/bi-dashboards', '/field-reports', '/vendors',
]);

describe('playbookModules, filtered for this fork\'s real routes', () => {
  it('never returns a playbook for a kept route that has any step outside the kept-route set', () => {
    for (const route of KEPT_ROUTES) {
      for (const pb of playbooksForRoute(route)) {
        for (const step of pb.steps) {
          expect(KEPT_ROUTES.has(normalizeCaseRoute(step.to))).toBe(true);
        }
      }
    }
  });

  it('caseCountByRoute never counts a playbook against a route it also excludes from playbooksForRoute', () => {
    const counts = caseCountByRoute();
    for (const [route, count] of counts) {
      if (!KEPT_ROUTES.has(route)) continue;
      expect(playbooksForRoute(route).length).toBe(count);
    }
  });

  it('the real Equipment/Resources/Procurement/Payroll dead-step cases found in audit no longer surface', () => {
    // Confirmed by direct audit: these pages had cases whose final steps
    // routed to /reports, /finance, /assemblies, /schedule-advanced, or
    // /schedule -- all unrouted in this fork. After filtering, none of
    // those dead-ending playbooks should be attributed to these routes.
    for (const route of ['/equipment', '/resources', '/procurement', '/payroll']) {
      for (const pb of playbooksForRoute(route)) {
        const routes = pb.steps.map((s) => normalizeCaseRoute(s.to));
        expect(routes.every((r) => KEPT_ROUTES.has(r))).toBe(true);
      }
    }
  });
});
