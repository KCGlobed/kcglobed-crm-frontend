import mongoose, { Schema, Types, Document } from 'mongoose';

export const LEAD_STATUSES = ['active', 'converted', 'lost'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_TRACKS = ['ads', 'partner', 'other'] as const;
export type LeadTrack = (typeof LEAD_TRACKS)[number];

export const LEAD_CHANNELS_IN = ['manual', 'capture', 'import', 'meta', 'google'] as const;
export type LeadCreatedVia = (typeof LEAD_CHANNELS_IN)[number];

export interface ILead extends Document<Types.ObjectId> {
  leadNo: string;
  firstName: string;
  lastName?: string;
  email?: string;
  mobile: string;
  altMobile?: string;
  city?: string;
  state?: string;
  country?: string;

  /** first-touch attribution is immutable after creation (SOW ID 38) */
  firstSource?: Types.ObjectId;
  /** latest-touch source, updated on re-enquiry (SOW ID 19/39) */
  source?: Types.ObjectId;
  utm: {
    source?: string;
    medium?: string;
    campaign?: string;
    term?: string;
    content?: string;
    landingPage?: string;
  };
  referral: {
    code?: string;
    partnerName?: string;
    partnerLink?: string;
  };
  track: LeadTrack;

  programInterest?: Types.ObjectId;
  cohort?: Types.ObjectId;

  stage?: Types.ObjectId;
  /** _id of one of the stage's subStages */
  subStage?: Types.ObjectId | null;
  stageChangedAt?: Date;
  status: LeadStatus;
  lastDisposition?: string;

  owner?: Types.ObjectId;
  assignedAt?: Date;

  tags: Types.ObjectId[];
  score: number;
  consent: { email: boolean; sms: boolean; whatsapp: boolean; optedOutAt?: Date };
  customFields: Map<string, unknown>;

  lastActivityAt?: Date;
  createdVia: LeadCreatedVia;
  createdBy?: Types.ObjectId;

  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

const leadSchema = new Schema<ILead>(
  {
    leadNo: { type: String, required: true, unique: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    mobile: { type: String, required: true, trim: true },
    altMobile: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    country: { type: String, trim: true, default: 'India' },

    firstSource: { type: Schema.Types.ObjectId, ref: 'Source' },
    source: { type: Schema.Types.ObjectId, ref: 'Source' },
    utm: {
      source: String,
      medium: String,
      campaign: String,
      term: String,
      content: String,
      landingPage: String,
    },
    referral: {
      code: String,
      partnerName: String,
      partnerLink: String,
    },
    track: { type: String, enum: LEAD_TRACKS, default: 'other' },

    programInterest: { type: Schema.Types.ObjectId, ref: 'Program' },
    cohort: { type: Schema.Types.ObjectId, ref: 'Cohort' },

    stage: { type: Schema.Types.ObjectId, ref: 'Stage' },
    subStage: { type: Schema.Types.ObjectId },
    stageChangedAt: { type: Date },
    status: { type: String, enum: LEAD_STATUSES, default: 'active' },
    lastDisposition: { type: String },

    owner: { type: Schema.Types.ObjectId, ref: 'User' },
    assignedAt: { type: Date },

    tags: [{ type: Schema.Types.ObjectId, ref: 'Tag' }],
    score: { type: Number, default: 0 },
    consent: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: true },
      whatsapp: { type: Boolean, default: true },
      optedOutAt: { type: Date },
    },
    customFields: { type: Map, of: Schema.Types.Mixed, default: {} },

    lastActivityAt: { type: Date },
    createdVia: { type: String, enum: LEAD_CHANNELS_IN, default: 'manual' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },

    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Duplicate blocking (SOW ID 16): unique among non-deleted leads.
leadSchema.index(
  { mobile: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);
leadSchema.index(
  { email: 1 },
  {
    unique: true,
    partialFilterExpression: { isDeleted: false, email: { $exists: true, $type: 'string' } },
  }
);
leadSchema.index({ owner: 1, stage: 1 });
leadSchema.index({ stage: 1 });
leadSchema.index({ source: 1 });
leadSchema.index({ createdAt: -1 });
leadSchema.index({ firstName: 1, lastName: 1 });

export const Lead = mongoose.model<ILead>('Lead', leadSchema);
