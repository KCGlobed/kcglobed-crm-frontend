import mongoose, { Schema } from 'mongoose';

interface ICounter {
  _id: string;
  seq: number;
}

const counterSchema = new Schema<ICounter>({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

const Counter = mongoose.model<ICounter>('Counter', counterSchema);

/** Atomic sequence, used for human-readable numbers like LD-000123. */
export async function nextSequence(key: string): Promise<number> {
  const doc = await Counter.findByIdAndUpdate(
    key,
    { $inc: { seq: 1 } },
    { returnDocument: 'after', upsert: true }
  );
  return doc.seq;
}

/** Reserves `count` sequence values in one shot (bulk import) — returns the first. */
export async function nextSequenceRange(key: string, count: number): Promise<number> {
  const doc = await Counter.findByIdAndUpdate(
    key,
    { $inc: { seq: count } },
    { returnDocument: 'after', upsert: true }
  );
  return doc.seq - count + 1;
}
