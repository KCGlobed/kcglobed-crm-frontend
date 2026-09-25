import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { storeToken, storeRefreshToken, getToken, clearToken, storeUserID, storeUser, storeAccess, getUser, getAccess } from "../../utils/tokenStorage"; // utils to persist tokens
import {
  loginApi,
  logoutAllApi,
  sendPasswordResetLinkApi,
  resetPasswordApi,
} from "../../services/apiServices";
import type { AuthState, LoginCred, LoginResponse } from "../../utils/types";



const initialState: AuthState = {
  isAuthenticated: !!getToken(),
  token: getToken(),
  loading: false,
  actionLoading: false,
  error: null,
  user: getUser(),
  access: getAccess(),
};

export const loginUser = createAsyncThunk<LoginResponse["data"], LoginCred>(
  "auth/loginUser",
  async (
    credentials: LoginCred,
    { rejectWithValue }
  ) => {
    try {
      const response = await loginApi(credentials);
      const { access_token, refresh_token, user, access } = response.data;

      storeToken(access_token);
      storeRefreshToken(refresh_token);
      storeUserID(user.uid || "");
      storeUser(user);
      storeAccess(access);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error?.message || "Login failed");
    }
  }
);

// Invalidates every session for this user on the backend (POST /auth/logout-all/)
export const logoutAllDevices = createAsyncThunk<any>(
  "auth/logoutAllDevices",
  async (_, { rejectWithValue }) => {
    try {
      const response = await logoutAllApi();
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to logout from all devices");
    }
  }
);

// ---------------- Forgot password flow ---------------- //
export const sendPasswordResetLink = createAsyncThunk<any, { email: string }>(
  "auth/sendPasswordResetLink",
  async (payload, { rejectWithValue }) => {
    try {
      const response = await sendPasswordResetLinkApi(payload);
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to send reset link");
    }
  }
);

export const resetPassword = createAsyncThunk<
  any,
  { token: string; uid?: string; new_password: string; confirm_password: string }
>(
  "auth/resetPassword",
  async (payload, { rejectWithValue }) => {
    try {
      const response = await resetPasswordApi(payload);
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to reset password");
    }
  }
);


const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    logout: (state) => {
      state.token = null;
      state.isAuthenticated = false;
      state.user = null;
      state.access = null;
      clearToken();
    },
    restoreAuth: (state, action) => {
      state.token = action.payload;
      state.isAuthenticated = true;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.token = action.payload.access_token;
        state.user = action.payload.user;
        state.access = action.payload.access;
        state.isAuthenticated = true;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Logout from all devices: clear the local session only after the backend confirms
      .addCase(logoutAllDevices.pending, (state) => {
        state.actionLoading = true;
      })
      .addCase(logoutAllDevices.fulfilled, (state) => {
        state.actionLoading = false;
        state.token = null;
        state.isAuthenticated = false;
        state.user = null;
        state.access = null;
        clearToken();
      })
      .addCase(logoutAllDevices.rejected, (state) => {
        state.actionLoading = false;
      })
      // Forgot password flow (errors are surfaced via toast in the page, not stored here)
      .addCase(sendPasswordResetLink.pending, (state) => {
        state.actionLoading = true;
      })
      .addCase(sendPasswordResetLink.fulfilled, (state) => {
        state.actionLoading = false;
      })
      .addCase(sendPasswordResetLink.rejected, (state) => {
        state.actionLoading = false;
      })
      .addCase(resetPassword.pending, (state) => {
        state.actionLoading = true;
      })
      .addCase(resetPassword.fulfilled, (state) => {
        state.actionLoading = false;
      })
      .addCase(resetPassword.rejected, (state) => {
        state.actionLoading = false;
      });
  },
});

export const { logout } = authSlice.actions;
export default authSlice.reducer;
