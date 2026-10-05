import mongoose, { Schema, Types, Document } from 'mongoose';
import {
  ACTIONS,
  DATA_SCOPES,
  DataScope,
  FIELD_RULE_MODES,
  FieldRule,
  MODULES,
  ModulePermission,
} from '../constants/permissions';

export interface IUser extends Document<Types.ObjectId> {
  name: string;
  email: string;
  passwordHash: string;
  mobile?: string;
  designation?: string;
  isSuperAdmin: boolean;
  isActive: boolean;
  /** user participates in round-robin lead distribution */
  receivesLeads: boolean;
  team?: Types.ObjectId;
  reportingManager?: Types.ObjectId;
  permissions: ModulePermission[];
  dataScope: DataScope;
  fieldRules: FieldRule[];
  /** template key this user's permissions were pre-filled from (display only) */
  templateKey?: string;
  lastLoginAt?: Date;
  passwordResetTokenHash?: string;
  passwordResetExpires?: Date;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const modulePermissionSchema = new Schema<ModulePermission>(
  {
    module: { type: String, enum: MODULES, required: true },
    actions: [{ type: String, enum: ACTIONS }],
  },
  { _id: false }
);

const fieldRuleSchema = new Schema<FieldRule>(
  {
    field: { type: String, required: true },
    mode: { type: String, enum: FIELD_RULE_MODES, required: true },
  },
  { _id: false }
);

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    mobile: { type: String, trim: true },
    designation: { type: String, trim: true },
    isSuperAdmin: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    receivesLeads: { type: Boolean, default: false },
    team: { type: Schema.Types.ObjectId, ref: 'Team' },
    reportingManager: { type: Schema.Types.ObjectId, ref: 'User' },
    permissions: { type: [modulePermissionSchema], default: [] },
    dataScope: { type: String, enum: DATA_SCOPES, default: 'own' },
    fieldRules: { type: [fieldRuleSchema], default: [] },
    templateKey: { type: String },
    lastLoginAt: { type: Date },
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

userSchema.index({ isActive: 1, receivesLeads: 1 });

export const User = mongoose.model<IUser>('User', userSchema);
