import { highlightParts } from '../../lib/search'

/** `text` with the parts that match the search query marked. */
export function Highlight({ text, query }: { text?: string | null; query: string }) {
  if (!text) return null
  const parts = highlightParts(text, query)
  return (
    <>
      {parts.map((p, i) =>
        p.hit ? (
          <mark key={i} className="rounded-sm bg-amber-100 px-px text-inherit">
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
    </>
  )
}
