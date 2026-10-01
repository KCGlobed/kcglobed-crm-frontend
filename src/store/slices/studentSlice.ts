import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import {
  fetchStudentsApi,
  fetchStudentByIdApi,
  fetchPendingReviewDocumentsApi,
  reviewStudentDocumentApi,
} from "../../services/apiServices";
import type { Pagination, PaginationInfo, Student, StudentDocument } from "../../utils/types";

interface StudentState extends Pagination<Student> {
  selectedStudent: Student | null;
  selectedStudentLoading: boolean;
  actionLoading: boolean;
  pendingDocuments: StudentDocument[];
  pendingDocumentsLoading: boolean;
  pendingDocumentsPagination: PaginationInfo | null;
}

const initialState: StudentState = {
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
  selectedStudent: null,
  selectedStudentLoading: false,
  actionLoading: false,
  pendingDocuments: [],
  pendingDocumentsLoading: false,
  pendingDocumentsPagination: null,
};

export const fetchStudents = createAsyncThunk<
  { data: Student[]; pagination?: PaginationInfo },
  { page?: number; page_size?: number; search?: string; stage?: string; profile_status?: string; status?: string } | void
>(
  "students/fetchStudents",
  async (params, { rejectWithValue }) => {
    try {
      const response = await fetchStudentsApi(params || undefined);
      return {
        data: response?.data || [],
        pagination: response?.pagination,
      };
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to fetch students");
    }
  },
  {
    condition: (_, { getState }) => {
      const { students } = getState() as { students: { loading: boolean } };
      if (students?.loading) return false;
      return true;
    },
  }
);

export const fetchStudentById = createAsyncThunk<Student, string>(
  "students/fetchStudentById",
  async (applicationId, { rejectWithValue }) => {
    try {
      const response = await fetchStudentByIdApi(applicationId);
      // Response data is {application, missing_fields, documents, approval_problems, lead}
      const data = response.data ?? response;
      if (data?.application) {
        return { ...data.application, lead: data.lead, missing_fields: data.missing_fields };
      }
      return data;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to fetch student details");
    }
  }
);

export const fetchPendingReviewDocuments = createAsyncThunk<
  { data: StudentDocument[]; pagination?: PaginationInfo },
  { page?: number; page_size?: number; search?: string; document_type?: string } | void
>(
  "students/fetchPendingReviewDocuments",
  async (params, { rejectWithValue }) => {
    try {
      const response = await fetchPendingReviewDocumentsApi(params || undefined);
      return {
        data: response?.data || [],
        pagination: response?.pagination,
      };
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to fetch pending documents");
    }
  },
  {
    condition: (_, { getState }) => {
      const { students } = getState() as { students: { pendingDocumentsLoading: boolean } };
      if (students?.pendingDocumentsLoading) return false;
      return true;
    },
  }
);

export const reviewStudentDocument = createAsyncThunk<
  StudentDocument,
  { id: number; status: string; rejection_reason?: string }
>(
  "students/reviewStudentDocument",
  async ({ id, status, rejection_reason }, { rejectWithValue }) => {
    try {
      const response = await reviewStudentDocumentApi(
        id,
        rejection_reason ? { status, rejection_reason } : { status }
      );
      return response.data ?? response;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to review document");
    }
  }
);

const studentSlice = createSlice({
  name: "students",
  initialState,
  reducers: {
    clearStudentError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchStudents.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchStudents.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload?.data || [];
        state.pagination = action.payload?.pagination || initialState.pagination;
      })
      .addCase(fetchStudents.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      .addCase(fetchStudentById.pending, (state) => {
        state.selectedStudentLoading = true;
        state.error = null;
      })
      .addCase(fetchStudentById.fulfilled, (state, action) => {
        state.selectedStudentLoading = false;
        state.selectedStudent = action.payload;
        if (state.data && state.data.length > 0 && action.payload?.application_id) {
          const idx = state.data.findIndex((s) => s.application_id === action.payload.application_id);
          if (idx !== -1) {
            state.data[idx] = { ...state.data[idx], ...action.payload };
          }
        }
      })
      .addCase(fetchStudentById.rejected, (state, action) => {
        state.selectedStudentLoading = false;
        state.error = action.payload as string;
      })

      .addCase(fetchPendingReviewDocuments.pending, (state) => {
        state.pendingDocumentsLoading = true;
        state.error = null;
      })
      .addCase(fetchPendingReviewDocuments.fulfilled, (state, action) => {
        state.pendingDocumentsLoading = false;
        state.pendingDocuments = action.payload?.data || [];
        state.pendingDocumentsPagination = action.payload?.pagination || null;
      })
      .addCase(fetchPendingReviewDocuments.rejected, (state, action) => {
        state.pendingDocumentsLoading = false;
        state.error = action.payload as string;
      })

      .addCase(reviewStudentDocument.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(reviewStudentDocument.fulfilled, (state, action) => {
        state.actionLoading = false;
        // A reviewed document leaves the pending-review queue
        if (action.payload?.id) {
          state.pendingDocuments = (state.pendingDocuments || []).filter(
            (d) => d.id !== action.payload.id
          );
        }
      })
      .addCase(reviewStudentDocument.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearStudentError } = studentSlice.actions;
export default studentSlice.reducer;
