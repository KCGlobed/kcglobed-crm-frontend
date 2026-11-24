/**
 * Client-side list search used by the Communication tabs: any part of any word matches ("ppo", "ship" →
 * Scholarship), every typed word must match somewhere (any order), and rows come back best match first —
 * a hit in the name beats one in the subject, which beats one buried in the message body. HTML in bodies is
 * stripped first, so tags / inline CSS never match. Plain functions, so node runs the tests (npm test).
 */

export interface SearchField {
  text?: string | null
  /** how much a hit here counts: name ≈ 10, subject ≈ 5, body ≈ 1 */
  weight: number
}

/** lower case, no HTML, no accents, punctuation → spaces, single spaces. */
export function normalize(text: string | null | undefined): string {
  if (!text) return ''
  return text
    .replace(/<(style|script|head)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z]+;|&#\d+;/gi, ' ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/** The typed words, normalised, without repeats. */
export function queryWords(query: string): string[] {
  return [...new Set(normalize(query).split(' ').filter(Boolean))]
}

/** 3 = a whole word, 2 = the start of a word, 1 = inside a word, 0 = not there. */
function quality(tokens: string[], word: string): number {
  let best = 0
  for (const t of tokens) {
    if (t === word) return 3
    if (t.startsWith(word)) best = 2
    else if (best < 1 && t.includes(word)) best = 1
  }
  return best
}

/** Score of one row for the words (0 = does not match). The first field is treated as the name. */
export function scoreFields(fields: SearchField[], words: string[], phrase = words.join(' ')): number {
  if (!words.length) return 0
  const prepared = fields.map((f) => {
    const text = normalize(f.text)
    return { text, tokens: text.split(' '), weight: f.weight }
  })
  let score = 0
  for (const w of words) {
    let best = 0
    for (const f of prepared) {
      if (!f.text) continue
      const q = quality(f.tokens, w)
      if (q) best = Math.max(best, q * f.weight)
    }
    if (!best) return 0
    score += best
  }
  // the whole phrase in the name: at its start > anywhere
  const name = prepared[0]
  if (name?.text && words.length) {
    if (name.text.startsWith(phrase)) score += name.weight * 3
    else if (name.text.includes(phrase)) score += name.weight * 2
  }
  return score
}

/** The rows that match `query`, best first (ties keep their order). An empty query returns the rows as they are. */
export function searchRank<T>(rows: readonly T[], query: string, fields: (row: T) => SearchField[]): T[] {
  const words = queryWords(query)
  if (!words.length) return [...rows]
  const phrase = words.join(' ')
  return rows
    .map((row, i) => ({ row, i, score: scoreFields(fields(row), words, phrase) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map((r) => r.row)
}

export interface HighlightPart {
  text: string
  hit: boolean
}

/** `text` cut into pieces, with the pieces that match a typed word marked (case-insensitive, overlaps merged). */
export function highlightParts(text: string, query: string): HighlightPart[] {
  if (!text) return []
  const words = queryWords(query)
  if (!words.length) return [{ text, hit: false }]
  const lower = text.toLowerCase()
  const ranges: [number, number][] = []
  for (const w of words) {
    let at = lower.indexOf(w)
    while (at !== -1) {
      ranges.push([at, at + w.length])
      at = lower.indexOf(w, at + 1)
    }
  }
  if (!ranges.length) return [{ text, hit: false }]
  ranges.sort((a, b) => a[0] - b[0])
  const merged: [number, number][] = []
  for (const r of ranges) {
    const last = merged[merged.length - 1]
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1])
    else merged.push([...r])
  }
  const parts: HighlightPart[] = []
  let pos = 0
  for (const [s, e] of merged) {
    if (s > pos) parts.push({ text: text.slice(pos, s), hit: false })
    parts.push({ text: text.slice(s, e), hit: true })
    pos = e
  }
  if (pos < text.length) parts.push({ text: text.slice(pos), hit: false })
  return parts
}
