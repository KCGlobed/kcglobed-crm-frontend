import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import {
  fetchRolesApi,
  fetchRoleByIdApi,
  createRoleApi,
  updateRoleApi,
  fetchRolePermissionsApi,
  updateRolePermissionsApi,
  deleteRoleApi,
  fetchModulesApi,
  fetchPermissionCatalogApi,
} from "../../services/apiServices";
import type {
  Pagination,
  PaginationInfo,
  Role,
  RoleAccess,
  RolePermission,
  Module,
} from "../../utils/types";


interface RoleState extends Pagination<Role> {
  modules: Module[];
  modulesLoading: boolean;
  catalog: { actions?: string[]; scopes?: { value: string; label: string }[]; modules?: Module[] } | null;
  catalogLoading: boolean;
  selectedRole: Role | null;
  selectedRoleLoading: boolean;
  rolePermissions: RoleAccess | null;
  rolePermissionsLoading: boolean;
  actionLoading: boolean;
}

const initialState: RoleState = {
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
  modules: [],
  modulesLoading: false,
  catalog: null,
  catalogLoading: false,
  selectedRole: null,
  selectedRoleLoading: false,
  rolePermissions: null,
  rolePermissionsLoading: false,
  actionLoading: false,
};

export const fetchRoles = createAsyncThunk<
  { data: Role[]; pagination?: PaginationInfo },
  { page?: number; page_size?: number; search?: string; active?: boolean | string } | void
>(
  "roles/fetchRoles",
  async (params, { rejectWithValue }) => {
    try {
      const response = await fetchRolesApi(params || undefined);
      let data: Role[] = [];
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
      return rejectWithValue(err.message || "Failed to fetch roles");
    }
  },
  {
    condition: (_, { getState }) => {
      const { roles } = getState() as { roles: { loading: boolean } };
      if (roles?.loading) {
        return false; // prevent duplicate in-flight request
      }
      return true;
    },
  }
);

export const fetchRoleById = createAsyncThunk<Role, number>(
  "roles/fetchRoleById",
  async (roleId, { rejectWithValue }) => {
    try {
      const response = await fetchRoleByIdApi(roleId);
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to fetch role details");
    }
  }
);

export const createRole = createAsyncThunk<Role, Role>(
  "roles/createRole",
  async (payload, { rejectWithValue }) => {
    try {
      const response = await createRoleApi(payload);
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to create role");
    }
  }
);

export const updateRole = createAsyncThunk<
  Role,
  { id: number; payload: Role }
>(
  "roles/updateRole",
  async ({ id, payload }, { rejectWithValue }) => {
    try {
      const response = await updateRoleApi(id, payload);
      return response.data ?? response;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to update role");
    }
  }
);

export const fetchRolePermissions = createAsyncThunk<RoleAccess, number>(
  "roles/fetchRolePermissions",
  async (roleId, { rejectWithValue }) => {
    try {
      const response = await fetchRolePermissionsApi(roleId);
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to fetch role permissions");
    }
  }
);

export const fetchModules = createAsyncThunk<Module[]>(
  "roles/fetchModules",
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetchModulesApi();
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to fetch modules");
    }
  },
  {
    condition: (_, { getState }) => {
      const { roles } = getState() as { roles: { modulesLoading: boolean } };
      if (roles?.modulesLoading) {
        return false; // prevent duplicate in-flight request
      }
      return true;
    },
  }
);

export const updateRolePermissions = createAsyncThunk<
  any,
  { id: number; payload: { permissions: RolePermission[]; replace?: boolean } }
>(
  "roles/updateRolePermissions",
  async ({ id, payload }, { rejectWithValue }) => {
    try {
      const response = await updateRolePermissionsApi(id, payload);
      return response.data ?? response;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to update role permissions");
    }
  }
);

export const updateRoleStatus = createAsyncThunk<Role, Role>(
  "roles/updateRoleStatus",
  async (payload, { getState, rejectWithValue }) => {
    try {
      const response = await updateRoleApi(payload.id as number, { is_active: payload.is_active });
      const { roles } = getState() as { roles: RoleState };
      const existing = (roles.data || []).find((r) => r.id === payload.id);
      return {
        ...(existing || { id: payload.id }),
        ...(response?.data ?? {}),
        is_active: payload.is_active ?? true,
      };
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to update role status");
    }
  }
);

export const deleteRole = createAsyncThunk<number, number>(
  "roles/deleteRole",
  async (roleId: number, { rejectWithValue }) => {
    try {
      await deleteRoleApi(roleId);
      return roleId;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to delete role");
    }
  }
);

// Permission catalog (GET /api/access/permissions/): actions, data scopes and modules
export const fetchPermissionCatalog = createAsyncThunk<RoleState["catalog"]>(
  "roles/fetchPermissionCatalog",
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetchPermissionCatalogApi();
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to fetch permission catalog");
    }
  },
  {
    condition: (_, { getState }) => {
      const { roles } = getState() as { roles: { catalogLoading: boolean } };
      if (roles?.catalogLoading) {
        return false; // prevent duplicate in-flight request
      }
      return true;
    },
  }
);

const roleSlice = createSlice({
  name: "roles",
  initialState,
  reducers: {
    setSelectedRole: (state, action: PayloadAction<Role | null>) => {
      state.selectedRole = action.payload;
    },
    clearRoleError: (state) => {
      state.error = null;
    },
    setCurrentPage: (state, action: PayloadAction<number>) => {
      state.page = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRoles.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchRoles.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload?.data || [];
        state.pagination = action.payload?.pagination || initialState.pagination;
      })
      .addCase(fetchRoles.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // Fetch role by ID (GET /api/access/roles/{id}/)
      .addCase(fetchRoleById.pending, (state) => {
        state.selectedRoleLoading = true;
        state.error = null;
      })
      .addCase(fetchRoleById.fulfilled, (state, action) => {
        state.selectedRoleLoading = false;
        state.selectedRole = action.payload;
        // Keep in-memory list synchronized if role exists
        if (state.data && state.data.length > 0) {
          const idx = state.data.findIndex((r) => r.id === action.payload.id);
          if (idx !== -1) {
            state.data[idx] = { ...state.data[idx], ...action.payload };
          }
        }
      })
      .addCase(fetchRoleById.rejected, (state, action) => {
        state.selectedRoleLoading = false;
        state.error = action.payload as string;
      })

      .addCase(createRole.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(createRole.fulfilled, (state, action) => {
        state.actionLoading = false;
        state.data = [action.payload, ...(state.data || [])];
      })
      .addCase(createRole.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload as string;
      })

      .addCase(updateRolePermissions.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(updateRolePermissions.fulfilled, (state, action) => {
        state.actionLoading = false;
        if (action.payload?.id) {
          const idx = (state.data || []).findIndex((r) => r.id === action.payload.id);
          if (idx !== -1 && state.data) state.data[idx] = { ...state.data[idx], ...action.payload };
          if (state.selectedRole?.id === action.payload.id) {
            state.selectedRole = { ...state.selectedRole, ...action.payload };
          }
        }
        if (state.rolePermissions && action.payload?.permissions) {
          state.rolePermissions = {
            ...state.rolePermissions,
            permissions: action.payload.permissions,
          };
        }
      })
      .addCase(updateRolePermissions.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload as string;
      })

      .addCase(updateRoleStatus.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(updateRoleStatus.fulfilled, (state, action) => {
        state.actionLoading = false;
        const idx = (state.data || []).findIndex((r) => r.id === action.payload.id);
        if (idx !== -1 && state.data) state.data[idx] = action.payload;
        if (state.selectedRole?.id === action.payload.id) state.selectedRole = action.payload;
      })
      .addCase(updateRoleStatus.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload as string;
      })

      .addCase(deleteRole.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(deleteRole.fulfilled, (state, action) => {
        state.actionLoading = false;
        state.data = (state.data || []).filter((r) => r.id !== action.payload);
        if (state.selectedRole?.id === action.payload) state.selectedRole = null;
      })
      .addCase(deleteRole.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload as string;
      })

      // Fetch role permissions (GET /api/access/roles/{id}/permissions/)
      .addCase(fetchRolePermissions.pending, (state) => {
        state.rolePermissionsLoading = true;
        state.rolePermissions = null; // drop the previous role's data
        state.error = null;
      })
      .addCase(fetchRolePermissions.fulfilled, (state, action) => {
        state.rolePermissionsLoading = false;
        state.rolePermissions = action.payload;
      })
      .addCase(fetchRolePermissions.rejected, (state, action) => {
        state.rolePermissionsLoading = false;
        state.rolePermissions = null;
        state.error = action.payload as string;
      })

      // Fetch modules (GET /api/access/modules/)
      .addCase(fetchModules.pending, (state) => {
        state.modulesLoading = true;
      })
      .addCase(fetchModules.fulfilled, (state, action) => {
        state.modulesLoading = false;
        state.modules = action.payload || [];
      })
      .addCase(fetchModules.rejected, (state, action) => {
        state.modulesLoading = false;
        state.error = action.payload as string;
      })

      .addCase(fetchPermissionCatalog.pending, (state) => {
        state.catalogLoading = true;
      })
      .addCase(fetchPermissionCatalog.fulfilled, (state, action) => {
        state.catalogLoading = false;
        state.catalog = action.payload || null;
      })
      .addCase(fetchPermissionCatalog.rejected, (state) => {
        state.catalogLoading = false;
      })

      // Update role (PATCH /api/access/roles/{id}/)
      .addCase(updateRole.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(updateRole.fulfilled, (state, action) => {
        state.actionLoading = false;
        const updated = action.payload;
        if (updated && updated.id != null) {
          const idx = (state.data || []).findIndex((r) => r.id === updated.id);
          if (idx !== -1 && state.data) state.data[idx] = { ...state.data[idx], ...updated };
          if (state.selectedRole?.id === updated.id) {
            state.selectedRole = { ...state.selectedRole, ...updated };
          }
        }
      })
      .addCase(updateRole.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { setSelectedRole, clearRoleError, setCurrentPage } = roleSlice.actions;
export default roleSlice.reducer;
