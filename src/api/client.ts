import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import type { PageMeta, Paginated } from '@/types/api';
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from './tokenStorage';
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
 */
let refreshInFlight: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refreshToken = getRefreshToken();
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

    config._retried = true;

    try {
      if (!refreshInFlight) {
        refreshInFlight = refreshAccessToken().finally(() => {
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
