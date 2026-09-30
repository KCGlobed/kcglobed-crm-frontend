import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import {
  fetchTeamsApi,
  fetchTeamByIdApi,
  createTeamApi,
  updateTeamApi,
  updateTeamLeaderApi,
  fetchTeamMembersApi,
  addTeamMembersApi,
  removeTeamMembersApi,
  activateTeamApi,
  deactivateTeamApi,
  deleteTeamApi,
} from "../../services/apiServices";
import type { Pagination, PaginationInfo, Team, User } from "../../utils/types";

interface TeamState extends Pagination<Team> {
  selectedTeam: Team | null;
  selectedTeamLoading: boolean;
  actionLoading: boolean;
  members: User[];
  membersLoading: boolean;
}

const initialState: TeamState = {
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
  selectedTeam: null,
  selectedTeamLoading: false,
  actionLoading: false,
  members: [],
  membersLoading: false,
};

export const fetchTeams = createAsyncThunk<
  { data: Team[]; pagination?: PaginationInfo },
  { page?: number; page_size?: number | string; search?: string; is_active?: boolean | string; department?: number | string; parent?: number | string } | void
>(
  "teams/fetchTeams",
  async (params, { rejectWithValue }) => {
    try {
      const response = await fetchTeamsApi(params || undefined);
      let data: Team[] = [];
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
      return rejectWithValue(err.message || "Failed to fetch teams");
    }
  },
  {
    condition: (_, { getState }) => {
      const { teams } = getState() as { teams: { loading: boolean } };
      if (teams?.loading) {
        return false; // prevent duplicate in-flight request
      }
      return true;
    },
  }
);

export const fetchTeamById = createAsyncThunk<Team, number>(
  "teams/fetchTeamById",
  async (teamId, { rejectWithValue }) => {
    try {
      const response = await fetchTeamByIdApi(teamId);
      return response.data ?? response;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to fetch team details");
    }
  }
);

export const fetchTeamMembers = createAsyncThunk<User[], number>(
  "teams/fetchTeamMembers",
  async (teamId, { rejectWithValue }) => {
    try {
      const response = await fetchTeamMembersApi(teamId, { page_size: 200 });
      return response.data || [];
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to fetch team members");
    }
  }
);

export const createTeam = createAsyncThunk<Team, Team>(
  "teams/createTeam",
  async (payload, { rejectWithValue }) => {
    try {
      const response = await createTeamApi(payload);
      return response.data ?? response;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to create team");
    }
  }
);

export const updateTeam = createAsyncThunk<
  Team,
  { id: number; payload: Team }
>(
  "teams/updateTeam",
  async ({ id, payload }, { rejectWithValue }) => {
    try {
      const response = await updateTeamApi(id, payload);
      return response.data ?? response;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to update team");
    }
  }
);

export const updateTeamLeader = createAsyncThunk<
  Team,
  { id: number; leader: string | null }
>(
  "teams/updateTeamLeader",
  async ({ id, leader }, { rejectWithValue }) => {
    try {
      const response = await updateTeamLeaderApi(id, { leader });
      return response.data ?? response;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to assign team leader");
    }
  }
);

export const addTeamMembers = createAsyncThunk<
  Team,
  { id: number; users: string[] }
>(
  "teams/addTeamMembers",
  async ({ id, users }, { rejectWithValue }) => {
    try {
      const response = await addTeamMembersApi(id, { users });
      return response.data ?? response;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to add team members");
    }
  }
);

export const removeTeamMembers = createAsyncThunk<
  Team,
  { id: number; users: string[] }
>(
  "teams/removeTeamMembers",
  async ({ id, users }, { rejectWithValue }) => {
    try {
      const response = await removeTeamMembersApi(id, { users });
      return response.data ?? response;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to remove team members");
    }
  }
);

export const updateTeamStatus = createAsyncThunk<
  Team,
  { id: number; is_active: boolean }
>(
  "teams/updateTeamStatus",
  async ({ id, is_active }, { rejectWithValue }) => {
    try {
      const response = is_active
        ? await activateTeamApi(id)
        : await deactivateTeamApi(id);
      return response.data ?? { id, is_active };
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to update team status");
    }
  }
);

export const deleteTeam = createAsyncThunk<number, number>(
  "teams/deleteTeam",
  async (teamId, { rejectWithValue }) => {
    try {
      await deleteTeamApi(teamId);
      return teamId;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to delete team");
    }
  }
);

// Shared handler: several mutations return the updated team object
const applyUpdatedTeam = (state: TeamState, updated: Team) => {
  state.actionLoading = false;
  if (updated && updated.id != null) {
    if (state.data && state.data.length > 0) {
      const idx = state.data.findIndex((t) => t.id === updated.id);
      if (idx !== -1) {
        state.data[idx] = { ...state.data[idx], ...updated };
      }
    }
    if (state.selectedTeam?.id === updated.id) {
      state.selectedTeam = { ...state.selectedTeam, ...updated };
    }
  }
};

const teamSlice = createSlice({
  name: "teams",
  initialState,
  reducers: {
    setSelectedTeam: (state, action: PayloadAction<Team | null>) => {
      state.selectedTeam = action.payload;
    },
    clearTeamError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch teams (GET /api/access/teams/)
      .addCase(fetchTeams.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTeams.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload?.data || [];
        state.pagination = action.payload?.pagination || initialState.pagination;
      })
      .addCase(fetchTeams.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // Fetch team by ID (GET /api/access/teams/{id}/)
      .addCase(fetchTeamById.pending, (state) => {
        state.selectedTeamLoading = true;
        state.error = null;
      })
      .addCase(fetchTeamById.fulfilled, (state, action) => {
        state.selectedTeamLoading = false;
        state.selectedTeam = action.payload;
        if (state.data && state.data.length > 0 && action.payload?.id != null) {
          const idx = state.data.findIndex((t) => t.id === action.payload.id);
          if (idx !== -1) {
            state.data[idx] = { ...state.data[idx], ...action.payload };
          }
        }
      })
      .addCase(fetchTeamById.rejected, (state, action) => {
        state.selectedTeamLoading = false;
        state.error = action.payload as string;
      })

      // Fetch team members (GET /api/access/teams/{id}/members/)
      .addCase(fetchTeamMembers.pending, (state) => {
        state.membersLoading = true;
        state.members = [];
      })
      .addCase(fetchTeamMembers.fulfilled, (state, action) => {
        state.membersLoading = false;
        state.members = action.payload || [];
      })
      .addCase(fetchTeamMembers.rejected, (state, action) => {
        state.membersLoading = false;
        state.error = action.payload as string;
      })

      // Create team (POST /api/access/teams/)
      .addCase(createTeam.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(createTeam.fulfilled, (state, action) => {
        state.actionLoading = false;
        const newTeam = action.payload;
        if (newTeam && typeof newTeam === "object") {
          state.data = [
            newTeam,
            ...(state.data || []).filter((t) => t.id !== newTeam.id),
          ];
        }
      })
      .addCase(createTeam.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload as string;
      })

      // Mutations returning the updated team
      .addCase(updateTeam.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(updateTeam.fulfilled, (state, action) => applyUpdatedTeam(state, action.payload))
      .addCase(updateTeam.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload as string;
      })

      .addCase(updateTeamLeader.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(updateTeamLeader.fulfilled, (state, action) => applyUpdatedTeam(state, action.payload))
      .addCase(updateTeamLeader.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload as string;
      })

      .addCase(addTeamMembers.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(addTeamMembers.fulfilled, (state, action) => applyUpdatedTeam(state, action.payload))
      .addCase(addTeamMembers.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload as string;
      })

      .addCase(removeTeamMembers.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(removeTeamMembers.fulfilled, (state, action) => applyUpdatedTeam(state, action.payload))
      .addCase(removeTeamMembers.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload as string;
      })

      .addCase(updateTeamStatus.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(updateTeamStatus.fulfilled, (state, action) => applyUpdatedTeam(state, action.payload))
      .addCase(updateTeamStatus.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload as string;
      })

      // Delete team (DELETE /api/access/teams/{id}/)
      .addCase(deleteTeam.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(deleteTeam.fulfilled, (state, action) => {
        state.actionLoading = false;
        state.data = (state.data || []).filter((t) => t.id !== action.payload);
        if (state.selectedTeam?.id === action.payload) {
          state.selectedTeam = null;
        }
      })
      .addCase(deleteTeam.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { setSelectedTeam, clearTeamError } = teamSlice.actions;
export default teamSlice.reducer;
