import { Types } from 'mongoose';
import { Team } from '../models/Team';
import { User } from '../models/User';
import { getDescendantIds } from '../services/team.service';

interface ScopeUser {
  id: string;
  isSuperAdmin: boolean;
  dataScope: string;
  team?: string;
}

/**
 * Translates the user's data scope (SOW permission builder step 5) into a Mongo
 * filter on `owner`. Returns {} when the user may see everything.
 *
 * own  → records they own
 * team → records owned by anyone in their team, teams they manage, every team
 *        below those at any depth, or their direct reports
 * all  → no restriction
 * location/program/cohort → currently resolved as "team" until those scopes
 *        get their own reference data (documented in docs/ARCHITECTURE.md §9).
 */
export async function buildOwnerScopeFilter(user: ScopeUser): Promise<Record<string, unknown>> {
  if (user.isSuperAdmin || user.dataScope === 'all') return {};
  if (user.dataScope === 'own') return { owner: new Types.ObjectId(user.id) };

  const managedTeams = await Team.find({ manager: user.id }).select('_id').lean();
  const baseTeamIds: Types.ObjectId[] = managedTeams.map((t) => t._id);
  if (user.team) baseTeamIds.push(new Types.ObjectId(user.team));

  const teamIds = [...baseTeamIds, ...(await getDescendantIds(baseTeamIds))];

  const members = await User.find({
    $or: [
      ...(teamIds.length ? [{ team: { $in: teamIds } }] : []),
      { reportingManager: user.id },
    ],
  })
    .select('_id')
    .lean();

  const ownerIds = new Set<string>(members.map((m) => String(m._id)));
  ownerIds.add(user.id);
  return { owner: { $in: [...ownerIds].map((id) => new Types.ObjectId(id)) } };
}
