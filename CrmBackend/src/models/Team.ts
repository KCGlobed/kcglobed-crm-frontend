import mongoose, { Schema, Types, Document } from 'mongoose';

/**
 * SOW ID 4 asks for departments, teams and counsellor groups in one hierarchy.
 * They share a shape, so `type` distinguishes them instead of three collections.
 */
export const TEAM_TYPES = ['department', 'team', 'counsellor_group'] as const;
export type TeamType = (typeof TEAM_TYPES)[number];

export interface ITeam extends Document<Types.ObjectId> {
  name: string;
  /** short unique code used in reports and exports, e.g. ADM-MUM */
  code?: string;
  type: TeamType;
  description?: string;
  manager?: Types.ObjectId;
  parent?: Types.ObjectId;
  location?: string;
  /** programs this team handles — groundwork for program routing (SOW ID 72) */
  programs: Types.ObjectId[];
  /** when false, members are skipped by round-robin even if they receive leads */
  receivesLeads: boolean;
  isActive: boolean;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const teamSchema = new Schema<ITeam>(
  {
    name: { type: String, required: true, trim: true, unique: true },
    code: { type: String, trim: true, uppercase: true },
    type: { type: String, enum: TEAM_TYPES, default: 'team' },
    description: { type: String, trim: true },
    manager: { type: Schema.Types.ObjectId, ref: 'User' },
    parent: { type: Schema.Types.ObjectId, ref: 'Team' },
    location: { type: String, trim: true },
    programs: [{ type: Schema.Types.ObjectId, ref: 'Program' }],
    receivesLeads: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

teamSchema.index({ code: 1 }, { unique: true, partialFilterExpression: { code: { $type: 'string' } } });
teamSchema.index({ parent: 1 });
teamSchema.index({ manager: 1 });

export const Team = mongoose.model<ITeam>('Team', teamSchema);
