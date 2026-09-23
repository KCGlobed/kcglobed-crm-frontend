import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import {
  fetchModulesApi,
  fetchModuleByIdApi,
  createModuleApi,
  updateModuleApi,
} from "../../services/apiServices";
import type { Pagination, PaginationInfo, Module } from "../../utils/types";

interface ModuleState extends Pagination<Module> {
  selectedModule: Module | null;
  selectedModuleLoading: boolean;
  actionLoading: boolean;
}

const initialState: ModuleState = {
  data: [],
  next: null,
  loading: false,
  error: null,
  total_results: 0,
  total_pages: 1,
  current_page: 1,
  next_page: null,
  previous_page: null,
  page_size: 10,
  selectedModule: null,
  selectedModuleLoading: false,
  actionLoading: false,
};

export const fetchModules = createAsyncThunk<
  { data: Module[]; pagination?: PaginationInfo },
  { page?: number; page_size?: number } | void
>(
  "modules/fetchModules",
  async (params, { rejectWithValue }) => {
    try {
      const response = await fetchModulesApi(params || undefined);
      let data: Module[] = [];
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
      return rejectWithValue(err.message || "Failed to fetch modules");
    }
  },
  {
    condition: (_, { getState }) => {
      const { modules } = getState() as { modules: { loading: boolean } };
      if (modules?.loading) {
        return false; // prevent duplicate in-flight request
      }
      return true;
    },
  }
);

export const fetchModuleById = createAsyncThunk<Module, number | string>(
  "modules/fetchModuleById",
  async (moduleId, { rejectWithValue }) => {
    try {
      const response = await fetchModuleByIdApi(moduleId);
      return response.data ?? response;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to fetch module details");
    }
  }
);

export const createModule = createAsyncThunk<Module, Module>(
  "modules/createModule",
  async (payload, { rejectWithValue }) => {
    try {
      const response = await createModuleApi(payload);
      return response.data ?? response;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to create module");
    }
  }
);

export const updateModule = createAsyncThunk<
  Module,
  { id: number | string; payload: Module }
>(
  "modules/updateModule",
  async ({ id, payload }, { rejectWithValue }) => {
    try {
      const response = await updateModuleApi(id, payload);
      return response.data ?? response;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to update module");
    }
  }
);

const moduleSlice = createSlice({
  name: "modules",
  initialState,
  reducers: {
    setSelectedModule: (state, action: PayloadAction<Module | null>) => {
      state.selectedModule = action.payload;
    },
    clearModuleError: (state) => {
      state.error = null;
    },
    setCurrentPage: (state, action: PayloadAction<number>) => {
      state.current_page = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch modules (GET /api/access/modules/)
      .addCase(fetchModules.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchModules.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload.data;
        if (action.payload.pagination) {
          state.total_results = action.payload.pagination.total_results ?? action.payload.data.length;
          state.total_pages = action.payload.pagination.total_pages ?? 1;
          state.current_page = action.payload.pagination.current_page ?? 1;
          state.next_page = action.payload.pagination.next_page ?? null;
          state.previous_page = action.payload.pagination.previous_page ?? null;
          state.page_size = action.payload.pagination.page_size ?? state.page_size;
          state.count = action.payload.pagination.total_results ?? action.payload.data.length;
        } else {
          state.total_results = action.payload.data.length;
          state.count = action.payload.data.length;
        }
      })
      .addCase(fetchModules.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // Fetch module by ID (GET /api/access/modules/{id}/)
      .addCase(fetchModuleById.pending, (state) => {
        state.selectedModuleLoading = true;
        state.error = null;
      })
      .addCase(fetchModuleById.fulfilled, (state, action) => {
        state.selectedModuleLoading = false;
        state.selectedModule = action.payload;
        // Keep in-memory list synchronized if module exists
        if (state.data && state.data.length > 0 && action.payload?.id != null) {
          const idx = state.data.findIndex((m) => m.id === action.payload.id);
          if (idx !== -1) {
            state.data[idx] = { ...state.data[idx], ...action.payload };
          }
        }
      })
      .addCase(fetchModuleById.rejected, (state, action) => {
        state.selectedModuleLoading = false;
        state.error = action.payload as string;
      })

      // Create module (POST /api/access/modules/)
      .addCase(createModule.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(createModule.fulfilled, (state, action) => {
        state.actionLoading = false;
        const newModule = action.payload;
        if (newModule && typeof newModule === "object") {
          state.data = [
            newModule,
            ...(state.data || []).filter((m) => m.id !== newModule.id),
          ];
          state.count = state.data?.length ?? 0;
        }
      })
      .addCase(createModule.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload as string;
      })

      // Update module (PATCH /api/access/modules/{id}/)
      .addCase(updateModule.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(updateModule.fulfilled, (state, action) => {
        state.actionLoading = false;
        const updated = action.payload;
        if (updated && updated.id != null) {
          if (state.data && state.data.length > 0) {
            const idx = state.data.findIndex((m) => m.id === updated.id);
            if (idx !== -1) {
              state.data[idx] = { ...state.data[idx], ...updated };
            }
          }
          if (state.selectedModule?.id === updated.id) {
            state.selectedModule = { ...state.selectedModule, ...updated };
          }
        }
      })
      .addCase(updateModule.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { setSelectedModule, clearModuleError, setCurrentPage } = moduleSlice.actions;
export default moduleSlice.reducer;
