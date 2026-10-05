import { QueryFilter } from 'mongoose';
import { asyncHandler } from '../utils/asyncHandler';
import { buildPagination, ok } from '../utils/respond';
import { parseListQuery, escapeRegex } from '../utils/pagination';
import { AuditLog, IAuditLog } from '../models/AuditLog';

export const list = asyncHandler(async (req, res) => {
  const query = parseListQuery(req, ['createdAt']);
  const where: QueryFilter<IAuditLog> = {};
  if (req.query.module) where.module = String(req.query.module);
  if (req.query.action) where.action = String(req.query.action);
  if (req.query.actor) where.actor = String(req.query.actor);
  if (query.search) {
    const rx = new RegExp(escapeRegex(query.search), 'i');
    where.$or = [{ actorName: rx }, { entityType: rx }, { entityId: rx }, { action: rx }];
  }
  if (req.query.created_from || req.query.created_to) {
    where.createdAt = {};
    if (req.query.created_from) (where.createdAt as Record<string, Date>).$gte = new Date(String(req.query.created_from));
    if (req.query.created_to) {
      const to = new Date(String(req.query.created_to));
      to.setHours(23, 59, 59, 999);
      (where.createdAt as Record<string, Date>).$lte = to;
    }
  }

  const [items, total] = await Promise.all([
    AuditLog.find(where)
      .populate('actor', 'name email')
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.pageSize)
      .limit(query.pageSize)
      .lean(),
    AuditLog.countDocuments(where),
  ]);
  ok(res, 'Audit logs fetched successfully', items, buildPagination(total, query.page, query.pageSize));
});
