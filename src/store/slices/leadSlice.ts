import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import {
  fetchLeadsApi,
  fetchLeadByIdApi,
  fetchLeadAssigneesApi,
  createLeadApi,
  deleteLeadApi,
  updateLeadStageApi,
  fetchStageOptionsApi,
} from "../../services/apiServices";
import type { Pagination, PaginationInfo, Lead, Stage, ReportsTo } from "../../utils/types";

// TODO: reassignLead is still stubbed (`await ""`) — the backend exposes the
// assignee options (GET /leads/assignees/) but no re-assign endpoint yet.
// Swap the stub body once it ships. Everything else is wired to the real API.

interface LeadState extends Pagination<Lead> {
  selectedLead: Lead | null;
  selectedLeadLoading: boolean;
  actionLoading: boolean;
  stageOptions: Stage[];
  stageOptionsLoading: boolean;
  assignees: ReportsTo[];
  assigneesLoading: boolean;
}

const initialState: LeadState = {
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
  selectedLead: null,
  selectedLeadLoading: false,
  actionLoading: false,
  stageOptions: [],
  stageOptionsLoading: false,
  assignees: [],
  assigneesLoading: false,
};

export const fetchLeads = createAsyncThunk<
  { data: Lead[]; pagination?: PaginationInfo },
  { page?: number; page_size?: number } | void
>(
  "leads/fetchLeads",
  async (params, { rejectWithValue }) => {
    try {
      const response = await fetchLeadsApi(params || undefined);
      let data: Lead[] = [];
      if (Array.isArray(response?.data)) {
        data = response.data;
      } else if (Array.isArray(response)) {
        data = response;
      } else if (Array.isArray(response?.results)) {
        data = response.results;
      } else if (Array.isArray(response?.data?.results)) {
        data = response.data.results;
      }
      return {
        data,
        pagination: response?.pagination,
      };
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to fetch leads");
    }
  },
  {
    condition: (_, { getState }) => {
      const { leads } = getState() as { leads: { loading: boolean } };
      if (leads?.loading) {
        return false; // prevent duplicate in-flight request
      }
      return true;
    },
  }
);

export const fetchLeadById = createAsyncThunk<Lead, string>(
  "leads/fetchLeadById",
  async (leadUid, { rejectWithValue }) => {
    try {
      const response = await fetchLeadByIdApi(leadUid);
      return response.data ?? response;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to fetch lead details");
    }
  }
);

export const fetchLeadAssignees = createAsyncThunk<ReportsTo[]>(
  "leads/fetchLeadAssignees",
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetchLeadAssigneesApi();
      return response.data || [];
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to fetch assignees");
    }
  },
  {
    condition: (_, { getState }) => {
      const { leads } = getState() as { leads: { assigneesLoading: boolean } };
      if (leads?.assigneesLoading) return false;
      return true;
    },
  }
);

export const createLead = createAsyncThunk<Lead, Lead>(
  "leads/createLead",
  async (payload, { rejectWithValue }) => {
    try {
      const response = await createLeadApi(payload);
      return response.data ?? response;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to create lead");
    }
  }
);

export const deleteLead = createAsyncThunk<string, string>(
  "leads/deleteLead",
  async (leadUid, { rejectWithValue }) => {
    try {
      await deleteLeadApi(leadUid);
      return leadUid;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to delete lead");
    }
  }
);

export const updateLeadStage = createAsyncThunk<
  { uids: string[]; stage: Stage },
  { uids: string[]; stage: Stage; remark?: string }
>(
  "leads/updateLeadStage",
  async ({ uids, stage, remark }, { rejectWithValue }) => {
    try {
      const payload = remark ? { stage: stage.code, remark } : { stage: stage.code };
      await Promise.all(uids.map((uid) => updateLeadStageApi(uid, payload)));
      return { uids, stage };
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to update lead stage");
    }
  }
);

export const fetchStageOptions = createAsyncThunk<Stage[]>(
  "leads/fetchStageOptions",
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetchStageOptionsApi();
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to fetch stage options");
    }
  },
  {
    condition: (_, { getState }) => {
      const { leads } = getState() as { leads: { stageOptionsLoading: boolean } };
      if (leads?.stageOptionsLoading) {
        return false; // prevent duplicate in-flight request
      }
      return true;
    },
  }
);

export const reassignLead = createAsyncThunk<Lead, Lead>(
  "leads/reassignLead",
  async (payload, { getState, rejectWithValue }) => {
    try {
      const response = await "";
      const { leads } = getState() as { leads: LeadState };
      const existing = (leads.data || []).find((l) => l.uid === payload.uid);
      return (
        (response as unknown as Lead) || {
          ...(existing || { uid: payload.uid }),
          assigned_to: payload.assigned_to,
          updated_at: new Date().toISOString(),
        }
      );
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to re-assign lead");
    }
  }
);

const leadSlice = createSlice({
  name: "leads",
  initialState,
  reducers: {
    setSelectedLead: (state, action: PayloadAction<Lead | null>) => {
      state.selectedLead = action.payload;
    },
    clearLeadError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch leads (GET /api/leads/)
      .addCase(fetchLeads.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchLeads.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload?.data || [];
        state.pagination = action.payload?.pagination || initialState.pagination;
      })
      .addCase(fetchLeads.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // Fetch lead by uid (GET /api/leads/{uid}/)
      .addCase(fetchLeadById.pending, (state) => {
        state.selectedLeadLoading = true;
        state.error = null;
      })
      .addCase(fetchLeadById.fulfilled, (state, action) => {
        state.selectedLeadLoading = false;
        state.selectedLead = action.payload;
        if (state.data && state.data.length > 0 && action.payload?.uid) {
          const idx = state.data.findIndex((l) => l.uid === action.payload.uid);
          if (idx !== -1) {
            state.data[idx] = { ...state.data[idx], ...action.payload };
          }
        }
      })
      .addCase(fetchLeadById.rejected, (state, action) => {
        state.selectedLeadLoading = false;
        state.error = action.payload as string;
      })

      // Fetch assignees (GET /api/leads/assignees/)
      .addCase(fetchLeadAssignees.pending, (state) => {
        state.assigneesLoading = true;
      })
      .addCase(fetchLeadAssignees.fulfilled, (state, action) => {
        state.assigneesLoading = false;
        state.assignees = action.payload || [];
      })
      .addCase(fetchLeadAssignees.rejected, (state, action) => {
        state.assigneesLoading = false;
        state.error = action.payload as string;
      })

      // Create lead (POST /api/leads/)
      .addCase(createLead.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(createLead.fulfilled, (state, action) => {
        state.actionLoading = false;
        const newLead = action.payload;
        if (newLead && typeof newLead === "object") {
          state.data = [
            newLead,
            ...(state.data || []).filter((l) => l.uid !== newLead.uid),
          ];
          state.count = state.data?.length ?? 0;
        }
      })
      .addCase(createLead.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload as string;
      })

      // Delete lead (DELETE /api/leads/{uid}/)
      .addCase(deleteLead.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(deleteLead.fulfilled, (state, action) => {
        state.actionLoading = false;
        state.data = (state.data || []).filter((l) => l.uid !== action.payload);
        if (state.selectedLead?.uid === action.payload) {
          state.selectedLead = null;
        }
      })
      .addCase(deleteLead.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload as string;
      })

      .addCase(updateLeadStage.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(updateLeadStage.fulfilled, (state, action) => {
        state.actionLoading = false;
        const { uids, stage } = action.payload;
        state.data = (state.data || []).map((l) =>
          l.uid != null && uids.includes(l.uid)
            ? { ...l, stage, updated_at: new Date().toISOString() }
            : l
        );
        if (state.selectedLead?.uid != null && uids.includes(state.selectedLead.uid)) {
          state.selectedLead = { ...state.selectedLead, stage };
        }
      })
      .addCase(updateLeadStage.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload as string;
      })

      // Fetch stage options (GET /api/leads/stages/options/)
      .addCase(fetchStageOptions.pending, (state) => {
        state.stageOptionsLoading = true;
      })
      .addCase(fetchStageOptions.fulfilled, (state, action) => {
        state.stageOptionsLoading = false;
        state.stageOptions = action.payload || [];
      })
      .addCase(fetchStageOptions.rejected, (state, action) => {
        state.stageOptionsLoading = false;
        state.error = action.payload as string;
      })

      .addCase(reassignLead.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(reassignLead.fulfilled, (state, action) => {
        state.actionLoading = false;
        const idx = (state.data || []).findIndex((l) => l.uid === action.payload.uid);
        if (idx !== -1 && state.data) state.data[idx] = action.payload;
        if (state.selectedLead?.uid === action.payload.uid) state.selectedLead = action.payload;
      })
      .addCase(reassignLead.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { setSelectedLead, clearLeadError } = leadSlice.actions;
export default leadSlice.reducer;
