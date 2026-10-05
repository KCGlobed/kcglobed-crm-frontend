import { RequestHandler } from 'express';
import { ZodType } from 'zod';
import { ApiError } from '../utils/ApiError';

type Target = 'body' | 'query' | 'params';

export function validate(schema: ZodType, target: Target = 'body'): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path.join('.') || target;
        if (!errors[key]) errors[key] = issue.message;
      }
      return next(ApiError.badRequest('Validation failed', errors));
    }
    if (target === 'body') {
      req.body = result.data;
    }
    next();
  };
}
