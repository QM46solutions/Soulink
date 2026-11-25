import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

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
  // Device sessions never time out: logged in until Log out, "log out of other devices", deletion or a ban.
  // This expiry applies only to old-style tokens without a session (none are issued any more).
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  smsProvider: process.env.SMS_PROVIDER || 'console',
  // Show the login code in the API reply: development and the private test preview only. Never in public production.
  otpDevEcho: bool(process.env.OTP_DEV_ECHO, (process.env.NODE_ENV || 'development') !== 'production'),
  emailProvider: process.env.EMAIL_PROVIDER || 'console',
  emailFrom: process.env.EMAIL_FROM || 'Soulink <no-reply@soulink.app>',
  emailFallbackProvider: process.env.EMAIL_FALLBACK_PROVIDER || '',
  // New accounts must add and confirm an email before the profile can be finished (off only in the automated tests,
  // whose helper accounts sign up by phone)
  signupEmailRequired: bool(process.env.SIGNUP_EMAIL_REQUIRED, (process.env.NODE_ENV || 'development') !== 'test'),
  // Websites allowed to call the API from a browser (comma list). The app's own address is always allowed.
  corsOrigins: (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
  // Face search (find someone by camera) is on hold
  faceSearch: bool(process.env.FACE_SEARCH, false),
  // Soulmoji engine. 'builtin' (default) = Soulink's own engine, the SAME on the laptop and in the cloud:
  // free, fast, nothing else to keep running. 'ai' = LivePortrait (laptop install or SOULMOJI_AI_URL), opt-in only.
  soulmojiEngine: process.env.SOULMOJI_ENGINE === 'ai' ? 'ai' : 'builtin',
  // STORAGE=db switches to Blob by itself once the Azure Storage key is in (docs/VIDEO-BUILDER.md); STORAGE_AUTO_BLOB=off stops that
  storage: (process.env.STORAGE === 'db' && process.env.AZURE_STORAGE_CONNECTION_STRING && process.env.STORAGE_AUTO_BLOB !== 'off') ? 'blob' : (process.env.STORAGE || 'local'),
  // Cloud hosting: the built web app is served from this folder, with the API under /api (one address for everything)
  webDir: process.env.WEB_DIR ? fileURLToPath(new URL(`../${process.env.WEB_DIR}/`, import.meta.url)) : '',
  // Private preview: everyone must type this code once before using the app (empty = no code)
  accessCode: process.env.ACCESS_CODE || '',
  // Google Play / App Store reviewers: one test phone number that always takes the same 6-digit code, and skips
  // the live face scan (a reviewer can't pass it). Both are set only in the cloud settings, never in the code.
  reviewPhone: process.env.REVIEW_PHONE || '',
  reviewCode: /^\d{6}$/.test(process.env.REVIEW_CODE || '') ? process.env.REVIEW_CODE : '',
  // (tests always use their own temporary folder, see test/helpers.js; never the real uploads)
  uploadDir: process.env.UPLOAD_DIR || (process.env.NODE_ENV === 'test' ? `${tmpdir()}/soulink-test-uploads/` : fileURLToPath(new URL('../uploads/', import.meta.url))),
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
  testing: bool(process.env.TESTING_MODE, (process.env.NODE_ENV || 'development') !== 'production' || !!process.env.ACCESS_CODE),
  // codes per phone/email: 5 min life, 5 wrong tries, 30 s between codes, at most 5 an hour and 10 a day
  otp: { ttlSeconds: 300, maxAttempts: 5, resendCooldownSeconds: 30, maxPerHour: 5, maxPerDay: 10 },
  // Phone sign-in by SMS code. Off in production until MSG91 + DLT are set up and tested (then PHONE_LOGIN=true);
  // always on in development and the automated tests. The reviewer number and TEST_LOGIN_TARGETS work regardless.
  phoneLogin: bool(process.env.PHONE_LOGIN, (process.env.NODE_ENV || 'development') !== 'production'),
  // The team's own phone numbers / emails (comma list) allowed to use test mode in the cloud: phone sign-in before
  // SMS is live, and (with OTP_DEV_ECHO) the code shown on screen. Nobody else ever gets a code back from the API.
  testLoginTargets: (process.env.TEST_LOGIN_TARGETS || '').split(',').map((s) => s.trim()).filter(Boolean),
  minAge: 18,
};

if (!config.isDev && config.jwtSecret === 'dev-secret-change-me') {
  throw new Error('JWT_SECRET must be set in production');
}

// Production safety switch (policy section 6): a public server (production, no private-preview access code)
// refuses to start with any test setting left on.
export const isPublicProduction = !config.isDev && !config.accessCode;
if (isPublicProduction) {
  const problems = [];
  if (config.otpDevEcho) problems.push('OTP_DEV_ECHO must be false (login codes are sent by SMS or email only)');
  if (config.testing) problems.push('TESTING_MODE must be false');
  if (config.phoneLogin && config.smsProvider === 'console') problems.push('SMS_PROVIDER must be a real provider (msg91 or messagecentral) when PHONE_LOGIN is on');
  if (config.smsProvider === 'messagecentral' && !(process.env.MESSAGECENTRAL_CUSTOMER_ID && (process.env.MESSAGECENTRAL_PASSWORD || process.env.MESSAGECENTRAL_KEY))) problems.push('MESSAGECENTRAL_CUSTOMER_ID and MESSAGECENTRAL_PASSWORD must be set');
  if (config.testLoginTargets.length) problems.push('TEST_LOGIN_TARGETS must be empty');
  if (!['resend', 'gmail'].includes(config.emailProvider)) problems.push('EMAIL_PROVIDER must be a real provider (resend or gmail)');
  if ([config.emailProvider, config.emailFallbackProvider].includes('resend') && !process.env.RESEND_API_KEY) problems.push('RESEND_API_KEY must be set');
  if ([config.emailProvider, config.emailFallbackProvider].includes('gmail') && !(process.env.GMAIL_SERVICE_ACCOUNT && process.env.GMAIL_SENDER)) problems.push('GMAIL_SERVICE_ACCOUNT and GMAIL_SENDER must be set');
  if (!process.env.FACE_KEY || Buffer.from(process.env.FACE_KEY, 'base64').length !== 32) problems.push('FACE_KEY must be 32 random bytes, base64');
  if (config.premiumFreeTrial) problems.push('PREMIUM_FREE_TRIAL must be false');
  if (problems.length) throw new Error(`Soulink will not start in production:\n - ${problems.join('\n - ')}`);
}
