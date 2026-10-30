import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, clearToken, getToken, setToken } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  const establishSession = useCallback(async (accessToken) => {
    setToken(accessToken);
    const me = await api.me();
    setUser(me);
    return me;
  }, []);

  const login = useCallback(
    async (email, password) => {
      const data = await api.login(email, password);
      if (data.status === 'authenticated') {
        const me = await establishSession(data.access_token);
        return { status: 'authenticated', user: me };
      }
      return { status: data.status, pendingToken: data.pending_token };
    },
    [establishSession],
  );

  const completeTotp = useCallback(
    async (pendingToken, code) => {
      const data = await api.verifyTotp(pendingToken, code);
      return establishSession(data.access_token);
    },
    [establishSession],
  );

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    api
      .me()
      .then(setUser)
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      isAdmin: user?.role === 'admin',
      login,
      completeTotp,
      logout,
    }),
    [user, loading, login, completeTotp, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
