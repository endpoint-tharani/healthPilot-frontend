/**
 * The backend returns tokens in the response body (no cookies), so the SPA has to
 * hold them. Only the tokens themselves are kept - never the password, never the
 * decoded claims - and they are read through this module alone.
 */
const STORAGE_KEY = 'healthpilot.auth';

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
}

let cache: StoredTokens | null = null;

export function getTokens(): StoredTokens | null {
  if (cache) {
    return cache;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<StoredTokens>;
    if (!parsed.accessToken || !parsed.refreshToken) {
      return null;
    }
    cache = { accessToken: parsed.accessToken, refreshToken: parsed.refreshToken };
    return cache;
  } catch {
    return null;
  }
}

export function setTokens(tokens: StoredTokens): void {
  cache = tokens;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
  } catch {
    /* storage unavailable: the session still works until the tab is closed */
  }
}

export function clearTokens(): void {
  cache = null;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function getAccessToken(): string | null {
  return getTokens()?.accessToken ?? null;
}

export function getRefreshToken(): string | null {
  return getTokens()?.refreshToken ?? null;
}
