from datetime import datetime, time, timedelta

from django.db.models import Q
from django.utils import timezone

from apps.leads.activity import log_activity
from apps.leads.services import find_lead_for_actor
from apps.notifications.services import notify
from apps.users.models import User
from common.exceptions import ApiError
from common.models import compact, ref
from common.scope import visible_owner_ids

from .models import Task

UPDATE_FIELDS = {
    'type': 'type', 'dueAt': 'due_at', 'priority': 'priority', 'reminderMinutes': 'reminder_minutes',
    'notes': 'notes', 'outcome': 'outcome',
}


def task_doc(task: Task) -> dict:
    lead = task.lead
    return compact({
        '_id': task.id,
        'lead': compact({
            '_id': lead.id, 'leadNo': lead.lead_no, 'firstName': lead.first_name, 'lastName': lead.last_name,
        }),
        'type': task.type,
        'typeLabel': task.type_label,
        'dueAt': task.due_at,
        'assignee': ref(task.assignee, 'name'),
        'priority': task.priority,
        'reminderMinutes': task.reminder_minutes,
        'notes': task.notes or None,
        'status': task.status,
        'isOverdue': task.is_overdue,
        'outcome': task.outcome or None,
        'completedAt': task.completed_at,
        'completedBy': ref(task.completed_by, 'name'),
        'createdBy': ref(task.created_by, 'name'),
        'createdAt': task.created_at,
        'updatedAt': task.updated_at,
    })


def _related(qs):
    return qs.select_related('lead', 'assignee', 'completed_by', 'created_by')


def scoped_tasks(actor):
    """Follow-ups the caller may see: assigned to someone in their scope, or on a lead they own-scope."""
    qs = Task.objects.filter(lead__is_deleted=False)
    owners = visible_owner_ids(actor)
    if owners is None:
        return qs
    return qs.filter(Q(assignee_id__in=owners) | Q(lead__owner_id__in=owners))


def _day_bounds():
    today = timezone.localdate()
    tz = timezone.get_current_timezone()
    start = timezone.make_aware(datetime.combine(today, time.min), tz)
    return start, start + timedelta(days=1)


def _view_filter(qs, view: str | None):
    now = timezone.now()
    start, end = _day_bounds()
    if view == 'today':
        return qs.filter(status='open', due_at__gte=start, due_at__lt=end)
    if view == 'overdue':
        return qs.filter(status='open', due_at__lt=now)
    if view == 'upcoming':
        return qs.filter(status='open', due_at__gte=end)
    if view == 'open':
        return qs.filter(status='open')
    if view == 'completed':
        return qs.filter(status__in=['done', 'cancelled'])
    return qs


def _check_assignee(actor, assignee_id: str) -> User:
    """Counsellors (own scope) schedule for themselves; leaders for anyone in their scope."""
    user = User.objects.filter(pk=assignee_id, is_active=True).first()
    if not user:
        raise ApiError.bad_request('Validation failed', {'assignee': 'Assignee must be an active user'})
    owners = visible_owner_ids(actor)
    if owners is not None and assignee_id not in owners:
        raise ApiError.forbidden('You can only assign follow-ups to yourself or people in your team')
    return user


def list_tasks(actor, params, page: int, page_size: int) -> tuple[list[dict], int]:
    qs = _view_filter(scoped_tasks(actor), params.get('view'))
    assignee = params.get('assignee')
    if assignee == 'me':
        qs = qs.filter(assignee_id=actor.id)
    elif assignee:
        qs = qs.filter(assignee_id=assignee)
    if params.get('lead'):
        qs = qs.filter(lead_id=params['lead'])
    if params.get('type'):
        qs = qs.filter(type=params['type'])
    if params.get('priority'):
        qs = qs.filter(priority=params['priority'])
    order = ['-completed_at', '-updated_at'] if params.get('view') == 'completed' else ['due_at', 'pk']
    total = qs.count()
    items = _related(qs).order_by(*order)[(page - 1) * page_size : page * page_size]
    return [task_doc(t) for t in items], total


def summary(actor, assignee: str | None) -> dict:
    qs = scoped_tasks(actor)
    if assignee == 'me':
        qs = qs.filter(assignee_id=actor.id)
    elif assignee:
        qs = qs.filter(assignee_id=assignee)
    return {view: _view_filter(qs, view).count() for view in ('today', 'overdue', 'upcoming', 'completed')}


def lead_tasks(actor, lead_id: str) -> list[dict]:
    find_lead_for_actor(actor, lead_id)  # 404 outside scope
    tasks = _related(Task.objects.filter(lead_id=lead_id))
    # open ones first, soonest due on top; then closed ones, latest first
    open_tasks = tasks.filter(status='open').order_by('due_at', 'pk')
    closed = tasks.exclude(status='open').order_by('-updated_at', '-pk')
    return [task_doc(t) for t in [*open_tasks, *closed]]


def _when(value) -> str:
    return timezone.localtime(value).strftime('%d %b %Y, %I:%M %p')


def create_task(actor, lead_id: str, data: dict) -> dict:
    lead = find_lead_for_actor(actor, lead_id)
    assignee_id = data.get('assignee') or lead.owner_id or actor.id
    assignee = _check_assignee(actor, assignee_id)
    task = Task.objects.create(
        lead_id=lead.id,
        type=data['type'],
        due_at=data['dueAt'],
        assignee=assignee,
        priority=data.get('priority') or 'normal',
        reminder_minutes=data.get('reminderMinutes') or 15,
        notes=(data.get('notes') or '').strip() or None,
        created_by_id=actor.id,
    )
    log_activity(
        lead.id, 'task', f'Follow-up scheduled: {task.type_label} · due {_when(task.due_at)}',
        description=task.notes, actor_id=actor.id, actor_name=actor.name,
        data={'taskId': task.id, 'assignee': assignee.name, 'priority': task.priority},
    )
    if assignee.id != actor.id:
        notify(assignee.id, 'task_due', f'New follow-up assigned: {task.type_label}',
               f'{lead.full_name} ({lead.lead_no}) · due {_when(task.due_at)}', {'leadId': lead.id, 'taskId': task.id})
    return task_doc(_related(Task.objects).get(pk=task.pk))


def update_task(actor, task_id: str, data: dict) -> dict:
    task = _related(scoped_tasks(actor)).filter(pk=task_id).first()
    if not task:
        raise ApiError.not_found('Follow-up not found or not accessible')
    lead = task.lead
    events: list[str] = []
    old_due, old_assignee, old_status = task.due_at, task.assignee, task.status

    for key, attr in UPDATE_FIELDS.items():
        if key in data:
            value = data[key]
            setattr(task, attr, (value.strip() or None) if isinstance(value, str) else value)

    if 'assignee' in data and data['assignee'] != task.assignee_id:
        task.assignee = _check_assignee(actor, data['assignee'])
    if task.due_at != old_due:
        events.append(f'rescheduled to {_when(task.due_at)}')
    if task.due_at != old_due or task.assignee_id != old_assignee.id:
        # a new due time or person gets fresh reminders
        task.reminder_sent_at = task.overdue_notified_at = task.escalated_at = None

    if 'status' in data and data['status'] != old_status:
        task.status = data['status']
        if task.status == 'open':
            task.completed_at = task.completed_by = None
        else:
            task.completed_at = timezone.now()
            task.completed_by_id = actor.id
    task.save()

    if task.status != old_status:
        verb = {'done': 'completed', 'cancelled': 'cancelled', 'open': 'reopened'}[task.status]
        log_activity(lead.id, 'task', f'Follow-up {verb}: {task.type_label}', description=task.outcome,
                     actor_id=actor.id, actor_name=actor.name, data={'taskId': task.id, 'status': task.status})
    elif events:
        log_activity(lead.id, 'task', f"Follow-up {', '.join(events)}: {task.type_label}",
                     actor_id=actor.id, actor_name=actor.name, data={'taskId': task.id})
    if task.assignee_id != old_assignee.id:
        log_activity(lead.id, 'task', f'Follow-up reassigned to {task.assignee.name}: {task.type_label}',
                     actor_id=actor.id, actor_name=actor.name, data={'taskId': task.id, 'from': old_assignee.name})
        if task.assignee_id != actor.id:
            notify(task.assignee_id, 'task_due', f'Follow-up assigned to you: {task.type_label}',
                   f'{lead.full_name} ({lead.lead_no}) · due {_when(task.due_at)}', {'leadId': lead.id, 'taskId': task.id})
    return task_doc(_related(Task.objects).get(pk=task.pk))
