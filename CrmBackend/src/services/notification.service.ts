import { Types } from 'mongoose';
import { Notification, NotificationType } from '../models/Notification';
import logger from '../config/logger';

/** In-app notification write — must never fail the main operation. */
export function notify(
  userId: Types.ObjectId | string,
  type: NotificationType,
  title: string,
  body?: string,
  data?: Record<string, unknown>
): void {
  Notification.create({ user: userId, type, title, body, data }).catch((err) =>
    logger.error(`Notification write failed: ${err.message}`)
  );
}
