import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import type { Pagination, RoleItem, ModulePermissionsGroup } from "../../utils/types";


interface RoleState extends Pagination<RoleItem> {
  permissionsByModule: ModulePermissionsGroup[];
  permissionsLoading: boolean;
  selectedRole: RoleItem | null;
  actionLoading: boolean;
}

const initialState: RoleState = {
  data: [],
  next: null,
  loading: false,
  error: null,
  permissionsByModule: [],
  permissionsLoading: false,
  selectedRole: null,
  actionLoading: false,
};

export const fetchRoles = createAsyncThunk(
  "roles/fetchRoles",
  async (_, { rejectWithValue }) => {
    try {
      const response = await "";
      return response;
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

export const createRole = createAsyncThunk(
  "roles/createRole",
  async (payload: { name: string; description: string; permissions: string[] }, { rejectWithValue }) => {
    try {
      const response = await "";
      return response;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to create role");
    }
  }
);

export const updateRolePermissions = createAsyncThunk(
  "roles/updateRolePermissions",
  async (payload: { id: number; permissions: string[] }, { rejectWithValue }) => {
    try {
      const response = await "";
      return response;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to update role permissions");
    }
  }
);

export const updateRoleStatus = createAsyncThunk(
  "roles/updateRoleStatus",
  async (payload: { id: number; is_active: boolean }, { rejectWithValue }) => {
    try {
      const response = await "updateRoleStatusApi(payload.id, payload.is_active)";
      return response;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to update role status");
    }
  }
);

export const deleteRole = createAsyncThunk(
  "roles/deleteRole",
  async (roleId: number, { rejectWithValue }) => {
    try {
      await "";
      return roleId;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to delete role");
    }
  }
);

export const fetchPermissionsByModule = createAsyncThunk(
  "roles/fetchPermissionsByModule",
  async (_, { rejectWithValue }) => {
    try {
      const response = await "";
      return response;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to fetch permissions");
    }
  },
  {
    condition: (_, { getState }) => {
      const { roles } = getState() as { roles: { permissionsLoading: boolean } };
      if (roles?.permissionsLoading) {
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
    setSelectedRole: (state, action) => {
      state.selectedRole = action.payload;
    },
    clearRoleError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRoles.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchRoles.fulfilled, (state, action: any) => {
        state.loading = false;
        state.data = action.payload.results || action.payload;
        state.next = action.payload.next || null;
      })
      .addCase(fetchRoles.rejected, (state, action) => {
        state.loading = false;
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
        const idx = (state.data || []).findIndex((r) => r.id === action.payload.id);
        if (idx !== -1 && state.data) state.data[idx] = action.payload;
        if (state.selectedRole?.id === action.payload.id) state.selectedRole = action.payload;
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

      .addCase(fetchPermissionsByModule.pending, (state) => {
        state.permissionsLoading = true;
      })
      .addCase(fetchPermissionsByModule.fulfilled, (state, action) => {
        state.permissionsLoading = false;
        state.permissionsByModule = action.payload;
      })
      .addCase(fetchPermissionsByModule.rejected, (state) => {
        state.permissionsLoading = false;
      });
  },
});

export const { setSelectedRole, clearRoleError } = roleSlice.actions;
export default roleSlice.reducer;
