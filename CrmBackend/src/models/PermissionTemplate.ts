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

export interface IPermissionTemplate extends Document<Types.ObjectId> {
  key: string;
  name: string;
  description?: string;
  permissions: ModulePermission[];
  dataScope: DataScope;
  fieldRules: FieldRule[];
  /** seeded system templates cannot be deleted, only edited */
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const templateSchema = new Schema<IPermissionTemplate>(
  {
    key: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    permissions: {
      type: [
        new Schema<ModulePermission>(
          {
            module: { type: String, enum: MODULES, required: true },
            actions: [{ type: String, enum: ACTIONS }],
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    dataScope: { type: String, enum: DATA_SCOPES, default: 'own' },
    fieldRules: {
      type: [
        new Schema<FieldRule>(
          {
            field: { type: String, required: true },
            mode: { type: String, enum: FIELD_RULE_MODES, required: true },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    isSystem: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const PermissionTemplate = mongoose.model<IPermissionTemplate>(
  'PermissionTemplate',
  templateSchema
);
