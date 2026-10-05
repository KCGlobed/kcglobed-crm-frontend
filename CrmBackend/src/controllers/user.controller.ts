import { asyncHandler } from '../utils/asyncHandler';
import { buildPagination, created, ok } from '../utils/respond';
import { parseListQuery } from '../utils/pagination';
import * as userService from '../services/user.service';
import { audit } from '../services/audit.service';

/** Lightweight active-user list for owner dropdowns (assign/filter UI).
 *  Names only — available to any signed-in user regardless of users.view. */
export const options = asyncHandler(async (_req, res) => {
  const { User } = await import('../models/User');
  const users = await User.find({ isActive: true })
    .select('name email receivesLeads team designation')
    .sort({ name: 1 })
    .lean();
  ok(res, 'User options fetched successfully', users);
});

export const list = asyncHandler(async (req, res) => {
  const query = parseListQuery(req, ['name', 'email', 'createdAt', 'lastLoginAt']);
  const { items, total } = await userService.listUsers(query, {
    team: req.query.team as string | undefined,
    isActive: req.query.is_active as string | undefined,
    receivesLeads: req.query.receives_leads as string | undefined,
  });
  ok(res, 'Users fetched successfully', items, buildPagination(total, query.page, query.pageSize));
});

export const create = asyncHandler(async (req, res) => {
  const user = await userService.createUser(req.body, req.user!.isSuperAdmin);
  audit(req, {
    action: 'create',
    module: 'users',
    entityType: 'User',
    entityId: String((user as { _id: unknown })._id),
    after: user,
  });
  created(res, 'User created successfully', user);
});

export const getById = asyncHandler(async (req, res) => {
  const user = await userService.getUserById(req.params.id);
  ok(res, 'User fetched successfully', user);
});

export const update = asyncHandler(async (req, res) => {
  const { user, before } = await userService.updateUser(req.params.id, req.body, {
    id: req.user!.id,
    isSuperAdmin: req.user!.isSuperAdmin,
  });
  audit(req, {
    action: 'update',
    module: 'users',
    entityType: 'User',
    entityId: req.params.id,
    before,
    after: user,
  });
  ok(res, 'User updated successfully', user);
});

export const setPermissions = asyncHandler(async (req, res) => {
  const { user, before } = await userService.setUserPermissions(req.params.id, req.body);
  audit(req, {
    action: 'set_permissions',
    module: 'users',
    entityType: 'User',
    entityId: req.params.id,
    before,
    after: {
      permissions: req.body.permissions,
      dataScope: req.body.dataScope,
      fieldRules: req.body.fieldRules,
      templateKey: req.body.templateKey,
    },
  });
  ok(res, 'Permissions updated successfully', user);
});

export const deactivate = asyncHandler(async (req, res) => {
  const user = await userService.deactivateUser(req.params.id, req.user!.id);
  audit(req, {
    action: 'deactivate',
    module: 'users',
    entityType: 'User',
    entityId: req.params.id,
  });
  ok(res, 'User deactivated successfully', user);
});
