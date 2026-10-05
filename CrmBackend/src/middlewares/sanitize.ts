import { RequestHandler } from 'express';

/** Removes Mongo operator keys ($…, dotted) from user payloads (NoSQL-injection guard). */
function clean(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      if (key.startsWith('$') || key.includes('.')) continue;
      out[key] = clean(v);
    }
    return out;
  }
  return value;
}

export const sanitizeBody: RequestHandler = (req, _res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = clean(req.body);
  }
  next();
};
