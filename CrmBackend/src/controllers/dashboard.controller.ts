import { PipelineStage, Types } from 'mongoose';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/respond';
import { Lead } from '../models/Lead';
import { buildOwnerScopeFilter } from '../utils/scope';

export const summary = asyncHandler(async (req, res) => {
  const user = req.user!;
  const scope = await buildOwnerScopeFilter(user);
  const base: Record<string, unknown> = { isDeleted: false };
  if (scope.owner) {
    if (user.dataScope === 'own') Object.assign(base, scope);
    else base.$or = [scope, { owner: null }];
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(startOfDay);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

  const match = base as PipelineStage.Match['$match'];

  const [counts, byStage, bySource, byOwner, recent] = await Promise.all([
    Lead.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          newToday: { $sum: { $cond: [{ $gte: ['$createdAt', startOfDay] }, 1, 0] } },
          newThisWeek: { $sum: { $cond: [{ $gte: ['$createdAt', startOfWeek] }, 1, 0] } },
          unassigned: { $sum: { $cond: [{ $eq: ['$owner', null] }, 1, 0] } },
          converted: { $sum: { $cond: [{ $eq: ['$status', 'converted'] }, 1, 0] } },
          lost: { $sum: { $cond: [{ $eq: ['$status', 'lost'] }, 1, 0] } },
        },
      },
    ]),
    Lead.aggregate([
      { $match: match },
      { $group: { _id: '$stage', count: { $sum: 1 } } },
      { $lookup: { from: 'stages', localField: '_id', foreignField: '_id', as: 'stage' } },
      { $unwind: { path: '$stage', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          name: { $ifNull: ['$stage.name', 'No stage'] },
          color: '$stage.color',
          order: { $ifNull: ['$stage.order', 999] },
          count: 1,
        },
      },
      { $sort: { order: 1 } },
    ]),
    Lead.aggregate([
      { $match: match },
      { $group: { _id: '$source', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 6 },
      { $lookup: { from: 'sources', localField: '_id', foreignField: '_id', as: 'source' } },
      { $unwind: { path: '$source', preserveNullAndEmptyArrays: true } },
      { $project: { name: { $ifNull: ['$source.name', 'Unknown'] }, channel: '$source.channel', count: 1 } },
    ]),
    Lead.aggregate([
      { $match: { ...match, owner: { $ne: null } } as PipelineStage.Match['$match'] },
      { $group: { _id: '$owner', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 6 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'owner' } },
      { $unwind: { path: '$owner', preserveNullAndEmptyArrays: true } },
      { $project: { name: { $ifNull: ['$owner.name', 'Unknown'] }, count: 1 } },
    ]),
    Lead.find(base)
      .populate('stage', 'name color')
      .populate('owner', 'name')
      .populate('source', 'name')
      .sort({ createdAt: -1 })
      .limit(8)
      .select('leadNo firstName lastName mobile stage owner source createdAt')
      .lean()
      .then((leads) =>
        user.fieldRules.some((r) => r.field === 'mobile')
          ? leads.map((l) => ({ ...l, mobile: undefined }))
          : leads
      ),
  ]);

  const myLeadsToday = await Lead.countDocuments({
    isDeleted: false,
    owner: new Types.ObjectId(user.id),
    assignedAt: { $gte: startOfDay },
  });

  ok(res, 'Dashboard fetched successfully', {
    totals: counts[0] ?? { total: 0, newToday: 0, newThisWeek: 0, unassigned: 0, converted: 0, lost: 0 },
    byStage,
    bySource,
    byOwner,
    recentLeads: recent,
    myLeadsToday,
  });
});
