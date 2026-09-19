import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Alert, Snackbar, Slide, type AlertColor } from '@mui/material';
import { ApiError } from '@/api/errors';

interface ToastMessage {
  key: number;
  severity: AlertColor;
  text: string;
}

export interface ToastApi {
  success: (text: string) => void;
  error: (text: string) => void;
  warning: (text: string) => void;
  info: (text: string) => void;
  /**
   * Shows a failure without leaking transport detail: a known backend message is
   * repeated as written, anything else falls back to the caller's sentence.
   */
  fromError: (error: unknown, fallback: string) => void;
}

const NOOP: ToastApi = {
  success: () => undefined,
  error: () => undefined,
  warning: () => undefined,
  info: () => undefined,
  fromError: () => undefined,
};

const ToastContext = createContext<ToastApi>(NOOP);

export function useToast(): ToastApi {
  return useContext(ToastContext);
}

/**
 * One feedback channel for the whole app, so every module confirms an action the
 * same way. Messages are business sentences - raw API errors are never shown.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<ToastMessage | null>(null);

  const push = useCallback((severity: AlertColor, text: string) => {
    setMessage({ key: Date.now(), severity, text });
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (text) => push('success', text),
      error: (text) => push('error', text),
      warning: (text) => push('warning', text),
      info: (text) => push('info', text),
      fromError: (error, fallback) => {
        const apiError = error instanceof ApiError ? error : null;
        // A 500 or a transport failure carries nothing a user can act on.
        const usable = apiError && apiError.status > 0 && apiError.status < 500;
        push('error', usable ? apiError.message : fallback);
      },
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <Snackbar
        key={message?.key}
        open={Boolean(message)}
        autoHideDuration={message?.severity === 'error' ? 8000 : 4500}
        onClose={(_event, reason) => {
          if (reason !== 'clickaway') {
            setMessage(null);
          }
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        TransitionComponent={Slide}
      >
        <Alert
          severity={message?.severity ?? 'info'}
          variant="filled"
          onClose={() => setMessage(null)}
          sx={{ minWidth: 280, boxShadow: 3 }}
        >
          {message?.text}
        </Alert>
      </Snackbar>
    </ToastContext.Provider>
  );
}
