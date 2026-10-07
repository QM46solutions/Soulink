// Optimistic on/off settings: the switch moves at once, then the server confirms (or it moves back).
import { useState } from 'react';
import { api } from './api';
import { useAuth } from './auth';

export function useSettingUpdate() {
  const { user, setUser } = useAuth();
  const [error, setError] = useState(null);
  const update = async (patch) => {
    setError(null);
    const prev = user;
    setUser({ ...user, settings: { ...user.settings, ...patch } }); // optimistic
    try { setUser((await api('/users/me', { method: 'PATCH', body: patch })).user); } catch (e) { setUser(prev); setError(e.message); }
  };
  return { user, setUser, update, error, setError };
}
