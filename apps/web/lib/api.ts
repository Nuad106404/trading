import { clearSession, getTokens, setTokens } from "./tokens";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

interface ApiOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  /** attach the access token (default true) */
  auth?: boolean;
}

// single-flight refresh: many parallel 401s share one refresh call
let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const tokens = getTokens();
      if (!tokens?.refreshToken) return false;
      try {
        const res = await fetch(`${API_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: tokens.refreshToken }),
        });
        if (!res.ok) return false;
        const data = await res.json();
        setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
        return true;
      } catch {
        return false;
      }
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export async function api<T = unknown>(path: string, options: ApiOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true } = options;

  const doFetch = () => {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (auth) {
      const tokens = getTokens();
      if (tokens?.accessToken) headers.Authorization = `Bearer ${tokens.accessToken}`;
    }
    return fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  let res = await doFetch();

  if (res.status === 401 && auth) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      res = await doFetch();
    } else {
      clearSession();
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
  }

  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    const message = Array.isArray(payload?.message)
      ? payload.message.join(", ")
      : (payload?.message ?? res.statusText);
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
