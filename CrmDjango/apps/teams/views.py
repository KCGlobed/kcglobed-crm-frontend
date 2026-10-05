from apps.audit.services import audit
from common.pagination import parse_list_query
from common.responses import build_pagination, created, ok
from common.validation import validated
from common.views import ApiView

from . import services
from .serializers import AddMembersSerializer, TeamSerializer


class TeamOptionsView(ApiView):
    def get(self, request):
        return ok('Team options fetched successfully', services.team_options())


class TeamTreeView(ApiView):
    required_permissions = {'GET': ('teams', 'view')}

    def get(self, request):
        roots = services.team_tree(request.query_params.get('include_inactive') == 'true')
        return ok('Team hierarchy fetched successfully', roots)


class TeamListView(ApiView):
    required_permissions = {'GET': ('teams', 'view'), 'POST': ('teams', 'create')}

    def get(self, request):
        query = parse_list_query(request, ['name', 'code', 'type', 'createdAt', 'updatedAt'], 'name')
        items, total = services.list_teams(query, request.query_params)
        return ok('Teams fetched successfully', items, build_pagination(total, query.page, query.page_size))

    def post(self, request):
        data = validated(TeamSerializer, request.data)
        team = services.create_team(data, request.user.id)
        doc = services.team_doc(team)
        audit(request, 'create', 'teams', 'Team', team.id, after=doc)
        return created('Team created successfully', doc)


class TeamDetailView(ApiView):
    required_permissions = {'GET': ('teams', 'view'), 'PUT': ('teams', 'edit'), 'DELETE': ('teams', 'delete')}

    def get(self, request, team_id):
        return ok('Team fetched successfully', services.team_detail(team_id))

    def put(self, request, team_id):
        data = validated(TeamSerializer, request.data, partial=True)
        before, team = services.update_team(team_id, data)
        doc = services.team_doc(team)
        audit(request, 'update', 'teams', 'Team', team.id, before=before, after=doc)
        return ok('Team updated successfully', doc)

    def delete(self, request, team_id):
        team = services.deactivate_team(team_id)
        audit(request, 'deactivate', 'teams', 'Team', team.id)
        return ok('Team deactivated successfully', services.team_doc(team))


class TeamStatsView(ApiView):
    required_permissions = {'GET': ('teams', 'view')}

    def get(self, request, team_id):
        data = services.team_stats(team_id, request.query_params.get('include_sub_teams') == 'true')
        return ok('Team stats fetched successfully', data)


class TeamMembersView(ApiView):
    required_permissions = {'POST': ('teams', 'edit')}

    def post(self, request, team_id):
        data = validated(AddMembersSerializer, request.data)
        set_manager = data.get('setReportingManager', False)
        result = services.add_members(team_id, data['userIds'], set_manager, request.user.id)
        before = result.pop('before')
        audit(request, 'add_members', 'teams', 'Team', team_id, before=before, after={
            'userIds': data['userIds'], 'setReportingManager': bool(set_manager),
        })
        message = f"{result['added']} member(s) added to the team" if result['added'] else 'Selected users are already in this team'
        return ok(message, result)


class TeamMemberDetailView(ApiView):
    required_permissions = {'DELETE': ('teams', 'edit')}

    def delete(self, request, team_id, user_id):
        user = services.remove_member(team_id, user_id)
        audit(request, 'remove_member', 'teams', 'Team', team_id, before={'user': user.id, 'team': team_id})
        return ok(f'{user.name} removed from the team', None)
