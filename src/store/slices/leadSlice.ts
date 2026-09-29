import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import type { Pagination, Lead } from "../../utils/types";
import { MOCK_LEADS } from "../../utils/mockLeads";

// TODO: No Lead backend endpoints exist yet. Every thunk below is stubbed with
// mock data (same pattern as updateRoleStatus in roleSlice). Once the API is
// ready, add the Lead service group in apiServices.ts and swap the stubs.

interface LeadState extends Pagination<Lead> {
  selectedLead: Lead | null;
  selectedLeadLoading: boolean;
  actionLoading: boolean;
}

const initialState: LeadState = {
  data: [],
  next: null,
  loading: false,
  error: null,
  selectedLead: null,
  selectedLeadLoading: false,
  actionLoading: false,
};

export const fetchLeads = createAsyncThunk<Lead[]>(
  "leads/fetchLeads",
  async (_, { getState, rejectWithValue }) => {
    try {
      const response = await "";
      const { leads } = getState() as { leads: LeadState };
      // Keep in-memory mutations (create/re-assign/stage) across refetches
      return (
        (response as unknown as Lead[]) ||
        (leads.data && leads.data.length > 0 ? leads.data : MOCK_LEADS)
      );
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

export const fetchLeadById = createAsyncThunk<Lead, number>(
  "leads/fetchLeadById",
  async (leadId, { getState, rejectWithValue }) => {
    try {
      const response = await "";
      const { leads } = getState() as { leads: LeadState };
      const existing = (leads.data || []).find((l) => l.id === leadId);
      return (response as unknown as Lead) || existing || { id: leadId };
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to fetch lead details");
    }
  }
);

export const createLead = createAsyncThunk<Lead, Lead>(
  "leads/createLead",
  async (payload, { getState, rejectWithValue }) => {
    try {
      const response = await "";
      const { leads } = getState() as { leads: LeadState };
      const maxId = (leads.data || []).reduce((max, l) => Math.max(max, l.id ?? 0), 0);
      return (
        (response as unknown as Lead) || {
          ...payload,
          id: maxId + 1,
          lead_stage: payload.lead_stage || "Untouched",
          last_activity: "Just now",
          queries: [],
          activities: [
            {
              id: 1,
              action: "Lead Registered",
              description: "Added as a quick lead.",
              created_at: new Date().toISOString(),
            },
          ],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      );
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to create lead");
    }
  }
);

export const updateLeadStage = createAsyncThunk<
  { ids: number[]; lead_stage: string },
  { ids: number[]; lead_stage: string }
>(
  "leads/updateLeadStage",
  async (payload, { rejectWithValue }) => {
    try {
      const response = await "";
      return (response as unknown as { ids: number[]; lead_stage: string }) || payload;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to update lead stage");
    }
  }
);

export const reassignLead = createAsyncThunk<Lead, Lead>(
  "leads/reassignLead",
  async (payload, { getState, rejectWithValue }) => {
    try {
      const response = await "";
      const { leads } = getState() as { leads: LeadState };
      const existing = (leads.data || []).find((l) => l.id === payload.id);
      return (
        (response as unknown as Lead) || {
          ...(existing || { id: payload.id }),
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
      .addCase(fetchLeads.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchLeads.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload || [];
        state.count = state.data.length;
        state.next = null;
      })
      .addCase(fetchLeads.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // Detail
      .addCase(fetchLeadById.pending, (state) => {
        state.selectedLeadLoading = true;
        state.error = null;
      })
      .addCase(fetchLeadById.fulfilled, (state, action) => {
        state.selectedLeadLoading = false;
        state.selectedLead = action.payload;
        if (state.data && state.data.length > 0) {
          const idx = state.data.findIndex((l) => l.id === action.payload.id);
          if (idx !== -1) {
            state.data[idx] = { ...state.data[idx], ...action.payload };
          }
        }
      })
      .addCase(fetchLeadById.rejected, (state, action) => {
        state.selectedLeadLoading = false;
        state.error = action.payload as string;
      })

      .addCase(createLead.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(createLead.fulfilled, (state, action) => {
        state.actionLoading = false;
        state.data = [action.payload, ...(state.data || [])];
        state.count = state.data.length;
      })
      .addCase(createLead.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload as string;
      })

      .addCase(updateLeadStage.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(updateLeadStage.fulfilled, (state, action) => {
        state.actionLoading = false;
        const { ids, lead_stage } = action.payload;
        state.data = (state.data || []).map((l) =>
          l.id != null && ids.includes(l.id)
            ? { ...l, lead_stage, updated_at: new Date().toISOString() }
            : l
        );
        if (state.selectedLead?.id != null && ids.includes(state.selectedLead.id)) {
          state.selectedLead = { ...state.selectedLead, lead_stage };
        }
      })
      .addCase(updateLeadStage.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload as string;
      })

      .addCase(reassignLead.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(reassignLead.fulfilled, (state, action) => {
        state.actionLoading = false;
        const idx = (state.data || []).findIndex((l) => l.id === action.payload.id);
        if (idx !== -1 && state.data) state.data[idx] = action.payload;
        if (state.selectedLead?.id === action.payload.id) state.selectedLead = action.payload;
      })
      .addCase(reassignLead.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { setSelectedLead, clearLeadError } = leadSlice.actions;
export default leadSlice.reducer;
