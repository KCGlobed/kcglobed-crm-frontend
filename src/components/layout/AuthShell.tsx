import type { ReactNode } from 'react'
import { CalendarClock, ClipboardList, Users } from 'lucide-react'
import logoLight from '../../assets/logo-gcc-light.png'

const HIGHLIGHTS = [
  { icon: ClipboardList, label: 'Every lead in one pipeline' },
  { icon: CalendarClock, label: 'Follow-ups that never slip' },
  { icon: Users, label: 'Teams and counsellors in sync' },
]

/** Frame for the signed-out pages: brand panel on large screens, the form on white. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-white">
      <aside className="relative hidden w-[42%] max-w-2xl flex-col justify-between overflow-hidden bg-linear-to-br from-brand-600 via-brand-700 to-brand-900 p-10 text-white lg:flex xl:p-14">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-brand-400/40 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full border border-gold-400/30" />
        <div aria-hidden className="pointer-events-none absolute -bottom-16 -left-4 h-64 w-64 rounded-full border border-white/10" />

        <div className="relative flex items-center gap-3">
          <img src={logoLight} alt="GCC School" className="h-12 w-auto" />
          <span className="rounded-md bg-white/10 px-2 py-1 text-[11px] font-bold tracking-wider text-gold-400 ring-1 ring-white/20">CRM</span>
        </div>

        <div className="relative">
          <span className="mb-5 block h-1 w-12 rounded-full bg-gold-400" />
          <h2 className="text-3xl font-bold leading-tight tracking-tight xl:text-4xl">
            Admissions, <span className="text-gold-400">organised.</span>
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-6 text-brand-100">
            Track every enquiry from the first call to enrolment, with follow-ups, counsellor discussions and documents in one place.
          </p>
        </div>

        <ul className="relative space-y-3">
          {HIGHLIGHTS.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-3 text-sm text-brand-100">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
                <Icon className="h-4 w-4 text-gold-300" />
              </span>
              {label}
            </li>
          ))}
        </ul>
      </aside>

      <main className="flex flex-1 items-center justify-center p-4 sm:p-8">{children}</main>
    </div>
  )
}
