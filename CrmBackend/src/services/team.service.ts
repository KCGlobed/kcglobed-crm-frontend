import { QueryFilter, Types } from 'mongoose';
import { ITeam, Team } from '../models/Team';
import { User } from '../models/User';
import { Lead } from '../models/Lead';
import { Program } from '../models/masters';
import { ApiError } from '../utils/ApiError';
import { escapeRegex } from '../utils/pagination';
import { ListQuery } from '../types/api';
import { notify } from './notification.service';

type TeamPayload = Partial<{
  name: string;
  code: string | null;
  type: ITeam['type'];
  description: string | null;
  manager: string | null;
  parent: string | null;
  location: string | null;
  programs: string[];
  receivesLeads: boolean;
  isActive: boolean;
}>;

interface TeamFilters {
  isActive?: string;
  type?: string;
  parent?: string;
  manager?: string;
  location?: string;
}

const toId = (id: string | Types.ObjectId) => new Types.ObjectId(String(id));

/* ------------------------------------------------------------------ hierarchy */

/** Every team below the given roots, at any depth (roots excluded). */
export async function getDescendantIds(rootIds: (string | Types.ObjectId)[]): Promise<Types.ObjectId[]> {
  if (!rootIds.length) return [];
  const rows = await Team.aggregate<{ descendants: { _id: Types.ObjectId }[] }>([
    { $match: { _id: { $in: rootIds.map(toId) } } },
    {
      $graphLookup: {
        from: Team.collection.name,
        startWith: '$_id',
        connectFromField: '_id',
        connectToField: 'parent',
        as: 'descendants',
      },
    },
    { $project: { 'descendants._id': 1 } },
  ]);
  const seen = new Map<string, Types.ObjectId>();
  for (const row of rows) for (const d of row.descendants) seen.set(String(d._id), d._id);
  return [...seen.values()];
}

/** Parent chain from the top-level team down to the direct parent. */
async function getAncestors(teamId: Types.ObjectId) {
  const [row] = await Team.aggregate<{ ancestors: { _id: Types.ObjectId; name: string; code?: string; type: string; depth: number }[] }>([
    { $match: { _id: teamId } },
    {
      $graphLookup: {
        from: Team.collection.name,
        startWith: '$parent',
        connectFromField: 'parent',
        connectToField: '_id',
        as: 'ancestors',
        depthField: 'depth',
      },
    },
    { $project: { 'ancestors._id': 1, 'ancestors.name': 1, 'ancestors.code': 1, 'ancestors.type': 1, 'ancestors.depth': 1 } },
  ]);
  return (row?.ancestors ?? [])
    .sort((a, b) => b.depth - a.depth)
    .map(({ depth: _depth, ...a }) => a);
}

async function countMembers(teamIds: Types.ObjectId[]) {
  const rows = await User.aggregate<{ _id: Types.ObjectId; total: number; active: number }>([
    { $match: { team: { $in: teamIds } } },
    {
      $group: {
        _id: '$team',
        total: { $sum: 1 },
        active: { $sum: { $cond: ['$isActive', 1, 0] } },
      },
    },
  ]);
  return new Map(rows.map((r) => [String(r._id), r]));
}

async function countSubTeams(teamIds: Types.ObjectId[]) {
  const rows = await Team.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { parent: { $in: teamIds }, isActive: true } },
    { $group: { _id: '$parent', count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.count]));
}

/* ----------------------------------------------------------------- validation */

/** Blank optional strings from forms arrive as '' — store them as unset. */
function normalise(payload: TeamPayload): TeamPayload {
  const out: TeamPayload = { ...payload };
  for (const key of ['code', 'description', 'location', 'manager', 'parent'] as const) {
    if (out[key] === '') out[key] = null;
  }
  if (typeof out.code === 'string') out.code = out.code.toUpperCase();
  return out;
}

async function assertUnique(payload: TeamPayload, excludeId?: Types.ObjectId) {
  const notSelf = excludeId ? { _id: { $ne: excludeId } } : {};
  if (payload.name) {
    const clash = await Team.exists({ ...notSelf, name: new RegExp(`^${escapeRegex(payload.name)}$`, 'i') });
    if (clash) {
      throw ApiError.conflict('A team with this name already exists', { name: 'A team with this name already exists' });
    }
  }
  if (payload.code) {
    const clash = await Team.exists({ ...notSelf, code: payload.code });
    if (clash) {
      throw ApiError.conflict('This team code is already in use', { code: 'This team code is already in use' });
    }
  }
}

async function assertRelations(payload: TeamPayload, teamId?: Types.ObjectId) {
  if (payload.parent) {
    if (teamId && String(payload.parent) === String(teamId)) {
      throw ApiError.badRequest('A team cannot be its own parent', { parent: 'A team cannot be its own parent' });
    }
    const parent = await Team.findById(payload.parent).select('isActive').lean();
    if (!parent) throw ApiError.badRequest('Parent team not found', { parent: 'Parent team not found' });
    if (!parent.isActive) {
      throw ApiError.unprocessable('The parent team is inactive', { parent: 'Pick an active parent team' });
    }
    if (teamId) {
      const below = await getDescendantIds([teamId]);
      if (below.some((d) => String(d) === String(payload.parent))) {
        throw ApiError.unprocessable('A team cannot report into one of its own sub-teams', {
          parent: 'This team is above the selected parent — pick another',
        });
      }
    }
  }
  if (payload.manager) {
    const manager = await User.findById(payload.manager).select('isActive').lean();
    if (!manager || !manager.isActive) {
      throw ApiError.badRequest('Manager must be an active user', { manager: 'Manager must be an active user' });
    }
  }
  if (payload.programs?.length) {
    const unique = [...new Set(payload.programs)];
    const found = await Program.countDocuments({ _id: { $in: unique } });
    if (found !== unique.length) {
      throw ApiError.badRequest('One or more programs were not found', { programs: 'One or more programs were not found' });
    }
    payload.programs = unique;
  }
}

/** A team can only be switched off once nobody active is left in or under it. */
async function assertCanDeactivate(teamId: Types.ObjectId) {
  const [activeMembers, activeSubTeams] = await Promise.all([
    User.countDocuments({ team: teamId, isActive: true }),
    Team.countDocuments({ parent: teamId, isActive: true }),
  ]);
  if (activeMembers > 0) {
    throw ApiError.unprocessable(
      `This team still has ${activeMembers} active member(s). Move them to another team first.`
    );
  }
  if (activeSubTeams > 0) {
    throw ApiError.unprocessable(
      `This team still has ${activeSubTeams} active sub-team(s). Move or deactivate them first.`
    );
  }
}

/* ---------------------------------------------------------------------- CRUD */

export async function listTeams(query: ListQuery, filters: TeamFilters) {
  const where: QueryFilter<ITeam> = {};
  if (query.search) {
    const rx = new RegExp(escapeRegex(query.search), 'i');
    where.$or = [{ name: rx }, { code: rx }, { location: rx }];
  }
  if (filters.isActive === 'true') where.isActive = true;
  if (filters.isActive === 'false') where.isActive = false;
  if (filters.type) where.type = filters.type as ITeam['type'];
  if (filters.parent === 'root') where.parent = null;
  else if (filters.parent && Types.ObjectId.isValid(filters.parent)) where.parent = toId(filters.parent);
  if (filters.manager && Types.ObjectId.isValid(filters.manager)) where.manager = toId(filters.manager);
  if (filters.location) where.location = new RegExp(escapeRegex(filters.location), 'i');

  const [items, total] = await Promise.all([
    Team.find(where)
      .populate('manager', 'name email')
      .populate('parent', 'name code')
      .populate('programs', 'name code')
      .sort({ [query.sortBy]: query.sortOrder })
      .skip((query.page - 1) * query.pageSize)
      .limit(query.pageSize)
      .lean(),
    Team.countDocuments(where),
  ]);

  const ids = items.map((t) => t._id);
  const [members, subTeams] = await Promise.all([countMembers(ids), countSubTeams(ids)]);
  const data = items.map((t) => ({
    ...t,
    memberCount: members.get(String(t._id))?.active ?? 0,
    subTeamCount: subTeams.get(String(t._id)) ?? 0,
  }));
  return { items: data, total };
}

/** Lightweight active-team list for dropdowns (user form, filters). */
export async function teamOptions() {
  return Team.find({ isActive: true }).select('name code type parent').sort({ name: 1 }).lean();
}

interface TreeNode {
  _id: Types.ObjectId;
  name: string;
  code?: string;
  type: string;
  location?: string;
  isActive: boolean;
  receivesLeads: boolean;
  manager?: { _id: Types.ObjectId; name: string } | null;
  memberCount: number;
  /** members in this team plus every team below it */
  totalMembers: number;
  children: TreeNode[];
}

/** Whole org chart in one call — the hierarchy is small, so it's built in memory. */
export async function getTeamTree(includeInactive: boolean) {
  const teams = await Team.find(includeInactive ? {} : { isActive: true })
    .select('name code type location isActive receivesLeads manager parent')
    .populate('manager', 'name')
    .sort({ name: 1 })
    .lean();
  const members = await countMembers(teams.map((t) => t._id));

  const nodes = new Map<string, TreeNode>();
  for (const t of teams) {
    nodes.set(String(t._id), {
      _id: t._id,
      name: t.name,
      code: t.code,
      type: t.type,
      location: t.location,
      isActive: t.isActive,
      receivesLeads: t.receivesLeads,
      manager: t.manager as unknown as TreeNode['manager'],
      memberCount: members.get(String(t._id))?.active ?? 0,
      totalMembers: 0,
      children: [],
    });
  }

  const roots: TreeNode[] = [];
  for (const t of teams) {
    const node = nodes.get(String(t._id))!;
    const parent = t.parent ? nodes.get(String(t.parent)) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  const rollUp = (node: TreeNode): number => {
    node.totalMembers = node.memberCount + node.children.reduce((sum, c) => sum + rollUp(c), 0);
    return node.totalMembers;
  };
  roots.forEach(rollUp);
  return roots;
}

export async function getTeamDetail(id: string) {
  const team = await Team.findById(id)
    .populate('manager', 'name email designation mobile')
    .populate('parent', 'name code type')
    .populate('programs', 'name code')
    .populate('createdBy', 'name')
    .lean();
  if (!team) throw ApiError.notFound('Team not found');

  const [ancestors, children, members] = await Promise.all([
    getAncestors(team._id),
    Team.find({ parent: team._id })
      .select('name code type isActive location manager receivesLeads')
      .populate('manager', 'name')
      .sort({ isActive: -1, name: 1 })
      .lean(),
    User.find({ team: team._id })
      .select('name email mobile designation isActive receivesLeads reportingManager lastLoginAt')
      .populate('reportingManager', 'name')
      .sort({ isActive: -1, name: 1 })
      .lean(),
  ]);

  const childMembers = await countMembers(children.map((c) => c._id));
  return {
    ...team,
    ancestors,
    children: children.map((c) => ({ ...c, memberCount: childMembers.get(String(c._id))?.active ?? 0 })),
    members,
    memberCount: members.filter((m) => m.isActive).length,
  };
}

export async function createTeam(raw: TeamPayload, actorId: string) {
  const payload = normalise(raw);
  await assertUnique(payload);
  await assertRelations(payload);
  // null only means "clear this" on update; on create the field is simply left out.
  const fields: Record<string, unknown> = Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== null));
  return Team.create({ ...fields, createdBy: actorId });
}

export async function updateTeam(id: string, raw: TeamPayload) {
  const team = await Team.findById(id);
  if (!team) throw ApiError.notFound('Team not found');
  const payload = normalise(raw);

  await assertUnique(payload, team._id);
  await assertRelations(payload, team._id);

  if (payload.isActive === false && team.isActive) await assertCanDeactivate(team._id);
  if (payload.isActive === true && !team.isActive) {
    const parentId = payload.parent !== undefined ? payload.parent : team.parent;
    if (parentId) {
      const parent = await Team.findById(parentId).select('isActive').lean();
      if (parent && !parent.isActive) {
        throw ApiError.unprocessable('Reactivate the parent team first, or move this team under an active one');
      }
    }
  }

  const before = team.toObject();
  team.set(payload);
  await team.save();
  return { before, team };
}

export async function deactivateTeam(id: string) {
  const team = await Team.findById(id);
  if (!team) throw ApiError.notFound('Team not found');
  if (!team.isActive) return team;
  await assertCanDeactivate(team._id);
  team.isActive = false;
  await team.save();
  return team;
}

/* ------------------------------------------------------------------- members */

export async function addMembers(
  id: string,
  userIds: string[],
  setReportingManager: boolean,
  actorId: string
) {
  const team = await Team.findById(id).select('name isActive manager').lean();
  if (!team) throw ApiError.notFound('Team not found');
  if (!team.isActive) throw ApiError.unprocessable('Members cannot be added to an inactive team');

  const ids = [...new Set(userIds)];
  const users = await User.find({ _id: { $in: ids } }).select('name team isActive').lean();
  if (users.length !== ids.length) {
    throw ApiError.badRequest('One or more users were not found', { userIds: 'One or more users were not found' });
  }
  const inactive = users.filter((u) => !u.isActive);
  if (inactive.length) {
    throw ApiError.unprocessable(`Inactive users cannot be added: ${inactive.map((u) => u.name).join(', ')}`);
  }

  const moving = users.filter((u) => String(u.team ?? '') !== String(team._id));
  if (moving.length) {
    await User.updateMany({ _id: { $in: moving.map((u) => u._id) } }, { $set: { team: team._id } });
  }
  if (setReportingManager && team.manager) {
    // The manager can be a member of their own team but never reports to themselves.
    const reportees = ids.filter((u) => u !== String(team.manager));
    await User.updateMany({ _id: { $in: reportees } }, { $set: { reportingManager: team.manager } });
  }

  for (const u of moving) {
    if (String(u._id) === actorId) continue;
    notify(u._id, 'system', `You were added to ${team.name}`, undefined, { teamId: String(team._id) });
  }

  return {
    added: moving.length,
    alreadyMembers: users.length - moving.length,
    before: moving.map((u) => ({ user: String(u._id), previousTeam: u.team ? String(u.team) : null })),
  };
}

export async function removeMember(id: string, userId: string) {
  const team = await Team.findById(id).select('name').lean();
  if (!team) throw ApiError.notFound('Team not found');
  const user = await User.findOne({ _id: userId, team: team._id }).select('name');
  if (!user) throw ApiError.notFound('This user is not a member of the team');
  await User.updateOne({ _id: user._id }, { $unset: { team: 1 } });
  return user;
}

/* --------------------------------------------------------------------- stats */

/**
 * Lead workload per member (SOW IDs 96/101 groundwork). With `includeSubTeams`
 * the numbers roll up everyone below the team as well.
 */
export async function getTeamStats(id: string, includeSubTeams: boolean) {
  const team = await Team.findById(id).select('_id').lean();
  if (!team) throw ApiError.notFound('Team not found');

  const teamIds = [team._id, ...(includeSubTeams ? await getDescendantIds([team._id]) : [])];
  const members = await User.find({ team: { $in: teamIds } })
    .select('name designation isActive receivesLeads team')
    .populate('team', 'name')
    .lean();
  const memberIds = members.map((m) => m._id);

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const rows = memberIds.length
    ? await Lead.aggregate<{
        _id: Types.ObjectId;
        total: number;
        active: number;
        converted: number;
        lost: number;
        assignedThisWeek: number;
      }>([
        { $match: { owner: { $in: memberIds }, isDeleted: false } },
        {
          $group: {
            _id: '$owner',
            total: { $sum: 1 },
            active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
            converted: { $sum: { $cond: [{ $eq: ['$status', 'converted'] }, 1, 0] } },
            lost: { $sum: { $cond: [{ $eq: ['$status', 'lost'] }, 1, 0] } },
            assignedThisWeek: { $sum: { $cond: [{ $gte: ['$assignedAt', weekAgo] }, 1, 0] } },
          },
        },
      ])
    : [];
  const byOwner = new Map(rows.map((r) => [String(r._id), r]));

  const empty = { total: 0, active: 0, converted: 0, lost: 0, assignedThisWeek: 0 };
  const byMember = members
    .map((m) => {
      const { _id: _ignored, ...counts } = byOwner.get(String(m._id)) ?? { _id: null, ...empty };
      return { user: m, ...counts };
    })
    .sort((a, b) => b.total - a.total || a.user.name.localeCompare(b.user.name));

  const totals = byMember.reduce(
    (acc, m) => ({
      total: acc.total + m.total,
      active: acc.active + m.active,
      converted: acc.converted + m.converted,
      lost: acc.lost + m.lost,
      assignedThisWeek: acc.assignedThisWeek + m.assignedThisWeek,
    }),
    { ...empty }
  );
  const closed = totals.converted + totals.lost;

  return {
    includeSubTeams,
    teamCount: teamIds.length,
    totals: {
      ...totals,
      members: members.filter((m) => m.isActive).length,
      receivingLeads: members.filter((m) => m.isActive && m.receivesLeads).length,
      conversionRate: closed ? Math.round((totals.converted / closed) * 1000) / 10 : null,
    },
    byMember,
  };
}
