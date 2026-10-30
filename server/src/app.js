import express from 'express';
import { isDbReady, markActivity, waitDbReady } from './activity.js';
import { query } from './db.js';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ensureLocal } from './providers/storage.js';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { clientKey } from './lib/clientKey.js';
import { config } from './config.js';
import { errorHandler, notFound } from './lib/errors.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import searchRoutes from './routes/search.js';
import safetyRoutes from './routes/safety.js';
import notificationRoutes from './routes/notifications.js';
import conversationRoutes from './routes/conversations.js';
import faceRoutes from './routes/face.js';
import soulRoutes from './routes/soul.js';
import musicRoutes from './routes/music.js';
import adRoutes from './routes/ads.js';
import shareRoutes from './routes/share.js';
import { checkSigned, signDeep, stripDeep } from './lib/fileLinks.js';
import placesRoutes from './routes/places.js';
import feedRoutes from './routes/feed.js';
import devRoutes from './routes/dev.js';
import connectionRoutes from './routes/connections.js';
import argueRoutes from './routes/argue.js';
import discoverRoutes from './routes/discover.js';
import postRoutes from './routes/posts.js';
import soulmojiRoutes from './routes/soulmoji.js';
import anonRoutes from './routes/anon.js';
import pushRoutes from './routes/push.js';
import accountRoutes from './routes/account.js';
import momentRoutes from './routes/moments.js';
import sparkRoutes from './routes/sparks.js';
import adminRoutes from './routes/admin.js';
import copyrightRoutes from './routes/copyright.js';
import { securityLog, clientIp } from './lib/log.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  // Cloud hosting: one address serves the web app (/...) and the API (/api/...)
  const web = !!config.webDir && fs.existsSync(path.join(config.webDir, 'index.html'));
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, ...(web ? { contentSecurityPolicy: false, crossOriginEmbedderPolicy: false } : {}) }));
  if (web) {
    const site = express.Router();
    site.use(express.static(config.webDir, { maxAge: '1h', setHeaders: (res, file) => { if (file.endsWith('.html') || file.endsWith('sw.js') || file.endsWith('manifest.json')) res.setHeader('Cache-Control', 'no-cache'); } }));
    site.get(/.*/, (req, res) => res.setHeader('Cache-Control', 'no-cache').sendFile(path.join(config.webDir, 'index.html')));
    app.use((req, res, next) => {
      if (req.url === '/api' || req.url.startsWith('/api/') || req.url.startsWith('/api?')) {
        req.url = req.url.slice(4) || '/';
        if (!req.url.startsWith('/')) req.url = `/${req.url}`;
        return next();
      }
      return site(req, res, next);
    });
  }
  // Browsers may call the API only from Soulink's own address or the CORS_ORIGINS list (policy section 6).
  // The phone apps send no Origin and are not affected. Development allows everything (Expo, phone link).
  // (x-soulink-token: a renewed login the app may read)
  app.use(config.isDev ? cors({ exposedHeaders: ['x-soulink-token'] }) : cors((req, cb) => {
    const origin = req.headers.origin;
    const own = `${req.protocol}://${req.get('host')}`;
    cb(null, { origin: !origin || origin === own || config.corsOrigins.includes(origin), exposedHeaders: ['x-soulink-token'] });
  }));
  app.use('/face', express.json({ limit: '8mb' })); // Face ID photos are bigger than normal requests
  app.use('/users/me/restore', express.json({ limit: '15mb' })); // a "Download my data" file

  // Access log (policy section 8): who did what, for every API call, kept 1 year in Log Analytics.
  // Method, route and status only: never bodies, query strings, codes or message text.
  if (!config.isDev || process.env.ACCESS_LOG === 'on') {
    app.use((req, res, next) => {
      const t0 = Date.now();
      if (req.path === '/health' || req.path === '/wake') return next(); // Render checks /health every 5 seconds: not user activity
      res.on('finish', () => securityLog('request', { user: req.user?.id || null, method: req.method, route: `${req.baseUrl || ''}${req.route?.path || ''}` || req.path.split('?')[0].slice(0, 120), status: res.statusCode, ms: Date.now() - t0, ip: clientIp(req) }));
      next();
    });
  }
  app.use(express.json({ limit: '1mb' }));
  // Private file links: every /uploads/... path the server sends gets a signature for this viewer (lib/fileLinks.js);
  // links the app sends back lose theirs, so the server always compares plain paths
  app.use((req, res, next) => {
    if (req.body && typeof req.body === 'object') stripDeep(req.body);
    const json = res.json.bind(res);
    res.json = (body) => json(signDeep(body, req.user?.id || null));
    next();
  });

  if (config.env !== 'test') {
    // Limits count per phone, not per laptop: through the phone link every phone arrives via this laptop
    app.use(rateLimit({ windowMs: 60_000, limit: config.testing ? 3000 : 300, keyGenerator: clientKey, standardHeaders: true, legacyHeaders: false }));
    app.use('/auth/otp', rateLimit({ windowMs: 15 * 60_000, limit: config.testing ? 300 : 20, keyGenerator: clientKey, standardHeaders: true, legacyHeaders: false }));
  }

  // Private preview gate: every API call needs the access code (photos and the health check don't)
  if (config.accessCode) {
    const want = crypto.createHash('sha256').update(config.accessCode).digest();
    const ok = (v) => !!v && crypto.timingSafeEqual(crypto.createHash('sha256').update(String(v)).digest(), want);
    app.get('/access', (req, res) => res.json({ required: true, ok: ok(req.get('x-soulink-access')) }));
    app.use((req, res, next) => {
      if (req.path === '/health' || req.path === '/wake' || req.path === '/push/renew' || req.path.startsWith('/uploads/') || req.path.startsWith('/music/play/') || req.path.startsWith('/share/') || ok(req.get('x-soulink-access'))) return next();
      return res.status(403).json({ error: { code: 'access_code', message: 'Enter the Soulink access code' } });
    });
  } else {
    app.get('/access', (req, res) => res.json({ required: false, ok: true }));
  }

  // Photos and voice notes; on cloud hosts they're restored from the database if the disk was wiped
  if (config.storage === 'db') {
    app.use('/uploads', async (req, res, next) => {
      try {
        const rel = decodeURIComponent(req.path);
        if (req.method === 'GET' && !rel.includes('..') && !rel.includes('\\')) await ensureLocal(`/uploads${rel}`);
      } catch { /* falls through to 404 */ }
      next();
    });
  }
  // nothing under /uploads opens without a valid signed link (ad pictures excepted)
  app.use('/uploads', (req, res, next) => {
    let p;
    try { p = `/uploads${decodeURIComponent(req.path)}`; } catch { return res.status(400).end(); }
    if (checkSigned(p, req.query.t)) return next();
    return res.status(403).json({ error: { code: 'link_expired', message: 'Log in to Soulink to see this' } });
  });
  app.use('/uploads', express.static(config.uploadDir, { maxAge: '1h', setHeaders: (res) => res.setHeader('Cache-Control', 'private, max-age=3600') }));
  app.use('/uploads', (req, res) => res.status(404).json({ error: { code: 'not_found', message: 'File not found' } })); // a missing file is a 404, not a sign-in error

  // /health never touches the database (used to keep the web server awake)
  app.get('/health', (req, res) => res.json({ ok: true, name: 'soulink', env: config.env, db: isDbReady() ? 'ready' : 'starting' }));
  // /wake: the app calls this when it opens; it wakes a paused cloud database and says when it's ready
  app.get('/wake', async (req, res) => {
    markActivity();
    const t = new Promise((r) => setTimeout(() => r('waking'), 20_000));
    const ping = waitDbReady().then(() => query('SELECT 1 AS ok')).then(() => 'ready').catch(() => 'waking');
    res.json({ db: await Promise.race([ping, t]) });
  });
  // every other request counts as someone using Soulink; right after a restart it waits for the database
  app.use(async (req, res, next) => {
    markActivity();
    if (isDbReady()) return next();
    const t = new Promise((r) => setTimeout(() => r(false), 90_000));
    if (await Promise.race([waitDbReady().then(() => true), t])) return next();
    return res.status(503).json({ error: { code: 'waking', message: 'Soulink is waking up. Try again in a moment.' } });
  });
  app.use('/auth', authRoutes);
  app.use('/users', userRoutes);
  app.use('/admin', adminRoutes);
  app.use('/copyright', copyrightRoutes);
  app.use('/search', searchRoutes);
  app.use('/discover', discoverRoutes);
  app.use('/posts', postRoutes);
  app.use('/soulmoji', soulmojiRoutes);
  app.use('/dev', devRoutes); // laptop-only test helpers (off in production)
  app.use('/music', musicRoutes); // song search (login) + /music/play/<ref> for players (public)
  app.use('/places', placesRoutes); // public (no login): must come before safetyRoutes, which requires login for everything under '/'
  app.use('/', safetyRoutes);
  app.use('/notifications', notificationRoutes);
  app.use('/conversations', conversationRoutes);
  app.use('/face', faceRoutes);
  app.use('/soul', soulRoutes);
  app.use('/feed', feedRoutes);
  app.use('/connections', connectionRoutes);
  app.use('/argue', argueRoutes);
  app.use('/anon', anonRoutes);
  app.use('/push', pushRoutes);
  app.use('/account', accountRoutes);
  app.use('/moments', momentRoutes);
  app.use('/sparks', sparkRoutes);
  app.use('/ads', adRoutes);
  app.use('/share', shareRoutes); // a shared post / Spark: a 15-second preview for people without an account

  app.use((req, res, next) => next(notFound(`No route ${req.method} ${req.path}`)));
  app.use(errorHandler);
  return app;
}
