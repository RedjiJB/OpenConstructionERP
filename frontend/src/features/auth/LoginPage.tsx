// DDC-CWICR-OE: DataDrivenConstruction · OpenConstructionERP
// Copyright (c) 2026 Artem Boiko / DataDrivenConstruction
import { useState, useRef, useEffect, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Eye, EyeOff, Mail, Lock, Globe, ChevronDown, Users,
  ShieldCheck,
  FileSpreadsheet, CalendarClock, Boxes, Database,
  FileCheck,
  Layers, Truck, Timer,
  Sun, Moon, Monitor,
} from 'lucide-react';
import { Button, Input, Logo, CountryFlag } from '@/shared/ui';
import { useAuthStore } from '@/stores/useAuthStore';
import { extractErrorMessageFromBody } from '@/shared/lib/api';
import { isTauri } from '@/shared/lib/desktop';
import { HEX_PORTRAIT_ASPECT, HEX_PORTRAIT_CLIP } from '@/shared/lib/honeycomb';
import { APP_VERSION } from '@/shared/lib/version';
import {
  shouldAttemptDesktopBootstrap,
  shouldQueryFirstRun,
  type FirstRunStatus,
} from './desktopBootstrap';
import { safeNextPath } from './nextPath';
import { SUPPORTED_LANGUAGES } from '@/app/i18n';
import { useThemeStore } from '@/stores/useThemeStore';

/* Segmented theme switch (Light / Dark / System) for the login page. */
function ThemeSwitch() {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const opts = [
    { mode: 'light' as const, icon: Sun, label: t('theme.light', { defaultValue: 'Light' }) },
    { mode: 'dark' as const, icon: Moon, label: t('theme.dark', { defaultValue: 'Dark' }) },
    { mode: 'system' as const, icon: Monitor, label: t('theme.system', { defaultValue: 'System' }) },
  ];
  return (
    <div
      role="radiogroup"
      aria-label={t('theme.label', { defaultValue: 'Theme' })}
      className="flex items-center gap-0.5 rounded-xl border border-border-light bg-surface-elevated/85 backdrop-blur-sm p-0.5 shadow-sm"
    >
      {opts.map(({ mode, icon: Icon, label }) => {
        const active = theme === mode;
        return (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={active}
            title={label}
            aria-label={label}
            onClick={() => setTheme(mode)}
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
              active
                ? 'bg-oe-blue text-white shadow-sm'
                : 'text-content-tertiary hover:text-content-secondary hover:bg-surface-secondary'
            }`}
          >
            <Icon size={15} strokeWidth={2} />
          </button>
        );
      })}
    </div>
  );
}

export function LoginPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const setTokens = useAuthStore((s) => s.setTokens);
  // `?next=/path` lets guarded routes send the user back to where they wanted
  // to go after login. Falls back to `/` for direct visits. Shared with the
  // authenticated-route guard (AuthedHome) so a redirect race between the two
  // cannot silently drop the `next` (the demo deep-link bug).
  const nextPath = safeNextPath(location.search);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(
    () => localStorage.getItem('oe_remember') === '1',
  );
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  // Desktop first-run: when running inside the Tauri shell with no stored
  // token and no deliberate manual logout this session, we silently auto-sign
  // in to the local workspace owner. Seed the pending flag synchronously so the
  // very first paint shows "Preparing your workspace..." rather than flashing
  // the login form before the bootstrap effect runs.
  const [bootstrapping, setBootstrapping] = useState(() => {
    if (typeof window === 'undefined') return false;
    const stored =
      localStorage.getItem('oe_access_token') || sessionStorage.getItem('oe_access_token');
    const manual = sessionStorage.getItem('oe_manual_login');
    return shouldQueryFirstRun(isTauri, Boolean(stored), manual);
  });

  const currentLang =
    SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language) ?? SUPPORTED_LANGUAGES[0]!;

  // Clear form on mount (prevents pre-fill after logout)
  useEffect(() => {
    setEmail('');
    setPassword('');
    setError('');
  }, []);

  // Desktop auto-bootstrap. Runs once on mount. On ANY failure it silently
  // falls back to the normal login form (clears `bootstrapping`); it never
  // surfaces an error to the user because manual login is always a valid path.
  useEffect(() => {
    if (!bootstrapping) return;
    let cancelled = false;

    const run = async () => {
      try {
        const res = await fetch('/api/v1/auth/first-run', {
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) throw new Error('first-run probe failed');
        const status = (await res.json()) as FirstRunStatus;

        const manual = sessionStorage.getItem('oe_manual_login');
        if (!shouldAttemptDesktopBootstrap(status, false, manual)) {
          throw new Error('bootstrap not applicable');
        }

        const bootRes = await fetch('/api/v1/auth/desktop-bootstrap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!bootRes.ok) throw new Error('desktop bootstrap failed');
        const data = (await bootRes.json()) as {
          access_token?: string;
          refresh_token?: string;
          user?: { email?: string };
        };
        if (!data.access_token || !data.refresh_token) {
          throw new Error('bootstrap response missing tokens');
        }
        if (cancelled) return;

        // Persist through the existing auth store path with remember=true so the
        // desktop owner stays signed in across launches.
        setTokens(data.access_token, data.refresh_token, true, data.user?.email);
        void useAuthStore.getState().syncRoleFromServer();
        navigate(status.onboarding_completed === true ? '/dashboard' : '/onboarding', {
          replace: true,
        });
      } catch {
        // Silent fallback to the manual login form.
        if (!cancelled) setBootstrapping(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
    // Mount-only: the gate inputs are read fresh inside `run`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/v1/users/auth/login/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const parsed = extractErrorMessageFromBody(data);
        setError(parsed || t('auth.invalid_credentials', 'Invalid email or password'));
        return;
      }
      const data = await res.json();
      setTokens(data.access_token, data.refresh_token, rememberMe, email);
      // setTokens() clears any cached display name from a previous session
      // (so a different account's name can't briefly leak into the
      // greeting), but nothing else re-populates it: the module-level
      // syncRoleFromServer() call in App.tsx already ran once at page load,
      // before this token existed, and no-ops without one. Without this,
      // the name stays wiped until the next full page reload -- fetch it
      // now so the greeting shows the real name on the very first paint
      // after login instead of the "there" fallback.
      void useAuthStore.getState().syncRoleFromServer();
      navigate(nextPath, { replace: true });
    } catch {
      setError(t('auth.connection_error', 'Unable to connect to server. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  /* Benefits list - reserved for future hero section layout
  const benefits = [
    { icon: HardDrive, color: 'text-emerald-500 bg-emerald-500/10', title: t('login.benefit.local', 'Your data stays on your computer'), desc: t('login.benefit.local_desc', 'No cloud. No third-party servers. Full control.') },
    { icon: ShieldCheck, color: 'text-blue-500 bg-blue-500/10', title: t('login.benefit.open_source', '100% open source'), desc: t('login.benefit.open_source_desc', 'Transparent code. No vendor lock-in.') },
    { icon: Globe2, color: 'text-violet-500 bg-violet-500/10', title: t('login.benefit.standards', 'International standards'), desc: t('login.benefit.standards_desc', '120,000+ cost items across 9 cost bases worldwide.') },
    { icon: Brain, color: 'text-amber-500 bg-amber-500/10', title: t('login.benefit.ai', 'AI-assisted estimation'), desc: t('login.benefit.ai_desc', 'Smart suggestions. You decide, AI assists.') },
    { icon: Zap, color: 'text-rose-500 bg-rose-500/10', title: t('login.benefit.allinone', 'BOQ + 4D + 5D + Tendering'), desc: t('login.benefit.allinone_desc', 'Full workflow in one tool.') },
    { icon: Users, color: 'text-cyan-500 bg-cyan-500/10', title: t('login.benefit.free', 'Free for everyone'), desc: t('login.benefit.free_desc', 'No fees. No limits. By estimators.') },
  ]; */

  // Desktop first-run: clean centered pending state while we silently sign in
  // to the local workspace. Falls back to the form on any failure (see effect).
  if (bootstrapping) {
    return (
      <div className="relative flex h-screen flex-col items-center justify-center bg-surface-secondary overflow-hidden">
        <div className="relative z-10 flex flex-col items-center gap-5 px-6 text-center">
          <Logo size="lg" animate />
          <svg
            className="h-7 w-7 animate-spin text-oe-blue"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <p className="text-sm font-medium text-content-secondary">
            {t('auth.preparing_workspace', { defaultValue: 'Preparing your workspace...' })}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative grid h-screen grid-cols-1 lg:grid-cols-2 bg-surface-secondary overflow-hidden">

      {/* Local style block - premium glass variant + drifting orb keyframes
          scoped to the login page. Pattern mirrors LoginPageNext.tsx. */}
      <style>{`
        .login-glass-pro {
          background:
            linear-gradient(135deg, rgba(255,255,255,0.78) 0%, rgba(255,255,255,0.62) 100%);
          backdrop-filter: blur(28px) saturate(180%);
          -webkit-backdrop-filter: blur(28px) saturate(180%);
          border: 1px solid rgba(255, 255, 255, 0.85);
          box-shadow:
            0 36px 80px -28px rgba(14, 165, 233, 0.30),
            0 14px 36px -12px rgba(15, 23, 42, 0.12),
            0 2px 6px -1px rgba(15, 23, 42, 0.06),
            inset 0 1px 0 rgba(255, 255, 255, 0.95),
            inset 0 0 0 1px rgba(255, 255, 255, 0.35);
        }
        .dark .login-glass-pro {
          background:
            linear-gradient(135deg, rgba(22, 26, 36, 0.78) 0%, rgba(15, 17, 23, 0.66) 100%);
          border-color: transparent;
          box-shadow:
            0 30px 80px -24px rgba(14, 165, 233, 0.35),
            0 12px 40px -12px rgba(0, 0, 0, 0.55),
            0 2px 6px -2px rgba(0, 0, 0, 0.4);
        }
        .login-glass-pro::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          pointer-events: none;
          background:
            radial-gradient(120% 80% at 0% 0%, rgba(14, 165, 233, 0.05), transparent 65%);
          mix-blend-mode: soft-light;
        }
        .dark .login-glass-pro::after {
          background:
            radial-gradient(120% 80% at 0% 0%, rgba(14, 165, 233, 0.18), transparent 60%),
            radial-gradient(120% 80% at 100% 100%, rgba(139, 92, 246, 0.16), transparent 60%);
          mix-blend-mode: screen;
        }
        @keyframes login-orb-drift-a {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
          50%      { transform: translate3d(30px, -22px, 0) scale(1.08); }
        }
        @keyframes login-orb-drift-b {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
          50%      { transform: translate3d(-26px, 28px, 0) scale(0.94); }
        }
        @keyframes login-orb-drift-c {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
          50%      { transform: translate3d(20px, 32px, 0) scale(1.05); }
        }
        .login-orb-a { animation: login-orb-drift-a 12s ease-in-out infinite; }
        .login-orb-b { animation: login-orb-drift-b 14s ease-in-out infinite; }
        .login-orb-c { animation: login-orb-drift-c 10s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .login-orb-a, .login-orb-b, .login-orb-c { animation: none; }
        }
      `}</style>

      {/* ── Ambient mesh blobs (LEFT half only) ─────────────────────────
          Restrained palette - single faint sky blob behind the marketing
          column so the headline / stats sit on a near-white field.
          Dark mode keeps the original richer blob set for depth. */}
      <div className="absolute inset-y-0 left-0 right-1/2 z-0 pointer-events-none overflow-hidden hidden lg:block">
        <div className="absolute top-[-12%] left-[-6%] w-[520px] h-[520px] rounded-full bg-sky-300/10 dark:bg-oe-blue/35 blur-[120px] animate-blob-slow-1 mix-blend-screen" />
        <div className="absolute bottom-[-18%] right-[2%] w-[400px] h-[400px] rounded-full bg-cyan-200/10 dark:bg-violet-500/35 blur-[110px] animate-blob-slow-4 mix-blend-screen hidden dark:block" />
      </div>

      {/* Mobile-only ambient blobs (single column layout) */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden lg:hidden">
        <div className="absolute top-[-12%] left-[-6%] w-[520px] h-[520px] rounded-full bg-sky-300/10 dark:bg-oe-blue/35 blur-[110px] animate-blob-slow-1 mix-blend-screen" />
      </div>

      {/* Theme + Language - top right (enlarged for /login so discoverable). */}
      <div className="absolute top-4 right-4 z-30 flex items-center gap-2">
        <ThemeSwitch />
        <div className="relative" ref={langRef}>
        <button
          onClick={() => setLangOpen(!langOpen)}
          className="flex items-center gap-2 rounded-xl border border-border-light bg-surface-elevated/85 backdrop-blur-sm px-4 py-2 text-sm font-medium text-content-secondary hover:bg-surface-elevated hover:border-oe-blue/30 transition-colors shadow-sm"
        >
          <Globe size={16} className="text-content-tertiary" />
          <CountryFlag code={currentLang.country} size={20} />
          <span className="hidden sm:inline">{currentLang.name}</span>
          <ChevronDown size={14} className={`text-content-tertiary transition-transform ${langOpen ? 'rotate-180' : ''}`} />
        </button>
        {langOpen && (
          <div className="absolute right-0 mt-2 w-64 max-h-80 overflow-y-auto rounded-xl border border-border-light bg-surface-elevated shadow-xl py-1 animate-stagger-in">
            {SUPPORTED_LANGUAGES.map((lang) => {
              const isActive = i18n.language === lang.code;
              const english = 'english' in lang ? (lang as { english?: string }).english : undefined;
              return (
                <button
                  key={lang.code}
                  onClick={() => { i18n.changeLanguage(lang.code); setLangOpen(false); }}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors ${isActive ? 'bg-oe-blue/10 text-oe-blue font-medium' : 'text-content-primary hover:bg-surface-secondary'}`}
                >
                  <CountryFlag code={lang.country} size={18} />
                  <span className="truncate">
                    {lang.name}
                    {english && (
                      <span className="ml-1 text-2xs text-content-tertiary">({english})</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        </div>
      </div>

      {/* ── Right column on lg+: marketing & benefits.
          Order swap (lg:order-2) puts the form on the left so it's the
          first thing the eye lands on - primary action priority. */}
      <div className="hidden lg:flex relative z-10 lg:order-2 flex-col justify-center pl-14 xl:pl-20 pr-12 xl:pr-16 py-6 overflow-hidden">
        {/* Marketing column showcase - color lives here. Sky/cyan mesh +
            slow-drifting orbs + faint noise grain. The form column on the
            left stays a clean white field; this column carries the visual
            weight. */}
        <div className="absolute inset-0 pointer-events-none -z-10" aria-hidden>
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse 90% 70% at 70% 25%, rgba(14,165,233,0.16), transparent 65%),' +
                'radial-gradient(ellipse 80% 60% at 25% 85%, rgba(56,189,248,0.12), transparent 65%),' +
                'radial-gradient(ellipse 60% 50% at 90% 75%, rgba(125,211,252,0.10), transparent 65%)',
            }}
          />
          <div
            className="absolute inset-0 hidden dark:block"
            style={{
              background:
                'radial-gradient(ellipse 80% 60% at 70% 20%, rgba(14,165,233,0.22), transparent 60%),' +
                'radial-gradient(ellipse 70% 60% at 30% 90%, rgba(139,92,246,0.18), transparent 60%)',
            }}
          />
          <div className="absolute top-[8%] right-[8%] w-[420px] h-[420px] rounded-full bg-sky-300/45 dark:bg-sky-500/35 blur-[100px] login-orb-a" />
          <div className="absolute bottom-[6%] left-[10%] w-[360px] h-[360px] rounded-full bg-cyan-200/40 dark:bg-violet-500/30 blur-[100px] login-orb-b" />
          <div className="absolute top-[42%] right-[34%] w-[280px] h-[280px] rounded-full bg-white/55 dark:bg-white/0 blur-[80px] login-orb-c" />
          <div
            className="absolute inset-0 opacity-[0.04] dark:opacity-[0.07] mix-blend-overlay"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.5 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
            }}
          />
        </div>

        {/* Eyebrow pill */}
        <div className="mb-5 animate-stagger-in" style={{ animationDelay: '0ms' }}>
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/[0.08] dark:bg-emerald-400/[0.1] px-3.5 py-1.5">
            <span className="relative flex h-[6px] w-[6px]">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-[6px] w-[6px] bg-emerald-500" />
            </span>
            <span className="text-[11px] font-medium tracking-[0.04em] text-emerald-700 dark:text-emerald-300">Sod Boys Ltd</span>
          </span>
        </div>

        {/* Headline - kept as h2 because the form panel below has the
            authoritative h1 (visually hidden, always present in DOM). */}
        <h2 className="text-[32px] xl:text-[36px] font-semibold text-content-primary leading-[1.08] tracking-[-0.025em] animate-stagger-in" style={{ animationDelay: '60ms' }}>
          {t('login.hero_h_a', { defaultValue: 'Field operations,' })}
          <br />
          <span className="bg-gradient-to-r from-oe-blue to-oe-purple bg-clip-text text-transparent">
            {t('login.hero_h_c', { defaultValue: 'in one place' })}
          </span>
        </h2>

        {/* Subhead */}
        <p className="mt-5 text-[17px] text-content-secondary/70 leading-[1.65] tracking-[-0.008em] max-w-[420px] animate-stagger-in" style={{ animationDelay: '120ms' }}>
          {t('login.hero_desc', { defaultValue: 'Equipment, crew, timeclock, inventory, procurement and payroll — backed by real data, not spreadsheets.' })}
        </p>

        {/* Divider */}
        <div className="mt-5 mb-4 h-px bg-gradient-to-r from-content-primary/[0.06] via-content-primary/[0.1] to-transparent animate-stagger-in" style={{ animationDelay: '220ms' }} />

        {/* Module honeycomb - proper pointy-top hex grid where every cell
            shares an edge with its neighbours. Layout is intentionally
            wider on the top/bottom rows (6 cells) than on the middle
            row (5 cells) so it reads as a real, naturally-extending
            honeycomb. Every cell is a real module - no decorative
            placeholders. Math:
              hex width   = 88px (left vertex to right vertex)
              hex height  = 100px (top vertex to bottom vertex)
              row stride  = 75px (3/4 of height - pointy-top step)
              column step = 88px (one hex width on the same row)
              alternating rows are offset by 44px (half a hex) - that's
              what makes the slanted edges meet exactly. */}
        <div className="relative mt-1 mr-auto h-[280px] w-[560px] max-w-full overflow-hidden animate-stagger-in" style={{ animationDelay: '260ms' }}>
          {([
            // Top row (y = -75).
            { x: -220, y: -76, icon: Truck,           label: t('login.mod.equipment',  { defaultValue: 'Equipment' }) },
            { x:  -44, y: -76, icon: Users,           label: t('login.mod.resources',  { defaultValue: 'Resources' }) },
            { x:  132, y: -76, icon: CalendarClock,   label: t('login.mod.fieldtime',  { defaultValue: 'Field Time' }) },
            // Mid row (y = 0).
            { x: -176, y:  0,  icon: Boxes,           label: t('login.mod.inventory',  { defaultValue: 'Inventory' }) },
            { x:    0, y:  0,  icon: Layers,          label: t('login.mod.core',       { defaultValue: 'FieldOps' }), accent: true },
            { x:  176, y:  0,  icon: FileSpreadsheet, label: t('login.mod.procurement',{ defaultValue: 'Procurement' }) },
            // Bottom row (y = 75).
            { x: -132, y:  76, icon: Database,        label: t('login.mod.payroll',    { defaultValue: 'Payroll' }) },
            { x:   44, y:  76, icon: ShieldCheck,     label: t('login.mod.teams',      { defaultValue: 'Teams' }) },
            { x:  132, y:  76, icon: FileCheck,       label: t('login.mod.notifications', { defaultValue: 'Alerts' }) },
          ] as const).map((cell, idx) => {
            const isAccent = 'accent' in cell && cell.accent === true;
            const Icon = cell.icon;
            return (
              // Outer wrapper handles ABSOLUTE POSITIONING only - its
              // transform is the hex-grid offset and must never be
              // overridden by an animation. Animations live on the inner
              // cell so they don't fight with our positioning maths.
              <div
                key={idx}
                className="absolute top-1/2 left-1/2"
                style={{
                  transform: `translate(calc(-50% + ${cell.x}px), calc(-50% + ${cell.y}px))`,
                }}
              >
                <div
                  className={`relative flex flex-col items-center justify-center w-[88px] animate-fade-in transition-transform duration-300 hover:scale-[1.05] ${
                    isAccent ? 'text-white' : 'text-slate-900'
                  }`}
                  style={{
                    animationDelay: `${280 + idx * 35}ms`,
                    animationFillMode: 'both',
                    // The height comes from the width, so the cell cannot
                    // drift off the ratio the clip path is regular in.
                    aspectRatio: HEX_PORTRAIT_ASPECT,
                    clipPath: HEX_PORTRAIT_CLIP,
                    background: isAccent
                      ? 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 65%, #0369a1 100%)'
                      : 'linear-gradient(180deg, rgba(255,255,255,0.97), rgba(244,250,255,0.82))',
                    boxShadow: isAccent
                      ? '0 18px 32px -12px rgba(14,165,233,0.55), inset 0 1px 0 rgba(255,255,255,0.35)'
                      : '0 8px 18px -8px rgba(15,23,42,0.10), inset 0 1px 0 rgba(255,255,255,0.9), inset 0 0 0 1px rgba(14,165,233,0.06)',
                  }}
                >
                  <Icon
                    size={isAccent ? 22 : 18}
                    strokeWidth={isAccent ? 2 : 1.65}
                    className={isAccent ? '' : 'text-oe-blue'}
                  />
                  <span
                    className={`mt-[5px] text-[10px] font-semibold tracking-[-0.01em] ${
                      isAccent ? 'text-white/95' : 'text-slate-800'
                    }`}
                  >
                    {cell.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Value props - restored as a clean two-up grid with refined
            typography (no boxed icon backgrounds, accent rule above each
            title) so the marketing column lands on something concrete
            after the honeycomb. */}
        <div className="mt-2 flex flex-wrap items-start gap-x-5 gap-y-2 animate-stagger-in" style={{ animationDelay: '320ms' }}>
          {[
            { icon: ShieldCheck, title: t('login.feat_local_title', { defaultValue: 'Your data, your servers' }), desc: t('login.feat_local', { defaultValue: 'Self-hosted for Sod Boys Ltd.\nNo third-party data sharing.' }) },
            { icon: Timer,       title: t('login.feat_ai_title',    { defaultValue: 'Straight from the field' }), desc: t('login.feat_ai',    { defaultValue: 'Timesheets and payroll come from real clock-ins, not spreadsheets.' }) },
          ].map((feat) => {
            const Icon = feat.icon;
            return (
              <div key={feat.title} className="relative pl-4 max-w-[210px]">
                <span aria-hidden className="absolute left-0 top-1 h-[14px] w-[2px] rounded-full bg-gradient-to-b from-oe-blue to-sky-500/60" />
                <div className="flex items-center gap-1.5">
                  <Icon size={13} strokeWidth={1.8} className="text-oe-blue/85" />
                  <span className="text-[12.5px] font-semibold tracking-[-0.01em] text-content-primary leading-tight">
                    {feat.title}
                  </span>
                </div>
                <p className="mt-1 text-[11.5px] leading-[1.55] text-content-tertiary tracking-[-0.005em] whitespace-pre-line">
                  {feat.desc}
                </p>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-4 space-y-1 animate-stagger-in" style={{ animationDelay: '380ms' }}>
          <div className="flex items-center gap-2 text-[11px] text-content-quaternary/60">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" className="opacity-40"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
            <a href="/api/source" target="_blank" rel="noopener noreferrer" className="hover:text-content-tertiary transition-colors">AGPL-3.0</a>
          </div>
        </div>
      </div>

      {/* Center column removed - tags moved to left panel footer */}

      {/* ── Left column on lg+: logo + form (primary action). ── */}
      <div className="relative flex items-center justify-center p-4 sm:p-6 z-10 lg:order-1 overflow-hidden">
        {/* Form column backdrop - clean near-white field on lg+ so the
            glass card reads against a calm canvas. The decorative show
            (orbs / mesh) lives on the marketing column on the right. */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden hidden lg:block" aria-hidden>
          {/* Dark mode: use #070912 (DARKER than #0f1117 surface-primary so
              form inputs lift visibly off the column backdrop). Previously
              #0b0d12 — too close to input bg, made inputs invisible. */}
          <div className="absolute inset-0 bg-white dark:bg-[#070912]" />
          <div className="absolute inset-0 bg-gradient-to-l from-white/0 via-white/60 to-white dark:from-[#070912]/0 dark:via-[#070912]/60 dark:to-[#070912]" />
          {/* Tiny far-corner sky tint just to soften the edge - the glass
              still has something to lift off, but the field reads white. */}
          <div className="absolute -top-24 -left-24 w-[420px] h-[420px] rounded-full bg-sky-100/55 dark:bg-sky-500/10 blur-[110px]" />
        </div>
        <div className="w-full max-w-[380px] relative z-10">
          {/* Logo - tenant white-label (logo / company name) when set via
              the in-app sidebar editor; otherwise the default brand. The
              small "by OpenConstructionERP" attribution stays visible in
              customised modes (AGPL-3.0 requirement). */}
          <div className="relative mb-5 flex flex-col items-center animate-stagger-in" style={{ animationDelay: '0ms' }}>
            {/* Brand + edit-pencil row - grouped together and visually
                centered in the form column (previously the pencil was
                pinned to the far right edge which made the brand block
                look off-centre relative to the form below). */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2.5">
                <Logo size="md" animate />
                <span
                  className="text-2xl font-medium text-content-primary whitespace-nowrap"
                  style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", letterSpacing: '-0.02em' }}
                >
                  <span className="text-oe-blue">Sod Boys</span> <span className="text-content-quaternary">FieldOps</span>
                </span>
              </div>
            </div>
            <p className="mt-2 text-sm text-content-tertiary">
              {t('login.workspace_tagline', { defaultValue: 'Field operations dashboard' })}
            </p>
          </div>

          {/* Brand banner (mobile) */}
          <div className="lg:hidden mb-4 animate-stagger-in" style={{ animationDelay: '100ms' }}>
            <div className="rounded-xl bg-gradient-to-r from-oe-blue/10 via-oe-purple/10 to-emerald-500/10 border border-oe-blue/20 px-4 py-3 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Sod Boys Ltd</span>
              </div>
              <p className="text-sm font-bold bg-gradient-to-r from-oe-blue via-oe-purple to-emerald-600 bg-clip-text text-transparent">
                {t('login.open_source_badge', { defaultValue: 'Field Operations Dashboard' })}
              </p>
            </div>
          </div>

          {/* Form - premium multi-layer glass.
              login-glass-pro adds layered borders, a coloured ambient drop
              shadow, an inset highlight, and a soft-light overlay tint via
              ::after. The DOM-level top sheen below adds the rim-light line. */}
          <div
            className="login-glass-pro relative rounded-2xl px-6 py-5 animate-form-scale-in"
            style={{ animationDelay: '150ms' }}
          >
            {/* Top-edge sheen - bright highlight along the rim */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-6 top-0 h-px rounded-t-2xl"
              style={{
                background:
                  'linear-gradient(90deg, transparent, rgba(255,255,255,0.95), transparent)',
              }}
            />
            {/* Inner soft glow gradient on the top-left corner */}
            <div
              aria-hidden
              className="pointer-events-none absolute top-0 left-0 w-32 h-32 rounded-tl-2xl opacity-60"
              style={{
                background:
                  'radial-gradient(circle at 0% 0%, rgba(255,255,255,0.5), transparent 70%)',
              }}
            />
            {/* Visually hidden h1 for screen readers + a11y tools - visible text uses h2 below */}
            <h1 className="sr-only">{t('auth.login', 'Sign in')}</h1>
            <div className="animate-stagger-in" style={{ animationDelay: '200ms' }}>
              <h2 className="text-base font-semibold text-content-primary mb-0.5">{t('auth.login', 'Sign in')}</h2>
              <p className="text-xs text-content-secondary mb-4">{t('auth.login_subtitle', 'Enter your credentials to access your workspace')}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3" aria-label={t('auth.login', 'Sign in')}>
              <div className="animate-stagger-in" style={{ animationDelay: '280ms' }}>
                <Input id="login-email" name="email" label={t('auth.email', 'Email')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" required aria-required="true" autoFocus icon={<Mail size={15} />} />
              </div>

              <div className="flex flex-col gap-1 animate-stagger-in" style={{ animationDelay: '340ms' }}>
                {/* D-Central FieldOps fork (Task #156): forgot-password is pruned
                    along with the rest of self-service auth -- this backend is
                    admin-provisioned only (reset_user_password MCP tool), not a
                    REST self-service flow. See docs/ARCHITECTURE.md's Task #156
                    status entries. */}
                <label htmlFor="login-password" className="text-sm font-medium text-content-primary">{t('auth.password', 'Password')}</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-content-tertiary"><Lock size={15} /></div>
                  <input id="login-password" name="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('auth.password_placeholder', 'Enter your password')} autoComplete="current-password" required aria-required="true" minLength={8} className="h-9 w-full rounded-lg border border-border bg-surface-primary pl-9 pr-9 text-sm text-content-primary placeholder:text-content-tertiary transition-all duration-fast ease-oe focus:outline-none focus:ring-2 focus:ring-oe-blue focus:border-transparent hover:border-content-tertiary" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? t('auth.hide_password', 'Hide password') : t('auth.show_password', 'Show password')} className="absolute inset-y-0 right-0 flex items-center pr-3 text-content-tertiary hover:text-content-secondary transition-colors" tabIndex={-1}>
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div className="animate-stagger-in" style={{ animationDelay: '380ms' }}>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="h-3.5 w-3.5 rounded border-border text-oe-blue focus:ring-oe-blue accent-oe-blue" />
                  <span className="text-xs text-content-secondary">{t('auth.remember_me', 'Remember me for 30 days')}</span>
                </label>
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-lg bg-semantic-error-bg px-3 py-2 text-xs text-semantic-error animate-stagger-in">
                  <span className="shrink-0 mt-0.5">!</span><span>{error}</span>
                </div>
              )}

              <div className="animate-stagger-in" style={{ animationDelay: '400ms' }}>
                <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full btn-shimmer">{t('auth.login', 'Sign in')}</Button>
              </div>
            </form>

          </div>

          {/* D-Central FieldOps fork (Task #156): the demo-access panel
              defaulted `demoEnabled` to `true` and only ever hid itself on
              an EXPLICIT `demo_enabled: false` response from
              `/api/v1/auth/first-run` -- deliberate upstream behavior so a
              transient probe failure could never hide a headline feature
              of the open-source product. This façade never implements
              that endpoint at all (permanent 404, not a hiccup), so the
              panel would show fake `@openconstructionerp.com` demo
              accounts on this deployment forever. There is no demo-mode
              concept in this domain -- accounts are admin-provisioned via
              MCP tools -- so the whole panel is dropped rather than
              patched to fail closed. */}

          {/* Running build version - always visible so it's obvious which
              version is live on a fresh open. Matches the Sidebar / About
              treatment (v{APP_VERSION}). */}
          <div className="mt-3 text-center text-2xs font-mono text-content-quaternary/80 tabular-nums">
            v{APP_VERSION}
          </div>
        </div>
      </div>

      {/* ── White-label branding editor (pre-auth) ── */}

    </div>
  );
}
