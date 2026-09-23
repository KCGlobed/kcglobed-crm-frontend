import { BASE_URL } from "../utils/constants";
import { getToken } from "../utils/tokenStorage";
import tryRefreshToken from "./tokenService";

// Map tracking concurrent in-flight GET requests to prevent duplicate network calls
const inFlightGetRequests = new Map<string, Promise<any>>();

async function executeRequest<T>(
  url: string,
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
  body?: any,
  retry: boolean = true
): Promise<T> {
  const token = getToken();

  const headers: HeadersInit = {
    ...(token && { Authorization: `Bearer ${token}` }),
  };

  // Set Content-Type only if body is not FormData
  if (!(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(BASE_URL + url, {
    method,
    headers,
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });

  // Token expired: attempt refresh and retry
  if (response.status === 401 && retry) {
    const refreshed = await tryRefreshToken();

    if (refreshed) {
      return executeRequest<T>(url, method, body, false);
    } else {
      console.error("Token refresh failed, please log in again.");
      localStorage.clear();
    }
  }

  if (!response.ok) {
    let errorData: any;
    try {
      errorData = await response.json();
    } catch {
      throw new Error("Unexpected API error");
    }

    const firstDetail: string | undefined =
      errorData?.error?.errors?.[0]?.detail;

    throw new Error(firstDetail || errorData?.detail || errorData?.message || "Something went wrong");
  }

  if (response.status === 204) {
    return {} as T;
  }

  const contentType = response.headers.get("Content-Type");
  if (contentType && contentType.includes("application/json")) {
    return response.json();
  }

  return response as any;
}

export async function apiRequest<T>(
  url: string,
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
  body?: any,
  retry: boolean = true
): Promise<T> {
  // Deduplicate concurrent in-flight GET requests
  if (method === "GET") {
    const existing = inFlightGetRequests.get(url);
    if (existing) {
      return existing as Promise<T>;
    }

    const promise = executeRequest<T>(url, method, body, retry).finally(() => {
      inFlightGetRequests.delete(url);
    });

    inFlightGetRequests.set(url, promise);
    return promise;
  }

  return executeRequest<T>(url, method, body, retry);
}
