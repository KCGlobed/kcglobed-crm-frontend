import bcrypt from 'bcryptjs';
import { QueryFilter } from 'mongoose';
import { IUser, User } from '../models/User';
import { Session } from '../models/Session';
import { ApiError } from '../utils/ApiError';
import { escapeRegex } from '../utils/pagination';
import { ListQuery } from '../types/api';
import { toSafeUser } from './auth.service';

interface UserFilters {
  team?: string;
  isActive?: string;
  receivesLeads?: string;
}

export async function listUsers(query: ListQuery, filters: UserFilters) {
  const where: QueryFilter<IUser> = {};
  if (query.search) {
    const rx = new RegExp(escapeRegex(query.search), 'i');
    where.$or = [{ name: rx }, { email: rx }, { mobile: rx }];
  }
  if (filters.team) where.team = filters.team;
  if (filters.isActive === 'true') where.isActive = true;
  if (filters.isActive === 'false') where.isActive = false;
  if (filters.receivesLeads === 'true') where.receivesLeads = true;

  const [items, total] = await Promise.all([
    User.find(where)
      .populate('team', 'name')
      .populate('reportingManager', 'name')
      .sort({ [query.sortBy]: query.sortOrder })
      .skip((query.page - 1) * query.pageSize)
      .limit(query.pageSize)
      .lean(),
    User.countDocuments(where),
  ]);
  return { items: items.map((u) => toSafeUser(u as never)), total };
}

export async function createUser(payload: Record<string, unknown>, actorIsSuperAdmin: boolean) {
  if (payload.isSuperAdmin && !actorIsSuperAdmin) {
    throw ApiError.forbidden('Only a super admin can create another super admin');
  }
  const existing = await User.findOne({ email: String(payload.email).toLowerCase() });
  if (existing) {
    throw ApiError.conflict('A user with this email already exists', {
      email: 'A user with this email already exists',
    });
  }
  const { password, ...rest } = payload;
  const user = await User.create({
    ...rest,
    passwordHash: await bcrypt.hash(String(password), 10),
  });
  return toSafeUser(user);
}

export async function getUserById(id: string) {
  const user = await User.findById(id)
    .populate('team', 'name')
    .populate('reportingManager', 'name email')
    .lean();
  if (!user) throw ApiError.notFound('User not found');
  return toSafeUser(user as never);
}

export async function updateUser(
  id: string,
  payload: Record<string, unknown>,
  actor: { id: string; isSuperAdmin: boolean }
) {
  const user = await User.findById(id);
  if (!user) throw ApiError.notFound('User not found');

  if ((payload.isSuperAdmin !== undefined || payload.isActive === false) && !actor.isSuperAdmin) {
    throw ApiError.forbidden('Only a super admin can change admin status or deactivate users');
  }
  if (actor.id === id && payload.isActive === false) {
    throw ApiError.badRequest('You cannot deactivate your own account');
  }
  if (actor.id === id && payload.isSuperAdmin === false) {
    throw ApiError.badRequest('You cannot remove your own super admin access');
  }

  const { password, ...rest } = payload;
  const before = toSafeUser(user.toObject() as never);
  Object.assign(user, rest);
  if (password) {
    user.passwordHash = await bcrypt.hash(String(password), 10);
  }
  await user.save();

  if (payload.isActive === false) {
    await Session.updateMany({ user: user._id, revokedAt: null }, { revokedAt: new Date() });
  }
  return { user: toSafeUser(user), before };
}

export async function setUserPermissions(
  id: string,
  payload: { permissions: unknown; dataScope: unknown; fieldRules: unknown; templateKey?: unknown }
) {
  const user = await User.findById(id);
  if (!user) throw ApiError.notFound('User not found');
  const before = {
    permissions: user.permissions,
    dataScope: user.dataScope,
    fieldRules: user.fieldRules,
    templateKey: user.templateKey,
  };
  user.permissions = payload.permissions as IUser['permissions'];
  user.dataScope = payload.dataScope as IUser['dataScope'];
  user.fieldRules = payload.fieldRules as IUser['fieldRules'];
  user.templateKey = (payload.templateKey as string) ?? undefined;
  await user.save();
  return { user: toSafeUser(user), before };
}

export async function deactivateUser(id: string, actorId: string) {
  if (id === actorId) throw ApiError.badRequest('You cannot deactivate your own account');
  const user = await User.findById(id);
  if (!user) throw ApiError.notFound('User not found');
  user.isActive = false;
  await user.save();
  await Session.updateMany({ user: user._id, revokedAt: null }, { revokedAt: new Date() });
  return toSafeUser(user);
}
