import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { fetchMyMenuApi } from "../../services/apiServices";
import { logout, logoutAllDevices } from "./authSlice";
import type { MenuItem } from "../../utils/types";

interface MenuState {
  data: MenuItem[];
  loading: boolean;
  loaded: boolean;
  error: string | null;
}

const initialState: MenuState = {
  data: [],
  loading: false,
  loaded: false,
  error: null,
};

// Flattens the nested menu tree so permissions can be looked up by code
export const flattenMenu = (items: MenuItem[]): MenuItem[] => {
  const result: MenuItem[] = [];
  (items || []).forEach((item) => {
    result.push(item);
    if (item.children && item.children.length > 0) {
      result.push(...flattenMenu(item.children));
    }
  });
  return result;
};

// First viewable menu item's path — used for the "/" and post-login redirect
export const firstMenuPath = (items: MenuItem[]): string => {
  const first = flattenMenu(items).find(
    (item) => item.permissions?.view === true && (PATH_ALIASES[item.code ?? ""] || item.path)
  );
  return first ? PATH_ALIASES[first.code ?? ""] || (first.path as string) : "/dashboard";
};

// Temporary: backend module paths that don't match the app routes yet.
// Remove entries once the Module records are updated in the backend.
export const PATH_ALIASES: Record<string, string> = {
  roles_permissions: "/roles",
  reporting_graph: "/reporting",
  module: "/modules",
};

export const resolveMenuPath = (item: MenuItem): string =>
  PATH_ALIASES[item.code ?? ""] || item.path || "";

export const fetchMenu = createAsyncThunk<MenuItem[]>(
  "menu/fetchMenu",
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetchMyMenuApi();
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.message || "Failed to fetch menu");
    }
  },
  {
    condition: (_, { getState }) => {
      const { menu } = getState() as { menu: { loading: boolean } };
      if (menu?.loading) {
        return false; // prevent duplicate in-flight request
      }
      return true;
    },
  }
);

const menuSlice = createSlice({
  name: "menu",
  initialState,
  reducers: {
    clearMenuError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMenu.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMenu.fulfilled, (state, action) => {
        state.loading = false;
        state.loaded = true;
        state.data = action.payload || [];
      })
      .addCase(fetchMenu.rejected, (state, action) => {
        state.loading = false;
        state.loaded = true;
        state.error = action.payload as string;
      })
      // Clear the menu when the session ends so the next user loads fresh
      .addCase(logout, () => initialState)
      .addCase(logoutAllDevices.fulfilled, () => initialState);
  },
});

export const { clearMenuError } = menuSlice.actions;
export default menuSlice.reducer;
