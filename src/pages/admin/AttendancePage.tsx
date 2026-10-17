import { Download } from 'lucide-react'
import { toast } from 'sonner'
import dayjs from 'dayjs'
import { useSearchParams } from 'react-router-dom'
import { useCurrentUser } from '../../app/hooks'
import { can } from '../../constants/permissions'
import { useListParams } from '../../hooks/useListParams'
import { authorizedDownload } from '../../lib/download'
import { formatHms, secondsSince, useNow } from '../../lib/durations'
import { parseApiError } from '../../lib/utils'
import { useUserOptionsQuery } from '../../services/adminApi'
import { useAttendanceReportQuery, useBreakEntriesQuery } from '../../services/attendanceApi'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { DateRangeFilter } from '../../components/ui/DateRangeFilter'
import { Select } from '../../components/ui/fields'
import { FilterBar, PageHeader, SearchInput, Tabs } from '../../components/ui/misc'
import type { AttendanceRow, BreakEntry, BreakType } from '../../types/models'
import { CallProofsTab } from './attendance/CallProofsTab'

/**
 * Attendance (Super Admin): per employee per IST day, sign-in hours from the login / logout records,
 * talk time from the logged calls and break-wise time from Punch Break. The tabs are views of the same
 * rows (the spec's tables 4.1, 4.2, 4.3 and the consolidated report); Break Entries lists every break.
 */
type Tab = 'consolidated' | 'login' | 'talk' | 'breaks' | 'entries' | 'calls'
type ReportTab = Exclude<Tab, 'entries' | 'calls'>
const TABS: { key: Tab; label: string }[] = [
  { key: 'consolidated', label: 'Consolidated' },
  { key: 'login', label: 'Login Hours' },
  { key: 'talk', label: 'Talk Time' },
  { key: 'breaks', label: 'Breaks' },
  { key: 'entries', label: 'Break Entries' },
  { key: 'calls', label: 'Call Proofs' },
]
const DESCRIPTIONS: Record<Tab, string> = {
  consolidated: 'Login and logout, talk time and break-wise time for every employee, one row per working day (IST).',
  login: 'First sign-in, last sign-out and the time signed in (sessions added up, as on the employee\'s timer). A day whose last session never signed out is flagged and counted only up to the last activity.',
  talk: 'Calls logged and the sum of their durations, per employee per day.',
  breaks: 'Completed break time by type. A break still running is shown on its own; one left open past its day is counted as incomplete.',
  entries: 'Every break punched, with its start, end and duration, for auditing.',
  calls: 'Every logged call with the duration the counsellor entered, its call screenshot and recording. Preview to compare the duration with the screenshot.',
}
const BREAK_TYPES: { key: BreakType; label: string }[] = [
  { key: 'tea', label: 'Tea Break' },
  { key: 'lunch', label: 'Lunch Break' },
  { key: 'bio', label: 'Bio Break' },
  { key: 'other', label: 'Other Break' },
]
const FILTER_KEYS = ['tab', 'date_from', 'date_to', 'user', 'search', 'type', 'status']

const clock = (iso?: string) => (iso ? dayjs(iso).format('h:mm A') : '—')
const muted = (text: string) => <span className="text-xs text-slate-400">{text}</span>
const cell = (text: string) => <span className="whitespace-nowrap text-xs tabular-nums text-slate-700">{text}</span>

function StatusBadge({ row }: { row: AttendanceRow }) {
  if (row.status === 'absent') return <Badge tone="slate">Absent</Badge>
  if (row.status === 'online') return <Badge tone="green">Online</Badge>
  if (row.logoutMissing)
    return (
      <span title={row.lastSeenAt ? `Last seen ${clock(row.lastSeenAt)}` : undefined}>
        <Badge tone="red">Logout missing</Badge>
      </span>
    )
  return <Badge tone="blue">Present</Badge>
}

export default function AttendancePage() {
  const user = useCurrentUser()
  const { query, setParam, setFilters } = useListParams({ sort_by: 'date', sort_order: 'desc' }, FILTER_KEYS)
  const [, setSearchParams] = useSearchParams()
  const tab: Tab = TABS.find((t) => t.key === query.tab)?.key ?? 'consolidated'
  const today = dayjs().format('YYYY-MM-DD')
  const dateFrom = (query.date_from as string) || today
  const dateTo = (query.date_to as string) || today
  const hasFilters = ['date_from', 'date_to', 'user', 'search', 'type', 'status'].some((k) => query[k])
  const tabParams = (key: Tab) => (key === 'consolidated' ? new URLSearchParams() : new URLSearchParams({ tab: key }))
  const resetFilters = () => setSearchParams(tabParams(tab), { replace: true })
  const switchTab = (key: string) => {
    // keep the dates and the employee when switching views; drop the break-log-only filters
    const next = tabParams(key as Tab)
    for (const k of ['date_from', 'date_to', 'user', 'search']) if (query[k]) next.set(k, String(query[k]))
    setSearchParams(next, { replace: true })
  }

  const filters = { page: query.page, page_size: query.page_size, date_from: dateFrom, date_to: dateTo, user: query.user, search: query.search }
  const entriesTab = tab === 'entries'
  const callsTab = tab === 'calls'
  const report = useAttendanceReportQuery(filters, { skip: entriesTab || callsTab })
  const entries = useBreakEntriesQuery({ ...filters, type: query.type, status: query.status }, { skip: !entriesTab })
  const { data: people } = useUserOptionsQuery()
  const now = useNow(1000)
  const canExport = can(user, 'attendance', 'export')

  const exportCsv = () => {
    const qs = new URLSearchParams(Object.entries({ date_from: dateFrom, date_to: dateTo, user: query.user, search: query.search })
      .filter(([, v]) => v).map(([k, v]) => [k, String(v)]))
    authorizedDownload(`/attendance/report/export?${qs.toString()}`, `attendance-${dateFrom}-to-${dateTo}.csv`).catch((e) =>
      toast.error(parseApiError(e).message)
    )
  }

  const dateCol: Column<AttendanceRow> = {
    key: 'date',
    header: 'Date',
    render: (r) => <span className="whitespace-nowrap text-xs text-slate-600">{dayjs(r.date).format('ddd, D MMM YYYY')}</span>,
  }
  const nameCol: Column<AttendanceRow> = {
    key: 'user',
    header: 'Sales Executive',
    render: (r) => (
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-slate-800">{r.user.name}</p>
        <p className="truncate text-[11px] text-slate-400">{r.user.roleLabel}</p>
      </div>
    ),
  }
  const statusCol: Column<AttendanceRow> = { key: 'status', header: 'Status', render: (r) => <StatusBadge row={r} /> }
  const loginCol: Column<AttendanceRow> = { key: 'login', header: 'Login Time', render: (r) => (r.loginAt ? cell(clock(r.loginAt)) : muted('—')) }
  const logoutCol: Column<AttendanceRow> = {
    key: 'logout',
    header: 'Logout Time',
    render: (r) =>
      r.logoutAt ? cell(clock(r.logoutAt)) : r.logoutMissing ? (
        <span className="text-xs font-medium text-red-600" title={r.lastSeenAt ? `Last seen ${clock(r.lastSeenAt)}` : undefined}>
          Missing
        </span>
      ) : (
        muted('—')
      ),
  }
  const hoursCol: Column<AttendanceRow> = {
    key: 'hours',
    header: 'Total Login Hours',
    render: (r) =>
      r.loginSeconds === null ? (
        muted('—')
      ) : (
        <div className="flex flex-col">
          {cell(formatHms(r.loginSeconds))}
          {r.status === 'online' && <span className="text-[11px] text-emerald-700">running</span>}
          {r.logoutMissing && (
            <span className="text-[11px] text-red-600" title={r.lastSeenAt ? `Counted up to the last activity at ${clock(r.lastSeenAt)}` : undefined}>
              to last activity
            </span>
          )}
        </div>
      ),
  }
  const callsCol: Column<AttendanceRow> = { key: 'calls', header: 'Total Calls', align: 'right', render: (r) => cell(String(r.calls)) }
  const talkCol: Column<AttendanceRow> = { key: 'talk', header: 'Total Talk Time', align: 'right', render: (r) => cell(formatHms(r.talktimeSeconds)) }
  const breakCols: Column<AttendanceRow>[] = BREAK_TYPES.map(({ key, label }) => ({
    key: `break-${key}`,
    header: label,
    align: 'right' as const,
    render: (r: AttendanceRow) => cell(formatHms(r.breaks[key])),
  }))
  const totalBreakCol: Column<AttendanceRow> = {
    key: 'breakTotal',
    header: 'Total Break Time',
    align: 'right',
    render: (r) => (
      <div className="flex flex-col items-end gap-0.5">
        <span className="whitespace-nowrap text-xs font-semibold tabular-nums text-slate-800">{formatHms(r.breakSeconds)}</span>
        {r.activeBreak && (
          <span className="whitespace-nowrap text-[11px] font-medium text-amber-700" title={`Since ${clock(r.activeBreak.startedAt)}`}>
            On {r.activeBreak.label} · {formatHms(secondsSince(r.activeBreak.startedAt, now))}
          </span>
        )}
        {r.incompleteBreaks > 0 && (
          <span className="whitespace-nowrap text-[11px] text-red-600" title="Still running when the day ended: not counted">
            {r.incompleteBreaks} incomplete
          </span>
        )}
      </div>
    ),
  }

  const reportColumns: Record<ReportTab, Column<AttendanceRow>[]> = {
    consolidated: [dateCol, nameCol, statusCol, loginCol, logoutCol, hoursCol, callsCol, talkCol, ...breakCols, totalBreakCol],
    login: [dateCol, nameCol, statusCol, loginCol, logoutCol, hoursCol],
    talk: [dateCol, nameCol, callsCol, talkCol],
    breaks: [dateCol, nameCol, ...breakCols, totalBreakCol],
  }

  const entryColumns: Column<BreakEntry>[] = [
    { key: 'day', header: 'Date', render: (b) => <span className="whitespace-nowrap text-xs text-slate-600">{dayjs(b.day).format('ddd, D MMM YYYY')}</span> },
    { key: 'user', header: 'Sales Executive', render: (b) => <span className="text-xs font-medium text-slate-800">{b.user?.name ?? '—'}</span> },
    {
      key: 'type',
      header: 'Break',
      render: (b) => (
        <span className="text-xs text-slate-700">
          {b.label}
          {b.note ? <span className="text-slate-400"> · {b.note}</span> : null}
        </span>
      ),
    },
    { key: 'start', header: 'Start', render: (b) => cell(clock(b.startedAt)) },
    { key: 'end', header: 'End', render: (b) => (b.endedAt ? cell(clock(b.endedAt)) : muted('—')) },
    {
      key: 'duration',
      header: 'Duration',
      align: 'right',
      render: (b) =>
        b.status === 'active' ? (
          <span className="text-xs font-medium tabular-nums text-amber-700">{formatHms(secondsSince(b.startedAt, now))}</span>
        ) : b.durationSeconds !== undefined ? (
          cell(formatHms(b.durationSeconds))
        ) : (
          muted('—')
        ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (b) =>
        b.status === 'active' ? (
          <Badge tone="amber">On break</Badge>
        ) : b.status === 'completed' ? (
          <Badge tone="green">Completed</Badge>
        ) : (
          <span title="Still running when its day ended: not counted in any total">
            <Badge tone="red">Incomplete</Badge>
          </span>
        ),
    },
  ]

  const active = entriesTab ? entries : report
  const employees = people?.data.filter((p) => p.role !== 'super_admin') ?? []

  return (
    <>
      <PageHeader
        title="Attendance"
        description={DESCRIPTIONS[tab]}
        actions={
          canExport && !entriesTab && !callsTab ? (
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
          ) : undefined
        }
      />
      <div className="mb-4">
        <Tabs tabs={TABS} active={tab} onChange={switchTab} />
      </div>
      <FilterBar
        end={
          hasFilters ? (
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              Reset
            </Button>
          ) : undefined
        }
      >
        <SearchInput className="w-full sm:w-56" value={query.search ?? ''} onSearch={(v) => setParam('search', v)} placeholder={callsTab ? 'Employee or lead…' : 'Employee name…'} />
        <Select className="!w-auto" value={(query.user as string) ?? ''} onChange={(e) => setParam('user', e.target.value)}>
          <option value="">All employees</option>
          {employees.map((p) => (
            <option key={p._id} value={p._id}>
              {p.name}
            </option>
          ))}
        </Select>
        <DateRangeFilter
          label="Date"
          heading="Attendance Between"
          from={dateFrom}
          to={dateTo}
          onChange={(from, to) => setFilters({ date_from: from, date_to: to })}
        />
        {entriesTab && (
          <>
            <Select className="!w-auto" value={(query.type as string) ?? ''} onChange={(e) => setParam('type', e.target.value)}>
              <option value="">All breaks</option>
              {BREAK_TYPES.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </Select>
            <Select className="!w-auto" value={(query.status as string) ?? ''} onChange={(e) => setParam('status', e.target.value)}>
              <option value="">Any status</option>
              <option value="active">On break</option>
              <option value="completed">Completed</option>
              <option value="incomplete">Incomplete</option>
            </Select>
          </>
        )}
      </FilterBar>
      {callsTab ? (
        <CallProofsTab filters={filters} setParam={setParam} />
      ) : entriesTab ? (
        <DataTable
          columns={entryColumns}
          rows={entries.data?.data}
          rowKey={(b) => b._id}
          loading={entries.isLoading || entries.isFetching}
          error={entries.isError}
          errorMessage={entries.isError ? parseApiError(entries.error).message : undefined}
          onRetry={entries.refetch}
          emptyTitle="No breaks"
          emptyDescription="No breaks were punched for these filters."
          pagination={entries.data?.pagination}
          onPageChange={(p) => setParam('page', p)}
          onPageSizeChange={(s) => setParam('page_size', s)}
        />
      ) : (
        <DataTable
          columns={reportColumns[tab as ReportTab]}
          rows={report.data?.data}
          rowKey={(r) => `${r.date}-${r.user._id}`}
          loading={active.isLoading || active.isFetching}
          error={report.isError}
          errorMessage={report.isError ? parseApiError(report.error).message : undefined}
          onRetry={report.refetch}
          emptyTitle="No attendance"
          emptyDescription="No employee matches these filters."
          pagination={report.data?.pagination}
          onPageChange={(p) => setParam('page', p)}
          onPageSizeChange={(s) => setParam('page_size', s)}
        />
      )}
    </>
  )
}
