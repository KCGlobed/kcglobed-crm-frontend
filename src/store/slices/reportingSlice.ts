import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { fetchReportingTreeApi } from "../../services/apiServices";
import type { ReportingNode } from "../../utils/types";

export interface ReportingState {
  treeData: ReportingNode[];
  loading: boolean;
  error: string | null;
}

const initialState: ReportingState = {
  treeData: [],
  loading: false,
  error: null,
};

export const fetchReportingTree = createAsyncThunk<ReportingNode[], void>(
  "reporting/fetchTree",
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetchReportingTreeApi();
      return response.data || [];
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to fetch reporting tree");
    }
  }
);

const reportingSlice = createSlice({
  name: "reporting",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchReportingTree.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchReportingTree.fulfilled, (state, action) => {
        state.loading = false;
        state.treeData = action.payload;
      })
      .addCase(fetchReportingTree.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export default reportingSlice.reducer;
