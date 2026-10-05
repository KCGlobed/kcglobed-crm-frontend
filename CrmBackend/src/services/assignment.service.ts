import { Types } from 'mongoose';
import { User } from '../models/User';
import { RoundRobinState } from '../models/RoundRobinState';
import { Team } from '../models/Team';

/**
 * Round-robin distribution (SOW ID 71): pure rotation over active users who
 * have `receivesLeads` ticked, skipping members of teams whose distribution is
 * paused (or that are inactive). Weighted rules are a Phase-2 concern (Q-07) —
 * this is the single place they would plug into.
 */
export async function pickNextOwner(): Promise<Types.ObjectId | null> {
  const pausedTeams = await Team.find({ $or: [{ receivesLeads: false }, { isActive: false }] }).distinct('_id');
  const pool = await User.find({
    isActive: true,
    receivesLeads: true,
    ...(pausedTeams.length ? { team: { $nin: pausedTeams } } : {}),
  })
    .select('_id')
    .sort({ _id: 1 })
    .lean();
  if (!pool.length) return null;

  const state = await RoundRobinState.findOneAndUpdate(
    { key: 'leads' },
    { $setOnInsert: { key: 'leads' } },
    { upsert: true, returnDocument: 'after' }
  );

  let next = pool[0]._id;
  if (state.lastUser) {
    const idx = pool.findIndex((u) => String(u._id) === String(state.lastUser));
    next = pool[(idx + 1) % pool.length]._id;
  }
  state.lastUser = next;
  await state.save();
  return next;
}
