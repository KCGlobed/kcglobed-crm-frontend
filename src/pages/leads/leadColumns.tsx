import { Badge, StatusBadge } from '../../components/ui/Badge'
import type { Column } from '../../components/ui/DataTable'
import { formatDate, formatDateTime, fullName, timeAgo } from '../../lib/utils'
import { subStageOf } from '../../lib/stages'
import type { Lead } from '../../types/models'
import { DISCUSSION_COLUMNS, PROFILE_COLUMNS } from './fieldCatalog'

export interface LeadColumn extends Column<Lead> {
  /** export column keys (backend `columns=` values) this table column stands for */
  exportKeys: string[]
}

const TRACK_LABEL: Record<Lead['track'], string> = { ads: 'Paid ads', partner: 'Channel partner', other: 'Other' }

const text = (value?: string | number | null) => (
  <span className="text-xs text-slate-600">{value === undefined || value === null || value === '' ? '—' : value}</span>
)
const when = (value?: string | null) => (
  <span className="text-xs text-slate-500" title={formatDateTime(value)}>
    {value ? formatDate(value) : '—'}
  </span>
)
const percent = (value?: number) => value === undefined ? text(null) : (
  <div className="flex items-center gap-1.5">
    <div className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-100">
      <div className="h-full rounded-full bg-brand-500" style={{ width: `${value ?? 0}%` }} />
    </div>
    <span className="text-[11px] text-slate-500">{value ?? 0}%</span>
  </div>
)
const show = (value: unknown) => {
  if (value === undefined || value === null || value === '') return text(null)
  if (typeof value === 'boolean') return text(value ? 'Yes' : 'No')
  if (typeof value === 'object') return text(Object.values(value as Record<string, unknown>).filter(Boolean).join(' / '))
  return text(String(value))
}

/**
 * Every column the leads table can show (GL-32). Keys of sortable columns are
 * the API's sort_by values. Order here is the default order.
 */
const ALL_LEAD_COLUMNS: LeadColumn[] = [
  { key: 'leadNo', header: 'Lead ID', sortable: true, exportKeys: ['leadNo'], render: (l) => <span className="whitespace-nowrap text-xs font-medium text-slate-500">{l.leadNo}</span> },
  {
    key: 'firstName',
    header: 'Name',
    sortable: true,
    exportKeys: ['firstName', 'lastName'],
    render: (l) => (
      <div className="flex items-center gap-1.5">
        <p className="max-w-52 truncate whitespace-nowrap font-medium text-slate-800" title={fullName(l)}>{fullName(l)}</p>
        {!!l.reEnquiryCount && <Badge tone="blue">Re-enquired ×{l.reEnquiryCount}</Badge>}
      </div>
    ),
  },
  { key: 'mobile', header: 'Mobile', sortable: true, exportKeys: ['mobile'], render: (l) => text(l.mobile ?? '••••••') },
  { key: 'email', header: 'Email', sortable: true, exportKeys: ['email'], render: (l) => <span className="block max-w-48 truncate text-xs text-slate-600">{l.email ?? '—'}</span> },
  {
    key: 'stage',
    header: 'Stage',
    sortable: true,
    exportKeys: ['stage', 'subStage'],
    render: (l) =>
      l.stage ? (
        <div>
          <Badge color={l.stage.color}>{l.stage.name}</Badge>
          {subStageOf(l) && <p className="mt-0.5 max-w-48 truncate text-[11px] text-slate-500">{subStageOf(l)!.name}</p>}
        </div>
      ) : (
        '—'
      ),
  },
  {
    key: 'owner',
    header: 'Owner',
    sortable: true,
    exportKeys: ['owner'],
    render: (l) =>
      l.owner ? (
        <span className="inline-flex max-w-44 items-center gap-1 whitespace-nowrap text-xs text-slate-700" title={l.owner.name}>
          <span className="truncate">{l.owner.name}</span>
          {l.ownerActive === false && <Badge tone="red" className="ml-1">inactive</Badge>}
        </span>
      ) : (
        <Badge tone="amber">Unassigned</Badge>
      ),
  },
  { key: 'firstSource', header: 'First Source', sortable: true, exportKeys: ['firstSource'], render: (l) => text(l.firstSource?.name) },
  { key: 'source', header: 'Latest Source', sortable: true, exportKeys: ['source'], render: (l) => text(l.source?.name) },
  { key: 'city', header: 'City', sortable: true, exportKeys: ['city'], render: (l) => text(l.city) },
  { key: 'program', header: 'Program Interest', sortable: true, exportKeys: ['program'], render: (l) => text(l.programInterest?.name) },
  { key: 'createdAt', header: 'Created On', sortable: true, exportKeys: ['createdAt'], render: (l) => when(l.createdAt) },
  {
    key: 'lastActivityAt',
    header: 'Last Activity',
    sortable: true,
    exportKeys: ['lastActivityAt'],
    render: (l) => (
      <span className="text-xs text-slate-500" title={formatDateTime(l.lastActivityAt)}>
        {timeAgo(l.lastActivityAt)}
      </span>
    ),
  },
  {
    key: 'nextFollowUpAt',
    header: 'Next Follow-up',
    sortable: true,
    exportKeys: ['nextFollowUpAt'],
    render: (l) =>
      l.nextFollowUpAt ? (
        <span className={`whitespace-nowrap text-xs ${l.isOverdue ? 'font-semibold text-red-600' : 'text-slate-600'}`} title={formatDateTime(l.nextFollowUpAt)}>
          {l.isOverdue ? 'Overdue · ' : ''}
          {formatDateTime(l.nextFollowUpAt)}
        </span>
      ) : (
        <span className="text-xs text-slate-400">—</span>
      ),
  },
  // ---- optional columns
  { key: 'state', header: 'State', sortable: true, exportKeys: ['state'], render: (l) => text(l.state) },
  {
    key: 'status',
    header: 'Status',
    sortable: true,
    exportKeys: ['status'],
    render: (l) => <StatusBadge status={l.status} />,
  },
  { key: 'createdViaLabel', header: 'Created Via', exportKeys: ['createdViaLabel'], render: (l) => text(l.createdViaLabel ?? l.createdVia) },
  { key: 'reEnquiryCount', header: 'Re-enquiry Count', sortable: true, exportKeys: ['reEnquiryCount'], render: (l) => text(l.reEnquiryCount ?? 0) },
  { key: 'metaCampaign', header: 'Meta Campaign', exportKeys: ['metaCampaign'], render: (l) => text(l.meta?.campaignName) },
  { key: 'metaAdset', header: 'Meta Ad Set', exportKeys: ['metaAdset'], render: (l) => text(l.meta?.adsetName) },
  { key: 'metaAd', header: 'Meta Ad', exportKeys: ['metaAd'], render: (l) => text(l.meta?.adName) },
  { key: 'metaForm', header: 'Meta Form', exportKeys: ['metaForm'], render: (l) => text(l.meta?.formName) },
  { key: 'uploadFileName', header: 'Upload File', exportKeys: ['uploadFileName'], render: (l) => text(l.uploadFileName) },
  { key: 'profileCompletion', header: 'Profile Completion %', exportKeys: ['profileCompletion'], render: (l) => percent(l.profileCompletion) },
  // The old backend sent the discussion % under customFieldsCompletion. `discussionCompletion` only
  // arrives from the new backend, so its presence tells us customFieldsCompletion now means Masters →
  // Custom fields. Until then both show "—". Drop the guard once the backend is deployed everywhere.
  {
    key: 'customFieldsCompletion',
    header: 'Custom Fields %',
    exportKeys: ['customFieldsCompletion'],
    render: (l) => percent(l.discussionCompletion === undefined ? undefined : l.customFieldsCompletion),
  },
  { key: 'discussionCompletion', header: 'Discussion Completion %', exportKeys: ['discussionCompletion'], render: (l) => percent(l.discussionCompletion) },
  {
    key: 'optedOut',
    header: 'Opted out',
    exportKeys: ['optedOutSms', 'optedOutEmail'],
    render: (l) => text([l.optedOut?.sms ? 'SMS' : null, l.optedOut?.email ? 'Email' : null].filter(Boolean).join(', ') || null),
  },
  { key: 'lastDisposition', header: 'Last disposition', exportKeys: ['lastDisposition'], render: (l) => text(l.lastDisposition) },
  { key: 'track', header: 'Track', exportKeys: ['track'], render: (l) => text(TRACK_LABEL[l.track]) },
  { key: 'cohort', header: 'Cohort', exportKeys: ['cohort'], render: (l) => text(l.cohort?.name) },
  {
    key: 'tags',
    header: 'Tags',
    exportKeys: ['tags'],
    render: (l) =>
      l.tags?.length ? (
        <div className="flex max-w-56 flex-wrap gap-1">
          {l.tags.map((t) => (
            <Badge key={t._id} color={t.color}>
              {t.name}
            </Badge>
          ))}
        </div>
      ) : (
        '—'
      ),
  },
  { key: 'assignedAt', header: 'Assigned On', sortable: true, exportKeys: ['assignedAt'], render: (l) => when(l.assignedAt) },
  { key: 'stageChangedAt', header: 'In stage since', sortable: true, exportKeys: ['stageChangedAt'], render: (l) => when(l.stageChangedAt) },
  { key: 'updatedAt', header: 'Updated', sortable: true, exportKeys: ['updatedAt'], render: (l) => when(l.updatedAt) },
  // every dropdown / number field of the profile and the counsellor discussion (GL-32/38)
  ...PROFILE_COLUMNS.map<LeadColumn>(({ key, label }) => ({
    key: `pf.${key}`,
    header: `Profile: ${label}`,
    exportKeys: [`pf.${key}`],
    render: (l) => show(l.profileValues?.[key]),
  })),
  ...DISCUSSION_COLUMNS.map<LeadColumn>(({ key, label }) => ({
    key: `cf.${key}`,
    header: label,
    exportKeys: [`cf.${key}`],
    render: (l) => show(l.discussionValues?.[key]),
  })),
]

// HIDDEN for now: removed from the table, the column chooser and exports. Saved layouts
// simply drop them. Delete a key here to bring its column back.
// - tags: no screen assigns tags to leads yet
// - lastDisposition: the Stage column already shows the sub-stage
const HIDDEN_COLUMNS = ['tags', 'lastDisposition']
export const LEAD_COLUMNS = ALL_LEAD_COLUMNS.filter((c) => !HIDDEN_COLUMNS.includes(c.key))

export const LEAD_COLUMN_KEYS = LEAD_COLUMNS.map((c) => c.key)
/** Go-live §11.1 default columns */
export const DEFAULT_VISIBLE_COLUMNS = [
  'leadNo', 'firstName', 'mobile', 'email', 'stage', 'owner', 'firstSource', 'source', 'city', 'program',
  'createdAt', 'lastActivityAt', 'nextFollowUpAt',
]
export const LOCKED_COLUMNS = ['firstName']
