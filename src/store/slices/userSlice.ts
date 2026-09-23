import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import {
  fetchUsersApi,
  fetchUserByUidApi,
  createUserApi,
  updateUserRoleApi,
} from "../../services/apiServices";
import type { Pagination, User } from "../../utils/types";


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
  selectedUser: null,
  selectedUserLoading: false,
  actionLoading: false,
};

export const fetchUsers = createAsyncThunk<User[]>(
  "users/fetchUsers",
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetchUsersApi();
      return response.data;
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
  async (userId: number, { rejectWithValue }) => {
    try {
      const response = await "";
      return { userId, response };
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to activate user");
    }
  }
);

export const deactivateUser = createAsyncThunk(
  "users/deactivateUser",
  async (userId: number, { rejectWithValue }) => {
    try {
      const response = await "";
      return { userId, response };
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to deactivate user");
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
        state.data = Array.isArray(action.payload)
          ? action.payload
          : (action.payload as any)?.results || [];
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
        const user = (state.data || []).find((u) => u.id === action.payload.userId);
        if (user) {
          user.is_active = true;
        }
        if (state.selectedUser?.id === action.payload.userId) {
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
        const user = (state.data || []).find((u) => u.id === action.payload.userId);
        if (user) {
          user.is_active = false;
        }
        if (state.selectedUser?.id === action.payload.userId) {
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
      });
  },
});

export const { setSelectedUser, clearUserError } = userSlice.actions;
export default userSlice.reducer;
