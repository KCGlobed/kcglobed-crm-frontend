import { useMemo } from "react";
import { useAppSelector } from "./useRedux";
import { flattenMenu } from "../store/slices/menuSlice";
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
 * Permissions for one module code. Super Admin (access.full_access) gets
 * everything; otherwise the menu API is the source of truth, with the login
 * response's access.permissions as fallback while the menu hasn't loaded.
 */
const useModulePermissions = (code: string): Required<MenuPermissions> => {
  const { access } = useAppSelector((state) => state.auth);
  const { data: menuItems, loaded } = useAppSelector((state) => state.menu);

  return useMemo(() => {
    if (access?.full_access) return FULL_ACCESS;

    const menuItem = flattenMenu(menuItems).find((item) => item.code === code);
    if (menuItem?.permissions) {
      return { ...NO_ACCESS, ...menuItem.permissions };
    }

    // Menu not loaded yet (or fetch failed): fall back to the login response
    if (!loaded || menuItems.length === 0) {
      const fallback = access?.permissions?.[code];
      if (fallback) return { ...NO_ACCESS, ...fallback };
    }

    return NO_ACCESS;
  }, [access, menuItems, loaded, code]);
};

export default useModulePermissions;
