from datetime import timedelta

from django.db.models import Count, Q
from django.utils import timezone

from apps.leads.models import Lead
from apps.masters.models import Source, Stage
from apps.users.models import User
from common.models import compact
from common.responses import ok
from common.scope import lead_scope_q
from common.views import ApiView


class DashboardSummaryView(ApiView):
    required_permissions = {'GET': ('dashboard', 'view')}

    def get(self, request):
        user = request.user
        base = Lead.objects.filter(lead_scope_q(user), is_deleted=False)

        now = timezone.localtime()
        start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
        # Week starts on Sunday, like JavaScript's getDay().
        start_of_week = start_of_day - timedelta(days=(start_of_day.weekday() + 1) % 7)

        totals = base.aggregate(
            total=Count('id'),
            newToday=Count('id', filter=Q(created_at__gte=start_of_day)),
            newThisWeek=Count('id', filter=Q(created_at__gte=start_of_week)),
            unassigned=Count('id', filter=Q(owner__isnull=True)),
            converted=Count('id', filter=Q(status='converted')),
            lost=Count('id', filter=Q(status='lost')),
        )

        stage_rows = base.values('stage_id').annotate(count=Count('id'))
        stages = Stage.objects.in_bulk([r['stage_id'] for r in stage_rows if r['stage_id']])
        by_stage = sorted(
            (
                compact({
                    '_id': r['stage_id'],
                    'name': stages[r['stage_id']].name if r['stage_id'] in stages else 'No stage',
                    'color': stages[r['stage_id']].color if r['stage_id'] in stages else None,
                    'order': stages[r['stage_id']].order if r['stage_id'] in stages else 999,
                    'count': r['count'],
                })
                for r in stage_rows
            ),
            key=lambda r: r['order'],
        )

        source_rows = list(base.values('source_id').annotate(count=Count('id')).order_by('-count')[:6])
        sources = Source.objects.in_bulk([r['source_id'] for r in source_rows if r['source_id']])
        by_source = [
            compact({
                '_id': r['source_id'],
                'name': sources[r['source_id']].name if r['source_id'] in sources else 'Unknown',
                'channel': sources[r['source_id']].channel if r['source_id'] in sources else None,
                'count': r['count'],
            })
            for r in source_rows
        ]

        owner_rows = list(base.filter(owner__isnull=False).values('owner_id').annotate(count=Count('id')).order_by('-count')[:6])
        owners = User.objects.in_bulk([r['owner_id'] for r in owner_rows])
        by_owner = [
            {'_id': r['owner_id'], 'name': owners[r['owner_id']].name if r['owner_id'] in owners else 'Unknown', 'count': r['count']}
            for r in owner_rows
        ]

        hide_mobile = any(rule.get('field') == 'mobile' for rule in user.field_rules)
        recent = base.select_related('stage', 'owner', 'source').order_by('-created_at')[:8]
        recent_leads = [
            compact({
                '_id': lead.id, 'leadNo': lead.lead_no, 'firstName': lead.first_name, 'lastName': lead.last_name,
                'mobile': None if hide_mobile else lead.mobile,
                'stage': compact({'_id': lead.stage.id, 'name': lead.stage.name, 'color': lead.stage.color}) if lead.stage else None,
                'owner': {'_id': lead.owner.id, 'name': lead.owner.name} if lead.owner else None,
                'source': {'_id': lead.source.id, 'name': lead.source.name} if lead.source else None,
                'createdAt': lead.created_at,
            })
            for lead in recent
        ]

        my_leads_today = Lead.objects.filter(is_deleted=False, owner_id=user.id, assigned_at__gte=start_of_day).count()

        return ok('Dashboard fetched successfully', {
            'totals': totals,
            'byStage': by_stage,
            'bySource': by_source,
            'byOwner': by_owner,
            'recentLeads': recent_leads,
            'myLeadsToday': my_leads_today,
        })
