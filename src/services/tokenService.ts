import { BASE_URL } from "../utils/constants";
import { clearToken, getRefreshToken, storeToken } from "../utils/tokenStorage";

const tryRefreshToken = async (): Promise<boolean> => {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  try {
    const response = await fetch(`${BASE_URL}api/auth/refresh/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    if (!response.ok) {
      clearToken();
      window.location.replace("/login");
      return false;
    }

    const data = await response.json();
    if (data?.access) {
      storeToken(data.access);
      return true;
    } else {
      clearToken();
      window.location.replace("/login");
      return false;
    }
  } catch (error) {
    console.error("Token refresh error:", error);
    clearToken();
    window.location.replace("/login");
    return false;
  }
};

export default tryRefreshToken;
