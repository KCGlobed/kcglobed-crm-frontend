import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import { fetchReportingTreeByUserApi } from "../../services/apiServices";
import type { ReportingNode } from "../../utils/types";
import { logout } from "./authSlice";

export interface ReportingState {
  rootTree: ReportingNode[];
  rootLoading: boolean;
  selectedUser: string;
  treeData: ReportingNode[];
  loading: boolean;
  error: string | null;
}

const initialState: ReportingState = {
  rootTree: [],
  rootLoading: false,
  selectedUser: "",
  treeData: [],
  loading: false,
  error: null,
};

// Logged-in user's hierarchy (left panel)
export const fetchRootReportingTree = createAsyncThunk<ReportingNode[], string>(
  "reporting/fetchRootTree",
  async (userUid, { rejectWithValue }) => {
    try {
      const response = await fetchReportingTreeByUserApi(userUid);
      return response.data || [];
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to fetch reporting tree");
    }
  },
  {
    condition: (_, { getState }) => {
      const { reporting } = getState() as { reporting: { rootLoading: boolean } };
      if (reporting?.rootLoading) return false;
      return true;
    },
  }
);

// Selected user's hierarchy (graph)
export const fetchReportingTreeByUser = createAsyncThunk<ReportingNode[], string>(
  "reporting/fetchTreeByUser",
  async (userUid, { rejectWithValue }) => {
    try {
      const response = await fetchReportingTreeByUserApi(userUid);
      return response.data || [];
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to fetch reporting tree");
    }
  }
);

const reportingSlice = createSlice({
  name: "reporting",
  initialState,
  reducers: {
    setSelectedUser: (state, action: PayloadAction<string>) => {
      state.selectedUser = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRootReportingTree.pending, (state) => {
        state.rootLoading = true;
        state.error = null;
      })
      .addCase(fetchRootReportingTree.fulfilled, (state, action) => {
        state.rootLoading = false;
        state.rootTree = action.payload;
      })
      .addCase(fetchRootReportingTree.rejected, (state, action) => {
        state.rootLoading = false;
        state.error = action.payload as string;
      })
      // Tree by user
      .addCase(fetchReportingTreeByUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchReportingTreeByUser.fulfilled, (state, action) => {
        state.loading = false;
        state.treeData = action.payload;
      })
      .addCase(fetchReportingTreeByUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Reset on logout so the next user never sees the previous user's tree
      .addCase(logout, () => initialState);
  },
});

export const { setSelectedUser } = reportingSlice.actions;
export default reportingSlice.reducer;
