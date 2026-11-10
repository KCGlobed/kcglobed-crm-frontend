import { useState } from 'react'
import { History } from 'lucide-react'
import { Button } from '../../components/ui/Button'

/** compact date / time box for the panel (the shared Input is too tall here) */
const FIELD =
  'h-8 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-800 focus:border-brand-400 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400'

/** What can be picked — the keys match the backend's TIMELINE_TYPES (apps/leads/filters.py). */
const TIMELINE_TYPES: { key: string; label: string }[] = [
  { key: 'stage', label: 'Lead Stage' },
  { key: 'sms', label: 'SMS' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'email', label: 'Email' },
  { key: 'call', label: 'Calls' },
  { key: 'note', label: 'Notes' },
  { key: 'task', label: 'Follow-ups' },
  { key: 'assignment', label: 'Lead Assigned' },
  { key: 'edit', label: 'Profile Update' },
  { key: 'document', label: 'Documents' },
  { key: 're_enquiry', label: 'Re-enquiry' },
]

export interface TimelineValue {
  types: string[]
  from: string
  to: string
  fromTime: string
  toTime: string
}

const EMPTY_TIMELINE: TimelineValue = { types: [], from: '', to: '', fromTime: '', toTime: '' }

/**
 * Leads → Timeline: leads where any of the chosen timeline events (a stage change, an SMS, a WhatsApp …)
 * happened between the start and end date/time. Picks are a draft until Apply, so the list reloads once.
 */
export function TimelineFilter({ value, onApply }: { value: TimelineValue; onApply: (next: TimelineValue) => void }) {
  const [open, setOpen] = useState(false)
  // the panel opens toward the side with room: left-aligned when the button sits in the left half of the screen
  // (e.g. wrapped onto a new filter row), right-aligned otherwise — so it never runs off either edge
  const [alignLeft, setAlignLeft] = useState(true)
  const [draft, setDraft] = useState<TimelineValue>(value)
  const active = value.types.length > 0 || !!value.from || !!value.to
  const names = value.types.map((k) => TIMELINE_TYPES.find((t) => t.key === k)?.label ?? k)
  const when = value.from || value.to
    ? `${value.from || '…'}${value.fromTime ? ` ${value.fromTime}` : ''} → ${value.to || '…'}${value.toTime ? ` ${value.toTime}` : ''}`
    : ''
  const text = active ? `Timeline${names.length ? `: ${names.join(', ')}` : ''}` : 'Timeline'
  const set = (patch: Partial<TimelineValue>) => setDraft((d) => ({ ...d, ...patch }))
  const toggle = (key: string, on: boolean) => set({ types: on ? [...draft.types, key] : draft.types.filter((k) => k !== key) })

  return (
    <div className="relative [&_button]:cursor-pointer">
      <Button
        variant={active ? 'secondary' : 'outline'}
        size="sm"
        title={active ? [names.join(', ') || 'Any activity', when].filter(Boolean).join(' · ') : 'Leads by what happened on their timeline, and when'}
        onClick={(e) => {
          setDraft(value) // reopening starts from what is applied
          const box = e.currentTarget.getBoundingClientRect()
          setAlignLeft(box.left + 416 <= window.innerWidth - 16) // 416 px = the panel's 26rem width
          setOpen((o) => !o)
        }}
      >
        <History className="h-3.5 w-3.5" />
        <span className="max-w-56 truncate">{text}</span>
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className={`absolute ${alignLeft ? 'left-0' : 'right-0'} top-full z-50 mt-1.5 flex max-h-[min(30rem,calc(100vh-10rem))] w-[26rem] max-w-[calc(100vw-2rem)] flex-col rounded-xl border border-slate-200 bg-white shadow-xl`}>
            <div className="overflow-y-auto px-3 pb-2 pt-3">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">What happened</p>
              <div className="grid grid-cols-3 gap-x-1 gap-y-0.5">
                {TIMELINE_TYPES.map((t) => (
                  <label key={t.key} className="flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 text-xs text-slate-700 hover:bg-slate-50">
                    <input type="checkbox" className="h-3.5 w-3.5" checked={draft.types.includes(t.key)} onChange={(e) => toggle(t.key, e.target.checked)} />
                    <span className="truncate">{t.label}</span>
                  </label>
                ))}
              </div>
              <p className="mb-1.5 mt-2.5 border-t border-slate-100 pt-2.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">When</p>
              <div className="grid grid-cols-[2.5rem_1fr_6.5rem] items-center gap-x-2 gap-y-1.5">
                <span className="text-[11px] font-medium text-slate-500">From</span>
                <input type="date" aria-label="Timeline from" className={FIELD} value={draft.from} max={draft.to || undefined} onChange={(e) => set({ from: e.target.value, fromTime: e.target.value ? draft.fromTime : '' })} />
                <input type="time" aria-label="Timeline from time" className={FIELD} value={draft.fromTime} disabled={!draft.from} title={draft.from ? 'Blank = from 12:00 AM' : 'Pick a start date first'} onChange={(e) => set({ fromTime: e.target.value })} />
                <span className="text-[11px] font-medium text-slate-500">To</span>
                <input type="date" aria-label="Timeline to" className={FIELD} value={draft.to} min={draft.from || undefined} onChange={(e) => set({ to: e.target.value, toTime: e.target.value ? draft.toTime : '' })} />
                <input type="time" aria-label="Timeline to time" className={FIELD} value={draft.toTime} disabled={!draft.to} title={draft.to ? 'Blank = till 11:59 PM' : 'Pick an end date first'} onChange={(e) => set({ toTime: e.target.value })} />
              </div>
              <p className="mt-1.5 text-[10px] leading-snug text-slate-400">No tick = any event · no date = any time · time is optional</p>
            </div>
            <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 px-3 py-2">
              {(active || draft.types.length > 0 || draft.from || draft.to) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600"
                  onClick={() => {
                    setDraft(EMPTY_TIMELINE)
                    onApply(EMPTY_TIMELINE)
                    setOpen(false)
                  }}
                >
                  Clear
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => {
                  onApply(draft)
                  setOpen(false)
                }}
              >
                Apply
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
