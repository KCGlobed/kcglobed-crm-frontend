import { NAV_SECTIONS } from '../../../constants/navigation'
import { can } from '../../../constants/permissions'
import type { ModulePermission } from '../../../types/models'

/**
 * SOW permission builder step 7 — "Preview": the menu exactly as this user will
 * see it. Unticked modules are hidden, not greyed out.
 */
export function MenuPreview({ permissions }: { permissions: ModulePermission[] }) {
  const viewer = { isSuperAdmin: false, permissions }
  const sections = NAV_SECTIONS.map((s) => ({
    ...s,
    items: s.items.filter((i) => !i.superAdminOnly && can(viewer, i.module, i.action)),
  })).filter((s) => s.items.length)

  return (
    <div className="h-fit rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Menu preview</p>
      {!sections.length && <p className="text-xs text-slate-400">No modules ticked — the user would see only their profile.</p>}
      <div className="space-y-3">
        {sections.map((s, i) => (
          <div key={i}>
            {s.title && <p className="mb-1 text-[10px] uppercase tracking-wide text-slate-400">{s.title}</p>}
            {s.items.map((item) => (
              <p key={item.path} className="flex items-center gap-2 rounded-md bg-white px-2 py-1.5 text-xs text-slate-700 ring-1 ring-slate-200">
                <item.icon className="h-3.5 w-3.5 text-slate-400" /> {item.label}
              </p>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
