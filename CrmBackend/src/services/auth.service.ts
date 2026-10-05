import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { env } from '../config/env';
import { IUser, User } from '../models/User';
import { Session } from '../models/Session';
import { ApiError } from '../utils/ApiError';
import { randomToken, sha256, signAccessToken, signRefreshToken } from '../utils/tokens';
import { sendMail } from '../utils/mailer';
import logger from '../config/logger';

export interface SessionMeta {
  ip?: string;
  userAgent?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export function toSafeUser(user: IUser | (Record<string, unknown> & { _id: Types.ObjectId })) {
  const obj = 'toObject' in user && typeof user.toObject === 'function' ? user.toObject() : { ...user };
  delete (obj as Record<string, unknown>).passwordHash;
  delete (obj as Record<string, unknown>).passwordResetTokenHash;
  delete (obj as Record<string, unknown>).passwordResetExpires;
  delete (obj as Record<string, unknown>).__v;
  return obj;
}

async function createSession(userId: Types.ObjectId, meta: SessionMeta): Promise<AuthTokens> {
  const expiresAt = new Date(Date.now() + env.refreshTokenTtlDays * 24 * 60 * 60 * 1000);
  const session = await Session.create({
    user: userId,
    refreshTokenHash: 'pending',
    userAgent: meta.userAgent,
    ip: meta.ip,
    expiresAt,
  });
  const refreshToken = signRefreshToken(String(userId), String(session._id));
  session.refreshTokenHash = sha256(refreshToken);
  await session.save();
  return { accessToken: signAccessToken(String(userId), String(session._id)), refreshToken };
}

export async function login(email: string, password: string, meta: SessionMeta) {
  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw ApiError.unauthorized('Invalid email or password');
  }
  if (!user.isActive) {
    throw ApiError.forbidden('Your account is deactivated. Contact your administrator.');
  }
  const tokens = await createSession(user._id, meta);
  user.lastLoginAt = new Date();
  await user.save();
  return { user: toSafeUser(user), ...tokens };
}

export async function rotateRefreshToken(refreshToken: string, meta: SessionMeta) {
  let payload: { sub: string; sid: string; type: string };
  try {
    payload = jwt.verify(refreshToken, env.jwtRefreshSecret) as typeof payload;
  } catch {
    throw ApiError.unauthorized('Session expired. Please sign in again.');
  }
  if (payload.type !== 'refresh') throw ApiError.unauthorized();

  const session = await Session.findById(payload.sid);
  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    throw ApiError.unauthorized('Session expired. Please sign in again.');
  }
  if (session.refreshTokenHash !== sha256(refreshToken)) {
    // Token reuse — revoke the session defensively.
    session.revokedAt = new Date();
    await session.save();
    throw ApiError.unauthorized('Session invalidated. Please sign in again.');
  }

  const user = await User.findById(payload.sub).lean();
  if (!user || !user.isActive) {
    throw ApiError.unauthorized('Your account is inactive.');
  }

  const newRefresh = signRefreshToken(payload.sub, payload.sid);
  session.refreshTokenHash = sha256(newRefresh);
  session.lastUsedAt = new Date();
  session.ip = meta.ip ?? session.ip;
  await session.save();

  return {
    accessToken: signAccessToken(payload.sub, payload.sid),
    refreshToken: newRefresh,
    user: toSafeUser(user as never),
  };
}

export async function logout(refreshToken?: string): Promise<void> {
  if (!refreshToken) return;
  try {
    const payload = jwt.verify(refreshToken, env.jwtRefreshSecret) as { sid: string };
    await Session.findByIdAndUpdate(payload.sid, { revokedAt: new Date() });
  } catch {
    // Already invalid — nothing to revoke.
  }
}

export async function requestPasswordReset(email: string): Promise<void> {
  const user = await User.findOne({ email: email.toLowerCase() }).select(
    '+passwordResetTokenHash +passwordResetExpires'
  );
  // Always succeed from the caller's perspective (no user enumeration).
  if (!user || !user.isActive) return;

  const token = randomToken();
  user.passwordResetTokenHash = sha256(token);
  user.passwordResetExpires = new Date(Date.now() + 30 * 60 * 1000);
  await user.save();

  const link = `${env.frontendUrl}/reset-password?token=${token}`;
  await sendMail({
    to: user.email,
    subject: 'Reset your CRM password',
    html: `<p>Hello ${user.name},</p><p>Click the link below to reset your password. It expires in 30 minutes.</p><p><a href="${link}">${link}</a></p>`,
  });
  logger.info(`Password reset requested for ${user.email}`);
}

export async function resetPassword(token: string, password: string): Promise<void> {
  const user = await User.findOne({
    passwordResetTokenHash: sha256(token),
    passwordResetExpires: { $gt: new Date() },
  }).select('+passwordResetTokenHash +passwordResetExpires');
  if (!user) {
    throw ApiError.badRequest('This reset link is invalid or has expired. Request a new one.');
  }
  user.passwordHash = await bcrypt.hash(password, 10);
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpires = undefined;
  await user.save();
  await Session.updateMany({ user: user._id, revokedAt: null }, { revokedAt: new Date() });
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  currentSessionId?: string
): Promise<void> {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) throw ApiError.notFound('User not found');
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw ApiError.badRequest('Current password is incorrect', {
      currentPassword: 'Current password is incorrect',
    });
  }
  user.passwordHash = await bcrypt.hash(newPassword, 10);
  await user.save();
  // Sign out every other session.
  await Session.updateMany(
    { user: user._id, revokedAt: null, ...(currentSessionId ? { _id: { $ne: currentSessionId } } : {}) },
    { revokedAt: new Date() }
  );
}

export async function getMe(userId: string) {
  const user = await User.findById(userId)
    .populate('team', 'name')
    .populate('reportingManager', 'name email')
    .lean();
  if (!user) throw ApiError.notFound('User not found');
  return toSafeUser(user as never);
}
