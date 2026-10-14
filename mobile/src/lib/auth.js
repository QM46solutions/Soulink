import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, loadSession, setToken, setUnauthorizedHandler } from './api';
import { notice } from './confirm';
import { disablePush, resyncPush } from './push';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  // Log out ends this device's session on the server too (other devices stay logged in).
  // { remote: false } = the server already ended it (account deleted, session ended).
  const signOut = useCallback(async (opts) => {
    const remote = opts?.remote !== false;
    if (remote && getToken()) await api('/auth/logout', { method: 'POST', timeoutMs: 6000 }).catch(() => {});
    await disablePush(); // this phone stops getting this account's notifications
    await setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    let shown = false;
    setUnauthorizedHandler(async (code) => {
      if (!getToken()) return;
      await signOut({ remote: false });
      if (shown) return;
      if (code === 'no_account') { shown = true; notice('No user account found', 'This Soulink account was deleted, so you have been logged out on this device.'); }
      else if (code === 'session_ended') { shown = true; notice('You were logged out', 'Log in again to continue.'); }
      else if (code === 'account_paused') { shown = true; notice('Account paused', 'This account is paused. Log in again to reactivate it.'); }
      else if (code === 'account_deleting') { shown = true; notice('Account scheduled for deletion', 'Your account will be deleted in 30 days. Log in before then to cancel.'); }
      setTimeout(() => { shown = false; }, 3000);
    });
    (async () => {
      const { token } = await loadSession();
      if (token) {
        try {
          const { user: me } = await api('/users/me');
          setUser(me);
          resyncPush(); // notifications switched on earlier: make sure the server still has this phone
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
