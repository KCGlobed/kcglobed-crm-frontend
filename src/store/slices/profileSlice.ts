import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { fetchProfileApi, changePasswordApi } from "../../services/apiServices";
import type { User } from "../../utils/types";

interface ProfileState {
  profile: User | null;
  loading: boolean;
  error: string | null;
  actionLoading: boolean;
}

const initialState: ProfileState = {
  profile: null,
  loading: false,
  error: null,
  actionLoading: false,
};

export const fetchProfile = createAsyncThunk<User, string>(
  "profile/fetchProfile",
  async (userUid, { rejectWithValue }) => {
    try {
      const response = await fetchProfileApi(userUid);
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to fetch profile");
    }
  },
  {
    condition: (_, { getState }) => {
      const { profile } = getState() as { profile: { loading: boolean } };
      if (profile?.loading) return false;
      return true;
    },
  }
);

export const changePassword = createAsyncThunk<any, User>(
  "profile/changePassword",
  async (payload, { rejectWithValue }) => {
    try {
      const response = await changePasswordApi(payload);
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to change password");
    }
  }
);

const profileSlice = createSlice({
  name: "profile",
  initialState,
  reducers: {
    clearProfileError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch profile (GET /api/access/users/{uid}/)
      .addCase(fetchProfile.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.profile = action.payload ?? null;
      })
      .addCase(fetchProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // Change password (POST /api/auth/change-password/)
      .addCase(changePassword.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(changePassword.fulfilled, (state) => {
        state.actionLoading = false;
      })
      .addCase(changePassword.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearProfileError } = profileSlice.actions;
export default profileSlice.reducer;
