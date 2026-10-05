"""
Time-based work (Go-live GL-30, GL-12, GL-09, GL-23) — one tick does it all:

- follow-up due       → assignee, `reminderMinutes` (15) before the due time
- follow-up overdue   → assignee, at the due time (+ a timeline entry)
- overdue 2+ hours    → Admin
- Untouched 30 min    → counsellor; Untouched 2 hrs → counsellor + Admin
  (working hours only: 9:30–19:00 Mon–Sat; leads arriving outside start at the next working start)
- Unassigned pool     → Admin reminder every hour while the count is > 0
- pooled Meta leads   → distributed round-robin when counsellors are logged in (every 5 minutes)
- Meta lead retries, scheduled bulk sends, expired export files

Each alert is claimed with a conditional UPDATE before it is sent, so running
this from several places (the notifications poll, cron) never sends twice.
"""
import logging
from datetime import datetime, time, timedelta

from django.conf import settings
from django.core.cache import cache
from django.utils import timezone

from apps.leads.activity import log_activity
from apps.leads.models import Lead, RoundRobinState
from apps.notifications.services import notify, notify_admins

from .models import Task

logger = logging.getLogger('crm')

ESCALATE_AFTER = timedelta(hours=2)
UNTOUCHED_EARLY = timedelta(minutes=30)
UNTOUCHED_AFTER = timedelta(hours=2)
MAX_REMINDER = timedelta(minutes=60)
POOL_REMINDER = timedelta(hours=1)
POOL_DISTRIBUTE_EVERY = timedelta(minutes=5)
THROTTLE_KEY = 'crm:reminders:last-run'
THROTTLE_SECONDS = 60


def _claim(model, pk: str, flag: str, now) -> bool:
    return model.objects.filter(pk=pk, **{f'{flag}__isnull': True}).update(**{flag: now}) == 1


def _label(lead: Lead) -> str:
    return f'{lead.full_name} ({lead.lead_no})'


# ------------------------------------------------------------- working hours


def _window():
    start, end = (time(*map(int, v.split(':'))) for v in settings.WORKING_HOURS)
    return start, end, set(settings.WORKING_DAYS)


def working_time_between(start: datetime, end: datetime) -> timedelta:
    """Working time elapsed between two instants (counts only working-day hours)."""
    if end <= start:
        return timedelta(0)
    day_start, day_end, days = _window()
    tz = timezone.get_current_timezone()
    total = timedelta(0)
    day = timezone.localtime(start).date()
    last = timezone.localtime(end).date()
    while day <= last:
        if day.weekday() in days:
            open_at = timezone.make_aware(datetime.combine(day, day_start), tz)
            close_at = timezone.make_aware(datetime.combine(day, day_end), tz)
            lo, hi = max(open_at, start), min(close_at, end)
            if hi > lo:
                total += hi - lo
        day += timedelta(days=1)
    return total


# --------------------------------------------------------------------- tick


def process_due(now=None) -> dict:
    now = now or timezone.now()
    sent = {'reminders': 0, 'overdue': 0, 'escalations': 0, 'untouched30': 0, 'untouched': 0, 'pool': 0,
            'distributed': 0, 'metaRetries': 0, 'campaigns': 0}
    open_tasks = Task.objects.filter(status='open', lead__is_deleted=False).select_related('lead', 'assignee')

    for task in open_tasks.filter(reminder_sent_at__isnull=True, due_at__gt=now, due_at__lte=now + MAX_REMINDER):
        if task.due_at - timedelta(minutes=task.reminder_minutes) <= now and _claim(Task, task.pk, 'reminder_sent_at', now):
            minutes = max(1, round((task.due_at - now).total_seconds() / 60))
            notify(task.assignee_id, 'task_due', f'Follow-up due in {minutes} min: {task.type_label}',
                   _label(task.lead), {'leadId': task.lead_id, 'taskId': task.id})
            sent['reminders'] += 1

    for task in open_tasks.filter(overdue_notified_at__isnull=True, due_at__lte=now):
        if _claim(Task, task.pk, 'overdue_notified_at', now):
            notify(task.assignee_id, 'task_overdue', f'Follow-up overdue: {task.type_label}',
                   _label(task.lead), {'leadId': task.lead_id, 'taskId': task.id})
            log_activity(task.lead_id, 'task', f'Follow-up overdue: {task.type_label}', actor_type='system',
                         actor_name='System', data={'taskId': task.id, 'assignee': task.assignee.name})
            sent['overdue'] += 1

    for task in open_tasks.filter(escalated_at__isnull=True, due_at__lte=now - ESCALATE_AFTER):
        if _claim(Task, task.pk, 'escalated_at', now):
            notify_admins('task_overdue', f'Overdue 2+ hrs: {task.type_label} ({task.assignee.name})',
                          _label(task.lead), {'leadId': task.lead_id, 'taskId': task.id})
            sent['escalations'] += 1

    _untouched(now, sent)
    _pool(now, sent)
    _integrations(now, sent)
    return sent


def _untouched(now, sent: dict) -> None:
    candidates = Lead.objects.filter(
        is_deleted=False, status='active', stage__name='Untouched', owner__isnull=False,
        assigned_at__lte=now - UNTOUCHED_EARLY,
    ).filter(untouched_alerted_at__isnull=True).select_related('owner')
    for lead in candidates:
        elapsed = working_time_between(lead.assigned_at, now)
        data = {'leadId': lead.id}
        if elapsed >= UNTOUCHED_AFTER and _claim(Lead, lead.pk, 'untouched_alerted_at', now):
            notify(lead.owner_id, 'untouched', 'Lead still Untouched after 2 hours', _label(lead), data)
            notify_admins('untouched', f'Untouched 2+ hrs: {lead.owner.name}', _label(lead), data)
            sent['untouched'] += 1
        elif elapsed >= UNTOUCHED_EARLY and lead.untouched_early_alerted_at is None \
                and _claim(Lead, lead.pk, 'untouched_early_alerted_at', now):
            notify(lead.owner_id, 'untouched', 'Lead still Untouched after 30 minutes', _label(lead), data)
            sent['untouched30'] += 1


def _state(key: str):
    state, _ = RoundRobinState.objects.get_or_create(key=key)
    try:
        last = datetime.fromisoformat(state.last_position) if state.last_position else None
    except ValueError:
        last = None
    return state, last


def _pool(now, sent: dict) -> None:
    from apps.leads.assignment import distribute_pool, eligible_counsellors

    state, last = _state('pool-distribute')
    if not last or now - last >= POOL_DISTRIBUTE_EVERY:
        state.last_position = now.isoformat()
        state.save(update_fields=['last_position'])
        if eligible_counsellors():
            sent['distributed'] = distribute_pool()

    count = Lead.objects.filter(is_deleted=False, owner__isnull=True, status='active').count()
    state, last = _state('pool-reminder')
    if count and (not last or now - last >= POOL_REMINDER):
        state.last_position = now.isoformat()
        state.save(update_fields=['last_position'])
        if last:  # the first alert went out when the lead landed in the pool
            notify_admins('unassigned_pool', f'{count} lead(s) waiting in the Unassigned pool',
                          'Assign them from the lead list (filter: Unassigned)', {'smart': 'unassigned'})
            sent['pool'] = count


def _integrations(now, sent: dict) -> None:
    from apps.integrations.meta import process_retries
    from apps.messaging.services import process_scheduled

    sent['metaRetries'] = process_retries(now)
    sent['campaigns'] = process_scheduled()


def process_due_throttled() -> None:
    """Runs process_due at most once a minute per process; called from the notifications poll."""
    if not cache.add(THROTTLE_KEY, True, THROTTLE_SECONDS):
        return
    try:
        process_due()
    except Exception as exc:  # noqa: BLE001 — reminders must never break the bell
        logger.error('Reminder processing failed: %s', exc)
