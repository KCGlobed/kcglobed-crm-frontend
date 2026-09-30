import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import {
  fetchDepartmentsApi,
  fetchDepartmentByIdApi,
  createDepartmentApi,
  updateDepartmentApi,
  activateDepartmentApi,
  deactivateDepartmentApi,
  deleteDepartmentApi,
} from "../../services/apiServices";
import type { Pagination, PaginationInfo, Department } from "../../utils/types";

interface DepartmentState extends Pagination<Department> {
  selectedDepartment: Department | null;
  selectedDepartmentLoading: boolean;
  actionLoading: boolean;
}

const initialState: DepartmentState = {
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
  selectedDepartment: null,
  selectedDepartmentLoading: false,
  actionLoading: false,
};

export const fetchDepartments = createAsyncThunk<
  { data: Department[]; pagination?: PaginationInfo },
  { page?: number; page_size?: number | string; search?: string; is_active?: boolean | string } | void
>(
  "departments/fetchDepartments",
  async (params, { rejectWithValue }) => {
    try {
      const response = await fetchDepartmentsApi(params || undefined);
      let data: Department[] = [];
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
      return rejectWithValue(err.message || "Failed to fetch departments");
    }
  },
  {
    condition: (_, { getState }) => {
      const { departments } = getState() as { departments: { loading: boolean } };
      if (departments?.loading) {
        return false; // prevent duplicate in-flight request
      }
      return true;
    },
  }
);

export const fetchDepartmentById = createAsyncThunk<Department, number>(
  "departments/fetchDepartmentById",
  async (departmentId, { rejectWithValue }) => {
    try {
      const response = await fetchDepartmentByIdApi(departmentId);
      return response.data ?? response;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to fetch department details");
    }
  }
);

export const createDepartment = createAsyncThunk<Department, Department>(
  "departments/createDepartment",
  async (payload, { rejectWithValue }) => {
    try {
      const response = await createDepartmentApi(payload);
      return response.data ?? response;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to create department");
    }
  }
);

export const updateDepartment = createAsyncThunk<
  Department,
  { id: number; payload: Department }
>(
  "departments/updateDepartment",
  async ({ id, payload }, { rejectWithValue }) => {
    try {
      const response = await updateDepartmentApi(id, payload);
      return response.data ?? response;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to update department");
    }
  }
);

export const updateDepartmentStatus = createAsyncThunk<
  Department,
  { id: number; is_active: boolean }
>(
  "departments/updateDepartmentStatus",
  async ({ id, is_active }, { rejectWithValue }) => {
    try {
      const response = is_active
        ? await activateDepartmentApi(id)
        : await deactivateDepartmentApi(id);
      return response.data ?? { id, is_active };
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to update department status");
    }
  }
);

export const deleteDepartment = createAsyncThunk<number, number>(
  "departments/deleteDepartment",
  async (departmentId, { rejectWithValue }) => {
    try {
      await deleteDepartmentApi(departmentId);
      return departmentId;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to delete department");
    }
  }
);

const departmentSlice = createSlice({
  name: "departments",
  initialState,
  reducers: {
    setSelectedDepartment: (state, action: PayloadAction<Department | null>) => {
      state.selectedDepartment = action.payload;
    },
    clearDepartmentError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch departments (GET /api/access/departments/)
      .addCase(fetchDepartments.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDepartments.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload?.data || [];
        state.pagination = action.payload?.pagination || initialState.pagination;
      })
      .addCase(fetchDepartments.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // Fetch department by ID (GET /api/access/departments/{id}/)
      .addCase(fetchDepartmentById.pending, (state) => {
        state.selectedDepartmentLoading = true;
        state.error = null;
      })
      .addCase(fetchDepartmentById.fulfilled, (state, action) => {
        state.selectedDepartmentLoading = false;
        state.selectedDepartment = action.payload;
        if (state.data && state.data.length > 0 && action.payload?.id != null) {
          const idx = state.data.findIndex((d) => d.id === action.payload.id);
          if (idx !== -1) {
            state.data[idx] = { ...state.data[idx], ...action.payload };
          }
        }
      })
      .addCase(fetchDepartmentById.rejected, (state, action) => {
        state.selectedDepartmentLoading = false;
        state.error = action.payload as string;
      })

      // Create department (POST /api/access/departments/)
      .addCase(createDepartment.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(createDepartment.fulfilled, (state, action) => {
        state.actionLoading = false;
        const newDepartment = action.payload;
        if (newDepartment && typeof newDepartment === "object") {
          state.data = [
            newDepartment,
            ...(state.data || []).filter((d) => d.id !== newDepartment.id),
          ];
        }
      })
      .addCase(createDepartment.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload as string;
      })

      // Update department (PATCH /api/access/departments/{id}/)
      .addCase(updateDepartment.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(updateDepartment.fulfilled, (state, action) => {
        state.actionLoading = false;
        const updated = action.payload;
        if (updated && updated.id != null) {
          if (state.data && state.data.length > 0) {
            const idx = state.data.findIndex((d) => d.id === updated.id);
            if (idx !== -1) {
              state.data[idx] = { ...state.data[idx], ...updated };
            }
          }
          if (state.selectedDepartment?.id === updated.id) {
            state.selectedDepartment = { ...state.selectedDepartment, ...updated };
          }
        }
      })
      .addCase(updateDepartment.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload as string;
      })

      // Activate/deactivate department
      .addCase(updateDepartmentStatus.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(updateDepartmentStatus.fulfilled, (state, action) => {
        state.actionLoading = false;
        const updated = action.payload;
        if (updated && updated.id != null) {
          const idx = (state.data || []).findIndex((d) => d.id === updated.id);
          if (idx !== -1 && state.data) state.data[idx] = { ...state.data[idx], ...updated };
          if (state.selectedDepartment?.id === updated.id) {
            state.selectedDepartment = { ...state.selectedDepartment, ...updated };
          }
        }
      })
      .addCase(updateDepartmentStatus.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload as string;
      })

      // Delete department (DELETE /api/access/departments/{id}/)
      .addCase(deleteDepartment.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(deleteDepartment.fulfilled, (state, action) => {
        state.actionLoading = false;
        state.data = (state.data || []).filter((d) => d.id !== action.payload);
        if (state.selectedDepartment?.id === action.payload) {
          state.selectedDepartment = null;
        }
      })
      .addCase(deleteDepartment.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { setSelectedDepartment, clearDepartmentError } = departmentSlice.actions;
export default departmentSlice.reducer;
