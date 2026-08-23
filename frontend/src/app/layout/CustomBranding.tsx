// DDC-CWICR-OE: DataDrivenConstruction · OpenConstructionERP
// Copyright (c) 2026 Artem Boiko / DataDrivenConstruction
// Sidebar brand mark.
//
// D-Central FieldOps fork (Task #156): this used to be a white-labeling
// editor (upload a logo, set a company name, persist it to the server
// via PUT /api/v1/branding/ so the brand followed a workspace to other
// browsers). This façade never implements that endpoint -- it isn't one
// of the 8 kept modules -- so persistToServer() always failed silently
// and an admin's "customised" brand never actually left their own
// browser's localStorage, despite the editor's UI implying otherwise.
// This deployment only ever serves one brand (Sod Boys Ltd) anyway, so
// the editor is removed rather than left as a feature that quietly does
// less than it promises. See docs/ARCHITECTURE.md's Task #156 status
// entries.
import { Logo } from '@/shared/ui';

interface CustomBrandingProps {
  /** When true (icon-only sidebar), render a compact logo without text. */
  iconified: boolean;
}

export function CustomBranding({ iconified }: CustomBrandingProps) {
  if (iconified) {
    return (
      <div className="pointer-events-none" title="Sod Boys FieldOps">
        <Logo size="sm" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1" title="Sod Boys FieldOps">
      <Logo size="xs" />
      <span
        className="text-[13px] font-medium text-content-primary whitespace-nowrap leading-none"
        style={{
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
          letterSpacing: '-0.02em',
        }}
      >
        <span className="text-oe-blue">Sod Boys</span>{' '}
        <span className="text-content-quaternary">FieldOps</span>
      </span>
    </div>
  );
}
