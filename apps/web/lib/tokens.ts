import type { AuthTokens, UserRole } from "./types";

const STORAGE_KEY = "um_tokens";
const COOKIE_MAX_AGE = 7 * 24 * 3600;

export function getTokens(): AuthTokens | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
  } catch {
    return null;
  }
}

export function setTokens(tokens: AuthTokens): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
}

/**
 * Lightweight, non-httpOnly cookies used ONLY by Next middleware for
 * routing decisions. Real authorization is enforced by the API's JWT guards.
 */
export function setSessionCookies(role: UserRole): void {
  document.cookie = `um_auth=1; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
  document.cookie = `um_role=${role}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY);
  document.cookie = "um_auth=; path=/; max-age=0";
  document.cookie = "um_role=; path=/; max-age=0";
}
