export class AppError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
export function notFound(_req, res) { res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'This page or case could not be found.' } }); }
export function errorHandler(err, _req, res, _next) {
  const status = err.status || 500;
  res.status(status).json({ ok: false, error: { code: err.code || 'INTERNAL', message: status === 500 && process.env.NODE_ENV === 'production' ? 'Something went wrong. Please try again.' : err.message || 'Something went wrong.' } });
}
