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

/**
 * Reads straight from localStorage, bypassing the in-memory cache.
 *
 * The cache exists so the request interceptor does not parse JSON on every call,
 * but it is per-tab and never sees what another tab wrote. The refresh path is
 * the one place that has to observe a rotation performed elsewhere, so it reads
 * through these instead. The cache is refreshed on the way past, so a successful
 * cross-tab rotation also settles this tab's cached copy.
 */
function readFromStorage(): StoredTokens | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      cache = null;
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

export function readAccessTokenFromStorage(): string | null {
  return readFromStorage()?.accessToken ?? null;
}

export function readRefreshTokenFromStorage(): string | null {
  return readFromStorage()?.refreshToken ?? null;
}
