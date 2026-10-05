import { asyncHandler } from '../utils/asyncHandler';
import { buildPagination, ok } from '../utils/respond';
import { Notification } from '../models/Notification';
import { ApiError } from '../utils/ApiError';

export const list = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(req.query.page_size) || 15));
  const where: Record<string, unknown> = { user: req.user!.id };
  if (req.query.unread === 'true') where.readAt = null;

  const [items, total, unreadCount] = await Promise.all([
    Notification.find(where)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    Notification.countDocuments(where),
    Notification.countDocuments({ user: req.user!.id, readAt: null }),
  ]);
  res.setHeader('X-Unread-Count', String(unreadCount));
  ok(res, 'Notifications fetched successfully', { items, unreadCount }, buildPagination(total, page, pageSize));
});

export const markRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, user: req.user!.id },
    { readAt: new Date() },
    { returnDocument: 'after' }
  );
  if (!notification) throw ApiError.notFound('Notification not found');
  ok(res, 'Notification marked as read', notification);
});

export const markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ user: req.user!.id, readAt: null }, { readAt: new Date() });
  ok(res, 'All notifications marked as read', null);
});
