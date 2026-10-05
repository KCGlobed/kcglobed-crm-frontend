/**
 * End-to-end API tests against a running server with seeded data.
 *   1. npm run seed
 *   2. npm run dev            (another terminal)
 *   3. npm run test:e2e
 * Uses Node's built-in test runner — no extra dependencies.
 * Creates uniquely-numbered records, so it is safe to re-run.
 */
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.API_URL ?? 'http://localhost:4000/api/v1';
const CAPTURE_KEY = process.env.CAPTURE_API_KEY ?? 'dev-capture-key-123';
const RUN = Date.now().toString().slice(-7);

async function call(method, path, { token, body, headers = {}, cookie } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers,
    },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, body: json, headers: res.headers };
}

async function login(email, password) {
  const res = await call('POST', '/auth/login', { body: { email, password } });
  assert.equal(res.status, 200, `login failed for ${email}: ${JSON.stringify(res.body)}`);
  const cookie = res.headers.get('set-cookie')?.split(';')[0];
  return { token: res.body.data.access_token, user: res.body.data.user, cookie };
}

let admin, counsellor, leader, marketing, masters;

before(async () => {
  admin = await login('admin@gccschool.com', 'Admin@12345');
  counsellor = await login('arjun.c@gccschool.com', 'Welcome@123');
  leader = await login('tanvi.tl@gccschool.com', 'Welcome@123');
  marketing = await login('dev.mkt@gccschool.com', 'Welcome@123');
  masters = (await call('GET', '/masters/bootstrap', { token: admin.token })).body.data;
});

describe('authentication', () => {
  test('rejects bad credentials with 401', async () => {
    const res = await call('POST', '/auth/login', { body: { email: 'admin@gccschool.com', password: 'wrong' } });
    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
  });

  test('validates login payload with 400 + field errors', async () => {
    const res = await call('POST', '/auth/login', { body: { email: 'not-an-email', password: '' } });
    assert.equal(res.status, 400);
    assert.ok(res.body.errors.email);
  });

  test('protected routes require a token', async () => {
    const res = await call('GET', '/leads');
    assert.equal(res.status, 401);
  });

  test('refresh rotates the cookie, and reusing the old one revokes the session', async () => {
    const session = await login('tanvi.tl@gccschool.com', 'Welcome@123');
    const first = await call('POST', '/auth/refresh', { cookie: session.cookie });
    assert.equal(first.status, 200);
    assert.ok(first.body.data.access_token);
    const rotated = first.headers.get('set-cookie')?.split(';')[0];
    assert.notEqual(rotated, session.cookie);

    const reuse = await call('POST', '/auth/refresh', { cookie: session.cookie });
    assert.equal(reuse.status, 401, 'old refresh token must be rejected');
    const afterReuse = await call('POST', '/auth/refresh', { cookie: rotated });
    assert.equal(afterReuse.status, 401, 'reuse detection revokes the whole session');
  });

  test('me returns permissions', async () => {
    const res = await call('GET', '/auth/me', { token: counsellor.token });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data.user.permissions));
    assert.equal(res.body.data.user.passwordHash, undefined);
  });
});

describe('RBAC enforced on the backend', () => {
  test('counsellor cannot export leads', async () => {
    const res = await call('GET', '/leads/export', { token: counsellor.token });
    assert.equal(res.status, 403);
  });

  test('counsellor cannot list users', async () => {
    assert.equal((await call('GET', '/users', { token: counsellor.token })).status, 403);
  });

  test('counsellor cannot create masters', async () => {
    const res = await call('POST', '/masters/tags', { token: counsellor.token, body: { name: `X${RUN}` } });
    assert.equal(res.status, 403);
  });

  test('marketing cannot create leads (import only)', async () => {
    const res = await call('POST', '/leads', { token: marketing.token, body: { firstName: 'M', mobile: '9000000000' } });
    assert.equal(res.status, 403);
  });

  test('counsellor cannot reassign leads', async () => {
    const list = await call('GET', '/leads?page_size=1', { token: counsellor.token });
    const id = list.body.data[0]._id;
    const res = await call('POST', `/leads/${id}/assign`, { token: counsellor.token, body: { owner: counsellor.user._id } });
    assert.equal(res.status, 403);
  });

  test('user options are available to any signed-in user', async () => {
    const res = await call('GET', '/users/options', { token: counsellor.token });
    assert.equal(res.status, 200);
    assert.ok(res.body.data.length >= 1);
  });
});

describe('data scope & masking', () => {
  test('counsellor (own scope) only sees own leads', async () => {
    const res = await call('GET', '/leads?page_size=100', { token: counsellor.token });
    assert.equal(res.status, 200);
    for (const lead of res.body.data) assert.equal(lead.owner?._id, counsellor.user._id);
  });

  test('team leader sees more than one counsellor', async () => {
    const res = await call('GET', '/leads?page_size=100', { token: leader.token });
    const owners = new Set(res.body.data.map((l) => l.owner?._id).filter(Boolean));
    assert.ok(owners.size >= 2, `expected team leads from 2+ owners, got ${owners.size}`);
  });

  test('marketing sees masked mobile and email', async () => {
    const res = await call('GET', '/leads?page_size=5', { token: marketing.token });
    const lead = res.body.data.find((l) => l.mobile);
    assert.match(lead.mobile, /^\*+\d{4}$/);
    if (lead.email) assert.match(lead.email, /\*/);
  });

  test('counsellor cannot open a lead outside their scope', async () => {
    const all = await call('GET', '/leads?page_size=100', { token: admin.token });
    const foreign = all.body.data.find((l) => l.owner && l.owner._id !== counsellor.user._id);
    const res = await call('GET', `/leads/${foreign._id}`, { token: counsellor.token });
    assert.equal(res.status, 404);
  });
});

describe('lead management', () => {
  const mobile = `97${RUN}9`.slice(0, 10);
  let leadId;

  test('rejects invalid lead payload with field errors', async () => {
    const res = await call('POST', '/leads', { token: admin.token, body: { firstName: '', mobile: 'abc' } });
    assert.equal(res.status, 400);
    assert.ok(res.body.errors.firstName);
    assert.ok(res.body.errors.mobile);
  });

  test('counsellor quick-add becomes owner automatically', async () => {
    const res = await call('POST', '/leads', {
      token: counsellor.token,
      body: { firstName: 'Walkin', lastName: `T${RUN}`, mobile, source: masters.sources[0]._id },
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.data.owner._id, counsellor.user._id);
    assert.match(res.body.data.leadNo, /^LD-\d{6}$/);
    assert.equal(res.body.data.firstSource._id, masters.sources[0]._id);
    leadId = res.body.data._id;
  });

  test('blocks duplicate mobile with 409 (normalised: +91 prefix)', async () => {
    const res = await call('POST', '/leads', { token: admin.token, body: { firstName: 'Dup', mobile: `+91 ${mobile}` } });
    assert.equal(res.status, 409);
    assert.ok(res.body.errors.mobile);
  });

  test('a failed create does not affect the list endpoint', async () => {
    await call('POST', '/leads', { token: admin.token, body: { firstName: 'Dup', mobile } });
    const res = await call('GET', '/leads?page_size=5', { token: admin.token });
    assert.equal(res.status, 200);
    assert.ok(res.body.data.length > 0);
  });

  test('search by mobile digits finds the lead', async () => {
    const res = await call('GET', `/leads?search=${mobile.slice(-6)}`, { token: admin.token });
    assert.ok(res.body.data.some((l) => l._id === leadId));
  });

  test('list supports pagination, sorting and filters', async () => {
    const res = await call('GET', `/leads?page=1&page_size=2&sort_by=firstName&sort_order=asc&source=${masters.sources[0]._id}`, {
      token: admin.token,
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.pagination.page_size, 2);
    assert.ok(res.body.data.length <= 2);
    for (const l of res.body.data) assert.equal(l.source._id, masters.sources[0]._id);
  });

  test('stage list follows the Lead Stages sheet, with Untouched for new leads', async () => {
    const names = masters.stages.map((st) => st.name);
    assert.deepEqual(names, [
      'Untouched', 'Interested', 'Prospects', 'Not Interested', 'Invalid', 'Not Eligible', 'Not Connected',
      'NFET', 'Interview', 'PPO', 'Registration & Fee', 'Risk', 'Future Batch', 'Closed - Lost', 'Enrolled',
    ]);
    const interested = masters.stages.find((st) => st.name === 'Interested');
    assert.equal(interested.subStages.length, 7);
    assert.match(interested.subStages[0].counsellorAction, /brochure/i);
    const lead = (await call('GET', `/leads/${leadId}`, { token: admin.token })).body.data;
    assert.equal(lead.stage.name, 'Untouched');
  });

  test('a stage move needs a sub-stage of that stage; system stages cannot be picked', async () => {
    const enrolled = masters.stages.find((st) => st.name === 'Enrolled');
    const prospects = masters.stages.find((st) => st.name === 'Prospects');
    const untouched = masters.stages.find((st) => st.name === 'Untouched');

    const noSub = await call('PUT', `/leads/${leadId}`, { token: admin.token, body: { stage: prospects._id } });
    assert.equal(noSub.status, 400);
    assert.ok(noSub.body.errors.subStage);

    const wrongSub = await call('PUT', `/leads/${leadId}`, {
      token: admin.token,
      body: { stage: prospects._id, subStage: enrolled.subStages[0]._id },
    });
    assert.equal(wrongSub.status, 400);

    const hot = prospects.subStages.find((ss) => ss.name === 'Hot');
    const moved = await call('PUT', `/leads/${leadId}`, { token: admin.token, body: { stage: prospects._id, subStage: hot._id } });
    assert.equal(moved.status, 200, JSON.stringify(moved.body));
    assert.equal(moved.body.data.subStage, hot._id);

    const back = await call('PUT', `/leads/${leadId}`, { token: admin.token, body: { stage: untouched._id } });
    assert.equal(back.status, 422);
  });

  test('moving to a converted stage sets status and logs the timeline with the sub-stage', async () => {
    const enrolled = masters.stages.find((st) => st.type === 'converted');
    const res = await call('PUT', `/leads/${leadId}`, {
      token: admin.token,
      body: { stage: enrolled._id, subStage: enrolled.subStages[0]._id },
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.status, 'converted');
    const tl = await call('GET', `/leads/${leadId}/timeline`, { token: admin.token });
    assert.ok(
      tl.body.data.some((a) => a.type === 'stage_change' && a.title.includes('Enrolled (Admission confirmed - seat allotted)')),
      'timeline shows stage and sub-stage'
    );
  });

  test('notes are added and appear on the timeline', async () => {
    const note = await call('POST', `/leads/${leadId}/notes`, {
      token: counsellor.token,
      body: { body: 'Discussed GMBA fees', category: 'Counselling' },
    });
    assert.equal(note.status, 201);
    const tl = await call('GET', `/leads/${leadId}/timeline`, { token: admin.token });
    assert.ok(tl.body.data.some((a) => a.type === 'note'));
  });

  test('team leader reassigns and the new owner is notified', async () => {
    const sara = (await call('GET', '/users/options', { token: leader.token })).body.data.find((u) =>
      u.email.startsWith('sara')
    );
    const res = await call('POST', `/leads/${leadId}/assign`, { token: leader.token, body: { owner: sara._id } });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.owner._id, sara._id);
    const saraLogin = await login('sara.c@gccschool.com', 'Welcome@123');
    const notes = await call('GET', '/notifications', { token: saraLogin.token });
    assert.ok(notes.body.data.items.some((n) => n.data?.leadId === leadId));
  });

  test('soft delete hides the lead and frees the mobile', async () => {
    assert.equal((await call('DELETE', `/leads/${leadId}`, { token: admin.token })).status, 200);
    assert.equal((await call('GET', `/leads/${leadId}`, { token: admin.token })).status, 404);
    const again = await call('POST', '/leads', { token: admin.token, body: { firstName: 'Again', mobile } });
    assert.equal(again.status, 201);
    await call('DELETE', `/leads/${again.body.data._id}`, { token: admin.token });
  });
});

describe('lead capture & bulk upload', () => {
  test('public capture requires the API key', async () => {
    const res = await call('POST', '/leads/capture', { body: { name: 'No Key', mobile: '9111111111' } });
    assert.equal(res.status, 401);
  });

  test('meta webhook creates an ads-track lead; re-enquiry keeps first touch', async () => {
    const mobile = `96${RUN}1`.slice(0, 10);
    const first = await call('POST', '/webhooks/meta-leads', {
      headers: { 'x-api-key': CAPTURE_KEY },
      body: { name: 'Meta Lead', mobile, source: 'Meta Ads', utm_campaign: 'test' },
    });
    assert.equal(first.status, 201);
    assert.equal(first.body.data.duplicate, false);

    const again = await call('POST', '/leads/capture', {
      headers: { 'x-api-key': CAPTURE_KEY },
      body: { name: 'Meta Lead', mobile, source: 'Website' },
    });
    assert.equal(again.body.data.duplicate, true);

    const lead = (await call('GET', `/leads/${first.body.data.leadId}`, { token: admin.token })).body.data;
    assert.equal(lead.track, 'ads');
    assert.equal(lead.firstSource.name, 'Meta Ads');
    assert.equal(lead.source.name, 'Website');
    await call('DELETE', `/leads/${lead._id}`, { token: admin.token });
  });

  test('bulk upload loads valid rows and reports invalid ones', async () => {
    const m1 = `95${RUN}1`.slice(0, 10);
    const m2 = `95${RUN}2`.slice(0, 10);
    const csv = `Name,Mobile,Email\nBulk One,${m1},b1-${RUN}@example.com\nBulk Two,${m2},not-an-email\nNo Mobile,,\nBulk Dup,${m1},\n`;
    const form = new FormData();
    form.append('file', new Blob([csv], { type: 'text/csv' }), 'leads.csv');
    form.append('mapping', JSON.stringify({ name: 'Name', mobile: 'Mobile', email: 'Email' }));
    form.append('defaults', JSON.stringify({ source: masters.sources[0]._id, autoAssign: true }));
    const res = await call('POST', '/leads/bulk-upload', { token: admin.token, body: form });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.total, 4);
    assert.equal(res.body.data.inserted, 1);
    assert.equal(res.body.data.errors.length, 3);

    const found = await call('GET', `/leads?search=${m1}`, { token: admin.token });
    assert.ok(found.body.data[0].owner, 'imported lead is round-robin assigned');
    await call('DELETE', `/leads/${found.body.data[0]._id}`, { token: admin.token });
  });
});

describe('users & permissions', () => {
  test('permission changes apply on the next request; deactivation blocks access', async () => {
    const email = `perm${RUN}@gccschool.com`;
    const created = await call('POST', '/users', {
      token: admin.token,
      body: {
        name: 'Perm Test',
        email,
        password: 'Welcome@123',
        permissions: [{ module: 'dashboard', actions: ['view'] }],
        dataScope: 'own',
      },
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const id = created.body.data._id;
    const session = await login(email, 'Welcome@123');

    assert.equal((await call('GET', '/leads', { token: session.token })).status, 403);
    await call('POST', `/users/${id}/permissions`, {
      token: admin.token,
      body: { permissions: [{ module: 'leads', actions: ['view'] }], dataScope: 'own', fieldRules: [] },
    });
    assert.equal((await call('GET', '/leads', { token: session.token })).status, 200);

    await call('DELETE', `/users/${id}`, { token: admin.token });
    assert.equal((await call('GET', '/leads', { token: session.token })).status, 401);
  });

  test('duplicate user email returns 409', async () => {
    const res = await call('POST', '/users', {
      token: admin.token,
      body: { name: 'Dup', email: 'admin@gccschool.com', password: 'Welcome@123' },
    });
    assert.equal(res.status, 409);
  });

  test('weak password is rejected', async () => {
    const res = await call('POST', '/users', {
      token: admin.token,
      body: { name: 'Weak', email: `weak${RUN}@x.com`, password: 'short' },
    });
    assert.equal(res.status, 400);
    assert.ok(res.body.errors.password);
  });

  test('audit log records permission changes', async () => {
    const res = await call('GET', '/audit-logs?action=set_permissions', { token: admin.token });
    assert.equal(res.status, 200);
    assert.ok(res.body.data.length >= 1);
  });
});

describe('masters & dashboard', () => {
  test('master CRUD with duplicate protection', async () => {
    const name = `Tag${RUN}`;
    const created = await call('POST', '/masters/tags', { token: admin.token, body: { name, color: '#123456' } });
    assert.equal(created.status, 201);
    const dup = await call('POST', '/masters/tags', { token: admin.token, body: { name } });
    assert.equal(dup.status, 409);
    const del = await call('DELETE', `/masters/tags/${created.body.data._id}`, { token: admin.token });
    assert.equal(del.body.data.isActive, false);
  });

  test('dashboard summary returns totals and breakdowns', async () => {
    const res = await call('GET', '/dashboard/summary', { token: admin.token });
    assert.equal(res.status, 200);
    assert.ok(res.body.data.totals.total > 0);
    assert.ok(Array.isArray(res.body.data.byStage));
  });

  test('unknown route returns consistent 404 JSON', async () => {
    const res = await call('GET', '/does-not-exist', { token: admin.token });
    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
  });

  test('malformed id returns 400, not 500', async () => {
    const res = await call('GET', '/leads/not-an-id', { token: admin.token });
    assert.equal(res.status, 400);
  });
});

describe('teams & hierarchy', () => {
  let dept, team, sub, memberId;

  async function newUser(label, extra = {}) {
    const res = await call('POST', '/users', {
      token: admin.token,
      body: { name: `${label} ${RUN}`, email: `${label.toLowerCase()}${RUN}@gccschool.com`, password: 'Welcome@123', ...extra },
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    return res.body.data._id;
  }

  test('creates a department → team → sub-team chain', async () => {
    dept = (await call('POST', '/teams', { token: admin.token, body: { name: `Dept ${RUN}`, code: `D${RUN}`, type: 'department' } })).body.data;
    team = (
      await call('POST', '/teams', {
        token: admin.token,
        body: { name: `Team ${RUN}`, code: `t${RUN}`, parent: dept._id, manager: leader.user._id, programs: [masters.programs[0]._id] },
      })
    ).body.data;
    sub = (await call('POST', '/teams', { token: admin.token, body: { name: `Group ${RUN}`, type: 'counsellor_group', parent: team._id } })).body.data;
    assert.equal(team.code, `T${RUN}`, 'code is stored upper-case');
    assert.equal(sub.type, 'counsellor_group');
  });

  test('blocks duplicate names (any case) and codes with 409', async () => {
    const byName = await call('POST', '/teams', { token: admin.token, body: { name: `team ${RUN}` } });
    assert.equal(byName.status, 409);
    assert.ok(byName.body.errors.name);
    const byCode = await call('POST', '/teams', { token: admin.token, body: { name: `Other ${RUN}`, code: `T${RUN}` } });
    assert.equal(byCode.status, 409);
    assert.ok(byCode.body.errors.code);
  });

  test('rejects a parent that would create a cycle', async () => {
    const res = await call('PUT', `/teams/${dept._id}`, { token: admin.token, body: { parent: sub._id } });
    assert.equal(res.status, 422);
    assert.ok(res.body.errors.parent);
  });

  test('tree nests the chain and detail returns the breadcrumb', async () => {
    const tree = (await call('GET', '/teams/tree', { token: admin.token })).body.data;
    const d = tree.find((n) => n._id === dept._id);
    assert.equal(d.children[0]._id, team._id);
    assert.equal(d.children[0].children[0]._id, sub._id);

    const detail = (await call('GET', `/teams/${sub._id}`, { token: admin.token })).body.data;
    assert.deepEqual(detail.ancestors.map((a) => a._id), [dept._id, team._id]);
  });

  test('adds members and points them at the team manager', async () => {
    memberId = await newUser('Member');
    const denied = await call('POST', `/teams/${team._id}/members`, { token: counsellor.token, body: { userIds: [memberId] } });
    assert.equal(denied.status, 403);

    const res = await call('POST', `/teams/${team._id}/members`, {
      token: admin.token,
      body: { userIds: [memberId], setReportingManager: true },
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.added, 1);
    const user = (await call('GET', `/users/${memberId}`, { token: admin.token })).body.data;
    assert.equal(user.team._id, team._id);
    assert.equal(user.reportingManager._id, leader.user._id);
  });

  test('deactivation is blocked by active members and active sub-teams', async () => {
    assert.equal((await call('DELETE', `/teams/${team._id}`, { token: admin.token })).status, 422);
    const removed = await call('DELETE', `/teams/${team._id}/members/${memberId}`, { token: admin.token });
    assert.equal(removed.status, 200);
    // still blocked: the sub-team is active
    assert.equal((await call('DELETE', `/teams/${team._id}`, { token: admin.token })).status, 422);
    assert.equal((await call('DELETE', `/teams/${sub._id}`, { token: admin.token })).status, 200);
    const off = await call('DELETE', `/teams/${team._id}`, { token: admin.token });
    assert.equal(off.body.data.isActive, false);
    // a sub-team cannot come back under an inactive parent
    const back = await call('PUT', `/teams/${sub._id}`, { token: admin.token, body: { isActive: true } });
    assert.equal(back.status, 422);
  });

  test('stats roll up lead workload per member', async () => {
    const seeded = (await call('GET', '/teams?search=Admissions Team A', { token: admin.token })).body.data[0];
    const res = await call('GET', `/teams/${seeded._id}/stats`, { token: admin.token });
    assert.equal(res.status, 200);
    assert.ok(res.body.data.byMember.length >= 2);
    assert.ok(res.body.data.totals.total > 0);

    const parentId = seeded.parent?._id;
    if (parentId) {
      const rolled = (await call('GET', `/teams/${parentId}/stats?include_sub_teams=true`, { token: admin.token })).body.data;
      assert.ok(rolled.totals.total >= res.body.data.totals.total);
    }
  });

  test('team options are available to any signed-in user', async () => {
    const res = await call('GET', '/teams/options', { token: counsellor.token });
    assert.equal(res.status, 200);
    assert.ok(res.body.data.some((t) => t.name === 'Admissions Team A'));
  });

  test('round-robin skips members of a team with distribution paused', async () => {
    const paused = (await call('POST', '/teams', { token: admin.token, body: { name: `Paused ${RUN}`, receivesLeads: false } })).body.data;
    const pausedUser = await newUser('Paused', { receivesLeads: true, team: paused._id });

    const pool = await call('GET', '/users?receives_leads=true&is_active=true&page_size=1', { token: admin.token });
    const rounds = pool.body.pagination.total_results + 1;
    for (let i = 0; i < rounds; i++) {
      const captured = await call('POST', '/leads/capture', {
        headers: { 'x-api-key': CAPTURE_KEY },
        body: { name: `RR ${RUN} ${i}`, mobile: `9${RUN}${String(i).padStart(2, "0")}`, email: `rr${RUN}${i}@example.com` },
      });
      assert.equal(captured.status, 201, JSON.stringify(captured.body));
      const lead = (await call('GET', `/leads/${captured.body.data.leadId}`, { token: admin.token })).body.data;
      assert.notEqual(lead.owner?._id, pausedUser, 'paused-team member received a lead');
    }
    await call('DELETE', `/users/${pausedUser}`, { token: admin.token });
  });
});

describe('lead profile (Deep Dive §4.2)', () => {
  let leadId;
  const base = () => `/leads/${leadId}/profile`;
  const personalBody = {
    personal: {
      firstName: 'Ishaan', lastName: 'Verma', email: `ishaan${RUN}@example.com`, mobile: `95${RUN}1`,
      dob: '2001-05-14', gender: 'Male', state: 'Maharashtra', city: 'Pune', pinCode: '411001',
      address: '12 MG Road, Pune',
    },
    guardian: { name: 'Rakesh Verma', relationship: 'Father', mobile: '9822012345', email: `rakesh${RUN}@example.com` },
  };
  const academicBody = {
    academic: {
      class10: { yearOfPassing: 2016, gradeType: 'CGPA', score: 9.2, medium: 'English' },
      class12: { yearOfPassing: 2018, gradeType: 'Percentage', score: 85.5, medium: 'English' },
      ug: { qualification: 'BBA', status: 'Completed', institution: 'Pune University', gradeType: 'Percentage', score: 72.5, yearOfPassing: 2021, medium: 'English' },
      higherQualification: { has: false },
    },
  };
  const put = (step, body, token = admin.token) => call('PUT', `${base()}/${step}`, { token, body });

  before(async () => {
    const res = await call('POST', '/leads', {
      token: admin.token,
      body: { firstName: 'Ishaan', lastName: 'Verma', mobile: `94${RUN}1`, email: `lead${RUN}@example.com` },
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    leadId = res.body.data._id;
  });

  test('a new profile is prefilled from the lead form', async () => {
    const res = await call('GET', base(), { token: admin.token });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.exists, false);
    assert.equal(res.body.data.personal.firstName, 'Ishaan');
    assert.equal(res.body.data.personal.mobile, `94${RUN}1`);
    assert.deepEqual(res.body.data.steps, { personal: false, academic: false, work: false });
    assert.equal(res.body.data.locked, false);
  });

  test('step 1: mandatory fields; address and guardian email optional', async () => {
    const res = await put('personal', { personal: { firstName: 'Ishaan' } });
    assert.equal(res.status, 400);
    for (const key of ['personal.lastName', 'personal.dob', 'personal.gender', 'personal.pinCode', 'guardian']) {
      assert.ok(res.body.errors[key], `expected an error for ${key}: ${JSON.stringify(res.body.errors)}`);
    }
    assert.equal(res.body.errors['personal.address'], undefined);
  });

  test('step 1 rules: name letters, mobile 6–9, PIN 6 digits, age 17–40, guardian mobile differs', async () => {
    const bad = structuredClone(personalBody);
    Object.assign(bad.personal, { firstName: 'Ishaan2', mobile: '5123456789', pinCode: '41100', dob: '2015-01-01' });
    bad.guardian.email = 'not-an-email';
    const res = await put('personal', bad);
    assert.equal(res.status, 400);
    for (const key of ['personal.firstName', 'personal.mobile', 'personal.pinCode', 'personal.dob', 'guardian.email']) {
      assert.ok(res.body.errors[key], key);
    }
    const same = structuredClone(personalBody);
    same.guardian.mobile = `+91 ${same.personal.mobile}`;
    const dup = await put('personal', same);
    assert.equal(dup.status, 400);
    assert.ok(dup.body.errors['guardian.mobile']);
  });

  test('step 1 saves (optional fields may be empty)', async () => {
    const body = structuredClone(personalBody);
    body.personal.address = '';
    body.guardian.email = '';
    const res = await put('personal', body);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.steps.personal, true);
    assert.equal(res.body.data.personal.address, undefined);
    const full = await put('personal', personalBody);
    assert.equal(full.body.data.personal.city, 'Pune');
  });

  test('declaration is blocked until steps 1–3 are complete', async () => {
    const res = await call('POST', `${base()}/declaration`, { token: admin.token, body: { accepted: true } });
    assert.equal(res.status, 422);
    assert.match(res.body.message, /Step 2/);
  });

  test('step 2 rules: score by grade type, year order, UG future year only while Pursuing', async () => {
    const bad = structuredClone(academicBody);
    bad.academic.class10.score = 11; // CGPA max 10
    bad.academic.class12.yearOfPassing = 2015; // not after class 10
    bad.academic.ug.score = 101;
    bad.academic.higherQualification = { has: true };
    const res = await put('academic', bad);
    assert.equal(res.status, 400);
    for (const key of ['academic.class10.score', 'academic.class12.yearOfPassing', 'academic.ug.score', 'academic.higherQualification.details']) {
      assert.ok(res.body.errors[key], `${key}: ${JSON.stringify(res.body.errors)}`);
    }

    const future = structuredClone(academicBody);
    future.academic.ug.yearOfPassing = new Date().getFullYear() + 1;
    assert.ok((await put('academic', future)).body.errors['academic.ug.yearOfPassing'], 'Completed cannot be in the future');
    future.academic.ug.status = 'Pursuing';
    delete future.academic.ug.score;
    delete future.academic.ug.gradeType;
    const pursuing = await put('academic', future);
    assert.equal(pursuing.status, 200, 'Pursuing allows a future year and no UG score');

    const ok = await put('academic', academicBody);
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.equal(ok.body.data.steps.academic, true);
  });

  test('step 3: experience required only for Experienced; years 0–30, months 0–11', async () => {
    const exp = await put('work', { work: { employmentStatus: 'Experienced', organization: 'Acme' } });
    assert.equal(exp.status, 400);
    for (const key of ['work.designation', 'work.functionalArea', 'work.experienceYears', 'work.experienceMonths']) assert.ok(exp.body.errors[key], key);

    const limits = await put('work', {
      work: { employmentStatus: 'Experienced', organization: 'Acme', designation: 'Analyst', functionalArea: 'Finance', experienceYears: 31, experienceMonths: 12 },
    });
    assert.ok(limits.body.errors['work.experienceYears']);
    assert.ok(limits.body.errors['work.experienceMonths']);

    const fresher = await put('work', { work: { employmentStatus: 'Fresher', organization: 'Leftover' } });
    assert.equal(fresher.status, 200);
    assert.deepEqual(fresher.body.data.work, { employmentStatus: 'Fresher' });
  });

  test('declaration records the text version, locks the profile, and reaches 100%', async () => {
    assert.equal((await call('POST', `${base()}/declaration`, { token: admin.token, body: { accepted: false } })).status, 400);
    const res = await call('POST', `${base()}/declaration`, { token: admin.token, body: { accepted: true } });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.declaration.accepted, true);
    assert.equal(res.body.data.declaration.textVersion, 'v1');
    assert.equal(res.body.data.locked, true);
    assert.equal(res.body.data.completionPercent, 100);
    assert.equal((await put('work', { work: { employmentStatus: 'Fresher' } })).status, 422, 'locked');
  });

  test('only an admin can unlock, with a reason', async () => {
    const byLeader = await call('POST', `${base()}/unlock`, { token: leader.token, body: { reason: 'Fix typo' } });
    assert.equal(byLeader.status, 403);
    assert.equal((await call('POST', `${base()}/unlock`, { token: admin.token, body: {} })).status, 400);
    const res = await call('POST', `${base()}/unlock`, { token: admin.token, body: { reason: 'Candidate asked to fix city' } });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.locked, false);
    assert.equal(res.body.data.declaration.accepted, false);
    assert.equal((await put('work', { work: { employmentStatus: 'Fresher' } })).status, 200);
  });

  test('profile follows lead permissions, scope and masking', async () => {
    assert.equal((await call('GET', base(), { token: counsellor.token })).status, 404);
    assert.equal((await put('work', { work: { employmentStatus: 'Fresher' } }, marketing.token)).status, 403);
    const masked = await call('GET', base(), { token: marketing.token });
    assert.equal(masked.status, 200);
    assert.match(masked.body.data.personal.mobile, /^\*+\d{4}$/);
  });
});
