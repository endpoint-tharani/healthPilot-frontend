import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import type { PageMeta, Paginated } from '@/types/api';
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  readAccessTokenFromStorage,
  readRefreshTokenFromStorage,
  setTokens,
} from './tokenStorage';
import { toApiError } from './errors';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api';

interface RetriableConfig extends InternalAxiosRequestConfig {
  /** Set once a request has already been replayed after a token refresh. */
  _retried?: boolean;
  /** Auth endpoints must never trigger the refresh interceptor. */
  _skipAuthRefresh?: boolean;
}

export const http: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

http.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/** Called when the session cannot be recovered; the auth provider wires this up. */
let onSessionExpired: (() => void) | null = null;

export function setSessionExpiredHandler(handler: () => void): void {
  onSessionExpired = handler;
}

/**
 * A single in-flight refresh shared by every 401 that arrives while it runs, so a
 * page issuing six parallel queries rotates the refresh token exactly once. The
 * promise is cleared in both outcomes, and a request is only ever replayed once
 * (`_retried`), which is what rules out a refresh loop.
 *
 * This only dedupes within one tab. The refresh token lives in localStorage and is
 * therefore shared across tabs, and the backend rotates it on use: a second tab
 * presenting the token the first has already spent trips reuse detection, which
 * revokes the whole session family and signs the user out everywhere. The
 * cross-tab lock below is what keeps two tabs from racing into that.
 */
let refreshInFlight: Promise<string> | null = null;

const REFRESH_LOCK_KEY = 'healthpilot.auth.refreshing';
/** Long enough for a slow round trip, short enough that a crashed tab cannot wedge the lock. */
const REFRESH_LOCK_TTL_MS = 10_000;
const REFRESH_LOCK_POLL_MS = 100;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Claims the cross-tab refresh lock, or reports that another tab holds it. A
 * stale claim (crashed tab, closed mid-refresh) is taken over once its TTL
 * lapses, so the lock can never strand the session.
 *
 * This is last-write-wins rather than a true mutex: two tabs claiming in the same
 * tick can both believe they hold it. That is deliberate - `navigator.locks` is
 * the correct primitive but is unavailable over plain HTTP on a LAN address,
 * which is how this app is served in the pharmacy. The residual window is one
 * event-loop tick against a refresh that takes tens of milliseconds, and the
 * waiter path below still resolves correctly if it is ever hit.
 */
function claimRefreshLock(): boolean {
  try {
    const raw = window.localStorage.getItem(REFRESH_LOCK_KEY);
    if (raw && Date.now() - Number(raw) < REFRESH_LOCK_TTL_MS) {
      return false;
    }
    window.localStorage.setItem(REFRESH_LOCK_KEY, String(Date.now()));
    return true;
  } catch {
    // No storage: fall back to the per-tab dedupe alone rather than blocking.
    return true;
  }
}

function releaseRefreshLock(): void {
  try {
    window.localStorage.removeItem(REFRESH_LOCK_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Waits for the tab holding the lock to publish a rotated token, and returns it.
 * Resolves as soon as the stored access token differs from the one that 401'd -
 * `setTokens` in the winning tab writes both halves at once, so a change here
 * means the rotation completed and this tab's own refresh token is already stale.
 */
async function awaitRefreshFromOtherTab(staleAccessToken: string | null): Promise<string> {
  const deadline = Date.now() + REFRESH_LOCK_TTL_MS;

  while (Date.now() < deadline) {
    await sleep(REFRESH_LOCK_POLL_MS);
    const current = readAccessTokenFromStorage();
    if (current && current !== staleAccessToken) {
      return current;
    }
    // Lock released without a new token: the other tab's refresh failed.
    try {
      if (!window.localStorage.getItem(REFRESH_LOCK_KEY)) {
        break;
      }
    } catch {
      break;
    }
  }

  throw new Error('Refresh by another tab did not complete');
}

async function refreshAccessToken(staleAccessToken: string | null): Promise<string> {
  if (!claimRefreshLock()) {
    return awaitRefreshFromOtherTab(staleAccessToken);
  }

  try {
    // Re-read rather than trusting the token this tab started with: another tab
    // may have rotated between the 401 landing and the lock being taken.
    const refreshToken = readRefreshTokenFromStorage();
    if (!refreshToken) {
      throw new Error('No refresh token');
    }

    const response = await axios.post(
      `${API_BASE_URL}/auth/refresh`,
      { refreshToken },
      { headers: { 'Content-Type': 'application/json' } }
    );

    const data = response.data?.data as { accessToken: string; refreshToken: string };
    setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    return data.accessToken;
  } finally {
    releaseRefreshLock();
  }
}

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined;
    const status = error.response?.status;

    if (status !== 401 || !config || config._retried || config._skipAuthRefresh) {
      return Promise.reject(error);
    }

    if (!getRefreshToken()) {
      clearTokens();
      onSessionExpired?.();
      return Promise.reject(error);
    }

    // Only an expired access token is recoverable. A revoked session, a
    // deactivated account or a forged token cannot be refreshed, and attempting it
    // would spend a good refresh token to earn the same 401.
    const code = (error.response?.data as { code?: string } | undefined)?.code;
    if (code && code !== 'TOKEN_EXPIRED') {
      clearTokens();
      onSessionExpired?.();
      return Promise.reject(error);
    }

    config._retried = true;

    const staleAccessToken = getAccessToken();

    try {
      if (!refreshInFlight) {
        refreshInFlight = refreshAccessToken(staleAccessToken).finally(() => {
          refreshInFlight = null;
        });
      }
      const accessToken = await refreshInFlight;
      config.headers.Authorization = `Bearer ${accessToken}`;
      return http.request(config);
    } catch {
      clearTokens();
      onSessionExpired?.();
      return Promise.reject(error);
    }
  }
);

type RequestOptions = AxiosRequestConfig & { skipAuthRefresh?: boolean };

function withOptions(options?: RequestOptions): AxiosRequestConfig {
  if (!options) {
    return {};
  }
  const { skipAuthRefresh, ...rest } = options;
  return skipAuthRefresh ? ({ ...rest, _skipAuthRefresh: true } as AxiosRequestConfig) : rest;
}

/** Unwraps `{ success, data }` and converts any failure into an ApiError. */
export async function apiGet<T>(url: string, options?: RequestOptions): Promise<T> {
  try {
    const response = await http.get(url, withOptions(options));
    return response.data.data as T;
  } catch (error) {
    throw toApiError(error);
  }
}

/** Unwraps `{ success, data, meta }` for paginated list endpoints. */
export async function apiGetList<T>(url: string, options?: RequestOptions): Promise<Paginated<T>> {
  try {
    const response = await http.get(url, withOptions(options));
    return {
      data: response.data.data as T[],
      meta: response.data.meta as PageMeta,
    };
  } catch (error) {
    throw toApiError(error);
  }
}

export async function apiPost<T>(
  url: string,
  body?: unknown,
  options?: RequestOptions
): Promise<T> {
  try {
    const response = await http.post(url, body ?? {}, withOptions(options));
    return response.data.data as T;
  } catch (error) {
    throw toApiError(error);
  }
}

export async function apiPut<T>(url: string, body?: unknown, options?: RequestOptions): Promise<T> {
  try {
    const response = await http.put(url, body ?? {}, withOptions(options));
    return response.data.data as T;
  } catch (error) {
    throw toApiError(error);
  }
}

export async function apiPatch<T>(
  url: string,
  body?: unknown,
  options?: RequestOptions
): Promise<T> {
  try {
    const response = await http.patch(url, body ?? {}, withOptions(options));
    return response.data.data as T;
  } catch (error) {
    throw toApiError(error);
  }
}

/** Drops empty filter values so they never reach the backend as empty strings. */
export function cleanParams<T extends Record<string, unknown>>(params: T): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }
    result[key] = value;
  }
  return result;
}
