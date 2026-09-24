import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { Pagination, ReportingOption } from "../../utils/types";
import { fetchReportingManagementOptionsApi, createUserApi } from "../../services/apiServices";

interface ReportingManagementState extends Pagination<ReportingOption> { }

const initialState: ReportingManagementState = {
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
}

export const fetchReportingManagementOptions = createAsyncThunk<Pagination<ReportingOption>, { page?: number; page_size?: number }>(
    "reportingManagement/fetchOptions",
    async ({ page = 1, page_size = 2 }, { rejectWithValue }) => {
        try {
            return await fetchReportingManagementOptionsApi({ page, page_size });
        } catch (error: any) {
            return rejectWithValue(error.message || "Failed to fetch reporting options");
        }
    },
    {
        condition: (_, { getState }) => {
            const { reportingManagement } = getState() as { reportingManagement: { loading: boolean } };
            if (reportingManagement?.loading) {
                return false;
            }
            return true;
        }
    }
)

export const createReportingUser = createAsyncThunk<any, any, { rejectValue: string }>(
    "reportingManagement/createUser",
    async (payload, { rejectWithValue }) => {
        try {
            return await createUserApi(payload);
        } catch (error: any) {
            return rejectWithValue(error.message || "Failed to create reporting user");
        }
    }
)

const reportingManagementSlice = createSlice({
    name: "reportingManagement",
    initialState,
    reducers: {
        setPage(state, action: PayloadAction<number>) {
            state.page = action.payload;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchReportingManagementOptions.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchReportingManagementOptions.fulfilled, (state, action) => {
                state.loading = false;
                // Use fallback to empty array/object in case backend doesn't return data/pagination exactly as expected
                state.data = action.payload?.data || [];
                state.pagination = action.payload?.pagination || initialState.pagination;
            })
            .addCase(fetchReportingManagementOptions.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            });
    }
})

export const { setPage } = reportingManagementSlice.actions
export default reportingManagementSlice.reducer
