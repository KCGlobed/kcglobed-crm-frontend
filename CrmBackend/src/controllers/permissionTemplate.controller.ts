import { asyncHandler } from '../utils/asyncHandler';
import { created, ok } from '../utils/respond';
import { PermissionTemplate } from '../models/PermissionTemplate';
import { ApiError } from '../utils/ApiError';
import { audit } from '../services/audit.service';

export const list = asyncHandler(async (_req, res) => {
  const templates = await PermissionTemplate.find().sort({ isSystem: -1, name: 1 }).lean();
  ok(res, 'Permission templates fetched successfully', templates);
});

export const create = asyncHandler(async (req, res) => {
  const existing = await PermissionTemplate.findOne({ key: req.body.key });
  if (existing) {
    throw ApiError.conflict('A template with this key already exists', {
      key: 'A template with this key already exists',
    });
  }
  const template = await PermissionTemplate.create({ ...req.body, isSystem: false });
  audit(req, { action: 'create', module: 'users', entityType: 'PermissionTemplate', entityId: String(template._id), after: template.toObject() });
  created(res, 'Template created successfully', template);
});

export const update = asyncHandler(async (req, res) => {
  const template = await PermissionTemplate.findById(req.params.id);
  if (!template) throw ApiError.notFound('Template not found');
  const before = template.toObject();
  const { key: _ignored, ...rest } = req.body;
  Object.assign(template, rest);
  await template.save();
  audit(req, { action: 'update', module: 'users', entityType: 'PermissionTemplate', entityId: String(template._id), before, after: template.toObject() });
  ok(res, 'Template updated successfully', template);
});

export const remove = asyncHandler(async (req, res) => {
  const template = await PermissionTemplate.findById(req.params.id);
  if (!template) throw ApiError.notFound('Template not found');
  if (template.isSystem) {
    throw ApiError.unprocessable('System templates cannot be deleted — edit them instead');
  }
  await template.deleteOne();
  audit(req, { action: 'delete', module: 'users', entityType: 'PermissionTemplate', entityId: String(template._id), before: template.toObject() });
  ok(res, 'Template deleted successfully', null);
});
