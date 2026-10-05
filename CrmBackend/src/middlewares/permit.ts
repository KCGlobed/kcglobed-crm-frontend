import { RequestHandler } from 'express';
import { ActionKey, hasAction, ModuleKey } from '../constants/permissions';
import { ApiError } from '../utils/ApiError';

/**
 * Backend permission enforcement — never rely on the frontend's checks (SOW §9).
 * Super admin bypasses module ticks; everyone else needs the exact module+action.
 */
export function permit(module: ModuleKey, action: ActionKey): RequestHandler {
  return (req, _res, next) => {
    const user = req.user;
    if (!user) return next(ApiError.unauthorized());
    if (user.isSuperAdmin || hasAction(user.permissions, module, action)) return next();
    return next(ApiError.forbidden());
  };
}
