import { RequestHandler } from 'express';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';

/** Guards the public lead-capture endpoint (website / landing pages / connectors). */
export const requireCaptureKey: RequestHandler = (req, _res, next) => {
  const key = req.headers['x-api-key'];
  if (!env.captureApiKey || key !== env.captureApiKey) {
    return next(ApiError.unauthorized('Invalid API key'));
  }
  next();
};
