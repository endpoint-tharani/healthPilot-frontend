import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { createAppTheme, type ColorMode } from './theme';

const STORAGE_KEY = 'healthpilot.colorMode';

interface ColorModeState {
  mode: ColorMode;
  toggle: () => void;
}

const ColorModeContext = createContext<ColorModeState>({ mode: 'light', toggle: () => undefined });

export function useColorMode(): ColorModeState {
  return useContext(ColorModeContext);
}

function readStoredMode(): ColorMode {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

/** Light/dark switch for the whole shell; the choice is remembered per browser. */
export function ColorModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ColorMode>(readStoredMode);

  const toggle = useCallback(() => {
    setMode((current) => {
      const next: ColorMode = current === 'light' ? 'dark' : 'light';
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* storage unavailable: the choice simply does not persist */
      }
      return next;
    });
  }, []);

  const theme = useMemo(() => createAppTheme(mode), [mode]);
  const value = useMemo(() => ({ mode, toggle }), [mode, toggle]);

  return (
    <ColorModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}
