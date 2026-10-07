// Phone notifications (Web Push: works in Chrome/Android and on iPhone when Soulink is added to the Home Screen).
// Free: no Firebase or paid service. The push keys are created once and kept in the database (app_secrets).
// Each person chooses which kinds of notifications reach their phone (Settings > Notifications).
import { many, one, query } from '../db.js';
import { config } from '../config.js';

/** Kinds of notifications people can switch on/off. Default: all on. */
export const NOTIFY_KINDS = ['messages', 'requests', 'likes', 'comments', 'anonymous', 'argue', 'events'];
export const DEFAULT_PREFS = Object.fromEntries(NOTIFY_KINDS.map((k) => [k, true]));
export const prefsOf = (u) => {
  let p = u?.notify_prefs;
  if (typeof p === 'string') { try { p = JSON.parse(p); } catch { p = null; } }
  return { ...DEFAULT_PREFS, ...(p && typeof p === 'object' ? p : {}) };
};

// notification type -> kind + text (the actor's name goes in front of the text, like on the Notifications screen)
const intent = (k) => ({ friendship: 'Friendship 🤝', dating: 'Dating 💘', situationship: 'Situationship 🌗', buddy: 'Study / Work buddy 📚', networking: 'Networking 💼', vibing: 'Just vibing ✨', unsure: 'Not sure yet 🤔' }[k] || 'a connection');
const TYPES = {
  connect_request: ['requests', (m) => `wants to connect for ${intent(m?.intent)}`],
  connect_accepted: ['requests', (m) => (m?.mutual ? "accepted your request. You're Connections now, say hi!" : 'accepted your request.')],
  connect_back: ['requests', () => "connected back with you. You're Connections now!"],
  connect_rejected: ['requests', () => 'declined your connect request.'],
  connect_held: ['requests', () => 'put your connect request on hold.'],
  connect_hold_extended: ['requests', () => 'extended the hold on your request.'],
  connect_hold_reminder: ['requests', () => ': your hold on their request ends soon.'],
  connect_suspended: ['requests', () => "didn't answer in time. Your request was suspended."],
  follow: ['requests', () => 'connected to you.'],
  follow_request: ['requests', () => 'wants to connect with you.'],
  post_like: ['likes', () => 'gave your post a 👌🏻'],
  post_comment: ['comments', () => 'commented on your post.'],
  post_suspended: ['likes', () => 'Your post was suspended after many reports. Only you can see it now.', true],
  anon_message: ['anonymous', () => 'Someone sent you an anonymous message 👀', true],
  anon_reply: ['anonymous', () => 'replied to your anonymous message.'],
  anon_revealed: ['anonymous', (m) => `was "${m?.alias || 'Anonymous'}". Now you know who wrote to you.`],
  anon_revealed_sender: ['anonymous', (m) => `can now see you were "${m?.alias || 'Anonymous'}".`],
  spark_reaction: ['likes', () => 'reacted to your Spark 🎬'],
  spark_tried: ['likes', (m) => (m?.category === 'fitness' ? 'did your workout 💪' : `tried your recipe${m?.dish ? ` for ${m.dish}` : ''} 😋`)],
  argue_invite: ['argue', (m) => `invited you to settle an argument${m?.topic ? `: "${m.topic}"` : ''}`],
  argue_verdict: ['argue', (m) => `The Referee's verdict is in${m?.topic ? ` for "${m.topic}"` : ''} ⚖️`, true],
};
const LINK = (type, entityId, meta) => {
  if (type === 'connect_request' || type === 'connect_hold_reminder') return '/activity';
  if ((type === 'connect_accepted' || type === 'connect_back') && meta?.conversationId) return `/chat/${meta.conversationId}`;
  if (type.startsWith('post_') && entityId) return `/post/${entityId}`;
  if (type.startsWith('anon_') && entityId) return `/anon/${entityId}`;
  if (type.startsWith('argue_') && meta?.caseId) return `/argue/${meta.caseId}`;
  if (type.startsWith('spark_')) return '/sparks';
  return '/activity';
};

let lib = null; let keys = null;
async function ready() {
  if (config.env === 'test') return null;
  if (!lib) {
    try { lib = (await import('web-push')).default; } catch { return null; } // package not installed yet (run UPDATE-SOULINK.bat)
  }
  if (!keys) {
    const row = await one("SELECT value FROM app_secrets WHERE name=N'vapid'");
    if (row) keys = JSON.parse(row.value);
    else {
      keys = lib.generateVAPIDKeys();
      await query("IF NOT EXISTS (SELECT 1 FROM app_secrets WHERE name=N'vapid') INSERT INTO app_secrets (name, value) VALUES (N'vapid', $1)", [JSON.stringify(keys)]);
      keys = JSON.parse((await one("SELECT value FROM app_secrets WHERE name=N'vapid'")).value); // another server may have won the race
    }
    // Apple rejects a made-up contact (403 BadJwtToken): use the site's real https address
    const subject = process.env.PUSH_SUBJECT || process.env.RENDER_EXTERNAL_URL || 'https://soulink-xvbd.onrender.com';
    lib.setVapidDetails(subject, keys.publicKey, keys.privateKey);
  }
  return lib;
}

export async function publicKey() {
  const l = await ready();
  return l ? keys.publicKey : null;
}

/** Number on the Home Screen icon: unread chats + unread notifications (same as the app's badges). */
async function badgeCount(userId) {
  try {
    const r = await one(
      `SELECT
         (SELECT COUNT(*) FROM conversation_members cm WHERE cm.user_id=$1 AND cm.is_request=0
            AND EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id=cm.conversation_id AND m.kind <> N'system'
                         AND m.sender_id <> $1 AND (cm.last_read_at IS NULL OR m.created_at > cm.last_read_at))) AS chats,
         (SELECT COUNT(*) FROM notifications WHERE user_id=$1 AND read_at IS NULL) AS notes`, [userId]);
    return Number(r?.chats || 0) + Number(r?.notes || 0);
  } catch { return null; }
}

/** Sends one push to every phone the person switched notifications on for (if they allow this kind). Never throws. */
export async function pushTo(userId, kind, { title = 'Soulink', body, url = '/', tag } = {}) {
  try {
    const l = await ready();
    if (!l) return;
    const u = await one('SELECT notify_prefs FROM users WHERE id=$1', [userId]);
    if (!u || !prefsOf(u)[kind]) return;
    const subs = await many('SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id=$1', [userId]);
    if (!subs.length) { console.log(`push skipped: no phone has notifications on for this person [${kind}]`); return; }
    const payload = JSON.stringify({ title, body, url, tag, badge: await badgeCount(userId) });
    await Promise.all(subs.map(async (s) => {
      const where = new URL(s.endpoint).host;
      try {
        const r = await l.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400, urgency: kind === 'messages' ? 'high' : 'normal' });
        console.log(`push ok -> ${where} (${r.statusCode}) [${kind}]`);
      } catch (e) {
        console.warn(`push FAILED -> ${where}: ${e.statusCode || ''} ${String(e.body || e.message).slice(0, 200)}`);
        if (e.statusCode === 404 || e.statusCode === 410) await query('DELETE FROM push_subscriptions WHERE id=$1', [s.id]); // phone unsubscribed
      }
    }));
  } catch (e) { console.warn('push failed:', e.message); }
}

/** Push for an in-app notification (called by notify()). */
export async function pushNotification(userId, actorId, type, entityId, meta) {
  const t = TYPES[type];
  if (!t) return;
  const [kind, text, noActor] = t;
  let name = '';
  if (actorId && !noActor) {
    const a = await one('SELECT username, display_name FROM users WHERE id=$1', [actorId]);
    name = a ? (a.display_name || a.username) : '';
  }
  const line = text(meta);
  await pushTo(userId, kind, { title: name || 'Soulink', body: name && !line.startsWith(':') ? line.charAt(0).toUpperCase() + line.slice(1) : line.replace(/^: /, ''), url: LINK(type, entityId, meta), tag: type });
}
