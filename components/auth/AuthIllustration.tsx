import type { CSSProperties } from 'react'

/**
 * Placeholder art for the sign-in screen: a plate of qebapa with lepinja,
 * kajmak and red onion, steaming under a floating map pin. Swap this one
 * component for a commissioned piece; nothing else references its insides.
 *
 * Colours are tokens (and color-mix of tokens), never hex, so the art follows
 * the palette. Decorative only — the caller marks it aria-hidden.
 */

const stop = (c: string, o?: number): CSSProperties => ({ stopColor: c, stopOpacity: o })

const MEAT_DARK = 'color-mix(in srgb, var(--accent) 55%, var(--text))'
const MEAT_LIGHT = 'color-mix(in srgb, var(--accent) 55%, var(--warning-soft))'
const BREAD = 'color-mix(in srgb, var(--warning) 35%, var(--warning-soft))'
const BREAD_DARK = 'color-mix(in srgb, var(--warning) 70%, var(--accent))'
const PLATE_SHADE = 'color-mix(in srgb, var(--primary) 22%, var(--border-strong))'
const PIN_LIGHT = 'color-mix(in srgb, var(--primary) 45%, var(--surface))'
const ONION = 'color-mix(in srgb, var(--accent) 35%, var(--surface))'

// Back to front: each kebab sits a little lower (nearer) than the one before.
const QEBAPA = [0, 1, 2, 3, 4].map((i) => ({ x: 152 + i * 4, y: 228 + i * 10 }))

const fill = (c: string): CSSProperties => ({ fill: c })

export default function AuthIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 400" className={className} aria-hidden focusable="false">
      <defs>
        <radialGradient id="art-plate" cx="45%" cy="30%" r="80%">
          <stop offset="0" style={stop('var(--surface)')} />
          <stop offset=".65" style={stop('var(--surface-muted)')} />
          <stop offset="1" style={stop('var(--border-strong)')} />
        </radialGradient>
        <linearGradient id="art-rim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={stop('var(--border-strong)')} />
          <stop offset="1" style={stop(PLATE_SHADE)} />
        </linearGradient>
        <radialGradient id="art-well" cx="50%" cy="25%" r="85%">
          <stop offset="0" style={stop('var(--surface-muted)')} />
          <stop offset="1" style={stop('var(--surface)')} />
        </radialGradient>
        <linearGradient id="art-meat" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={stop(MEAT_LIGHT)} />
          <stop offset=".45" style={stop('var(--accent)')} />
          <stop offset="1" style={stop(MEAT_DARK)} />
        </linearGradient>
        <linearGradient id="art-bread" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={stop('var(--warning-soft)')} />
          <stop offset=".55" style={stop(BREAD)} />
          <stop offset="1" style={stop(BREAD_DARK)} />
        </linearGradient>
        <linearGradient id="art-pin" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={stop(PIN_LIGHT)} />
          <stop offset=".5" style={stop('var(--primary)')} />
          <stop offset="1" style={stop('var(--primary-hover)')} />
        </linearGradient>
        <filter id="art-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="10" />
        </filter>
        <filter id="art-soft" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
        <filter id="art-lift" x="-40%" y="-40%" width="180%" height="200%">
          <feDropShadow dx="0" dy="10" stdDeviation="9" style={{ floodColor: 'var(--primary-hover)', floodOpacity: 0.25 }} />
        </filter>
      </defs>

      {/* Soft light in the air. */}
      <g style={fill('var(--surface)')} filter="url(#art-blur)" opacity=".6">
        <circle cx="64" cy="292" r="26" />
        <circle cx="352" cy="262" r="18" />
        <circle cx="116" cy="44" r="14" />
        <circle cx="362" cy="34" r="10" />
      </g>

      {/* Ground shadow stays put while the plate floats above it. */}
      <ellipse cx="200" cy="358" rx="118" ry="13" style={fill('var(--primary-hover)')} opacity=".22" filter="url(#art-blur)" />

      <g className="ef-auth-float">
        {/* Plate: underside for thickness, top, well, rim light. */}
        <ellipse cx="200" cy="266" rx="150" ry="58" fill="url(#art-rim)" />
        <ellipse cx="200" cy="254" rx="150" ry="58" fill="url(#art-plate)" />
        <ellipse cx="200" cy="252" rx="106" ry="38" fill="url(#art-well)" style={{ stroke: 'var(--border)' }} strokeWidth="1.5" />
        <path d="M84 228 Q200 176 316 228" fill="none" style={{ stroke: 'var(--surface)' }} strokeWidth="3" strokeLinecap="round" opacity=".9" />

        {/* Lepinja. */}
        <ellipse cx="158" cy="252" rx="64" ry="23" style={fill(BREAD_DARK)} />
        <ellipse cx="158" cy="245" rx="64" ry="23" fill="url(#art-bread)" />
        <ellipse cx="146" cy="236" rx="36" ry="7" style={fill('var(--surface)')} opacity=".4" />

        {/* Contact shadow, then the qebapa. */}
        <ellipse cx="214" cy="280" rx="74" ry="10" style={fill('var(--text)')} opacity=".14" filter="url(#art-soft)" />
        <g transform="rotate(-8 210 256)">
          {QEBAPA.map(({ x, y }) => (
            <g key={y}>
              <rect x={x} y={y} width="104" height="22" rx="11" fill="url(#art-meat)" />
              <rect x={x + 12} y={y + 4} width="58" height="4" rx="2" style={fill('var(--surface)')} opacity=".35" />
              <path
                d={`M${x + 32} ${y + 4}l-6 15M${x + 56} ${y + 4}l-6 15M${x + 80} ${y + 4}l-6 15`}
                style={{ stroke: MEAT_DARK }}
                strokeWidth="3"
                strokeLinecap="round"
                opacity=".55"
              />
            </g>
          ))}
        </g>

        {/* Kajmak and red onion. */}
        <ellipse cx="282" cy="266" rx="25" ry="13" style={fill('var(--border-strong)')} />
        <ellipse cx="282" cy="262" rx="25" ry="13" style={fill('var(--surface)')} />
        <ellipse cx="276" cy="258" rx="10" ry="4" style={fill('var(--surface-muted)')} />
        <g fill="none" style={{ stroke: ONION }} strokeWidth="3.5">
          <ellipse cx="124" cy="276" rx="14" ry="6" />
          <ellipse cx="143" cy="283" rx="12" ry="5" />
        </g>

        {/* Steam. */}
        <g fill="none" style={{ stroke: 'var(--surface)' }} strokeWidth="6" strokeLinecap="round" opacity=".8" filter="url(#art-soft)">
          <path d="M184 206c-10-14 10-24 0-38s10-24 0-38" />
          <path d="M210 198c-10-14 10-24 0-38s10-24 0-38s10-24 0-38" />
          <path d="M236 206c-10-14 10-24 0-38" />
        </g>
      </g>

      {/* The pin: "this is a place on a map". */}
      <g className="ef-auth-float ef-auth-float--late" filter="url(#art-lift)">
        <path d="M300 172C286 150 262 128 262 100a38 38 0 1 1 76 0c0 28-24 50-38 72Z" fill="url(#art-pin)" />
        <circle cx="300" cy="100" r="16" style={fill('var(--surface)')} />
        <circle cx="300" cy="100" r="7" style={fill('var(--accent)')} />
        <ellipse cx="284" cy="80" rx="11" ry="6" transform="rotate(-35 284 80)" style={fill('var(--surface)')} opacity=".5" />
      </g>

      {/* A rating chip, borrowed from the app itself. */}
      <g className="ef-auth-float ef-auth-float--late" filter="url(#art-lift)">
        <rect x="54" y="92" width="96" height="40" rx="20" style={fill('var(--surface)')} />
        <path
          d="M80 103l2.35 5.76 6.21.46-4.76 4.02 1.49 6.04L80 116l-5.29 3.28 1.49-6.04-4.76-4.02 6.21-.46Z"
          style={fill('var(--accent)')}
        />
        <text x="96" y="118" style={{ fill: 'var(--text)', font: '800 17px var(--font-sans), system-ui, sans-serif' }}>
          4.8
        </text>
      </g>
    </svg>
  )
}
