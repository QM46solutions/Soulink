// Live connection to the Soulink server (Socket.IO): new messages, typing, "Seen",
// plus the unread badge on the Messages icon.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { io } from 'socket.io-client';
import { api, forceSignOut, getServer, getToken } from './api';
import { useAuth } from './auth';

const RealtimeContext = createContext(null);

export function RealtimeProvider({ children }) {
  const { user } = useAuth();
  const socketRef = useRef(null);
  const listeners = useRef(new Map()); // event -> Set(handler)
  const [unread, setUnread] = useState({ chats: 0, requests: 0, notifications: 0 });
  const [connected, setConnected] = useState(false);

  const refreshUnread = useCallback(async () => {
    // chats/requests/anon for the Messages badge, notifications for the bell
    try {
      const [c, n] = await Promise.all([api('/conversations/unread'), api('/notifications/unread').catch(() => ({ count: 0 }))]);
      setUnread({ ...c, notifications: n.count || 0 });
    } catch { /* offline */ }
  }, []);

  useEffect(() => {
    if (!user?.onboardingDone) return undefined;
    refreshUnread(); // don't wait for the live connection to show the badge
    // Through the phone link the server sits under /api, so the socket path moves with it
    const server = getServer();
    const viaGateway = server.endsWith('/api');
    const socket = io(viaGateway ? server.slice(0, -4) : server, { path: viaGateway ? '/api/socket.io' : '/socket.io', auth: { token: getToken() }, transports: ['websocket'], reconnectionDelayMax: 5000 });
    socketRef.current = socket;
    socket.on('connect', () => { setConnected(true); refreshUnread(); });
    socket.on('disconnect', () => setConnected(false));
    // the account was deleted on another device, or this session was ended: sign out here too
    socket.on('account:deleted', () => forceSignOut('no_account'));
    socket.on('account:paused', () => forceSignOut('account_paused'));
    socket.on('account:deleting', () => forceSignOut('account_deleting'));
    socket.on('connect_error', (e) => { if (e?.message === 'no_account' || e?.message === 'session_ended') forceSignOut(e.message); });
    for (const event of ['message:new', 'message:deleted', 'message:reactions', 'message:moment', 'message:poll', 'message:vanished', 'conversation:private', 'typing', 'read', 'anon:update', 'notification:new']) {
      socket.on(event, (payload) => {
        listeners.current.get(event)?.forEach((fn) => fn(payload));
        if (event === 'message:new' || event === 'read' || event === 'anon:update' || event === 'notification:new') refreshUnread();
      });
    }
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') refreshUnread(); });
    // safety net: badges stay right even if a live update is missed (weak network, phone link)
    const poll = setInterval(refreshUnread, 20000);
    return () => { clearInterval(poll); sub.remove(); socket.disconnect(); socketRef.current = null; setConnected(false); };
  }, [user?.id, user?.onboardingDone, refreshUnread]);

  /** Subscribe to a live event. Returns an unsubscribe function. */
  const on = useCallback((event, fn) => {
    if (!listeners.current.has(event)) listeners.current.set(event, new Set());
    listeners.current.get(event).add(fn);
    return () => listeners.current.get(event)?.delete(fn);
  }, []);

  const emit = useCallback((event, payload) => socketRef.current?.emit(event, payload), []);

  // Home Screen icon badge = unread chats + notifications (web app; needs notifications allowed on iPhone)
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.setAppBadge) return;
    const n = (unread.chats || 0) + (unread.notifications || 0);
    (n > 0 ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => {});
  }, [unread]);
  const value = useMemo(() => ({ on, emit, unread, refreshUnread, connected }), [on, emit, unread, refreshUnread, connected]);
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export const useRealtime = () => useContext(RealtimeContext);

/** Subscribe to an event for the lifetime of a component. */
export function useLiveEvent(event, handler) {
  const { on } = useRealtime();
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => on(event, (p) => ref.current(p)), [on, event]);
}
