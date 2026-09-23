import { useEffect } from "react";
import { useAppDispatch } from "./useAppDispatch";
import { useAppSelector } from "./useRedux";
import {
  THEME_STORAGE_KEY,
  applyThemeToDocument,
  setTheme,
  toggleTheme,
} from "../store/slices/themeSlice";
import type { ThemeMode } from "../utils/types";

/**
 * Single source of truth for the active colour scheme.
 * Keeps the `.dark` class on <html> and localStorage in sync with the store.
 */
export const useTheme = () => {
  const mode = useAppSelector((state) => state.theme.mode);
  const dispatch = useAppDispatch();

  useEffect(() => {
    applyThemeToDocument(mode);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      // Storage can be unavailable (private mode) - the in-memory theme still works.
    }
  }, [mode]);

  return {
    mode,
    isDark: mode === "dark",
    toggle: () => dispatch(toggleTheme()),
    setMode: (next: ThemeMode) => dispatch(setTheme(next)),
  };
};

export default useTheme;
