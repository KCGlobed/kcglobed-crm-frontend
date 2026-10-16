import { api } from './api'
import type { ApiListResponse, ApiResponse, AttendanceCallRow, AttendanceRow, AttendanceToday, BreakEntry, BreaksToday, BreakType } from '../types/models'

function cleanParams(params: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''))
}

/** Punch Break (the signed-in employee) and the Super Admin's Attendance report. */
export const attendanceApi = api.injectEndpoints({
  endpoints: (build) => ({
    // the top bar's logged-in timer and the Punch Break state in one call; polled, so marked as background
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
    attendanceReport: build.query<ApiListResponse<AttendanceRow>, Record<string, unknown>>({
      query: (params) => ({ url: '/attendance/report', params: cleanParams(params) }),
      providesTags: ['Attendance'],
    }),
    attendanceCalls: build.query<ApiListResponse<AttendanceCallRow>, Record<string, unknown>>({
      query: (params) => ({ url: '/attendance/calls', params: cleanParams(params) }),
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
  useAttendanceReportQuery,
  useAttendanceCallsQuery,
  useBreakEntriesQuery,
} = attendanceApi
