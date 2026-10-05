import crypto from 'crypto';
import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';

export function signAccessToken(userId: string, sessionId: string): string {
  return jwt.sign({ sub: userId, sid: sessionId, type: 'access' }, env.jwtAccessSecret, {
    expiresIn: env.accessTokenTtl,
  } as SignOptions);
}

export function signRefreshToken(userId: string, sessionId: string): string {
  // jti makes every rotation unique even within the same second (same iat).
  return jwt.sign({ sub: userId, sid: sessionId, type: 'refresh' }, env.jwtRefreshSecret, {
    expiresIn: `${env.refreshTokenTtlDays}d`,
    jwtid: crypto.randomUUID(),
  } as SignOptions);
}

export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}
