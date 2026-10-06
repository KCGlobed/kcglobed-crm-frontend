import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight, PauseCircle, Users } from 'lucide-react'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { EmptyState, ErrorState, Skeleton } from '../../../components/ui/feedback'
import { cn } from '../../../lib/utils'
import type { TeamTreeNode } from '../../../types/models'
import { TeamTypeBadge } from './TeamTypeBadge'

function collectIds(nodes: TeamTreeNode[]): string[] {
  return nodes.flatMap((n) => (n.children.length ? [n._id, ...collectIds(n.children)] : []))
}

function TreeRow({
  node,
  depth,
  collapsed,
  onToggle,
}: {
  node: TeamTreeNode
  depth: number
  collapsed: Set<string>
  onToggle: (id: string) => void
}) {
  const open = !collapsed.has(node._id)
  const hasChildren = node.children.length > 0
  return (
    <>
      <div
        className={cn(
          'flex items-center gap-3 border-b border-slate-100 px-3 py-2.5 hover:bg-brand-50/40',
          !node.isActive && 'opacity-60'
        )}
        style={{ paddingLeft: 12 + depth * 24 }}
      >
        <button
          type="button"
          aria-label={open ? 'Collapse' : 'Expand'}
          onClick={() => onToggle(node._id)}
          className={cn('rounded p-0.5 text-slate-400 hover:bg-slate-100', !hasChildren && 'invisible')}
        >
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link to={`/app/admin/teams/${node._id}`} className="truncate text-sm font-medium text-slate-800 hover:text-brand-700">
              {node.name}
            </Link>
            {node.code && <span className="text-[11px] text-slate-400">{node.code}</span>}
            <TeamTypeBadge type={node.type} />
            {!node.isActive && <Badge>Inactive</Badge>}
            {node.receivesLeads === false && node.isActive && (
              <Badge tone="amber">
                <PauseCircle className="h-3 w-3" /> Distribution paused
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {node.manager?.name ? `Led by ${node.manager.name}` : 'No manager'}
            {node.location ? ` · ${node.location}` : ''}
          </p>
        </div>
        <div className="shrink-0 text-right text-xs text-slate-600" title="Active members in this unit / including everything below it">
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Users className="h-3.5 w-3.5 text-slate-400" />
            {node.memberCount}
            {hasChildren && <span className="text-slate-400">/ {node.totalMembers}</span>}
          </span>
        </div>
      </div>
      {open && node.children.map((c) => (
        <TreeRow key={c._id} node={c} depth={depth + 1} collapsed={collapsed} onToggle={onToggle} />
      ))}
    </>
  )
}

export function TeamTree({
  nodes,
  loading,
  error,
  onRetry,
}: {
  nodes?: TeamTreeNode[]
  loading?: boolean
  error?: string
  onRetry?: () => void
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Organisation hierarchy</p>
        {!!nodes?.length && (
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => setCollapsed(new Set())}>
              Expand all
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setCollapsed(new Set(collectIds(nodes)))}>
              Collapse all
            </Button>
          </div>
        )}
      </div>
      {loading ? (
        <div className="space-y-3 p-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ paddingLeft: (i % 3) * 24 }}>
              <Skeleton className="h-5" />
            </div>
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={onRetry} />
      ) : !nodes?.length ? (
        <EmptyState title="No teams yet" description="Create a department or team to start building the hierarchy." />
      ) : (
        nodes.map((n) => <TreeRow key={n._id} node={n} depth={0} collapsed={collapsed} onToggle={toggle} />)
      )}
    </div>
  )
}
