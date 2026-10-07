import express from 'express';
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
  app.use(cors());
  app.use('/face', express.json({ limit: '8mb' })); // Face ID photos are bigger than normal requests
  app.use(express.json({ limit: '1mb' }));

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
      if (req.path === '/health' || req.path.startsWith('/uploads/') || ok(req.get('x-soulink-access'))) return next();
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
  app.use('/uploads', express.static(config.uploadDir, { maxAge: '7d' }));

  app.get('/health', (req, res) => res.json({ ok: true, name: 'soulink', env: config.env }));
  app.use('/auth', authRoutes);
  app.use('/users', userRoutes);
  app.use('/search', searchRoutes);
  app.use('/discover', discoverRoutes);
  app.use('/posts', postRoutes);
  app.use('/soulmoji', soulmojiRoutes);
  app.use('/dev', devRoutes); // laptop-only test helpers (off in production)
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

  app.use((req, res, next) => next(notFound(`No route ${req.method} ${req.path}`)));
  app.use(errorHandler);
  return app;
}
