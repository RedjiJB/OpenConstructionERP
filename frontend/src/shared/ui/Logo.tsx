// DDC-CWICR-OE: DataDrivenConstruction · OpenConstructionERP
// Copyright (c) 2026 Artem Boiko / DataDrivenConstruction
//
// D-Central FieldOps fork (Task #156): re-skinned for Sod Boys Ltd — a
// rising sun over rolling fields, matching the client's existing v1
// (fieldops-system) logo and green/gold palette. Same animation
// choreography as upstream's building-icon Logo, just re-pointed at
// different shapes: background scales in, fields grow from the bottom,
// the sun slides in, its rays fade in one by one.
import clsx from 'clsx';

interface LogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  animate?: boolean;
  className?: string;
}

/* Icon sizes — compact so the text dominates */
const sizeMap = {
  xs: 'h-5 w-5',
  sm: 'h-6 w-6',
  md: 'h-7 w-7',
  lg: 'h-10 w-10',
  xl: 'h-14 w-14',
};

/**
 * Brand logo — rolling fields and a rising sun, on the Sod Boys green
 * background.
 *
 * `animate` triggers a staggered entrance:
 *   1. Background scales in
 *   2. Field bands grow up one by one
 *   3. Sun slides in
 *   4. Sun rays fade in
 */
export function Logo({ size = 'md', animate = false, className }: LogoProps) {
  const isSmall = size === 'xs' || size === 'sm';

  const fieldStyle = (delay: number) =>
    animate
      ? {
          transformOrigin: 'bottom',
          animation: `oeBarGrow 500ms cubic-bezier(0.34,1.56,0.64,1) both`,
          animationDelay: `${delay}ms`,
        }
      : undefined;

  const sunGroupStyle = animate
    ? {
        animation: `oeBuildingSlide 600ms cubic-bezier(0.22,1,0.36,1) both`,
        animationDelay: '300ms',
      }
    : undefined;

  const rayStyle = (delay: number) =>
    animate
      ? {
          animation: `oeWindowFade 400ms ease both`,
          animationDelay: `${delay}ms`,
        }
      : undefined;

  const bgStyle = animate
    ? {
        animation: `oeBgScale 450ms cubic-bezier(0.34,1.56,0.64,1) both`,
      }
    : undefined;

  return (
    <div
      className={clsx(sizeMap[size], 'relative shrink-0', className)}
      style={animate ? { animation: 'oeLogoFloat 3s ease-in-out 1.2s infinite, oeLogoGlow 3s ease-in-out 1.2s infinite' } : undefined}
    >
      <svg viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <defs>
          <clipPath id={`oe-lg-clip-${size}`}>
            <rect x="32" y="32" width="448" height="448" rx="96" />
          </clipPath>
        </defs>

        {/* Background */}
        <rect x="32" y="32" width="448" height="448" rx="96" fill="#eef7f0" style={bgStyle} />

        <g clipPath={`url(#oe-lg-clip-${size})`}>
          {/* Sun */}
          <g style={sunGroupStyle}>
            <circle cx="180" cy="188" r="58" fill="#f2a71b" />
            {!isSmall && (
              <g stroke="#f2a71b" strokeWidth="16" strokeLinecap="round">
                <line x1="180" y1="70" x2="180" y2="102" style={rayStyle(550)} />
                <line x1="180" y1="274" x2="180" y2="306" style={rayStyle(600)} />
                <line x1="58" y1="188" x2="90" y2="188" style={rayStyle(650)} />
                <line x1="270" y1="188" x2="302" y2="188" style={rayStyle(700)} />
                <line x1="98" y1="106" x2="121" y2="129" style={rayStyle(750)} />
                <line x1="239" y1="247" x2="262" y2="270" style={rayStyle(800)} />
                <line x1="262" y1="106" x2="239" y2="129" style={rayStyle(850)} />
              </g>
            )}
          </g>

          {/* Rolling fields, back to front */}
          <path d="M32 460 C 120 380, 200 420, 280 380 C 360 340, 420 400, 480 370 V 480 H 32 Z" fill="#256e33" style={fieldStyle(120)} />
          <path d="M32 480 C 130 420, 220 460, 320 420 C 390 392, 440 430, 480 410 V 480 H 32 Z" fill="#35a049" style={fieldStyle(200)} />
          <path d="M32 480 C 150 452, 260 480, 360 452 C 410 438, 450 456, 480 448 V 480 H 32 Z" fill="#2e8b3f" style={fieldStyle(280)} />
        </g>
      </svg>
    </div>
  );
}

/* ── LogoWithText ──────────────────────────────────────────────────────── */

interface LogoWithTextProps extends LogoProps {
  showVersion?: boolean;
}

/* Text sizes — larger than icon to make the name prominent */
const textSizeMap = {
  xs: 'text-[15px] leading-none',
  sm: 'text-[16px] leading-none',
  md: 'text-[17px] leading-none',
  lg: 'text-xl leading-none',
  xl: 'text-2xl leading-none',
};

const gapSizeMap = {
  xs: 'gap-1.5',
  sm: 'gap-2',
  md: 'gap-2',
  lg: 'gap-2.5',
  xl: 'gap-3',
};

/**
 * Logo + brand name: "Sod Boys" in the brand green, "FieldOps" as the
 * quieter suffix — same visual weighting upstream used for its own
 * "OpenConstruction"/"ERP" split.
 */
export function LogoWithText({ size = 'md', animate, showVersion = true, className }: LogoWithTextProps) {
  return (
    <div className={clsx('flex items-center', gapSizeMap[size], className)}>
      <Logo size={size} animate={animate} />
      <span
        className={clsx(
          textSizeMap[size],
          'font-medium text-content-primary whitespace-nowrap tracking-tight',
        )}
        style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", letterSpacing: '-0.02em' }}
      >
        <span className="text-oe-blue">Sod Boys</span>
        {showVersion && <span className="text-content-quaternary"> FieldOps</span>}
      </span>
    </div>
  );
}
