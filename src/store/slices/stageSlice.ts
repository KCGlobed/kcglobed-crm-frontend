import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import {
  fetchStagesApi,
  fetchStageByIdApi,
  createStageApi,
  updateStageApi,
  deleteStageApi,
} from "../../services/apiServices";
import type { Pagination, PaginationInfo, Stage } from "../../utils/types";

interface StageState extends Pagination<Stage> {
  selectedStage: Stage | null;
  selectedStageLoading: boolean;
  actionLoading: boolean;
}

const initialState: StageState = {
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
  selectedStage: null,
  selectedStageLoading: false,
  actionLoading: false,
};

export const fetchStages = createAsyncThunk<
  { data: Stage[]; pagination?: PaginationInfo },
  { page?: number; page_size?: number } | void
>(
  "stages/fetchStages",
  async (params, { rejectWithValue }) => {
    try {
      const response = await fetchStagesApi(params || undefined);
      let data: Stage[] = [];
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
      return rejectWithValue(err.message || "Failed to fetch stages");
    }
  },
  {
    condition: (_, { getState }) => {
      const { stages } = getState() as { stages: { loading: boolean } };
      if (stages?.loading) {
        return false; // prevent duplicate in-flight request
      }
      return true;
    },
  }
);

export const fetchStageById = createAsyncThunk<Stage, number>(
  "stages/fetchStageById",
  async (stageId, { rejectWithValue }) => {
    try {
      const response = await fetchStageByIdApi(stageId);
      return response.data ?? response;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to fetch stage details");
    }
  }
);

export const createStage = createAsyncThunk<Stage, Stage>(
  "stages/createStage",
  async (payload, { rejectWithValue }) => {
    try {
      const response = await createStageApi(payload);
      return response.data ?? response;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to create stage");
    }
  }
);

export const updateStage = createAsyncThunk<
  Stage,
  { id: number; payload: Stage }
>(
  "stages/updateStage",
  async ({ id, payload }, { rejectWithValue }) => {
    try {
      const response = await updateStageApi(id, payload);
      return response.data ?? response;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to update stage");
    }
  }
);

export const deleteStage = createAsyncThunk<number, number>(
  "stages/deleteStage",
  async (stageId, { rejectWithValue }) => {
    try {
      await deleteStageApi(stageId);
      return stageId;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to delete stage");
    }
  }
);

const stageSlice = createSlice({
  name: "stages",
  initialState,
  reducers: {
    setSelectedStage: (state, action: PayloadAction<Stage | null>) => {
      state.selectedStage = action.payload;
    },
    clearStageError: (state) => {
      state.error = null;
    },
    setCurrentPage: (state, action: PayloadAction<number>) => {
      state.page = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch stages (GET /api/leads/stages/)
      .addCase(fetchStages.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchStages.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload?.data || [];
        state.pagination = action.payload?.pagination || initialState.pagination;
      })
      .addCase(fetchStages.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // Fetch stage by ID (GET /api/leads/stages/{id}/)
      .addCase(fetchStageById.pending, (state) => {
        state.selectedStageLoading = true;
        state.error = null;
      })
      .addCase(fetchStageById.fulfilled, (state, action) => {
        state.selectedStageLoading = false;
        state.selectedStage = action.payload;
        // Keep in-memory list synchronized if stage exists
        if (state.data && state.data.length > 0 && action.payload?.id != null) {
          const idx = state.data.findIndex((s) => s.id === action.payload.id);
          if (idx !== -1) {
            state.data[idx] = { ...state.data[idx], ...action.payload };
          }
        }
      })
      .addCase(fetchStageById.rejected, (state, action) => {
        state.selectedStageLoading = false;
        state.error = action.payload as string;
      })

      // Create stage (POST /api/leads/stages/)
      .addCase(createStage.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(createStage.fulfilled, (state, action) => {
        state.actionLoading = false;
        const newStage = action.payload;
        if (newStage && typeof newStage === "object") {
          state.data = [
            newStage,
            ...(state.data || []).filter((s) => s.id !== newStage.id),
          ];
          state.count = state.data?.length ?? 0;
        }
      })
      .addCase(createStage.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload as string;
      })

      // Update stage (PATCH /api/leads/stages/{id}/)
      .addCase(updateStage.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(updateStage.fulfilled, (state, action) => {
        state.actionLoading = false;
        const updated = action.payload;
        if (updated && updated.id != null) {
          if (state.data && state.data.length > 0) {
            const idx = state.data.findIndex((s) => s.id === updated.id);
            if (idx !== -1) {
              state.data[idx] = { ...state.data[idx], ...updated };
            }
          }
          if (state.selectedStage?.id === updated.id) {
            state.selectedStage = { ...state.selectedStage, ...updated };
          }
        }
      })
      .addCase(updateStage.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload as string;
      })

      // Delete stage (DELETE /api/leads/stages/{id}/)
      .addCase(deleteStage.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(deleteStage.fulfilled, (state, action) => {
        state.actionLoading = false;
        state.data = (state.data || []).filter((s) => s.id !== action.payload);
        if (state.selectedStage?.id === action.payload) {
          state.selectedStage = null;
        }
      })
      .addCase(deleteStage.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { setSelectedStage, clearStageError, setCurrentPage } = stageSlice.actions;
export default stageSlice.reducer;
