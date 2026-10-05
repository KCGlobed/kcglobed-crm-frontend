import mongoose, { Schema, Types, Document } from 'mongoose';

export const ACTIVITY_TYPES = [
  'created',
  'note',
  'call',
  'task',
  'stage_change',
  'assignment',
  'communication',
  'document',
  'payment',
  'edit',
  'import',
  'system',
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

/** Chronological lead timeline (SOW ID 27). */
export interface ILeadActivity extends Document<Types.ObjectId> {
  lead: Types.ObjectId;
  type: ActivityType;
  title: string;
  description?: string;
  data?: Record<string, unknown>;
  actor?: Types.ObjectId;
  actorType: 'user' | 'system' | 'student';
  actorName?: string;
  createdAt: Date;
}

const leadActivitySchema = new Schema<ILeadActivity>(
  {
    lead: { type: Schema.Types.ObjectId, ref: 'Lead', required: true },
    type: { type: String, enum: ACTIVITY_TYPES, required: true },
    title: { type: String, required: true },
    description: { type: String },
    data: { type: Schema.Types.Mixed },
    actor: { type: Schema.Types.ObjectId, ref: 'User' },
    actorType: { type: String, enum: ['user', 'system', 'student'], default: 'system' },
    actorName: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

leadActivitySchema.index({ lead: 1, createdAt: -1 });

export const LeadActivity = mongoose.model<ILeadActivity>('LeadActivity', leadActivitySchema);
