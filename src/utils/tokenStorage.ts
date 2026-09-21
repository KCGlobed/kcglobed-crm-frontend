const AUTH_KEYS = ["token", "refreshToken", "userID"] as const;

export const getToken = () => localStorage.getItem("token");
export const getRefreshToken = () => localStorage.getItem("refreshToken");
export const storeToken = (token: string) => localStorage.setItem("token", token);
export const storeRefreshToken = (token: string) => localStorage.setItem("refreshToken", token);
export const storeUserID = (userID: string) => localStorage.setItem("userID", userID);

/**
 * Clears the session only. Non-auth preferences (e.g. the selected theme)
 * intentionally survive a logout.
 */
export const clearToken = () => {
  AUTH_KEYS.forEach((key) => localStorage.removeItem(key));
};
