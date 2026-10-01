import { useMemo } from "react";
import { useAppSelector } from "./useRedux";
import { findMenuItemByPath } from "../store/slices/menuSlice";
import type { MenuPermissions } from "../utils/types";

const NO_ACCESS: Required<MenuPermissions> = {
  view: false,
  add: false,
  change: false,
  delete: false,
  export: false,
};

const FULL_ACCESS: Required<MenuPermissions> = {
  view: true,
  add: true,
  change: true,
  delete: true,
  export: true,
};

/**
 * Permissions for the module behind one screen path (e.g. "/roles"). Super
 * Admin (access.full_access) gets everything; otherwise the menu API item for
 * that path is the source of truth, whatever module code the backend gives it.
 * While the menu hasn't loaded, the login response's access.permissions is the
 * fallback, keyed by the path's own name.
 */
const useModulePermissions = (path: string): Required<MenuPermissions> => {
  const { access } = useAppSelector((state) => state.auth);
  const { data: menuItems, loaded } = useAppSelector((state) => state.menu);

  return useMemo(() => {
    if (access?.full_access) return FULL_ACCESS;

    const menuItem = findMenuItemByPath(menuItems, path);
    if (menuItem?.permissions) {
      return { ...NO_ACCESS, ...menuItem.permissions };
    }

    // Menu not loaded yet (or fetch failed): fall back to the login response
    if (!loaded || menuItems.length === 0) {
      const fallback = access?.permissions?.[path.replace(/^\/+/, "")];
      if (fallback) return { ...NO_ACCESS, ...fallback };
    }

    return NO_ACCESS;
  }, [access, menuItems, loaded, path]);
};

export default useModulePermissions;
