import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { fetchFollowUpsApi, updateFollowUpApi } from "../../services/apiServices";
import type { Pagination, PaginationInfo, FollowUp } from "../../utils/types";

interface FollowUpState extends Pagination<FollowUp> {
  actionLoading: boolean;
}

const initialState: FollowUpState = {
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
  actionLoading: false,
};

export const fetchFollowUps = createAsyncThunk<
  { data: FollowUp[]; pagination?: PaginationInfo },
  { page?: number; page_size?: number; scope?: string; status?: string; counsellor?: string; date_from?: string; date_to?: string; search?: string } | void
>(
  "followUps/fetchFollowUps",
  async (params, { rejectWithValue }) => {
    try {
      const response = await fetchFollowUpsApi(params || undefined);
      return {
        data: response?.data || [],
        pagination: response?.pagination,
      };
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to fetch follow-ups");
    }
  },
  {
    condition: (_, { getState }) => {
      const { followUps } = getState() as { followUps: { loading: boolean } };
      if (followUps?.loading) return false;
      return true;
    },
  }
);

export const updateFollowUp = createAsyncThunk<
  FollowUp,
  { id: number; payload: { status?: string; outcome?: string; notes?: string } }
>(
  "followUps/updateFollowUp",
  async ({ id, payload }, { rejectWithValue }) => {
    try {
      const response = await updateFollowUpApi(id, payload);
      return response.data ?? response;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to update follow-up");
    }
  }
);

const followUpSlice = createSlice({
  name: "followUps",
  initialState,
  reducers: {
    clearFollowUpError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchFollowUps.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchFollowUps.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload?.data || [];
        state.pagination = action.payload?.pagination || initialState.pagination;
      })
      .addCase(fetchFollowUps.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      .addCase(updateFollowUp.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(updateFollowUp.fulfilled, (state, action) => {
        state.actionLoading = false;
        if (state.data && state.data.length > 0 && action.payload?.id) {
          const idx = state.data.findIndex((f) => f.id === action.payload.id);
          if (idx !== -1) {
            state.data[idx] = { ...state.data[idx], ...action.payload };
          }
        }
      })
      .addCase(updateFollowUp.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearFollowUpError } = followUpSlice.actions;
export default followUpSlice.reducer;
