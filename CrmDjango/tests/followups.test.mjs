/**
 * Follow-ups, reminders, notifications and lead history, against the Django API.
 * Run from CrmDjango/ with the server up:
 *   API_URL=http://localhost:4000/api/v1 node --test tests/followups.test.mjs
 * Time-based alerts are driven by `manage.py send_reminders` after back-dating rows.
 */
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const BASE = process.env.API_URL ?? 'http://localhost:4000/api/v1';
const CAPTURE_KEY = process.env.CAPTURE_API_KEY ?? 'dev-capture-key-123';
const PYTHON = process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python';
const RUN = Date.now().toString().slice(-7);
// names allow letters only (go-live), so the run id is spelled with letters
const TAG = RUN.split('').map((d) => 'abcdefghij'[Number(d)]).join('');

async function call(method, path, { token, body, headers = {} } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, body: json };
}

async function login(email, password) {
  const res = await call('POST', '/auth/login', { body: { email, password } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return { token: res.body.data.access_token, user: res.body.data.user };
}

/** Runs Django code in-process (back-dating rows) — only for simulating the clock. */
function djangoShell(code) {
  return execFileSync(PYTHON, ['manage.py', 'shell', '-c', code], { encoding: 'utf8' });
}
const sendReminders = () => execFileSync(PYTHON, ['manage.py', 'send_reminders'], { encoding: 'utf8' });

const inMinutes = (m) => new Date(Date.now() + m * 60_000).toISOString();
const notificationsOf = async (session) => (await call('GET', '/notifications?page_size=50', { token: session.token })).body.data.items;

let admin, arjun, sara, tanvi, marketing, leadId, masters;
const sourceId = (name) => masters.sources.find((s) => s.name === name)._id;

before(async () => {
  [admin, arjun, sara, tanvi, marketing] = await Promise.all([
    login('admin@gccschool.com', 'Admin@12345'),
    login('arjun.c@gccschool.com', 'Welcome@123'),
    login('sara.c@gccschool.com', 'Welcome@123'),
    login('tanvi.tl@gccschool.com', 'Welcome@123'),
    login('dev.mkt@gccschool.com', 'Welcome@123'),
  ]);
  masters = (await call('GET', '/masters/bootstrap', { token: admin.token })).body.data;
  const lead = await call('POST', '/leads', {
    token: arjun.token,
    body: { firstName: 'Follow', lastName: `Up ${TAG}`, mobile: `97${RUN}7`, email: `fu${RUN}@example.com`, city: 'Pune', source: sourceId('Walk-in') },
  });
  assert.equal(lead.status, 201, JSON.stringify(lead.body));
  leadId = lead.body.data._id;
});

describe('follow-ups', () => {
  let taskId, dueAt;

  test('counsellor schedules a follow-up on own lead; it shows on the timeline and as next follow-up', async () => {
    dueAt = inMinutes(3);
    const res = await call('POST', `/leads/${leadId}/tasks`, {
      token: arjun.token,
      body: { type: 'call_back', dueAt, priority: 'high', reminderMinutes: 5, notes: 'Asked to call after lunch' },
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    taskId = res.body.data._id;
    assert.equal(res.body.data.assignee._id, arjun.user._id, 'defaults to the lead owner');
    assert.equal(res.body.data.typeLabel, 'Call back');
    assert.equal(res.body.data.isOverdue, false);

    const tl = await call('GET', `/leads/${leadId}/timeline?type=task`, { token: arjun.token });
    assert.ok(tl.body.data.length >= 1);
    assert.ok(tl.body.data.every((a) => a.type === 'task'), 'type filter');
    assert.match(tl.body.data[0].title, /^Follow-up scheduled: Call back/);

    const lead = await call('GET', `/leads/${leadId}`, { token: arjun.token });
    assert.equal(new Date(lead.body.data.nextFollowUpAt).getTime(), new Date(dueAt).getTime());
  });

  test('validation: past due, unknown type, bad reminder; counsellor cannot assign to someone else', async () => {
    const past = await call('POST', `/leads/${leadId}/tasks`, { token: arjun.token, body: { type: 'call_back', dueAt: inMinutes(-30) } });
    assert.equal(past.status, 400);
    assert.ok(past.body.errors.dueAt);
    const type = await call('POST', `/leads/${leadId}/tasks`, { token: arjun.token, body: { type: 'lunch', dueAt: inMinutes(10) } });
    assert.ok(type.body.errors.type);
    const reminder = await call('POST', `/leads/${leadId}/tasks`, { token: arjun.token, body: { type: 'other', dueAt: inMinutes(10), reminderMinutes: 7 } });
    assert.ok(reminder.body.errors.reminderMinutes);
    const other = await call('POST', `/leads/${leadId}/tasks`, { token: arjun.token, body: { type: 'other', dueAt: inMinutes(10), assignee: sara.user._id } });
    assert.equal(other.status, 403);
  });

  test('team leader assigns a follow-up to a counsellor, who is notified', async () => {
    const res = await call('POST', `/leads/${leadId}/tasks`, {
      token: tanvi.token,
      body: { type: 'counselling_session', dueAt: inMinutes(120), assignee: arjun.user._id },
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const notes = await notificationsOf(arjun);
    assert.ok(notes.some((n) => n.type === 'task_due' && n.title === 'New follow-up assigned: Counselling session' && n.data.leadId === leadId));
  });

  test('task lists by view and the summary counts', async () => {
    const open = await call('GET', '/tasks?view=open&assignee=me', { token: arjun.token });
    assert.equal(open.status, 200);
    assert.ok(open.body.data.some((t) => t._id === taskId));
    assert.ok(open.body.pagination);
    const summary = await call('GET', '/tasks/summary?assignee=me', { token: arjun.token });
    assert.deepEqual(Object.keys(summary.body.data.counts).sort(), ['completed', 'overdue', 'today', 'upcoming']);
    assert.equal(summary.body.data.types.length, 6, 'go-live: six follow-up types');
    const leadTasks = await call('GET', `/leads/${leadId}/tasks`, { token: arjun.token });
    assert.equal(leadTasks.body.data[0]._id, taskId, 'soonest open follow-up first');
    assert.equal((await call('GET', '/tasks', { token: marketing.token })).status, 403, 'marketing has no tasks access');
  });

  test('reminder → overdue → Admin escalation, each sent once', async () => {
    sendReminders(); // due in 3 min with a 5-min reminder → reminder now
    assert.ok((await notificationsOf(arjun)).some((n) => n.type === 'task_due' && /^Follow-up due in \d+ min: Call back$/.test(n.title)));

    djangoShell(`from apps.tasks.models import Task; from django.utils import timezone; from datetime import timedelta; Task.objects.filter(pk='${taskId}').update(due_at=timezone.now()-timedelta(hours=3))`);
    sendReminders();
    sendReminders(); // second run must not duplicate
    const arjunNotes = await notificationsOf(arjun);
    assert.equal(arjunNotes.filter((n) => n.title === 'Follow-up overdue: Call back' && n.data.taskId === taskId).length, 1);
    // go-live: the 2h escalation goes to Admins (role admin + super admins), not the team leader
    const adminNotes = await notificationsOf(admin);
    assert.equal(adminNotes.filter((n) => n.data?.taskId === taskId && n.title.startsWith('Overdue 2+ hrs')).length, 1);

    const tl = await call('GET', `/leads/${leadId}/timeline?type=task`, { token: arjun.token });
    assert.ok(tl.body.data.some((a) => a.title === 'Follow-up overdue: Call back'));
    const overdue = await call('GET', '/tasks?view=overdue&assignee=me', { token: arjun.token });
    assert.ok(overdue.body.data.some((t) => t._id === taskId && t.isOverdue));
  });

  test('reschedule and complete are recorded on the timeline', async () => {
    const res = await call('PUT', `/tasks/${taskId}`, { token: arjun.token, body: { dueAt: inMinutes(60) } });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.isOverdue, false);
    const done = await call('PUT', `/tasks/${taskId}`, { token: arjun.token, body: { status: 'done', outcome: 'Spoke to candidate, sending brochure' } });
    assert.equal(done.body.data.status, 'done');
    assert.ok(done.body.data.completedAt);
    assert.equal(done.body.data.completedBy._id, arjun.user._id);
    const titles = (await call('GET', `/leads/${leadId}/timeline?type=task`, { token: arjun.token })).body.data.map((a) => a.title);
    assert.ok(titles.some((t) => t.startsWith('Follow-up rescheduled to')));
    assert.ok(titles.includes('Follow-up completed: Call back'));
  });

  test('reassigning the lead moves its open follow-ups to the new owner', async () => {
    const res = await call('POST', `/leads/${leadId}/assign`, { token: tanvi.token, body: { owner: sara.user._id, reason: 'Workload' } });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const tasks = (await call('GET', `/leads/${leadId}/tasks`, { token: tanvi.token })).body.data;
    for (const t of tasks.filter((x) => x.status === 'open')) assert.equal(t.assignee._id, sara.user._id);
    const tl = await call('GET', `/leads/${leadId}/timeline?type=assignment`, { token: tanvi.token });
    assert.match(tl.body.data[0].description, /open follow-up\(s\) moved/);
  });
});

describe('lead history & notifications', () => {
  test('field edits record before → after; contact values stay out of the history', async () => {
    const res = await call('PUT', `/leads/${leadId}`, { token: admin.token, body: { city: 'Mumbai', mobile: `97${RUN}8` } });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const edit = (await call('GET', `/leads/${leadId}/timeline?type=edit`, { token: admin.token })).body.data[0];
    assert.match(edit.description, /City: Pune → Mumbai/);
    assert.match(edit.description, /Mobile updated/);
    assert.ok(!edit.description.includes(`97${RUN}8`), 'new mobile not exposed');
  });

  test('a status change gets its own timeline entry', async () => {
    await call('PUT', `/leads/${leadId}`, { token: admin.token, body: { status: 'lost' } });
    const entry = (await call('GET', `/leads/${leadId}/timeline?type=status_change`, { token: admin.token })).body.data[0];
    assert.equal(entry.title, 'Status changed: active → lost');
  });

  test('profile steps are part of the history', async () => {
    const res = await call('PUT', `/leads/${leadId}/profile/work`, { token: admin.token, body: { work: { employmentStatus: 'Fresher' } } });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    // a step save that changes fields is recorded as a field-history ("edit") entry with before → after
    const entry = (await call('GET', `/leads/${leadId}/timeline?type=edit`, { token: admin.token })).body.data[0];
    assert.equal(entry.title, 'Student profile Step 3 (work experience) saved');
    assert.match(entry.description, /Fresher/);
  });

  test('re-enquiry notifies the owner', async () => {
    const res = await call('POST', '/leads/capture', {
      headers: { 'x-api-key': CAPTURE_KEY },
      body: { name: 'Follow Up', mobile: `97${RUN}8`, source: 'Website' },
    });
    assert.equal(res.body.data.duplicate, true);
    const notes = await notificationsOf(sara);
    assert.ok(notes.some((n) => n.title.startsWith('Re-enquiry on your lead') && n.data.leadId === leadId));
  });

  test('a lead left untouched for 2+ working hours alerts its owner and the Admins once', async () => {
    const lead = await call('POST', '/leads', { token: arjun.token, body: { firstName: 'Untouched', lastName: TAG, mobile: `98${RUN}9`, source: sourceId('Walk-in') } });
    assert.equal(lead.status, 201, JSON.stringify(lead.body));
    const id = lead.body.data._id;
    djangoShell(`from apps.leads.models import Lead; from django.utils import timezone; from datetime import timedelta; Lead.objects.filter(pk='${id}').update(assigned_at=timezone.now()-timedelta(days=3))`); // 3 days back always covers 2+ working hours (9:30-19:00 Mon-Sat)
    sendReminders();
    sendReminders();
    assert.equal((await notificationsOf(arjun)).filter((n) => n.data?.leadId === id && n.title === 'Lead still Untouched after 2 hours').length, 1);
    assert.ok((await notificationsOf(admin)).some((n) => n.data?.leadId === id && n.title.startsWith('Untouched 2+ hrs')));
    await call('DELETE', `/leads/${id}`, { token: admin.token });
  });

  test('cleanup', async () => {
    assert.equal((await call('DELETE', `/leads/${leadId}`, { token: admin.token })).status, 200);
  });
});
