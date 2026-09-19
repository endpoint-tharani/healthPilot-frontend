import type { AxiosError } from 'axios';
import type { ApiFailureBody } from '@/types/api';

/**
 * One normalised error shape for the whole app. Every backend failure answers
 * `{ success: false, message, errors? }`, so the message the API produced is
 * always preferred over a generic client-side string.
 */
export class ApiError extends Error {
  readonly status: number;
  /** Field-level validation errors, keyed by the request body path. */
  readonly fieldErrors?: Record<string, string[]>;

  constructor(status: number, message: string, fieldErrors?: Record<string, string[]>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }

  get isPermissionDenied(): boolean {
    return this.status === 403;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isConflict(): boolean {
    return this.status === 409;
  }

  get isValidation(): boolean {
    return this.status === 400 || this.status === 422;
  }
}

const STATUS_FALLBACKS: Record<number, string> = {
  400: 'The request could not be processed. Please check the values entered.',
  401: 'Your session has expired. Please sign in again.',
  403: 'You do not have permission to perform this action.',
  404: 'The requested record was not found.',
  409: 'This action conflicts with the current state of the record.',
  422: 'Some values are invalid. Please review the highlighted fields.',
  500: 'Something went wrong on the server. Please try again.',
};

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  const axiosError = error as AxiosError<ApiFailureBody>;
  if (axiosError?.isAxiosError) {
    const status = axiosError.response?.status ?? 0;
    const body = axiosError.response?.data;

    if (!axiosError.response) {
      return new ApiError(
        0,
        'Cannot reach the server. Check that the API is running and try again.'
      );
    }

    return new ApiError(
      status,
      body?.message || STATUS_FALLBACKS[status] || 'Unexpected error',
      body?.errors
    );
  }

  return new ApiError(0, error instanceof Error ? error.message : 'Unexpected error');
}

/** Flattens field errors into one readable line, for form-level alerts. */
export function describeFieldErrors(error: ApiError): string | null {
  if (!error.fieldErrors) {
    return null;
  }
  const parts = Object.entries(error.fieldErrors).map(
    ([field, messages]) => `${field}: ${messages.join(', ')}`
  );
  return parts.length > 0 ? parts.join(' • ') : null;
}
