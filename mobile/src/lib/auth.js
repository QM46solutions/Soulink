import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, loadSession, setToken, setUnauthorizedHandler } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  const signOut = useCallback(async () => {
    await setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => { signOut(); });
    (async () => {
      const { token } = await loadSession();
      if (token) {
        try {
          const { user: me } = await api('/users/me');
          setUser(me);
        } catch (e) {
          if (e.status === 401) await setToken(null);
          // network errors: stay logged out screen-wise but keep token for retry
        }
      }
      setReady(true);
    })();
  }, [signOut]);

  const signIn = useCallback(async (token, me) => {
    await setToken(token);
    setUser(me);
  }, []);

  const refresh = useCallback(async () => {
    const { user: me } = await api('/users/me');
    setUser(me);
    return me;
  }, []);

  const value = useMemo(() => ({ user, ready, signIn, signOut, refresh, setUser }), [user, ready, signIn, signOut, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
