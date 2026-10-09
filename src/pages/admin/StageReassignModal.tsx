import { useState } from 'react'
import { AlertTriangle, Ban } from 'lucide-react'
import { toast } from 'sonner'
import {
  useBulkChangeStageMutation,
  useDispositionOptionsQuery,
  useListLeadsQuery,
} from '../../services/leadsApi'
import { useDeleteMasterMutation } from '../../services/mastersApi'
import { useCurrentUser } from '../../app/hooks'
import { can } from '../../constants/permissions'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { Checkbox, FormField, Input, Select } from '../../components/ui/fields'
import { formatDate, parseApiError } from '../../lib/utils'
import type { Lead } from '../../types/models'
import { toLocalInput } from '../tasks/taskMeta'

/**
 * Deactivating a lead stage that still has leads on it: instead of a bare
 * validation error, this popup lists the leads, lets the admin bulk-select
 * them and move them to another active stage, and only once the stage is
 * empty can it be deactivated. With no leads it acts as a plain confirm.
 */
export function StageReassignModal({ stage, onClose }: { stage: { _id: string; name: string }; onClose: () => void }) {
  const me = useCurrentUser()
  const canMove = can(me, 'leads', 'edit')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [selected, setSelected] = useState<string[]>([])
  const [allMatching, setAllMatching] = useState(false)
  const [targetId, setTargetId] = useState('')
  const [subStageId, setSubStageId] = useState('')
  const [reason, setReason] = useState('')
  const [followUpAt, setFollowUpAt] = useState(() => toLocalInput(new Date(Date.now() + 24 * 3600_000)))
  const [followUpType, setFollowUpType] = useState('follow_up_call')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { data, isLoading, isFetching } = useListLeadsQuery({ stage: stage._id, page, page_size: pageSize })
  const { data: options } = useDispositionOptionsQuery()
  const [moveLeads, { isLoading: moving }] = useBulkChangeStageMutation()
  const [remove, { isLoading: removing }] = useDeleteMasterMutation()

  const leads = (data?.data ?? []) as Lead[]
  const total = data?.pagination?.total_results ?? 0
  const targets = (options?.data.stages ?? []).filter((s) => !s.locked && s._id !== stage._id)
  const target = targets.find((s) => s._id === targetId)
  const subStages = target?.subStages ?? []
  const count = allMatching ? total : selected.length

  const pageIds = leads.map((l) => l._id)
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => allMatching || selected.includes(id))

  const onMove = async () => {
    const local: Record<string, string> = {}
    if (!target) local.stage = 'Select the stage to move the leads to'
    else if (subStages.length && !subStageId) local.subStage = 'Select a sub-stage'
    if (target?.requiresReason && !subStages.length && !reason.trim()) local.reason = `A reason is required for "${target.name}"`
    if (target?.requiresFollowUp && !followUpAt) local.followUpAt = 'A next follow-up date-time is required for this stage'
    if (Object.keys(local).length) return setErrors(local)
    if (!count) return toast.error('Select at least one lead')
    try {
      const res = await moveLeads({
        ...(allMatching ? { selectAll: true, filters: { stage: stage._id } } : { leadIds: selected }),
        stage: targetId,
        subStage: subStageId || null,
        ...(target?.requiresFollowUp ? { followUpAt: new Date(followUpAt).toISOString(), followUpType } : {}),
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      }).unwrap()
      toast.success(res.message)
      setSelected([])
      setAllMatching(false)
      setPage(1)
      setErrors({})
    } catch (err) {
      const { message, errors: fe } = parseApiError(err)
      setErrors(fe)
      toast.error(message)
    }
  }

  const onDeactivate = async () => {
    try {
      await remove({ type: 'stages', id: stage._id }).unwrap()
      toast.success(`Stage "${stage.name}" deactivated`)
      onClose()
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }

  const columns: Column<Lead>[] = [
    {
      key: '__select',
      header: '',
      className: 'w-8',
      headerNode: (
        <Checkbox
          aria-label="Select page"
          checked={allPageSelected}
          onChange={(e) => {
            setAllMatching(false)
            setSelected((s) => (e.target.checked ? [...new Set([...s, ...pageIds])] : s.filter((id) => !pageIds.includes(id))))
          }}
        />
      ),
      render: (l) => (
        <Checkbox
          aria-label={`Select ${l.leadNo}`}
          checked={allMatching || selected.includes(l._id)}
          onChange={(e) => {
            setAllMatching(false)
            setSelected((s) => (e.target.checked ? [...s, l._id] : s.filter((id) => id !== l._id)))
          }}
        />
      ),
    },
    { key: 'leadNo', header: 'Lead no.', render: (l) => <span className="font-medium text-slate-800">{l.leadNo}</span> },
    { key: 'name', header: 'Name', render: (l) => `${l.firstName} ${l.lastName ?? ''}`.trim() },
    { key: 'mobile', header: 'Mobile', render: (l) => l.mobile ?? '—' },
    { key: 'owner', header: 'Counsellor', render: (l) => l.owner?.name ?? <span className="text-slate-400">Unassigned</span> },
    { key: 'lastDisposition', header: 'Disposition', render: (l) => l.lastDisposition ?? '—' },
    { key: 'createdAt', header: 'Created', render: (l) => formatDate(l.createdAt) },
  ]

  const empty = !isLoading && total === 0

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={`Deactivate stage "${stage.name}"`}
      description="Inactive stages stay on past records but disappear from dropdowns."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {!empty && canMove && (
            <Button onClick={onMove} loading={moving} disabled={!count}>
              Move {count || ''} lead{count === 1 ? '' : 's'}
            </Button>
          )}
          <Button variant="danger" onClick={onDeactivate} loading={removing} disabled={!empty}>
            <Ban className="h-3.5 w-3.5" /> Deactivate stage
          </Button>
        </>
      }
    >
      {empty ? (
        <p className="text-sm text-slate-600">
          No leads are in this stage. Deactivating it removes it from every dropdown — existing records keep it.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="flex gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>
              <b>{total}</b> lead{total === 1 ? ' is' : 's are'} still in <Badge>{stage.name}</Badge>. Move them to another
              active stage first — the stage can be deactivated only once it is empty.
              {!canMove && ' You need the "edit leads" permission to move them.'}
            </p>
          </div>
          {canMove && (
            <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3 sm:grid-cols-2">
              <FormField label="Move to stage" required error={errors.stage}>
                <Select
                  value={targetId}
                  aria-invalid={!!errors.stage}
                  onChange={(e) => {
                    setTargetId(e.target.value)
                    setSubStageId('')
                    setErrors({})
                  }}
                >
                  <option value="">Select stage…</option>
                  {targets.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </FormField>
              {subStages.length > 0 && (
                <FormField label="Sub-stage" required error={errors.subStage}>
                  <Select
                    value={subStageId}
                    aria-invalid={!!errors.subStage}
                    onChange={(e) => {
                      setSubStageId(e.target.value)
                      setErrors({})
                    }}
                  >
                    <option value="">Select sub-stage…</option>
                    {subStages.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </FormField>
              )}
              {target?.requiresReason && !subStages.length && (
                <FormField label="Reason" required error={errors.reason}>
                  <Input value={reason} onChange={(e) => setReason(e.target.value)} aria-invalid={!!errors.reason} />
                </FormField>
              )}
              {target?.requiresFollowUp && (
                <>
                  <FormField label="Next follow-up (all moved leads)" required error={errors.followUpAt}>
                    <Input
                      type="datetime-local"
                      min={toLocalInput(new Date())}
                      value={followUpAt}
                      onChange={(e) => setFollowUpAt(e.target.value)}
                      aria-invalid={!!errors.followUpAt}
                    />
                  </FormField>
                  <FormField label="Follow-up type">
                    <Select value={followUpType} onChange={(e) => setFollowUpType(e.target.value)}>
                      {options?.data.followUpTypes.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                </>
              )}
            </div>
          )}
          {canMove && allPageSelected && !allMatching && total > pageIds.length && (
            <p className="text-xs text-slate-600">
              All {pageIds.length} leads on this page are selected.{' '}
              <button type="button" className="font-semibold text-brand-700 hover:underline" onClick={() => setAllMatching(true)}>
                Select all {total} leads in this stage
              </button>
            </p>
          )}
          {allMatching && (
            <p className="text-xs text-slate-600">
              All <b>{total}</b> leads in this stage are selected.{' '}
              <button
                type="button"
                className="font-semibold text-brand-700 hover:underline"
                onClick={() => {
                  setAllMatching(false)
                  setSelected([])
                }}
              >
                Clear selection
              </button>
            </p>
          )}
          <DataTable
            columns={columns}
            rows={isLoading ? undefined : leads}
            rowKey={(l) => l._id}
            loading={isLoading || isFetching}
            emptyTitle="No leads in this stage"
            pagination={data?.pagination}
            onPageChange={setPage}
            onPageSizeChange={(s) => {
              setPageSize(s)
              setPage(1)
            }}
          />
        </div>
      )}
    </Modal>
  )
}
