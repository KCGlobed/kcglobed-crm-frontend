import { apiRequest } from "./apiRequest";

import { BASE_URL } from "../utils/constants";

import type { LoginCred, LoginResponse } from "../utils/types";

// ----------------Auth service------- //
export const loginApi = async (payload: LoginCred): Promise<LoginResponse> => {
  return await apiRequest("/auth/login/", "POST", payload);
};

export const refreshTokenApi = async (payload: { refresh: string }): Promise<any> => {
  return await apiRequest(`${BASE_URL}/auth/refresh/`, "POST", payload);
};

