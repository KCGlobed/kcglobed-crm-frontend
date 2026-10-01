import { createSlice, createAsyncThunk, isAnyOf, type PayloadAction } from "@reduxjs/toolkit";
import {
  fetchLeadsApi,
  fetchLeadByIdApi,
  fetchLeadAssigneesApi,
  createLeadApi,
  deleteLeadApi,
  updateLeadStageApi,
  fetchStageOptionsApi,
  fetchLeadWorkflowApi,
  assignLeadApi,
  autoAssignLeadApi,
  fetchLeadAssignmentsApi,
  startLeadCallApi,
  recordLeadCallApi,
  fetchLeadCallsApi,
  createLeadFollowUpApi,
  markLeadInterestedApi,
  fetchLeadActivitiesApi,
  fetchLeadProfileApi,
  updateLeadProfileApi,
  completeLeadProfileApi,
  sendDocumentEmailApi,
  fetchLeadDocumentsApi,
  approveLeadProfileApi,
  fetchLeadLettersApi,
  generateLeadLettersApi,
  fetchLeadPaymentApi,
  initiateLeadPaymentApi,
  verifyLeadPaymentApi,
  recordOfflinePaymentApi,
} from "../../services/apiServices";
import type {
  Pagination,
  PaginationInfo,
  Lead,
  Stage,
  ReportsTo,
  Workflow,
  LeadActivity,
  CallLog,
  LeadAssignment,
  Student,
  StudentDocument,
  Letter,
  Payment,
} from "../../utils/types";

interface LeadState extends Pagination<Lead> {
  selectedLead: Lead | null;
  selectedLeadLoading: boolean;
  actionLoading: boolean;
  stageOptions: Stage[];
  stageOptionsLoading: boolean;
  assignees: ReportsTo[];
  assigneesLoading: boolean;
  workflow: Workflow | null;
  workflowLoading: boolean;
  activities: LeadActivity[];
  activitiesLoading: boolean;
  calls: CallLog[];
  callsLoading: boolean;
  assignments: LeadAssignment[];
  assignmentsLoading: boolean;
  profile: {
    application?: Student | null;
    missing_fields?: string[];
    documents?: StudentDocument[];
    approval_problems?: Record<string, string[]>;
  } | null;
  profileLoading: boolean;
  documents: StudentDocument[];
  documentsProblems: Record<string, string[]> | null;
  documentsLoading: boolean;
  letters: Letter[];
  lettersLoading: boolean;
  leadPayment: {
    amount?: string | number;
    currency?: string;
    settled?: boolean;
    payments?: Payment[];
  } | null;
  leadPaymentLoading: boolean;
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
  workflow: null,
  workflowLoading: false,
  activities: [],
  activitiesLoading: false,
  calls: [],
  callsLoading: false,
  assignments: [],
  assignmentsLoading: false,
  profile: null,
  profileLoading: false,
  documents: [],
  documentsProblems: null,
  documentsLoading: false,
  letters: [],
  lettersLoading: false,
  leadPayment: null,
  leadPaymentLoading: false,
};

export const fetchLeads = createAsyncThunk<
  { data: Lead[]; pagination?: PaginationInfo },
  { page?: number; page_size?: number; search?: string; stage?: string; assigned_to?: string; unassigned?: boolean | string; program?: string; source?: string; created_from?: string; created_to?: string; follow_up_from?: string; follow_up_to?: string; ordering?: string } | void
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

export const fetchLeadWorkflow = createAsyncThunk<Workflow>(
  "leads/fetchLeadWorkflow",
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetchLeadWorkflowApi();
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to fetch workflow options");
    }
  },
  {
    condition: (_, { getState }) => {
      const { leads } = getState() as { leads: { workflowLoading: boolean } };
      if (leads?.workflowLoading) return false;
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

// ---- Lead flow actions (each returns the refreshed lead detail, or {..., lead}) ----

export const assignLead = createAsyncThunk<any, { uid: string; assigned_to: string | null; note?: string }>(
  "leads/assignLead",
  async ({ uid, assigned_to, note }, { rejectWithValue }) => {
    try {
      const response = await assignLeadApi(uid, note ? { assigned_to, note } : { assigned_to });
      return response.data ?? response;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to assign lead");
    }
  }
);

export const autoAssignLead = createAsyncThunk<any, string>(
  "leads/autoAssignLead",
  async (leadUid, { rejectWithValue }) => {
    try {
      const response = await autoAssignLeadApi(leadUid);
      return response.data ?? response;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to auto-assign lead");
    }
  }
);

export const startLeadCall = createAsyncThunk<any, string>(
  "leads/startLeadCall",
  async (leadUid, { rejectWithValue }) => {
    try {
      const response = await startLeadCallApi(leadUid);
      return response.data ?? response;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to start call");
    }
  }
);

export const recordCallOutcome = createAsyncThunk<any, { uid: string; payload: any }>(
  "leads/recordCallOutcome",
  async ({ uid, payload }, { rejectWithValue }) => {
    try {
      const response = await recordLeadCallApi(uid, payload);
      return response.data ?? response;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to record call outcome");
    }
  }
);

export const markLeadInterested = createAsyncThunk<any, { uid: string; notes?: string }>(
  "leads/markLeadInterested",
  async ({ uid, notes }, { rejectWithValue }) => {
    try {
      const response = await markLeadInterestedApi(uid, notes ? { notes } : {});
      return response.data ?? response;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to mark lead interested");
    }
  }
);

export const createLeadFollowUp = createAsyncThunk<any, { uid: string; payload: any }>(
  "leads/createLeadFollowUp",
  async ({ uid, payload }, { rejectWithValue }) => {
    try {
      const response = await createLeadFollowUpApi(uid, payload);
      return response.data ?? response;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to create follow-up");
    }
  }
);

export const updateLeadProfile = createAsyncThunk<any, { uid: string; payload: any }>(
  "leads/updateLeadProfile",
  async ({ uid, payload }, { rejectWithValue }) => {
    try {
      const response = await updateLeadProfileApi(uid, payload);
      return response.data ?? response;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to update profile");
    }
  }
);

export const completeLeadProfile = createAsyncThunk<any, string>(
  "leads/completeLeadProfile",
  async (leadUid, { rejectWithValue }) => {
    try {
      const response = await completeLeadProfileApi(leadUid);
      return response.data ?? response;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to complete profile");
    }
  }
);

export const sendDocumentEmail = createAsyncThunk<any, string>(
  "leads/sendDocumentEmail",
  async (leadUid, { rejectWithValue }) => {
    try {
      const response = await sendDocumentEmailApi(leadUid);
      return response.data ?? response;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to send document email");
    }
  }
);

export const approveLeadProfile = createAsyncThunk<any, string>(
  "leads/approveLeadProfile",
  async (leadUid, { rejectWithValue }) => {
    try {
      const response = await approveLeadProfileApi(leadUid);
      return response.data ?? response;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to approve profile");
    }
  }
);

export const generateLeadLetters = createAsyncThunk<any, string>(
  "leads/generateLeadLetters",
  async (leadUid, { rejectWithValue }) => {
    try {
      const response = await generateLeadLettersApi(leadUid);
      return response.data ?? response;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to generate letters");
    }
  }
);

export const initiateLeadPayment = createAsyncThunk<any, string>(
  "leads/initiateLeadPayment",
  async (leadUid, { rejectWithValue }) => {
    try {
      const response = await initiateLeadPaymentApi(leadUid);
      return response.data ?? response;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to initiate payment");
    }
  }
);

export const verifyLeadPayment = createAsyncThunk<any, { uid: string; payload: any }>(
  "leads/verifyLeadPayment",
  async ({ uid, payload }, { rejectWithValue }) => {
    try {
      const response = await verifyLeadPaymentApi(uid, payload);
      return response.data ?? response;
    } catch (err: any) {
      return rejectWithValue(err.message || "Payment failed. Please try again.");
    }
  }
);

export const recordOfflinePayment = createAsyncThunk<any, { uid: string; formData: FormData }>(
  "leads/recordOfflinePayment",
  async ({ uid, formData }, { rejectWithValue }) => {
    try {
      const response = await recordOfflinePaymentApi(uid, formData);
      return response.data ?? response;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to record offline payment");
    }
  }
);

// ---- Lead detail sub-resources ----

export const fetchLeadActivities = createAsyncThunk<LeadActivity[], string>(
  "leads/fetchLeadActivities",
  async (leadUid, { rejectWithValue }) => {
    try {
      const response = await fetchLeadActivitiesApi(leadUid);
      return response.data || [];
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to fetch lead timeline");
    }
  }
);

export const fetchLeadCalls = createAsyncThunk<CallLog[], string>(
  "leads/fetchLeadCalls",
  async (leadUid, { rejectWithValue }) => {
    try {
      const response = await fetchLeadCallsApi(leadUid);
      return response.data || [];
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to fetch call history");
    }
  }
);

export const fetchLeadAssignments = createAsyncThunk<LeadAssignment[], string>(
  "leads/fetchLeadAssignments",
  async (leadUid, { rejectWithValue }) => {
    try {
      const response = await fetchLeadAssignmentsApi(leadUid);
      return response.data || [];
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to fetch assignment history");
    }
  }
);

export const fetchLeadProfile = createAsyncThunk<any, string>(
  "leads/fetchLeadProfile",
  async (leadUid, { rejectWithValue }) => {
    try {
      const response = await fetchLeadProfileApi(leadUid);
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to fetch student profile");
    }
  }
);

export const fetchLeadDocuments = createAsyncThunk<any, string>(
  "leads/fetchLeadDocuments",
  async (leadUid, { rejectWithValue }) => {
    try {
      const response = await fetchLeadDocumentsApi(leadUid);
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to fetch documents");
    }
  }
);

export const fetchLeadLetters = createAsyncThunk<Letter[], string>(
  "leads/fetchLeadLetters",
  async (leadUid, { rejectWithValue }) => {
    try {
      const response = await fetchLeadLettersApi(leadUid);
      // Response data is {letters: [...]} (with ?history=true it also carries history)
      return response.data?.letters ?? response.data ?? [];
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to fetch letters");
    }
  }
);

export const fetchLeadPayment = createAsyncThunk<any, string>(
  "leads/fetchLeadPayment",
  async (leadUid, { rejectWithValue }) => {
    try {
      const response = await fetchLeadPaymentApi(leadUid);
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to fetch payment info");
    }
  }
);

// Extracts the refreshed lead detail from a flow-action response
const extractLead = (payload: any): Lead | null => {
  if (payload?.lead?.uid) return payload.lead;
  if (payload?.uid && payload?.stage) return payload;
  return null;
};

const applyLeadDetail = (state: LeadState, lead: Lead | null) => {
  if (!lead?.uid) return;
  state.selectedLead = { ...(state.selectedLead || {}), ...lead };
  if (state.data && state.data.length > 0) {
    const idx = state.data.findIndex((l) => l.uid === lead.uid);
    if (idx !== -1) {
      state.data[idx] = { ...state.data[idx], ...lead };
    }
  }
};

const flowActionThunks = [
  assignLead,
  autoAssignLead,
  startLeadCall,
  recordCallOutcome,
  markLeadInterested,
  createLeadFollowUp,
  updateLeadProfile,
  completeLeadProfile,
  sendDocumentEmail,
  approveLeadProfile,
  generateLeadLetters,
  initiateLeadPayment,
  verifyLeadPayment,
  recordOfflinePayment,
];

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
    // Reset per-lead sub-resources when opening a different lead's detail view
    clearLeadDetail: (state) => {
      state.activities = [];
      state.calls = [];
      state.assignments = [];
      state.profile = null;
      state.documents = [];
      state.documentsProblems = null;
      state.letters = [];
      state.leadPayment = null;
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

      // Workflow options (GET /api/leads/workflow/)
      .addCase(fetchLeadWorkflow.pending, (state) => {
        state.workflowLoading = true;
      })
      .addCase(fetchLeadWorkflow.fulfilled, (state, action) => {
        state.workflowLoading = false;
        state.workflow = action.payload || null;
      })
      .addCase(fetchLeadWorkflow.rejected, (state, action) => {
        state.workflowLoading = false;
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

      // Lead timeline (GET /api/leads/{uid}/activities/)
      .addCase(fetchLeadActivities.pending, (state) => {
        state.activitiesLoading = true;
      })
      .addCase(fetchLeadActivities.fulfilled, (state, action) => {
        state.activitiesLoading = false;
        state.activities = action.payload || [];
      })
      .addCase(fetchLeadActivities.rejected, (state, action) => {
        state.activitiesLoading = false;
        state.error = action.payload as string;
      })

      // Call history (GET /api/leads/{uid}/call/)
      .addCase(fetchLeadCalls.pending, (state) => {
        state.callsLoading = true;
      })
      .addCase(fetchLeadCalls.fulfilled, (state, action) => {
        state.callsLoading = false;
        state.calls = action.payload || [];
      })
      .addCase(fetchLeadCalls.rejected, (state, action) => {
        state.callsLoading = false;
        state.error = action.payload as string;
      })

      // Assignment history (GET /api/leads/{uid}/assignments/)
      .addCase(fetchLeadAssignments.pending, (state) => {
        state.assignmentsLoading = true;
      })
      .addCase(fetchLeadAssignments.fulfilled, (state, action) => {
        state.assignmentsLoading = false;
        state.assignments = action.payload || [];
      })
      .addCase(fetchLeadAssignments.rejected, (state, action) => {
        state.assignmentsLoading = false;
        state.error = action.payload as string;
      })

      // Student profile (GET /api/leads/{uid}/profile/)
      .addCase(fetchLeadProfile.pending, (state) => {
        state.profileLoading = true;
      })
      .addCase(fetchLeadProfile.fulfilled, (state, action) => {
        state.profileLoading = false;
        state.profile = action.payload || null;
      })
      .addCase(fetchLeadProfile.rejected, (state, action) => {
        state.profileLoading = false;
        state.error = action.payload as string;
      })

      // Documents checklist (GET /api/leads/{uid}/documents/)
      .addCase(fetchLeadDocuments.pending, (state) => {
        state.documentsLoading = true;
      })
      .addCase(fetchLeadDocuments.fulfilled, (state, action) => {
        state.documentsLoading = false;
        state.documents = action.payload?.documents || [];
        state.documentsProblems = action.payload?.approval_problems || null;
      })
      .addCase(fetchLeadDocuments.rejected, (state, action) => {
        state.documentsLoading = false;
        state.error = action.payload as string;
      })

      // Letters (GET /api/leads/{uid}/letters/)
      .addCase(fetchLeadLetters.pending, (state) => {
        state.lettersLoading = true;
      })
      .addCase(fetchLeadLetters.fulfilled, (state, action) => {
        state.lettersLoading = false;
        state.letters = action.payload || [];
      })
      .addCase(fetchLeadLetters.rejected, (state, action) => {
        state.lettersLoading = false;
        state.error = action.payload as string;
      })

      // Lead payment info (GET /api/leads/{uid}/payment/)
      .addCase(fetchLeadPayment.pending, (state) => {
        state.leadPaymentLoading = true;
      })
      .addCase(fetchLeadPayment.fulfilled, (state, action) => {
        state.leadPaymentLoading = false;
        state.leadPayment = action.payload || null;
      })
      .addCase(fetchLeadPayment.rejected, (state, action) => {
        state.leadPaymentLoading = false;
        state.error = action.payload as string;
      })

      // Lead flow actions: shared actionLoading + refreshed lead detail
      .addMatcher(isAnyOf(...flowActionThunks.map((t) => t.pending)), (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addMatcher(isAnyOf(...flowActionThunks.map((t) => t.fulfilled)), (state, action) => {
        state.actionLoading = false;
        applyLeadDetail(state, extractLead(action.payload));
      })
      .addMatcher(isAnyOf(...flowActionThunks.map((t) => t.rejected)), (state, action) => {
        state.actionLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { setSelectedLead, clearLeadError, clearLeadDetail } = leadSlice.actions;
export default leadSlice.reducer;
