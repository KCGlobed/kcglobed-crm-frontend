import { api } from './api'
import type {
  ApiListResponse,
  ApiResponse,
  AttendanceCallRow,
  AttendanceRow,
  AttendanceToday,
  BreakEntry,
  BreaksToday,
  BreakType,
  DialerRunDetail,
  DialerRunRow,
  Punch,
} from '../types/models'

function cleanParams(params: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''))
}

/** Punch In / Out and Punch Break (the signed-in employee) and the Super Admin's Attendance report. */
export const attendanceApi = api.injectEndpoints({
  endpoints: (build) => ({
    // the top bar's punched-in timer, Punch In / Out and the Punch Break state in one call; polled, so marked as background
    attendanceToday: build.query<ApiResponse<AttendanceToday>, void>({
      query: () => ({ url: '/attendance/today', headers: { 'X-Background': '1' } }),
      providesTags: ['Breaks'],
    }),
    breaksToday: build.query<ApiResponse<BreaksToday>, void>({
      // polled: marked as background so it doesn't keep an idle session alive
      query: () => ({ url: '/breaks/today', headers: { 'X-Background': '1' } }),
      providesTags: ['Breaks'],
    }),
    // a start or end changes today's break time (dashboard) and the report; refetch even after a 409, which
    // means another tab already changed the break
    startBreak: build.mutation<ApiResponse<BreakEntry>, { type: BreakType; note?: string }>({
      query: (body) => ({ url: '/breaks/start', method: 'POST', body }),
      invalidatesTags: ['Breaks', 'Dashboard', 'Attendance'],
    }),
    endBreak: build.mutation<ApiResponse<BreakEntry>, void>({
      query: () => ({ url: '/breaks/end', method: 'POST' }),
      invalidatesTags: ['Breaks', 'Dashboard', 'Attendance'],
    }),
    // Punch In / Out change today's time (timer, dashboard, report) and who is online for the round-robin
    punchIn: build.mutation<ApiResponse<Punch>, void>({
      query: () => ({ url: '/punch/in', method: 'POST' }),
      invalidatesTags: ['Breaks', 'Dashboard', 'Attendance', 'RoundRobin'],
    }),
    punchOut: build.mutation<ApiResponse<Punch>, void>({
      query: () => ({ url: '/punch/out', method: 'POST' }),
      invalidatesTags: ['Breaks', 'Dashboard', 'Attendance', 'RoundRobin'],
    }),
    attendanceReport: build.query<ApiListResponse<AttendanceRow>, Record<string, unknown>>({
      query: (params) => ({ url: '/attendance/report', params: cleanParams(params) }),
      providesTags: ['Attendance'],
    }),
    attendanceCalls: build.query<ApiListResponse<AttendanceCallRow>, Record<string, unknown>>({
      query: (params) => ({ url: '/attendance/calls', params: cleanParams(params) }),
      providesTags: ['Attendance'],
    }),
    // Auto Dialer: progressive runs in the range, plus `runningNow` (who is dialing this minute)
    attendanceDialerRuns: build.query<ApiListResponse<DialerRunRow> & { runningNow: DialerRunRow[] }, Record<string, unknown>>({
      query: (params) => ({ url: '/attendance/dialer-runs', params: cleanParams(params) }),
      providesTags: ['Attendance'],
    }),
    attendanceDialerRun: build.query<ApiResponse<DialerRunDetail>, string>({
      query: (id) => `/attendance/dialer-runs/${id}`,
      providesTags: ['Attendance'],
    }),
    breakEntries: build.query<ApiListResponse<BreakEntry>, Record<string, unknown>>({
      query: (params) => ({ url: '/attendance/breaks', params: cleanParams(params) }),
      providesTags: ['Attendance'],
    }),
  }),
})

export const {
  useAttendanceTodayQuery,
  useBreaksTodayQuery,
  useStartBreakMutation,
  useEndBreakMutation,
  usePunchInMutation,
  usePunchOutMutation,
  useAttendanceReportQuery,
  useAttendanceCallsQuery,
  useAttendanceDialerRunsQuery,
  useAttendanceDialerRunQuery,
  useBreakEntriesQuery,
} = attendanceApi
