import type { AuthUser, AuthAccess } from "./types";

const AUTH_KEYS = ["token", "refreshToken", "userID", "user", "access"] as const;

export const getToken = () => localStorage.getItem("token");
export const getRefreshToken = () => localStorage.getItem("refreshToken");
export const getUser = (): AuthUser | null => {
  const user = localStorage.getItem("user");
  return user ? JSON.parse(user) : null;
};
export const getAccess = (): AuthAccess | null => {
  const access = localStorage.getItem("access");
  return access ? JSON.parse(access) : null;
};

export const storeToken = (token: string) => localStorage.setItem("token", token);
export const storeRefreshToken = (token: string) => localStorage.setItem("refreshToken", token);
export const storeUserID = (userID: string) => localStorage.setItem("userID", userID);
export const storeUser = (user: AuthUser) => localStorage.setItem("user", JSON.stringify(user));
export const storeAccess = (access: AuthAccess) => localStorage.setItem("access", JSON.stringify(access));

/**
 * Clears the session only. Non-auth preferences (e.g. the selected theme)
 * intentionally survive a logout.
 */
export const clearToken = () => {
  AUTH_KEYS.forEach((key) => localStorage.removeItem(key));
};
