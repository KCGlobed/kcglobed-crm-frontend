import { useEffect } from "react";
import { flushSync } from "react-dom";
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
 * Uses the View Transitions API when available for a unified, seamless cross-fade across the entire page.
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

  const toggle = () => {
    if (typeof document !== "undefined" && "startViewTransition" in document) {
      (document as any).startViewTransition(() => {
        flushSync(() => {
          dispatch(toggleTheme());
        });
      });
    } else {
      dispatch(toggleTheme());
    }
  };

  const changeMode = (next: ThemeMode) => {
    if (typeof document !== "undefined" && "startViewTransition" in document) {
      (document as any).startViewTransition(() => {
        flushSync(() => {
          dispatch(setTheme(next));
        });
      });
    } else {
      dispatch(setTheme(next));
    }
  };

  return {
    mode,
    isDark: mode === "dark",
    toggle,
    setMode: changeMode,
  };
};

export default useTheme;

