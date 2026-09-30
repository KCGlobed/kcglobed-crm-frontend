import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import {
  fetchConfigurationsApi,
  fetchConfigurationByIdApi,
  createConfigurationApi,
  updateConfigurationApi,
  activateConfigurationApi,
  deactivateConfigurationApi,
  deleteConfigurationApi,
} from "../../services/apiServices";
import type { Pagination, PaginationInfo, Configuration } from "../../utils/types";

interface ConfigurationState extends Pagination<Configuration> {
  selectedConfiguration: Configuration | null;
  selectedConfigurationLoading: boolean;
  actionLoading: boolean;
}

const initialState: ConfigurationState = {
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
  selectedConfiguration: null,
  selectedConfigurationLoading: false,
  actionLoading: false,
};

export const fetchConfigurations = createAsyncThunk<
  { data: Configuration[]; pagination?: PaginationInfo },
  { page?: number; page_size?: number | string; search?: string; group?: string; is_active?: boolean | string } | void
>(
  "configurations/fetchConfigurations",
  async (params, { rejectWithValue }) => {
    try {
      const response = await fetchConfigurationsApi(params || undefined);
      let data: Configuration[] = [];
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
      return rejectWithValue(err.message || "Failed to fetch configurations");
    }
  },
  {
    condition: (_, { getState }) => {
      const { configurations } = getState() as { configurations: { loading: boolean } };
      if (configurations?.loading) {
        return false; // prevent duplicate in-flight request
      }
      return true;
    },
  }
);

export const fetchConfigurationById = createAsyncThunk<Configuration, number>(
  "configurations/fetchConfigurationById",
  async (configId, { rejectWithValue }) => {
    try {
      const response = await fetchConfigurationByIdApi(configId);
      return response.data ?? response;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to fetch configuration details");
    }
  }
);

export const createConfiguration = createAsyncThunk<Configuration, Configuration>(
  "configurations/createConfiguration",
  async (payload, { rejectWithValue }) => {
    try {
      const response = await createConfigurationApi(payload);
      return response.data ?? response;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to create configuration");
    }
  }
);

export const updateConfiguration = createAsyncThunk<
  Configuration,
  { id: number; payload: Configuration }
>(
  "configurations/updateConfiguration",
  async ({ id, payload }, { rejectWithValue }) => {
    try {
      const response = await updateConfigurationApi(id, payload);
      return response.data ?? response;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to update configuration");
    }
  }
);

export const updateConfigurationStatus = createAsyncThunk<
  Configuration,
  { id: number; is_active: boolean }
>(
  "configurations/updateConfigurationStatus",
  async ({ id, is_active }, { rejectWithValue }) => {
    try {
      const response = is_active
        ? await activateConfigurationApi(id)
        : await deactivateConfigurationApi(id);
      return response.data ?? { id, is_active };
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to update configuration status");
    }
  }
);

export const deleteConfiguration = createAsyncThunk<number, number>(
  "configurations/deleteConfiguration",
  async (configId, { rejectWithValue }) => {
    try {
      await deleteConfigurationApi(configId);
      return configId;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to delete configuration");
    }
  }
);

const configurationSlice = createSlice({
  name: "configurations",
  initialState,
  reducers: {
    setSelectedConfiguration: (state, action: PayloadAction<Configuration | null>) => {
      state.selectedConfiguration = action.payload;
    },
    clearConfigurationError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch configurations (GET /api/access/configurations/)
      .addCase(fetchConfigurations.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchConfigurations.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload?.data || [];
        state.pagination = action.payload?.pagination || initialState.pagination;
      })
      .addCase(fetchConfigurations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // Fetch configuration by ID (GET /api/access/configurations/{id}/)
      .addCase(fetchConfigurationById.pending, (state) => {
        state.selectedConfigurationLoading = true;
        state.error = null;
      })
      .addCase(fetchConfigurationById.fulfilled, (state, action) => {
        state.selectedConfigurationLoading = false;
        state.selectedConfiguration = action.payload;
        if (state.data && state.data.length > 0 && action.payload?.id != null) {
          const idx = state.data.findIndex((c) => c.id === action.payload.id);
          if (idx !== -1) {
            state.data[idx] = { ...state.data[idx], ...action.payload };
          }
        }
      })
      .addCase(fetchConfigurationById.rejected, (state, action) => {
        state.selectedConfigurationLoading = false;
        state.error = action.payload as string;
      })

      // Create configuration (POST /api/access/configurations/)
      .addCase(createConfiguration.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(createConfiguration.fulfilled, (state, action) => {
        state.actionLoading = false;
        const newConfig = action.payload;
        if (newConfig && typeof newConfig === "object") {
          state.data = [
            newConfig,
            ...(state.data || []).filter((c) => c.id !== newConfig.id),
          ];
        }
      })
      .addCase(createConfiguration.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload as string;
      })

      // Update configuration (PATCH /api/access/configurations/{id}/)
      .addCase(updateConfiguration.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(updateConfiguration.fulfilled, (state, action) => {
        state.actionLoading = false;
        const updated = action.payload;
        if (updated && updated.id != null) {
          if (state.data && state.data.length > 0) {
            const idx = state.data.findIndex((c) => c.id === updated.id);
            if (idx !== -1) {
              state.data[idx] = { ...state.data[idx], ...updated };
            }
          }
          if (state.selectedConfiguration?.id === updated.id) {
            state.selectedConfiguration = { ...state.selectedConfiguration, ...updated };
          }
        }
      })
      .addCase(updateConfiguration.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload as string;
      })

      // Activate/deactivate configuration
      .addCase(updateConfigurationStatus.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(updateConfigurationStatus.fulfilled, (state, action) => {
        state.actionLoading = false;
        const updated = action.payload;
        if (updated && updated.id != null) {
          const idx = (state.data || []).findIndex((c) => c.id === updated.id);
          if (idx !== -1 && state.data) state.data[idx] = { ...state.data[idx], ...updated };
          if (state.selectedConfiguration?.id === updated.id) {
            state.selectedConfiguration = { ...state.selectedConfiguration, ...updated };
          }
        }
      })
      .addCase(updateConfigurationStatus.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload as string;
      })

      // Delete configuration (DELETE /api/access/configurations/{id}/)
      .addCase(deleteConfiguration.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(deleteConfiguration.fulfilled, (state, action) => {
        state.actionLoading = false;
        state.data = (state.data || []).filter((c) => c.id !== action.payload);
        if (state.selectedConfiguration?.id === action.payload) {
          state.selectedConfiguration = null;
        }
      })
      .addCase(deleteConfiguration.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { setSelectedConfiguration, clearConfigurationError } = configurationSlice.actions;
export default configurationSlice.reducer;
