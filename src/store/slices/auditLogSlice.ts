import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import {
  fetchAuditLogsApi,
  fetchAuditLogByIdApi,
} from "../../services/apiServices";
import type { Pagination, PaginationInfo, AuditLog } from "../../utils/types";

interface AuditLogState extends Pagination<AuditLog> {
  selectedAuditLog: AuditLog | null;
  selectedAuditLogLoading: boolean;
  actionLoading: boolean;
}

const initialState: AuditLogState = {
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
  selectedAuditLog: null,
  selectedAuditLogLoading: false,
  actionLoading: false,
};

export const fetchAuditLogs = createAsyncThunk<
  { data: AuditLog[]; pagination?: PaginationInfo },
  { page?: number; page_size?: number; search?: string; user?: string; action?: string; module?: string; success?: boolean | string; date_from?: string; date_to?: string; ordering?: string } | void
>(
  "auditLogs/fetchAuditLogs",
  async (params, { rejectWithValue }) => {
    try {
      const response = await fetchAuditLogsApi(params || undefined);
      let data: AuditLog[] = [];
      if (Array.isArray(response?.data)) {
        data = response.data;
      } else if (Array.isArray(response)) {
        data = response;
      } else if (Array.isArray(response?.results)) {
        data = response.results;
      } else if (Array.isArray(response?.data?.results)) {
        data = response.data.results;
      }
      return {
        data,
        pagination: response?.pagination,
      };
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to fetch audit logs");
    }
  },
  {
    condition: (_, { getState }) => {
      const { auditLogs } = getState() as { auditLogs: { loading: boolean } };
      if (auditLogs?.loading) {
        return false; // prevent duplicate in-flight request
      }
      return true;
    },
  }
);

export const fetchAuditLogById = createAsyncThunk<AuditLog, number>(
  "auditLogs/fetchAuditLogById",
  async (auditId, { rejectWithValue }) => {
    try {
      const response = await fetchAuditLogByIdApi(auditId);
      return response.data ?? response;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to fetch audit log details");
    }
  }
);

const auditLogSlice = createSlice({
  name: "auditLogs",
  initialState,
  reducers: {
    setSelectedAuditLog: (state, action: PayloadAction<AuditLog | null>) => {
      state.selectedAuditLog = action.payload;
    },
    clearAuditLogError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch audit logs (GET /api/access/audit-logs/)
      .addCase(fetchAuditLogs.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAuditLogs.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload?.data || [];
        state.pagination = action.payload?.pagination || initialState.pagination;
      })
      .addCase(fetchAuditLogs.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // Fetch audit log by ID (GET /api/access/audit-logs/{id}/ — includes old/new data)
      .addCase(fetchAuditLogById.pending, (state) => {
        state.selectedAuditLogLoading = true;
        state.error = null;
      })
      .addCase(fetchAuditLogById.fulfilled, (state, action) => {
        state.selectedAuditLogLoading = false;
        state.selectedAuditLog = action.payload;
        if (state.data && state.data.length > 0 && action.payload?.id != null) {
          const idx = state.data.findIndex((l) => l.id === action.payload.id);
          if (idx !== -1) {
            state.data[idx] = { ...state.data[idx], ...action.payload };
          }
        }
      })
      .addCase(fetchAuditLogById.rejected, (state, action) => {
        state.selectedAuditLogLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { setSelectedAuditLog, clearAuditLogError } = auditLogSlice.actions;
export default auditLogSlice.reducer;
