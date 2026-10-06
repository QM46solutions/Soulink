// Live connection to the Soulink server (Socket.IO): new messages, typing, "Seen",
// plus the unread badge on the Messages icon.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { io } from 'socket.io-client';
import { api, getServer, getToken } from './api';
import { useAuth } from './auth';

const RealtimeContext = createContext(null);

export function RealtimeProvider({ children }) {
  const { user } = useAuth();
  const socketRef = useRef(null);
  const listeners = useRef(new Map()); // event -> Set(handler)
  const [unread, setUnread] = useState({ chats: 0, requests: 0 });
  const [connected, setConnected] = useState(false);

  const refreshUnread = useCallback(async () => {
    try { setUnread(await api('/conversations/unread')); } catch { /* offline */ }
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
    for (const event of ['message:new', 'message:deleted', 'typing', 'read', 'anon:update']) {
      socket.on(event, (payload) => {
        listeners.current.get(event)?.forEach((fn) => fn(payload));
        if (event === 'message:new' || event === 'read' || event === 'anon:update') refreshUnread();
      });
    }
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') refreshUnread(); });
    return () => { sub.remove(); socket.disconnect(); socketRef.current = null; setConnected(false); };
  }, [user?.id, user?.onboardingDone, refreshUnread]);

  /** Subscribe to a live event. Returns an unsubscribe function. */
  const on = useCallback((event, fn) => {
    if (!listeners.current.has(event)) listeners.current.set(event, new Set());
    listeners.current.get(event).add(fn);
    return () => listeners.current.get(event)?.delete(fn);
  }, []);

  const emit = useCallback((event, payload) => socketRef.current?.emit(event, payload), []);

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
