// DDC-CWICR-OE: DataDrivenConstruction · OpenConstructionERP
// Copyright (c) 2026 Artem Boiko / DataDrivenConstruction
// Tests for normalizePackLocale: maps a partner pack's BCP-47 default_locale to
// a supported base UI language, so an active pack forces the right language
// and never an unsupported one.
//
// D-Central FieldOps fork (Task #156): SUPPORTED_LANGUAGES was trimmed from
// ~40 locales to just `en`/`fr` (see src/app/i18n.ts). Every fixture below
// that used to name a now-unshipped locale (de, en-US, es-MX, pt-BR, es-CL,
// es-CO, pt, ar) is updated to expect the documented fallback: a locale this
// fork does not ship at all returns 'en'.
import { describe, expect, it } from 'vitest';

import { normalizePackLocale } from '../i18n';

describe('normalizePackLocale', () => {
  it('strips the region subtag when the UI does not ship that region', () => {
    expect(normalizePackLocale('fr-CA')).toBe('fr'); // batimatech-ca
    expect(normalizePackLocale('en-GB')).toBe('en'); // uk-jct
    expect(normalizePackLocale('en-AU')).toBe('en'); // aus
    expect(normalizePackLocale('en-NZ')).toBe('en'); // nzs
  });

  it('falls back to English for a regional variant this fork does not ship', () => {
    // Upstream shipped en-US/es-MX/pt-BR/es-CL/es-CO as real regional
    // bundles; this fork ships only en/fr, so all of these now resolve
    // through the same "unsupported locale" path as a locale the UI never
    // heard of at all.
    expect(normalizePackLocale('en-US')).toBe('en');
    expect(normalizePackLocale('es-MX')).toBe('en');
    expect(normalizePackLocale('pt-BR')).toBe('en');
    expect(normalizePackLocale('es-CL')).toBe('en');
    expect(normalizePackLocale('es-CO')).toBe('en');
  });

  it('passes through base codes the UI ships, falls back for ones it does not', () => {
    expect(normalizePackLocale('fr')).toBe('fr');
    expect(normalizePackLocale('en')).toBe('en');
    expect(normalizePackLocale('de')).toBe('en'); // not shipped in this fork
    expect(normalizePackLocale('pt')).toBe('en'); // not shipped in this fork
    expect(normalizePackLocale('ar')).toBe('en'); // not shipped in this fork
  });

  it('is case-insensitive and trims', () => {
    expect(normalizePackLocale('FR-ca')).toBe('fr');
    expect(normalizePackLocale(' fr ')).toBe('fr');
    expect(normalizePackLocale(' de ')).toBe('en'); // not shipped in this fork
    expect(normalizePackLocale('en-us')).toBe('en');
    expect(normalizePackLocale('EN-US')).toBe('en');
  });

  it('falls back to English for unsupported or empty locales', () => {
    expect(normalizePackLocale('xx-YY')).toBe('en');
    expect(normalizePackLocale('')).toBe('en');
    expect(normalizePackLocale(null)).toBe('en');
    expect(normalizePackLocale(undefined)).toBe('en');
  });
});
