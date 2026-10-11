/**
 * Lead status colour coding — the single source of truth for stage colours.
 *
 * The approved palette is keyed by the exact stage name (capitalisation,
 * spaces and punctuation included). A stage outside the palette keeps the
 * colour configured in Masters unless that colour is one of the palette's,
 * which are reserved for their statuses; with no usable colour it renders
 * neutral. So a new or unknown status never looks like an approved one. The
 * text colour on a fill is chosen by WCAG 2.1 contrast ratio, never assumed.
 */
export const STAGE_COLORS: Readonly<Record<string, string>> = {
  'Interested': '#16A34A',
  'Prospects': '#0F766E',
  'Not Interested': '#FCA5A5',
  'Invalid': '#DC2626',
  'Not Eligible': '#B91C1C',
  'Not Connected': '#F59E0B',
  'NFET': '#2563EB',
  'Interview': '#4F46E5',
  'PPO': '#7C3AED',
  'Registration & Fee': '#0891B2',
  'Risk': '#EA580C',
  'Future Batch': '#7DD3FC',
  'Closed - Lost': '#64748B',
  'Enrolled': '#15803D',
}

export interface StageLike {
  name?: string | null
  color?: string | null
}

/** The palette colour for an exact status name (surrounding whitespace ignored), or undefined. */
export function paletteColor(name?: string | null): string | undefined {
  if (!name) return undefined
  return STAGE_COLORS[name.trim()]
}

const RESERVED = new Set(Object.values(STAGE_COLORS).map((hex) => hex.toUpperCase()))

/** The colour to show for a stage: the palette by name, else its Masters colour (unless that is a
 * palette colour, reserved for its own status), else none (neutral). */
export function stageColor(stage?: StageLike | string | null): string | undefined {
  if (!stage) return undefined
  if (typeof stage === 'string') return paletteColor(stage)
  const own = stage.color?.trim() || undefined
  return paletteColor(stage.name) ?? (own && !RESERVED.has(own.toUpperCase()) ? own : undefined)
}

export const DARK_TEXT = '#0F172A'
export const LIGHT_TEXT = '#FFFFFF'
/** WCAG 2.1 AA minimum for normal text. */
export const WCAG_AA = 4.5

function channels(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1]
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

/** Relative luminance (WCAG 2.1); null for a value that is not a hex colour. */
export function luminance(hex: string): number | null {
  const rgb = channels(hex)
  if (!rgb) return null
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Contrast ratio between two hex colours, 1 (same) to 21 (black on white). */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a), lb = luminance(b)
  if (la === null || lb === null) return 1
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

/** Dark or light text, whichever reads better on `background`. */
export function textOn(background: string): string {
  return contrastRatio(background, DARK_TEXT) >= contrastRatio(background, LIGHT_TEXT) ? DARK_TEXT : LIGHT_TEXT
}
