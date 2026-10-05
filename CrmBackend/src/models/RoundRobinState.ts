import mongoose, { Schema, Types, Document } from 'mongoose';

/** Pointer for fair rotation (SOW ID 71: round-robin lead distribution). */
export interface IRoundRobinState extends Document<Types.ObjectId> {
  key: string;
  lastUser?: Types.ObjectId;
}

const roundRobinSchema = new Schema<IRoundRobinState>({
  key: { type: String, required: true, unique: true },
  lastUser: { type: Schema.Types.ObjectId, ref: 'User' },
});

export const RoundRobinState = mongoose.model<IRoundRobinState>('RoundRobinState', roundRobinSchema);
