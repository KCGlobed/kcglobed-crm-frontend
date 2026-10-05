import mongoose, { Schema, Types, Document } from 'mongoose';

/**
 * Student profile (Deep Dive: Lead Management Module §4.2), one per lead.
 * Sections mirror the form steps: personal + guardian (step 1), academic (step 2),
 * work (step 3), declaration (step 4). Documents (step 4 uploads) are not built yet.
 */
export interface ILeadProfile extends Document<Types.ObjectId> {
  lead: Types.ObjectId;
  personal?: {
    firstName: string;
    lastName: string;
    email: string;
    mobile: string;
    /** YYYY-MM-DD — kept as a calendar date, no timezone */
    dob: string;
    gender: string;
    state: string;
    city: string;
    pinCode: string;
    address?: string;
  };
  guardian?: {
    name: string;
    relationship: string;
    mobile: string;
    email?: string;
  };
  academic?: {
    class10: { yearOfPassing: number; gradeType: string; score: number; medium: string };
    class12: { yearOfPassing: number; gradeType: string; score: number; medium: string };
    ug: {
      qualification: string;
      status: string;
      institution: string;
      gradeType?: string;
      score?: number;
      yearOfPassing: number;
      medium: string;
    };
    higherQualification: { has: boolean; details?: string };
  };
  work?: {
    employmentStatus: string;
    organization?: string;
    designation?: string;
    functionalArea?: string;
    experienceYears?: number;
    experienceMonths?: number;
  };
  declaration?: { accepted: boolean; acceptedAt: Date; acceptedBy: Types.ObjectId; textVersion: string };
  /** set after the declaration (Deep Dive LM-17); only an admin can unlock */
  locked?: boolean;
  unlockHistory?: { by: Types.ObjectId; at: Date; reason: string }[];
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const leadProfileSchema = new Schema<ILeadProfile>(
  {
    lead: { type: Schema.Types.ObjectId, ref: 'Lead', required: true, unique: true },
    // Sections are validated by zod per step, so they are stored as plain objects.
    personal: { type: Schema.Types.Mixed },
    guardian: { type: Schema.Types.Mixed },
    academic: { type: Schema.Types.Mixed },
    work: { type: Schema.Types.Mixed },
    declaration: {
      accepted: { type: Boolean },
      acceptedAt: { type: Date },
      acceptedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      textVersion: { type: String },
    },
    locked: { type: Boolean, default: false },
    unlockHistory: [
      {
        _id: false,
        by: { type: Schema.Types.ObjectId, ref: 'User' },
        at: { type: Date },
        reason: { type: String },
      },
    ],
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, minimize: true }
);

export const LeadProfile = mongoose.model<ILeadProfile>('LeadProfile', leadProfileSchema);
