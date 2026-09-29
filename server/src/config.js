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
  uploadDir: process.env.UPLOAD_DIR || fileURLToPath(new URL('../uploads/', import.meta.url)),
  aiProvider: process.env.AI_PROVIDER || 'local',
  anthropicKey: process.env.ANTHROPIC_API_KEY || '',
  anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
  faceProvider: process.env.FACE_PROVIDER || 'local',
  // Face ID is required before a new account can finish sign-up (switched off only for automated tests)
  faceRequired: bool(process.env.FACE_REQUIRED, (process.env.NODE_ENV || 'development') !== 'test'),
  otp: { ttlSeconds: 300, maxAttempts: 5, resendCooldownSeconds: 30 },
  minAge: 18,
};

if (!config.isDev && config.jwtSecret === 'dev-secret-change-me') {
  throw new Error('JWT_SECRET must be set in production');
}
