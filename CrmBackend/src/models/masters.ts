import mongoose, { Schema, Types, Document } from 'mongoose';

/**
 * Master data (SOW §12): central configurable lists reused by dependent modules.
 * All masters share isActive + sortOrder so listing/ordering behaves the same everywhere.
 */

export const CHANNELS = ['paid', 'organic', 'referral', 'partner', 'direct', 'event', 'other'] as const;
export type Channel = (typeof CHANNELS)[number];

export interface ISource extends Document<Types.ObjectId> {
  name: string;
  channel: Channel;
  description?: string;
  isActive: boolean;
  sortOrder: number;
}
const sourceSchema = new Schema<ISource>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    channel: { type: String, enum: CHANNELS, default: 'other' },
    description: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);
export const Source = mongoose.model<ISource>('Source', sourceSchema);

export interface IProgram extends Document<Types.ObjectId> {
  name: string;
  code: string;
  track?: string;
  durationMonths?: number;
  description?: string;
  isActive: boolean;
  sortOrder: number;
}
const programSchema = new Schema<IProgram>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    track: { type: String, trim: true },
    durationMonths: { type: Number },
    description: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);
export const Program = mongoose.model<IProgram>('Program', programSchema);

export const COHORT_STATUSES = ['planned', 'open', 'closed', 'completed'] as const;
export type CohortStatus = (typeof COHORT_STATUSES)[number];

export interface ICohort extends Document<Types.ObjectId> {
  name: string;
  program: Types.ObjectId;
  startDate?: Date;
  endDate?: Date;
  capacity?: number;
  status: CohortStatus;
  sortOrder: number;
}
const cohortSchema = new Schema<ICohort>(
  {
    name: { type: String, required: true, trim: true },
    program: { type: Schema.Types.ObjectId, ref: 'Program', required: true },
    startDate: { type: Date },
    endDate: { type: Date },
    capacity: { type: Number },
    status: { type: String, enum: COHORT_STATUSES, default: 'planned' },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);
cohortSchema.index({ program: 1, name: 1 }, { unique: true });
export const Cohort = mongoose.model<ICohort>('Cohort', cohortSchema);

export const STAGE_TYPES = ['open', 'converted', 'lost'] as const;
export type StageType = (typeof STAGE_TYPES)[number];

/** Sub-stage with the action a counsellor should take (Lead Stages sheet). */
export interface ISubStage {
  _id: Types.ObjectId;
  name: string;
  counsellorAction?: string;
  isActive: boolean;
}

export interface IStage extends Document<Types.ObjectId> {
  name: string;
  type: StageType;
  color?: string;
  order: number;
  isActive: boolean;
  /** set only by the system (e.g. Untouched on create); counsellors cannot pick it */
  isSystem: boolean;
  subStages: ISubStage[];
}
const subStageSchema = new Schema<ISubStage>({
  name: { type: String, required: true, trim: true },
  counsellorAction: { type: String, trim: true },
  isActive: { type: Boolean, default: true },
});
const stageSchema = new Schema<IStage>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    type: { type: String, enum: STAGE_TYPES, default: 'open' },
    color: { type: String, trim: true },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    isSystem: { type: Boolean, default: false },
    subStages: { type: [subStageSchema], default: [] },
  },
  { timestamps: true }
);
export const Stage = mongoose.model<IStage>('Stage', stageSchema);

export interface IDisposition extends Document<Types.ObjectId> {
  name: string;
  category?: string;
  requiresFollowUp: boolean;
  isActive: boolean;
  sortOrder: number;
}
const dispositionSchema = new Schema<IDisposition>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    category: { type: String, trim: true },
    requiresFollowUp: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);
export const Disposition = mongoose.model<IDisposition>('Disposition', dispositionSchema);

export interface ITag extends Document<Types.ObjectId> {
  name: string;
  color?: string;
  isActive: boolean;
  sortOrder: number;
}
const tagSchema = new Schema<ITag>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    color: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);
export const Tag = mongoose.model<ITag>('Tag', tagSchema);

export const CUSTOM_FIELD_TYPES = ['text', 'number', 'date', 'select', 'boolean'] as const;
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

/** GCC-specific lead fields without code changes (SOW ID 15). */
export interface ICustomFieldDef extends Document<Types.ObjectId> {
  key: string;
  label: string;
  type: CustomFieldType;
  options: string[];
  required: boolean;
  module: 'lead';
  isActive: boolean;
  sortOrder: number;
}
const customFieldDefSchema = new Schema<ICustomFieldDef>(
  {
    key: { type: String, required: true, unique: true, trim: true },
    label: { type: String, required: true, trim: true },
    type: { type: String, enum: CUSTOM_FIELD_TYPES, required: true },
    options: { type: [String], default: [] },
    required: { type: Boolean, default: false },
    module: { type: String, enum: ['lead'], default: 'lead' },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);
export const CustomFieldDef = mongoose.model<ICustomFieldDef>('CustomFieldDef', customFieldDefSchema);
