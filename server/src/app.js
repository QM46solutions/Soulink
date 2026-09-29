import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
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

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors());
  app.use('/face', express.json({ limit: '8mb' })); // Face ID photos are bigger than normal requests
  app.use(express.json({ limit: '1mb' }));

  if (config.env !== 'test') {
    app.use(rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: true, legacyHeaders: false }));
    app.use('/auth/otp', rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: true, legacyHeaders: false }));
  }

  app.use('/uploads', express.static(config.uploadDir, { maxAge: '7d' }));

  app.get('/health', (req, res) => res.json({ ok: true, name: 'soulink', env: config.env }));
  app.use('/auth', authRoutes);
  app.use('/users', userRoutes);
  app.use('/search', searchRoutes);
  app.use('/discover', discoverRoutes);
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

  app.use((req, res, next) => next(notFound(`No route ${req.method} ${req.path}`)));
  app.use(errorHandler);
  return app;
}
