// Real-time events (Socket.IO). Each signed-in phone joins a room named after its user id,
// so the server can push "new message", "typing" and "seen" to exactly the right people.
import { Server } from 'socket.io';
import { verifyToken } from './lib/auth.js';
import { one, many } from './db.js';

let io = null;

export function initRealtime(httpServer) {
  io = new Server(httpServer, { cors: { origin: '*' } });

  io.use((socket, next) => {
    const userId = verifyToken(socket.handshake.auth?.token || '');
    if (!userId) return next(new Error('unauthorized'));
    socket.data.userId = userId;
    next();
  });

  io.on('connection', (socket) => {
    const me = socket.data.userId;
    socket.join(`user:${me}`);

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

/** Push an event to these users' phones (no-op in tests or before the server starts). */
export function emitToUsers(userIds, event, payload) {
  if (!io) return;
  for (const id of new Set(userIds)) io.to(`user:${id}`).emit(event, payload);
}
