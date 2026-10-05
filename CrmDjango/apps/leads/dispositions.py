"""
Dispositions and the manual call log (Go-live §7, GL-16..20, GL-40).

A counsellor saves a disposition after every call or interaction: stage +
sub-stage (the disposition / reason), a mandatory next follow-up for open
stages, and an optional note. "Log Call" also writes a row to the calls table.
"""
from datetime import datetime, timedelta

from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from apps.masters.models import Stage, SubStage
from apps.notifications.services import notify_admins
from apps.tasks.models import TASK_TYPES, Task
from common.exceptions import ApiError
from common.roles import COUNSELLOR

from . import stage_rules as rules
from .activity import log_activity
from .history import record_changes
from .models import Call, Lead, Note

CALL_STATUSES = ['answered', 'not_answered', 'busy', 'failed']
FOLLOW_UP_GRACE = timedelta(minutes=1)


def _parse_when(value):
    if value in (None, ''):
        return None
    if isinstance(value, datetime):
        when = value
    else:
        when = parse_datetime(str(value))
        if when is None:
            raise ApiError.bad_request('Validation failed', {'followUpAt': 'Enter a valid date-time'})
    if timezone.is_naive(when):
        when = timezone.make_aware(when, timezone.get_current_timezone())
    return when


def _fmt(when) -> str:
    return timezone.localtime(when).strftime('%d %b %Y, %I:%M %p')


def _is_counsellor(actor) -> bool:
    return bool(actor) and not actor.is_super_admin and getattr(actor, 'role', None) == COUNSELLOR


def close_open_follow_ups(lead_id: str, outcome: str, actor=None) -> int:
    return Task.objects.filter(lead_id=lead_id, status='open').update(
        status='cancelled', outcome=outcome, completed_at=timezone.now(),
        completed_by_id=getattr(actor, 'id', None), updated_at=timezone.now(),
    )


def set_stage(lead: Lead, stage: Stage, sub_stage: SubStage | None, *, actor=None, actor_name: str | None = None,
              reason: str | None = None, disposition_label: str | None = None, title: str | None = None) -> bool:
    """Moves the lead and writes the stage-change timeline + History rows. Returns True when it moved."""
    old_stage = lead.stage if lead.stage_id else None
    old_sub = lead.sub_stage if lead.sub_stage_id else None
    old_status = lead.status
    if old_stage and old_stage.id == stage.id and (old_sub.id if old_sub else None) == (sub_stage.id if sub_stage else None):
        return False
    now = timezone.now()
    lead.stage, lead.sub_stage = stage, sub_stage
    lead.status = rules.status_for(stage)
    lead.last_disposition = disposition_label or (sub_stage.name if sub_stage else stage.name)
    if not old_stage or old_stage.id != stage.id:
        lead.stage_changed_at = now
    lead.save(update_fields=['stage', 'sub_stage', 'status', 'last_disposition', 'stage_changed_at', 'updated_at'])

    who = actor_name or (actor.name if actor else 'System')
    if not old_stage or old_stage.id != stage.id:
        heading = title or f"Stage changed: {old_stage.name if old_stage else '—'} → {stage.name}"
    else:
        heading = title or f'Disposition updated: {stage.name}'
    lines = [f'Disposition: {sub_stage.name}' if sub_stage else None, f'Reason: {reason}' if reason else None]
    log_activity(
        lead.id, 'stage_change', heading, description='\n'.join(x for x in lines if x) or None,
        actor_id=getattr(actor, 'id', None), actor_name=who,
        data={'from': old_stage.name if old_stage else None, 'to': stage.name,
              'subStage': sub_stage.name if sub_stage else None, 'reason': reason},
    )
    record_changes(lead.id, 'system', [
        ('stage', 'Lead stage', old_stage.name if old_stage else None, stage.name),
        ('subStage', 'Disposition', old_sub.name if old_sub else None, sub_stage.name if sub_stage else None),
        ('status', 'Status', old_status, lead.status),
    ], actor, actor_name=who if not actor else None, timeline=False)
    return True


def _resolve(payload: dict) -> tuple[Stage, SubStage | None]:
    stage = Stage.objects.filter(pk=payload.get('stage'), is_active=True).prefetch_related('sub_stages').first()
    if not stage:
        raise ApiError.bad_request('Validation failed', {'stage': 'Choose a stage'})
    sub = None
    if payload.get('subStage'):
        sub = SubStage.objects.filter(pk=payload['subStage'], stage=stage, is_active=True).first()
        if not sub:
            raise ApiError.bad_request('Validation failed', {'subStage': 'Choose a disposition of this stage'})
    elif stage.sub_stages.filter(is_active=True).exists() and not payload.get('reason'):
        raise ApiError.bad_request('Validation failed', {'subStage': 'Choose a disposition'})
    return stage, sub


def apply_disposition(actor, lead: Lead, payload: dict) -> dict:
    """
    Validates and saves one disposition. Payload keys: stage, subStage, reason,
    followUpAt, followUpType, followUpNote, note, interaction ('call' | 'update'),
    call {status, durationSeconds, direction}.
    """
    stage, sub = _resolve(payload)
    reason = (payload.get('reason') or '').strip() or None
    errors: dict = {}

    # GL-20 locked stages
    if stage.name in rules.LOCKED_STAGES and _is_counsellor(actor) and stage.id != lead.stage_id:
        raise ApiError.unprocessable(f'"{stage.name}" is set by the system and cannot be chosen manually')
    # "Not interested" cannot be saved without a reason
    if rules.needs_reason(stage) and not sub and not reason:
        errors['subStage'] = f'Choose a reason for "{stage.name}"'
    # GL-19 no dead ends
    follow_up_at = _parse_when(payload.get('followUpAt'))
    if rules.needs_follow_up(stage):
        if not follow_up_at:
            errors['followUpAt'] = 'A next follow-up date-time is required for this stage'
        elif follow_up_at < timezone.now() - FOLLOW_UP_GRACE:
            errors['followUpAt'] = 'Follow-up must be in the future'
    follow_up_type = payload.get('followUpType') or 'follow_up_call'
    if follow_up_at and follow_up_type not in TASK_TYPES:
        errors['followUpType'] = 'Select a follow-up type'
    call = payload.get('call') or {}
    if payload.get('interaction') == 'call':
        if call.get('status') and call['status'] not in CALL_STATUSES:
            errors['call.status'] = 'Unknown call status'
        duration = call.get('durationSeconds')
        if duration not in (None, '') and (not str(duration).isdigit() or int(duration) > 6 * 3600):
            errors['call.durationSeconds'] = 'Duration must be 0 to 6 hours, in seconds'
    if errors:
        raise ApiError.bad_request('Validation failed', errors)

    with transaction.atomic():
        lead = Lead.objects.select_for_update().select_related('stage', 'sub_stage').get(pk=lead.pk)
        was_streak = lead.not_connected_streak
        moved = set_stage(lead, stage, sub, actor=actor, reason=reason)
        if not moved:
            lead.last_disposition = sub.name if sub else stage.name
            lead.save(update_fields=['last_disposition', 'updated_at'])

        # GL-18 attempt counter
        if stage.name == rules.NOT_CONNECTED and not (sub and sub.name == rules.LANGUAGE_BARRIER):
            lead.not_connected_streak += 1
            lead.not_connected_since = lead.not_connected_since or timezone.now()
        elif stage.name != rules.NOT_CONNECTED:
            lead.not_connected_streak, lead.not_connected_since = 0, None
        lead.save(update_fields=['not_connected_streak', 'not_connected_since', 'updated_at'])

        call_row = None
        if payload.get('interaction') == 'call':
            duration = call.get('durationSeconds')
            call_row = Call.objects.create(
                lead=lead, user_id=getattr(actor, 'id', None), direction=call.get('direction') or 'outbound',
                status=call.get('status') or ('not_answered' if stage.name == rules.NOT_CONNECTED else 'answered'),
                started_at=timezone.now(), duration_seconds=int(duration) if duration not in (None, '') else None,
                stage=stage, sub_stage=sub, note=(payload.get('note') or '').strip() or None, source='manual',
            )
            minutes = f' · {int(duration) // 60}m {int(duration) % 60}s' if duration not in (None, '') else ''
            log_activity(
                lead.id, 'call', f"Call logged: {sub.name if sub else stage.name}{minutes}",
                description=call_row.note, actor_id=getattr(actor, 'id', None), actor_name=getattr(actor, 'name', None),
                data={'callId': call_row.id, 'status': call_row.status, 'durationSeconds': call_row.duration_seconds,
                      'stage': stage.name, 'subStage': sub.name if sub else None},
            )

        if note := (payload.get('note') or '').strip():
            if not call_row:  # a call note already sits on the call entry
                Note.objects.create(lead=lead, body=note[:2000], created_by_id=actor.id)
                log_activity(lead.id, 'note', 'Note added', description=note[:2000], actor_id=actor.id, actor_name=actor.name)

        task = None
        if follow_up_at:
            task = Task.objects.create(
                lead=lead, type=follow_up_type, due_at=follow_up_at, assignee_id=lead.owner_id or actor.id,
                notes=(payload.get('followUpNote') or '').strip() or None, created_by_id=actor.id,
            )
            log_activity(lead.id, 'task', f'Follow-up scheduled: {task.type_label} · due {_fmt(follow_up_at)}',
                         description=task.notes, actor_id=actor.id, actor_name=actor.name, data={'taskId': task.id})
        if stage.type != 'open':
            close_open_follow_ups(lead.id, f'Lead moved to {stage.name}', actor)

    # side effects after the save
    from .services import fire

    if stage.name == rules.NOT_CONNECTED and was_streak == 0 and lead.not_connected_streak == 1:
        fire('first_not_connected', lead, actor=actor)
    if moved and stage.name == rules.INTERESTED:
        fire('stage_interested', lead, actor=actor)
    if moved and stage.name == rules.APPLICATION_SUBMITTED:
        fire('stage_application_submitted', lead, actor=actor)
    if sub and sub.name == rules.LANGUAGE_BARRIER:
        notify_admins('language_barrier', f'Language barrier: {lead.full_name} ({lead.lead_no})',
                      f'{actor.name} marked a language barrier — reassign to a counsellor who speaks the language',
                      {'leadId': lead.id})
    check_attempt_limit(lead)
    return {'callId': call_row.id if call_row else None, 'followUpId': task.id if task else None}


def check_attempt_limit(lead: Lead) -> bool:
    """GL-18: 10 consecutive Not connected over at least 3 days → Lost."""
    lead.refresh_from_db(fields=['not_connected_streak', 'not_connected_since', 'stage'])
    if lead.not_connected_streak < rules.ATTEMPT_LIMIT or not lead.not_connected_since:
        return False
    if timezone.now() - lead.not_connected_since < timedelta(days=rules.ATTEMPT_MIN_DAYS):
        return False
    lost = Stage.objects.filter(name=rules.LOST, is_active=True).first()
    if not lost:
        return False
    sub = lost.sub_stages.filter(name=rules.ATTEMPT_LOST_REASON).first()
    set_stage(lead, lost, sub, actor_name='System', reason=f'{lead.not_connected_streak} consecutive Not connected attempts',
              title=f'Moved to {rules.LOST} — attempt limit reached')
    close_open_follow_ups(lead.id, 'Attempt limit reached')
    Lead.objects.filter(pk=lead.pk).update(not_connected_streak=0, not_connected_since=None)
    return True


def call_doc(call: Call) -> dict:
    return {
        '_id': call.id, 'lead': call.lead_id,
        'user': {'_id': call.user.id, 'name': call.user.name} if call.user_id and call.user else None,
        'direction': call.direction, 'status': call.status, 'startedAt': call.started_at, 'endedAt': call.ended_at,
        'durationSeconds': call.duration_seconds, 'recordingUrl': call.recording_url, 'dialerCallId': call.dialer_call_id,
        'source': call.source, 'stage': call.stage.name if call.stage_id and call.stage else None,
        'subStage': call.sub_stage.name if call.sub_stage_id and call.sub_stage else None, 'note': call.note,
        'createdAt': call.created_at,
    }


def list_calls(lead_id: str) -> list[dict]:
    calls = Call.objects.filter(lead_id=lead_id).select_related('user', 'stage', 'sub_stage').order_by('-created_at')
    return [call_doc(c) for c in calls]


def disposition_options(actor) -> list[dict]:
    """Stages with their dispositions and the rules the popup enforces."""
    stages = Stage.objects.filter(is_active=True).prefetch_related('sub_stages').order_by('order', 'name')
    out = []
    for s in stages:
        out.append({
            '_id': s.id, 'name': s.name, 'type': s.type, 'color': s.color,
            'locked': s.name in rules.LOCKED_STAGES and _is_counsellor(actor),
            'requiresFollowUp': rules.needs_follow_up(s), 'requiresReason': rules.needs_reason(s),
            'subStages': [{'_id': x.id, 'name': x.name} for x in s.sub_stages.all() if x.is_active],
        })
    return out
