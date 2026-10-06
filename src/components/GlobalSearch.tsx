import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { useGlobalSearchQuery } from '../services/leadsApi'
import { Spinner } from './ui/feedback'

/**
 * GL-33: one search box at the top of every screen — name (partial), mobile
 * (full or last 4+ digits), email (partial), Lead ID. Results respect the
 * caller's visibility; another counsellor's lead only shows a notice (GL-07).
 */
export function GlobalSearch() {
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [term, setTerm] = useState('')
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setTerm(text.trim()), 300)
    return () => clearTimeout(t)
  }, [text])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        box.current?.querySelector('input')?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const { data, isFetching } = useGlobalSearchQuery(term, { skip: term.length < 2 })
  const result = data?.data

  const go = (id: string) => {
    setOpen(false)
    setText('')
    navigate(`/app/leads/${id}`)
  }

  return (
    <div ref={box} className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && result?.items[0]) go(result.items[0]._id)
          if (e.key === 'Escape') setOpen(false)
        }}
        placeholder="Search leads — name, mobile, email, Lead ID  (Ctrl+K)"
        className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-8 text-sm text-slate-700 placeholder:text-slate-400 transition-colors hover:border-slate-300 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-3 focus:ring-brand-100"
      />
      {isFetching && <Spinner className="absolute right-2.5 top-2.5 h-4 w-4" />}
      {open && term.length >= 2 && result && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 z-40 mt-1 max-h-96 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
            {result.items.length === 0 && (
              <p className="px-3 py-3 text-xs text-slate-500">{result.notice ?? 'No lead matches this search.'}</p>
            )}
            {result.items.map((l) => (
              <button
                key={l._id}
                onClick={() => go(l._id)}
                className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left hover:bg-slate-50"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-slate-800">{l.name}</span>
                  <span className="block truncate text-[11px] text-slate-500">
                    {l.leadNo} · {l.mobile ?? '—'} {l.email ? `· ${l.email}` : ''}
                  </span>
                </span>
                <span className="shrink-0 text-right text-[11px] text-slate-500">
                  {l.stage}
                  <span className="block text-slate-400">{l.owner ?? 'Unassigned'}</span>
                </span>
              </button>
            ))}
            {result.total > result.items.length && (
              <button
                onClick={() => {
                  setOpen(false)
                  navigate(`/app/leads?search=${encodeURIComponent(term)}`)
                }}
                className="block w-full border-t border-slate-100 px-3 py-2 text-left text-xs font-medium text-brand-600 hover:bg-slate-50"
              >
                See all {result.total} results
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
