import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/respond';
import * as authService from '../services/auth.service';
import { audit } from '../services/audit.service';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';

const REFRESH_COOKIE = 'crm_rt';

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    maxAge: env.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
    path: '/api/v1/auth',
  });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
}

function getRefreshToken(req: Request): string | undefined {
  return req.cookies?.[REFRESH_COOKIE] ?? req.body?.refresh_token;
}

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.login(email, password, {
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  setRefreshCookie(res, result.refreshToken);
  audit(req, {
    action: 'login',
    module: 'users',
    entityType: 'User',
    entityId: String((result.user as { _id: unknown })._id),
  });
  ok(res, 'Signed in successfully', { user: result.user, access_token: result.accessToken });
});

export const refresh = asyncHandler(async (req, res) => {
  const token = getRefreshToken(req);
  if (!token) throw ApiError.unauthorized('Session expired. Please sign in again.');
  const result = await authService.rotateRefreshToken(token, { ip: req.ip });
  setRefreshCookie(res, result.refreshToken);
  ok(res, 'Session refreshed', { user: result.user, access_token: result.accessToken });
});

export const logout = asyncHandler(async (req, res) => {
  await authService.logout(getRefreshToken(req));
  clearRefreshCookie(res);
  ok(res, 'Signed out successfully', null);
});

export const forgotPassword = asyncHandler(async (req, res) => {
  await authService.requestPasswordReset(req.body.email);
  ok(res, 'If that email exists, a reset link has been sent', null);
});

export const resetPassword = asyncHandler(async (req, res) => {
  await authService.resetPassword(req.body.token, req.body.password);
  ok(res, 'Password reset successfully. You can now sign in.', null);
});

export const changePassword = asyncHandler(async (req, res) => {
  let sessionId: string | undefined;
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    const decoded = jwt.decode(header.slice(7)) as { sid?: string } | null;
    sessionId = decoded?.sid;
  }
  await authService.changePassword(
    req.user!.id,
    req.body.currentPassword,
    req.body.newPassword,
    sessionId
  );
  audit(req, { action: 'change_password', module: 'users', entityType: 'User', entityId: req.user!.id });
  ok(res, 'Password changed successfully', null);
});

export const me = asyncHandler(async (req, res) => {
  const user = await authService.getMe(req.user!.id);
  ok(res, 'Profile fetched successfully', { user });
});
