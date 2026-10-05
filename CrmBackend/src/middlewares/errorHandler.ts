import { ErrorRequestHandler, RequestHandler } from 'express';
import mongoose from 'mongoose';
import { ApiError } from '../utils/ApiError';
import logger from '../config/logger';
import { env } from '../config/env';

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    status: 404,
    errors: {},
  });
};

/**
 * Central error handler (SOW §16): technical details go to logs,
 * safe consistent messages go to the client.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ApiError) {
    res.status(err.status).json({
      success: false,
      message: err.message,
      status: err.status,
      errors: err.errors ?? {},
    });
    return;
  }

  // Mongo duplicate key → 409 with the offending field(s)
  if (err && typeof err === 'object' && (err as { code?: number }).code === 11000) {
    const keyValue = (err as { keyValue?: Record<string, unknown> }).keyValue ?? {};
    const errors: Record<string, string> = {};
    for (const field of Object.keys(keyValue)) {
      errors[field] = `A record with this ${field} already exists`;
    }
    res.status(409).json({
      success: false,
      message: 'Duplicate record',
      status: 409,
      errors,
    });
    return;
  }

  if (err instanceof mongoose.Error.ValidationError) {
    const errors: Record<string, string> = {};
    for (const [path, e] of Object.entries(err.errors)) {
      errors[path] = e.message;
    }
    res.status(400).json({ success: false, message: 'Validation failed', status: 400, errors });
    return;
  }

  if (err instanceof mongoose.Error.CastError) {
    res.status(400).json({
      success: false,
      message: 'Invalid identifier format',
      status: 400,
      errors: {},
    });
    return;
  }

  logger.error(`Unhandled error on ${req.method} ${req.originalUrl}: ${(err as Error)?.message}`, {
    stack: (err as Error)?.stack,
  });
  res.status(500).json({
    success: false,
    message: env.isProduction ? 'Something went wrong. Please try again.' : String((err as Error)?.message),
    status: 500,
    errors: {},
  });
};
