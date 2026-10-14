import { config } from './config.js';
// Real-time events (Socket.IO). Each signed-in phone joins a room named after its user id,
// so the server can push "new message", "typing" and "seen" to exactly the right people.
import { Server } from 'socket.io';
import { verifyToken } from './lib/auth.js';
import { one, many } from './db.js';
import { checkSession } from './services/sessions.js';

let io = null;

export function initRealtime(httpServer) {
  io = new Server(httpServer, { cors: { origin: config.isDev ? '*' : config.corsOrigins }, path: config.webDir ? '/api/socket.io' : '/socket.io' });

  io.use(async (socket, next) => {
    const t = verifyToken(socket.handshake.auth?.token || '');
    if (!t) return next(new Error('unauthorized'));
    try {
      const u = await one('SELECT TOP 1 id FROM users WHERE id=$1', [t.userId]);
      if (!u) return next(new Error('no_account'));
      if ((await checkSession(t.userId, t.sid)) !== 'ok') return next(new Error('session_ended'));
    } catch { return next(new Error('unavailable')); }
    socket.data.userId = t.userId;
    socket.data.sid = t.sid;
    next();
  });

  io.on('connection', (socket) => {
    const me = socket.data.userId;
    socket.join(`user:${me}`);
    if (socket.data.sid) socket.join(`session:${socket.data.sid}`);

    // "typing…" is relayed to the other members only; nothing is stored.
    socket.on('typing', async (payload = {}) => {
      try {
        const conversationId = String(payload.conversationId || '').toLowerCase();
        if (!/^[0-9a-f-]{36}$/.test(conversationId)) return;
        const member = await one('SELECT TOP 1 1 AS x FROM conversation_members WHERE conversation_id=$1 AND user_id=$2', [conversationId, me]);
        if (!member) return;
        const others = await membersOf(conversationId);
        emitToUsers(others.filter((id) => id !== me), 'typing', { conversationId, userId: me });
      } catch { /* ignore */ }
    });
  });
  return io;
}

async function membersOf(conversationId) {
  const rows = await many('SELECT user_id FROM conversation_members WHERE conversation_id=$1', [conversationId]);
  return rows.map((r) => r.user_id);
}

/** Logout: close this device's live connection. */
export function disconnectSession(sid) {
  if (io && sid) io.in(`session:${sid}`).disconnectSockets(true);
}

/** Account deleted: tell every other device (they show "No user account found") and close their connections. */
export function signOutEverywhere(userId, exceptSid) {
  if (!io) return;
  const room = io.to(`user:${userId}`);
  (exceptSid ? room.except(`session:${exceptSid}`) : room).emit('account:deleted', { message: 'No user account found.' });
  setTimeout(() => io?.in(`user:${userId}`).disconnectSockets(true), 1500).unref?.();
}

/** Push an event to these users' phones (no-op in tests or before the server starts). */
export function emitToUsers(userIds, event, payload) {
  if (!io) return;
  for (const id of new Set(userIds)) io.to(`user:${id}`).emit(event, payload);
}
