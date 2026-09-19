import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/api/endpoints';
import { setSessionExpiredHandler } from '@/api/client';
import { clearTokens, getRefreshToken, getTokens, setTokens } from '@/api/tokenStorage';
import type { CurrentUser, Permission, SignupRequest } from '@/types/api';

export interface AuthState {
  user: CurrentUser | null;
  /** True until the stored session has been validated against /auth/me. */
  initialising: boolean;
  login: (email: string, password: string) => Promise<void>;
  /** Creates a company, its branches and the founding admin, then starts that session. */
  signup: (payload: SignupRequest) => Promise<void>;
  logout: (allSessions?: boolean) => Promise<void>;
  /** UX only - the backend re-checks every permission on every request. */
  can: (...permissions: Permission[]) => boolean;
  canAny: (...permissions: Permission[]) => boolean;
  hasAllBranches: boolean;
  allowedBranchIds: string[] | null;
}

export const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [initialising, setInitialising] = useState(true);
  const queryClient = useQueryClient();

  const endSession = useCallback(() => {
    clearTokens();
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  // The axios interceptor calls this when a refresh attempt has failed for good.
  useEffect(() => {
    setSessionExpiredHandler(endSession);
  }, [endSession]);

  /**
   * A stored token is only trusted once /auth/me confirms it: the backend rebuilds
   * the identity from the database, so a deactivated user or a revoked session is
   * rejected here rather than after the first protected page renders.
   */
  useEffect(() => {
    let cancelled = false;

    async function restore() {
      if (!getTokens()) {
        setInitialising(false);
        return;
      }
      try {
        const me = await authApi.me();
        if (!cancelled) {
          setUser(me);
        }
      } catch {
        if (!cancelled) {
          endSession();
        }
      } finally {
        if (!cancelled) {
          setInitialising(false);
        }
      }
    }

    void restore();
    return () => {
      cancelled = true;
    };
  }, [endSession]);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await authApi.login(email, password);
      setTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });
      // /auth/me carries the branch scope and permission list that login omits.
      const me = await authApi.me();
      setUser(me);
    },
    []
  );

  /**
   * Signup returns the same token pair as login, so the new admin lands in the
   * workspace without a second round trip through the sign-in form.
   */
  const signup = useCallback(async (payload: SignupRequest) => {
    const result = await authApi.signup(payload);
    setTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });
    const me = await authApi.me();
    setUser(me);
  }, []);

  const logout = useCallback(
    async (allSessions = false) => {
      const refreshToken = getRefreshToken();
      try {
        if (allSessions) {
          await authApi.logoutAll();
        } else if (refreshToken) {
          await authApi.logout(refreshToken);
        }
      } catch {
        // A failed revoke must never trap the user in the app.
      } finally {
        endSession();
      }
    },
    [endSession]
  );

  const value = useMemo<AuthState>(() => {
    const permissions = new Set(user?.permissions ?? []);
    return {
      user,
      initialising,
      login,
      signup,
      logout,
      can: (...required: Permission[]) => required.every((p) => permissions.has(p)),
      canAny: (...required: Permission[]) => required.some((p) => permissions.has(p)),
      hasAllBranches: user?.scopeType === 'ALL_BRANCHES',
      allowedBranchIds: user?.allowedBranchIds ?? null,
    };
  }, [user, initialising, login, signup, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
