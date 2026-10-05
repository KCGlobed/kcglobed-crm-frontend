import mongoose, { Schema, Types, Document } from 'mongoose';

/** Structured + free-text lead notes (SOW ID 28). */
export interface INote extends Document<Types.ObjectId> {
  lead: Types.ObjectId;
  body: string;
  category?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const noteSchema = new Schema<INote>(
  {
    lead: { type: Schema.Types.ObjectId, ref: 'Lead', required: true },
    body: { type: String, required: true, trim: true },
    category: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

noteSchema.index({ lead: 1, createdAt: -1 });

export const Note = mongoose.model<INote>('Note', noteSchema);
