import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import type { Pagination, UserItem, CreateUserPayload } from "../../utils/types";


interface UserState extends Pagination<UserItem> {
  selectedUser: UserItem | null;
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

export const fetchUsers = createAsyncThunk(
  "users/fetchUsers",
  async (_, { rejectWithValue }) => {
    try {
      const response = "";
      return response;
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

export const fetchUserById = createAsyncThunk(
  "users/fetchUserById",
  async (userId: number, { rejectWithValue }) => {
    try {
      const response = await "";
      return response;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to fetch user details");
    }
  }
);

export const createUser = createAsyncThunk(
  "users/createUser",
  async (payload: CreateUserPayload, { rejectWithValue }) => {
    try {
      const response = await "";
      return response;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to create user");
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
      .addCase(fetchUsers.fulfilled, (state, action: any) => {
        state.loading = false;
        state.data = action.payload.results || action.payload;
        state.next = action.payload.next || null;
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // Fetch user by ID (GET /api/users/{id}/)
      .addCase(fetchUserById.pending, (state) => {
        state.selectedUserLoading = true;
        state.error = null;
      })
      .addCase(fetchUserById.fulfilled, (state, action: any) => {
        state.selectedUserLoading = false;
        state.selectedUser = action.payload;
        // Keep in-memory list synchronized if user exists
        if (state.data && state.data.length > 0) {
          const idx = state.data.findIndex((u) => u.id === action.payload.id);
          if (idx !== -1) {
            state.data[idx] = { ...state.data[idx], ...action.payload };
          }
        }
      })
      .addCase(fetchUserById.rejected, (state, action) => {
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
      });
  },
});

export const { setSelectedUser, clearUserError } = userSlice.actions;
export default userSlice.reducer;
