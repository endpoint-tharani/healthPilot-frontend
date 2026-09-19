import { Box, CircularProgress } from '@mui/material';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { Permission } from '@/types/api';
import { PermissionDenied } from '@/components/PermissionDenied';
import { useAuth } from './useAuth';

function FullPageSpinner() {
  return (
    <Box
      sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}
    >
      <CircularProgress />
    </Box>
  );
}

/** Gate for the whole application shell. */
export function RequireAuth() {
  const { user, initialising } = useAuth();
  const location = useLocation();

  if (initialising) {
    return <FullPageSpinner />;
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <Outlet />;
}

/**
 * Per-module gate. This is a UX guard only: it keeps the user out of a page whose
 * every request the backend would reject anyway. Authorization itself stays server-side.
 */
export function RequirePermission({ permissions }: { permissions: Permission[] }) {
  const { canAny } = useAuth();
  if (!canAny(...permissions)) {
    return <PermissionDenied />;
  }
  return <Outlet />;
}

export function RedirectIfAuthenticated({ children }: { children: React.ReactNode }) {
  const { user, initialising } = useAuth();
  if (initialising) {
    return <FullPageSpinner />;
  }
  if (user) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
