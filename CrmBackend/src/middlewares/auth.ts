import { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { User } from '../models/User';

export interface AccessTokenPayload {
  sub: string;
  sid: string;
  type: 'access' | 'refresh';
}

/**
 * Verifies the Bearer token and loads the user fresh from the DB so that
 * deactivation and permission changes take effect immediately (SOW §9).
 */
export const requireAuth: RequestHandler = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw ApiError.unauthorized();
  }

  let payload: AccessTokenPayload;
  try {
    payload = jwt.verify(header.slice(7), env.jwtAccessSecret) as AccessTokenPayload;
  } catch {
    throw ApiError.unauthorized('Session expired or invalid. Please sign in again.');
  }
  if (payload.type !== 'access') {
    throw ApiError.unauthorized();
  }

  const user = await User.findById(payload.sub).lean();
  if (!user || !user.isActive) {
    throw ApiError.unauthorized('Your account is inactive. Contact your administrator.');
  }

  req.user = {
    id: String(user._id),
    name: user.name,
    email: user.email,
    isSuperAdmin: user.isSuperAdmin,
    permissions: user.permissions ?? [],
    dataScope: user.dataScope ?? 'own',
    fieldRules: user.fieldRules ?? [],
    team: user.team ? String(user.team) : undefined,
  };
  next();
});
