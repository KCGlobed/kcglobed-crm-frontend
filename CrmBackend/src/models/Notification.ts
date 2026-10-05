import mongoose, { Schema, Types, Document } from 'mongoose';

export const NOTIFICATION_TYPES = [
  'lead_assigned',
  'lead_reassigned',
  'task_due',
  'task_overdue',
  'payment',
  'application',
  'interview',
  'exam',
  'system',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface INotification extends Document<Types.ObjectId> {
  user: Types.ObjectId;
  type: NotificationType;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  readAt?: Date;
  createdAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true },
    body: { type: String },
    data: { type: Schema.Types.Mixed },
    readAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

notificationSchema.index({ user: 1, readAt: 1, createdAt: -1 });

export const Notification = mongoose.model<INotification>('Notification', notificationSchema);
