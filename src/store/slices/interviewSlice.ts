import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import {
  fetchInterviewsApi,
  fetchInterviewByIdApi,
  fetchInterviewersApi,
  fetchLeadInterviewApi,
  scheduleInterviewApi,
  updateInterviewStatusApi,
  updateInterviewResultApi,
} from "../../services/apiServices";
import type { Pagination, PaginationInfo, Interview, ReportsTo } from "../../utils/types";

interface InterviewState extends Pagination<Interview> {
  selectedInterview: Interview | null;
  selectedInterviewLoading: boolean;
  actionLoading: boolean;
  interviewers: ReportsTo[];
  interviewersLoading: boolean;
  leadInterview: { interview?: Interview | null; history?: Interview[] } | null;
  leadInterviewLoading: boolean;
  calendar: { date?: string; interviews?: Interview[] }[];
}

const initialState: InterviewState = {
  data: [],
  next: null,
  previous: null,
  pagination: {
    total_results: null,
    total_pages: null,
    current_page: null,
    next_page: null,
    page_size: null,
    previous_page: null,
  },
  page: 1,
  loading: false,
  error: null,
  selectedInterview: null,
  selectedInterviewLoading: false,
  actionLoading: false,
  interviewers: [],
  interviewersLoading: false,
  leadInterview: null,
  leadInterviewLoading: false,
  calendar: [],
};

export const fetchInterviews = createAsyncThunk<
  { data: any; pagination?: PaginationInfo; view?: string },
  { page?: number; page_size?: number; status?: string; result?: string; counsellor?: string; interviewer?: string; search?: string; date_from?: string; date_to?: string; view?: string } | void
>(
  "interviews/fetchInterviews",
  async (params, { rejectWithValue }) => {
    try {
      const response = await fetchInterviewsApi(params || undefined);
      return {
        data: response?.data || [],
        pagination: response?.pagination,
        view: (params as any)?.view,
      };
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to fetch interviews");
    }
  },
  {
    condition: (_, { getState }) => {
      const { interviews } = getState() as { interviews: { loading: boolean } };
      if (interviews?.loading) return false;
      return true;
    },
  }
);

export const fetchInterviewById = createAsyncThunk<Interview, number>(
  "interviews/fetchInterviewById",
  async (id, { rejectWithValue }) => {
    try {
      const response = await fetchInterviewByIdApi(id);
      return response.data ?? response;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to fetch interview details");
    }
  }
);

export const fetchInterviewers = createAsyncThunk<ReportsTo[]>(
  "interviews/fetchInterviewers",
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetchInterviewersApi();
      return response.data || [];
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to fetch interviewers");
    }
  },
  {
    condition: (_, { getState }) => {
      const { interviews } = getState() as { interviews: { interviewersLoading: boolean } };
      if (interviews?.interviewersLoading) return false;
      return true;
    },
  }
);

export const fetchLeadInterview = createAsyncThunk<any, string>(
  "interviews/fetchLeadInterview",
  async (leadUid, { rejectWithValue }) => {
    try {
      const response = await fetchLeadInterviewApi(leadUid);
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to fetch lead interview");
    }
  }
);

export const scheduleInterview = createAsyncThunk<any, { uid: string; payload: any }>(
  "interviews/scheduleInterview",
  async ({ uid, payload }, { rejectWithValue }) => {
    try {
      const response = await scheduleInterviewApi(uid, payload);
      return response.data ?? response;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to schedule interview");
    }
  }
);

export const updateInterviewStatus = createAsyncThunk<
  any,
  { id: number; payload: { status: string; notes?: string } }
>(
  "interviews/updateInterviewStatus",
  async ({ id, payload }, { rejectWithValue }) => {
    try {
      const response = await updateInterviewStatusApi(id, payload);
      return response.data ?? response;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to update interview status");
    }
  }
);

export const updateInterviewResult = createAsyncThunk<
  any,
  { id: number; payload: { result: string; notes?: string } }
>(
  "interviews/updateInterviewResult",
  async ({ id, payload }, { rejectWithValue }) => {
    try {
      const response = await updateInterviewResultApi(id, payload);
      return response.data ?? response;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to record interview result");
    }
  }
);

const interviewSlice = createSlice({
  name: "interviews",
  initialState,
  reducers: {
    clearInterviewError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchInterviews.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchInterviews.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload?.view === "calendar") {
          state.calendar = action.payload?.data || [];
        } else {
          state.data = action.payload?.data || [];
          state.pagination = action.payload?.pagination || initialState.pagination;
        }
      })
      .addCase(fetchInterviews.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      .addCase(fetchInterviewById.pending, (state) => {
        state.selectedInterviewLoading = true;
        state.error = null;
      })
      .addCase(fetchInterviewById.fulfilled, (state, action) => {
        state.selectedInterviewLoading = false;
        state.selectedInterview = action.payload;
        if (state.data && state.data.length > 0 && action.payload?.id) {
          const idx = state.data.findIndex((i) => i.id === action.payload.id);
          if (idx !== -1) {
            state.data[idx] = { ...state.data[idx], ...action.payload };
          }
        }
      })
      .addCase(fetchInterviewById.rejected, (state, action) => {
        state.selectedInterviewLoading = false;
        state.error = action.payload as string;
      })

      .addCase(fetchInterviewers.pending, (state) => {
        state.interviewersLoading = true;
      })
      .addCase(fetchInterviewers.fulfilled, (state, action) => {
        state.interviewersLoading = false;
        state.interviewers = action.payload || [];
      })
      .addCase(fetchInterviewers.rejected, (state, action) => {
        state.interviewersLoading = false;
        state.error = action.payload as string;
      })

      .addCase(fetchLeadInterview.pending, (state) => {
        state.leadInterviewLoading = true;
      })
      .addCase(fetchLeadInterview.fulfilled, (state, action) => {
        state.leadInterviewLoading = false;
        state.leadInterview = action.payload || null;
      })
      .addCase(fetchLeadInterview.rejected, (state, action) => {
        state.leadInterviewLoading = false;
        state.error = action.payload as string;
      })

      .addCase(scheduleInterview.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(scheduleInterview.fulfilled, (state, action) => {
        state.actionLoading = false;
        if (action.payload?.interview) {
          state.leadInterview = { ...(state.leadInterview || {}), interview: action.payload.interview };
        }
      })
      .addCase(scheduleInterview.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload as string;
      })

      .addCase(updateInterviewStatus.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(updateInterviewStatus.fulfilled, (state, action) => {
        state.actionLoading = false;
        const interview = action.payload?.interview ?? action.payload;
        if (interview?.id && state.data && state.data.length > 0) {
          const idx = state.data.findIndex((i) => i.id === interview.id);
          if (idx !== -1) {
            state.data[idx] = { ...state.data[idx], ...interview };
          }
        }
      })
      .addCase(updateInterviewStatus.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload as string;
      })

      .addCase(updateInterviewResult.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(updateInterviewResult.fulfilled, (state, action) => {
        state.actionLoading = false;
        const interview = action.payload?.interview ?? action.payload;
        if (interview?.id && state.data && state.data.length > 0) {
          const idx = state.data.findIndex((i) => i.id === interview.id);
          if (idx !== -1) {
            state.data[idx] = { ...state.data[idx], ...interview };
          }
        }
      })
      .addCase(updateInterviewResult.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearInterviewError } = interviewSlice.actions;
export default interviewSlice.reducer;
