import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import {
  fetchUsersApi,
  fetchUserByUidApi,
  createUserApi,
  updateUserRoleApi,
  updateUserReportsToApi,
  activateUserApi,
  deactivateUserApi,
} from "../../services/apiServices";
import type { Pagination, PaginationInfo, User } from "../../utils/types";


interface UserState extends Pagination<User> {
  selectedUser: User | null;
  selectedUserLoading: boolean;
  actionLoading: boolean;
}

const initialState: UserState = {
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
  selectedUser: null,
  selectedUserLoading: false,
  actionLoading: false,
};

export const fetchUsers = createAsyncThunk<
  { data: User[]; pagination?: PaginationInfo },
  { page?: number; page_size?: number } | void
>(
  "users/fetchUsers",
  async (params, { rejectWithValue }) => {
    try {
      const response = await fetchUsersApi(params || undefined);
      const data = Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response)
          ? response
          : response?.results || [];
      return {
        data,
        pagination: response?.pagination,
      };
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to fetch users");
    }
  },
  {
    condition: (_, { getState }) => {
      const { users } = getState() as { users: { loading: boolean } };
      if (users?.loading) {
        return false;
      }
      return true;
    },
  }
);

export const fetchUserByUid = createAsyncThunk<User, string>(
  "users/fetchUserByUid",
  async (userUid: string, { rejectWithValue }) => {
    try {
      const response = await fetchUserByUidApi(userUid);
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to fetch user details");
    }
  }
);

export const fetchUserById = fetchUserByUid;

export const createUser = createAsyncThunk<User, any>(
  "users/createUser",
  async (payload: any, { rejectWithValue }) => {
    try {
      const response = await createUserApi(payload);
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to create user");
    }
  }
);

export const updateUserRole = createAsyncThunk<
  { userUid: string; roleId: number | string; roleObj?: any },
  { userUid: string; roleId: number | string; roleObj?: any }
>(
  "users/updateUserRole",
  async ({ userUid, roleId, roleObj }, { rejectWithValue }) => {
    try {
      const response = await updateUserRoleApi(userUid, { role: roleId });
      // Backend returns { "role": "{{role_id}}" }
      const returnedRoleId = response?.data?.role ?? response?.role ?? roleId;
      return { userUid, roleId: returnedRoleId, roleObj };
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to update role");
    }
  }
);

export const activateUser = createAsyncThunk(
  "users/activateUser",
  async (userUid: string, { rejectWithValue }) => {
    try {
      const response = await activateUserApi(userUid);
      return { userUid, response };
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to activate user");
    }
  }
);

export const deactivateUser = createAsyncThunk(
  "users/deactivateUser",
  async (userUid: string, { rejectWithValue }) => {
    try {
      const response = await deactivateUserApi(userUid);
      return { userUid, response };
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to deactivate user");
    }
  }
);

export const updateUserReportsTo = createAsyncThunk<
  { userUid: string; reportsToUid: string | null; reportsToObj?: any },
  { userUid: string; reportsToUid: string | null; reportsToObj?: any }
>(
  "users/updateUserReportsTo",
  async ({ userUid, reportsToUid, reportsToObj }, { rejectWithValue }) => {
    try {
      await updateUserReportsToApi(userUid, { reports_to: reportsToUid });
      return { userUid, reportsToUid, reportsToObj };
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to update reporting manager");
    }
  }
);

const userSlice = createSlice({
  name: "users",
  initialState,
  reducers: {
    setSelectedUser: (state, action) => {
      state.selectedUser = action.payload;
    },
    clearUserError: (state) => {
      state.error = null;
    },
    setCurrentPage: (state, action) => {
      state.current_page = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch users
      .addCase(fetchUsers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
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
      .addCase(fetchUsers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // Fetch user by UID (GET /access/users/{user_uid}/)
      .addCase(fetchUserByUid.pending, (state) => {
        state.selectedUserLoading = true;
        state.error = null;
      })
      .addCase(fetchUserByUid.fulfilled, (state, action: any) => {
        state.selectedUserLoading = false;
        state.selectedUser = action.payload;
        // Keep in-memory list synchronized if user exists
        if (state.data && state.data.length > 0 && action.payload) {
          const idx = state.data.findIndex(
            (u) =>
              (u.uid && u.uid === action.payload.uid) ||
              (u.id != null && u.id === action.payload.id)
          );
          if (idx !== -1) {
            state.data[idx] = { ...state.data[idx], ...action.payload };
          }
        }
      })
      .addCase(fetchUserByUid.rejected, (state, action) => {
        state.selectedUserLoading = false;
        state.error = action.payload as string;
      })

      // Create user (POST /api/users/)
      .addCase(createUser.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(createUser.fulfilled, (state, action: any) => {
        state.actionLoading = false;
        state.data = [action.payload, ...(state.data || [])];
      })
      .addCase(createUser.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload as string;
      })

      // Activate user (POST /api/users/{id}/activate/)
      .addCase(activateUser.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(activateUser.fulfilled, (state, action) => {
        state.actionLoading = false;
        const user = (state.data || []).find((u) => u.uid === action.payload.userUid);
        if (user) {
          user.is_active = true;
        }
        if (state.selectedUser?.uid === action.payload.userUid) {
          state.selectedUser.is_active = true;
        }
      })
      .addCase(activateUser.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload as string;
      })

      // Deactivate user (DELETE /api/users/{id}/)
      .addCase(deactivateUser.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(deactivateUser.fulfilled, (state, action) => {
        state.actionLoading = false;
        const user = (state.data || []).find((u) => u.uid === action.payload.userUid);
        if (user) {
          user.is_active = false;
        }
        if (state.selectedUser?.uid === action.payload.userUid) {
          state.selectedUser.is_active = false;
        }
      })
      .addCase(deactivateUser.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload as string;
      })

      // Update user role (PATCH /access/users/{user_uid}/role/)
      .addCase(updateUserRole.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(updateUserRole.fulfilled, (state, action) => {
        state.actionLoading = false;
        const { userUid, roleId, roleObj } = action.payload;
        if (state.data && state.data.length > 0) {
          const idx = state.data.findIndex((u) => u.uid === userUid);
          if (idx !== -1) {
            const currentRole = state.data[idx].role;
            const updatedRole =
              roleObj ||
              (typeof currentRole === "object" && currentRole !== null
                ? { ...currentRole, id: Number(roleId) }
                : roleId);
            state.data[idx] = {
              ...state.data[idx],
              role: updatedRole,
              role_name: roleObj?.name ?? state.data[idx].role_name,
            };
          }
        }
        if (state.selectedUser && state.selectedUser.uid === userUid) {
          const currentRole = state.selectedUser.role;
          const updatedRole =
            roleObj ||
            (typeof currentRole === "object" && currentRole !== null
              ? { ...currentRole, id: Number(roleId) }
              : roleId);
          state.selectedUser = {
            ...state.selectedUser,
            role: updatedRole,
            role_name: roleObj?.name ?? state.selectedUser.role_name,
          };
        }
      })
      .addCase(updateUserRole.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload as string;
      })

      // Update user reporting manager
      .addCase(updateUserReportsTo.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(updateUserReportsTo.fulfilled, (state, action) => {
        state.actionLoading = false;
        const { userUid, reportsToUid, reportsToObj } = action.payload;
        if (state.data && state.data.length > 0) {
          const idx = state.data.findIndex((u) => u.uid === userUid);
          if (idx !== -1) {
            const updatedReportsTo =
              reportsToObj || reportsToUid;
            state.data[idx] = {
              ...state.data[idx],
              reports_to: updatedReportsTo,
              reports_to_name: reportsToObj?.name || reportsToObj?.email || state.data[idx].reports_to_name,
            };
          }
        }
        if (state.selectedUser && state.selectedUser.uid === userUid) {
          const updatedReportsTo =
            reportsToObj || reportsToUid;
          state.selectedUser = {
            ...state.selectedUser,
            reports_to: updatedReportsTo,
            reports_to_name: reportsToObj?.name || reportsToObj?.email || state.selectedUser.reports_to_name,
          };
        }
      })
      .addCase(updateUserReportsTo.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { setSelectedUser, clearUserError, setCurrentPage } = userSlice.actions;
export default userSlice.reducer;
