import { asyncHandler } from '../utils/asyncHandler';
import { buildPagination, created, ok } from '../utils/respond';
import { parseListQuery } from '../utils/pagination';
import { audit } from '../services/audit.service';
import * as teamService from '../services/team.service';

export const list = asyncHandler(async (req, res) => {
  const query = parseListQuery(req, ['name', 'code', 'type', 'createdAt', 'updatedAt'], 'name');
  const { items, total } = await teamService.listTeams(query, {
    isActive: req.query.is_active as string | undefined,
    type: req.query.type as string | undefined,
    parent: req.query.parent as string | undefined,
    manager: req.query.manager as string | undefined,
    location: req.query.location as string | undefined,
  });
  ok(res, 'Teams fetched successfully', items, buildPagination(total, query.page, query.pageSize));
});

export const options = asyncHandler(async (_req, res) => {
  ok(res, 'Team options fetched successfully', await teamService.teamOptions());
});

export const tree = asyncHandler(async (req, res) => {
  const roots = await teamService.getTeamTree(req.query.include_inactive === 'true');
  ok(res, 'Team hierarchy fetched successfully', roots);
});

export const create = asyncHandler(async (req, res) => {
  const team = await teamService.createTeam(req.body, req.user!.id);
  audit(req, { action: 'create', module: 'teams', entityType: 'Team', entityId: String(team._id), after: team.toObject() });
  created(res, 'Team created successfully', team);
});

export const getById = asyncHandler(async (req, res) => {
  ok(res, 'Team fetched successfully', await teamService.getTeamDetail(req.params.id));
});

export const update = asyncHandler(async (req, res) => {
  const { before, team } = await teamService.updateTeam(req.params.id, req.body);
  audit(req, { action: 'update', module: 'teams', entityType: 'Team', entityId: String(team._id), before, after: team.toObject() });
  ok(res, 'Team updated successfully', team);
});

export const remove = asyncHandler(async (req, res) => {
  const team = await teamService.deactivateTeam(req.params.id);
  audit(req, { action: 'deactivate', module: 'teams', entityType: 'Team', entityId: String(team._id) });
  ok(res, 'Team deactivated successfully', team);
});

export const stats = asyncHandler(async (req, res) => {
  const data = await teamService.getTeamStats(req.params.id, req.query.include_sub_teams === 'true');
  ok(res, 'Team stats fetched successfully', data);
});

export const addMembers = asyncHandler(async (req, res) => {
  const { before, ...result } = await teamService.addMembers(
    req.params.id,
    req.body.userIds,
    req.body.setReportingManager ?? false,
    req.user!.id
  );
  audit(req, {
    action: 'add_members',
    module: 'teams',
    entityType: 'Team',
    entityId: req.params.id,
    before,
    after: { userIds: req.body.userIds, setReportingManager: !!req.body.setReportingManager },
  });
  const message = result.added
    ? `${result.added} member(s) added to the team`
    : 'Selected users are already in this team';
  ok(res, message, result);
});

export const removeMember = asyncHandler(async (req, res) => {
  const user = await teamService.removeMember(req.params.id, req.params.userId);
  audit(req, {
    action: 'remove_member',
    module: 'teams',
    entityType: 'Team',
    entityId: req.params.id,
    before: { user: String(user._id), team: req.params.id },
  });
  ok(res, `${user.name} removed from the team`, null);
});
