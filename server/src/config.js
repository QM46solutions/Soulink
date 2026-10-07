import 'dotenv/config';
import { fileURLToPath } from 'node:url';

const bool = (v, d = false) => (v === undefined || v === '' ? d : ['1', 'true', 'yes'].includes(String(v).toLowerCase()));

export const config = {
  port: Number(process.env.PORT || 4000),
  env: process.env.NODE_ENV || 'development',
  isDev: (process.env.NODE_ENV || 'development') !== 'production',
  // Microsoft SQL Server connection
  db: {
    server: process.env.DB_SERVER || 'localhost',
    port: Number(process.env.DB_PORT || 1433),
    instanceName: process.env.DB_INSTANCE || '',
    database: process.env.DB_NAME || 'soulink',
    user: process.env.DB_USER || 'soulink',
    password: process.env.DB_PASSWORD || '',
    encrypt: bool(process.env.DB_ENCRYPT, false),
    trustServerCertificate: bool(process.env.DB_TRUST_SERVER_CERT, true),
  },
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  smsProvider: process.env.SMS_PROVIDER || 'console',
  otpDevEcho: bool(process.env.OTP_DEV_ECHO, true),
  storage: process.env.STORAGE || 'local',
  // Cloud hosting: the built web app is served from this folder, with the API under /api (one address for everything)
  webDir: process.env.WEB_DIR ? fileURLToPath(new URL(`../${process.env.WEB_DIR}/`, import.meta.url)) : '',
  // Private preview: everyone must type this code once before using the app (empty = no code)
  accessCode: process.env.ACCESS_CODE || '',
  uploadDir: process.env.UPLOAD_DIR || fileURLToPath(new URL('../uploads/', import.meta.url)),
  // Argue referee AI: local = free Ollama on this laptop (falls back to the basic judge), claude = Claude API (paid), basic = rules only
  aiProvider: process.env.AI_PROVIDER || 'local',
  ollamaUrl: process.env.OLLAMA_URL || 'http://127.0.0.1:11434',
  ollamaModel: process.env.OLLAMA_MODEL || 'llama3.2:3b',
  anthropicKey: process.env.ANTHROPIC_API_KEY || '',
  anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
  faceProvider: process.env.FACE_PROVIDER || 'local',
  // Face ID is required before a new account can finish sign-up (switched off only for automated tests)
  // Soul DNA must be created before connecting with anyone (switched off only for automated tests)
  soulRequired: bool(process.env.SOUL_REQUIRED, (process.env.NODE_ENV || 'development') !== 'test'),
  // Chat opens only between connected people (Connect request accepted); off only for automated tests
  connectRequired: bool(process.env.CONNECT_REQUIRED, (process.env.NODE_ENV || 'development') !== 'test'),
  faceRequired: bool(process.env.FACE_REQUIRED, (process.env.NODE_ENV || 'development') !== 'test'),
  // Premium Soul Filters (min Soul Score, Soul type, personality) are free while testing; set PREMIUM_FREE_TRIAL=false at launch
  premiumFreeTrial: bool(process.env.PREMIUM_FREE_TRIAL, true),
  // Testing mode (on until launch): roomy request limits so a group of testers on one Wi-Fi or the phone link
  // never gets blocked. Set TESTING_MODE=false at launch for the strict limits. ("One face, one account" is always on.)
  testing: bool(process.env.TESTING_MODE, true),
  otp: { ttlSeconds: 300, maxAttempts: 5, resendCooldownSeconds: 30 },
  minAge: 18,
};

if (!config.isDev && config.jwtSecret === 'dev-secret-change-me') {
  throw new Error('JWT_SECRET must be set in production');
}
