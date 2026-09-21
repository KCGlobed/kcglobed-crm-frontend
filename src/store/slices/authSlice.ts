import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { storeToken, storeRefreshToken, getToken, clearToken, storeUserID, storeUser, storeAccess, getUser, getAccess } from "../../utils/tokenStorage"; // utils to persist tokens
import { loginApi } from "../../services/apiServices";
import type { AuthState, LoginCred, LoginResponse } from "../../utils/types";



const initialState: AuthState = {
  isAuthenticated: !!getToken(),
  token: getToken(),
  loading: false,
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
      storeUserID(user.uid);
      storeUser(user);
      storeAccess(access);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error?.message || "Login failed");
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
  },
});

export const { logout } = authSlice.actions;
export default authSlice.reducer;
