import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const badRequest = (msg, code = 'bad_request') => new HttpError(400, msg, code);
export const unauthorized = (msg = 'Please log in', code = 'unauthorized') => new HttpError(401, msg, code);
export const forbidden = (msg = 'Not allowed', code = 'forbidden') => new HttpError(403, msg, code);
export const notFound = (msg = 'Not found', code = 'not_found') => new HttpError(404, msg, code);
export const conflict = (msg, code = 'conflict') => new HttpError(409, msg, code);
export const tooMany = (msg, code = 'rate_limited') => new HttpError(429, msg, code);

/** Wrap async route handlers so thrown errors reach the error middleware. */
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    const first = err.issues[0];
    return res.status(400).json({
      error: { code: 'validation', message: `${first.path.join('.') || 'input'}: ${first.message}`, issues: err.issues },
    });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  }
  // SQL Server: 2627 = unique constraint, 2601 = unique index
  if (err?.number === 2627 || err?.number === 2601 || err?.originalError?.info?.number === 2627 || err?.originalError?.info?.number === 2601) {
    return res.status(409).json({ error: { code: 'duplicate', message: 'That already exists' } });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'bad_json', message: 'Invalid JSON body' } });
  }
  if (err?.name === 'MulterError') {
    return res.status(400).json({ error: { code: 'upload', message: err.message } });
  }
  console.error(err);
  res.status(500).json({ error: { code: 'server_error', message: 'Something went wrong' } });
}
