/**
 * Flows the shared e2e suite (CrmBackend/tests/api.e2e.test.mjs) does not cover,
 * run against the Django API:
 *   API_URL=http://localhost:8000/api/v1 node --test tests/extra_flows.test.mjs
 */
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.API_URL ?? 'http://localhost:4000/api/v1';
const RUN = Date.now().toString().slice(-7);
// user names allow letters and spaces only (go-live), so the run id is spelled with letters
const TAG = RUN.split('').map((d) => 'abcdefghij'[Number(d)]).join('');

async function call(method, path, { token, body, cookie } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
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
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return { token: res.body.data.access_token, user: res.body.data.user, cookie: res.headers.get('set-cookie')?.split(';')[0] };
}

let admin, masters;
const sourceId = (name) => masters.sources.find((s) => s.name === name)._id;
before(async () => {
  admin = await login('admin@gccschool.com', 'Admin@12345');
  masters = (await call('GET', '/masters/bootstrap', { token: admin.token })).body.data;
});

describe('auth extras', () => {
  test('login sets an httpOnly refresh cookie scoped to /api/v1/auth', async () => {
    const res = await call('POST', '/auth/login', { body: { email: 'admin@gccschool.com', password: 'Admin@12345' } });
    const cookie = res.headers.get('set-cookie');
    assert.match(cookie, /crm_rt=/);
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /Path=\/api\/v1\/auth/);
  });

  test('logout revokes the session: refresh then fails', async () => {
    const s = await login('admin@gccschool.com', 'Admin@12345');
    assert.equal((await call('POST', '/auth/logout', { cookie: s.cookie })).status, 200);
    assert.equal((await call('POST', '/auth/refresh', { cookie: s.cookie })).status, 401);
  });

  test('forgot-password never reveals whether the email exists; bad reset token is 400', async () => {
    const known = await call('POST', '/auth/forgot-password', { body: { email: 'admin@gccschool.com' } });
    const unknown = await call('POST', '/auth/forgot-password', { body: { email: `nobody${RUN}@x.com` } });
    assert.equal(known.status, 200);
    assert.equal(unknown.status, 200);
    assert.equal(known.body.message, unknown.body.message);
    const reset = await call('POST', '/auth/reset-password', { body: { token: 'not-a-real-token', password: 'Welcome@123' } });
    assert.equal(reset.status, 400);
    const weak = await call('POST', '/auth/reset-password', { body: { token: 'x', password: 'short' } });
    assert.ok(weak.body.errors.password);
  });

  test('change password: wrong current password is 400; success signs out other sessions', async () => {
    const email = `chg${RUN}@gccschool.com`;
    const created = await call('POST', '/users', {
      token: admin.token,
      body: { name: `Chg User ${TAG}`, email, designation: 'Admission Counsellor', role: 'counsellor', password: 'Welcome@123' },
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const a = await login(email, 'Welcome@123');
    const b = await login(email, 'Welcome@123');
    const wrong = await call('POST', '/auth/change-password', { token: a.token, body: { currentPassword: 'nope', newPassword: 'Changed@123' } });
    assert.equal(wrong.status, 400);
    assert.ok(wrong.body.errors.currentPassword);
    const ok = await call('POST', '/auth/change-password', { token: a.token, body: { currentPassword: 'Welcome@123', newPassword: 'Changed@123' } });
    assert.equal(ok.status, 200);
    assert.equal((await call('POST', '/auth/refresh', { cookie: b.cookie })).status, 401, 'other session revoked');
    assert.equal((await call('POST', '/auth/refresh', { cookie: a.cookie })).status, 200, 'current session kept');
    await login(email, 'Changed@123');
  });
});

describe('users & templates extras', () => {
  test('user update, list filters and sorting', async () => {
    const created = await call('POST', '/users', {
      token: admin.token,
      body: { name: `Upd User ${TAG}`, email: `upd${RUN}@gccschool.com`, designation: 'Admission Counsellor', role: 'counsellor', password: 'Welcome@123', receivesLeads: false },
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const id = created.body.data._id;
    const upd = await call('PUT', `/users/${id}`, { token: admin.token, body: { designation: 'Senior Counsellor', mobile: '9811122233' } });
    assert.equal(upd.status, 200);
    assert.equal(upd.body.data.designation, 'Senior Counsellor');
    const list = await call('GET', `/users?search=upd${RUN}&sort_by=name&sort_order=asc`, { token: admin.token });
    assert.equal(list.body.data.length, 1);
    assert.equal(list.body.pagination.total_results, 1);
    const self = await call('PUT', `/users/${admin.user._id}`, { token: admin.token, body: { isActive: false } });
    assert.equal(self.status, 400, 'cannot deactivate yourself');
  });

  test('permission templates: create, duplicate key 409, update, system template cannot be deleted', async () => {
    const key = `tpl-${RUN}`;
    const body = { key, name: 'Tpl Test', permissions: [{ module: 'leads', actions: ['view'] }], dataScope: 'own' };
    const created = await call('POST', '/permission-templates', { token: admin.token, body });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal((await call('POST', '/permission-templates', { token: admin.token, body })).status, 409);
    const upd = await call('PUT', `/permission-templates/${created.body.data._id}`, { token: admin.token, body: { name: 'Tpl Renamed', key: 'ignored' } });
    assert.equal(upd.body.data.name, 'Tpl Renamed');
    assert.equal(upd.body.data.key, key, 'key cannot change');
    const list = await call('GET', '/permission-templates', { token: admin.token });
    const system = list.body.data.find((t) => t.isSystem);
    assert.equal((await call('DELETE', `/permission-templates/${system._id}`, { token: admin.token })).status, 422);
    assert.equal((await call('DELETE', `/permission-templates/${created.body.data._id}`, { token: admin.token })).status, 200);
  });
});

describe('masters extras', () => {
  test('stage sub-stages: edits keep ids, new ones are added, list is reordered', async () => {
    const stages = (await call('GET', '/masters/stages?page_size=50&sort_order=asc', { token: admin.token })).body.data;
    const prospects = stages.find((s) => s.name === 'Prospects');
    const subs = prospects.subStages;
    const body = {
      subStages: [
        { ...subs[1], counsellorAction: `${subs[1].counsellorAction} (edited)` },
        subs[0],
        ...subs.slice(2),
        { name: `Lukewarm ${RUN}`, counsellorAction: 'Test only', isActive: false },
      ],
    };
    const res = await call('PUT', `/masters/stages/${prospects._id}`, { token: admin.token, body });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.subStages[0]._id, subs[1]._id, 'existing id kept and reordered');
    assert.match(res.body.data.subStages[0].counsellorAction, /\(edited\)$/);
    assert.equal(res.body.data.subStages.length, subs.length + 1);
    // restore
    await call('PUT', `/masters/stages/${prospects._id}`, { token: admin.token, body: { subStages: subs } });
  });

  test('cohort create accepts a plain date; delete closes it', async () => {
    const programs = (await call('GET', '/masters/bootstrap', { token: admin.token })).body.data.programs;
    const res = await call('POST', '/masters/cohorts', {
      token: admin.token,
      body: { name: `Oct ${RUN}`, program: programs[0]._id, startDate: '2027-10-04', capacity: 50 },
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.match(res.body.data.startDate, /^2027-10-04T00:00:00\.000Z$/);
    const del = await call('DELETE', `/masters/cohorts/${res.body.data._id}`, { token: admin.token });
    assert.equal(del.body.data.status, 'closed');
  });

  test('custom field validation and unknown master type 404', async () => {
    const bad = await call('POST', '/masters/custom-fields', { token: admin.token, body: { key: 'Bad Key', label: 'X', type: 'text' } });
    assert.equal(bad.status, 400);
    assert.ok(bad.body.errors.key);
    assert.equal((await call('GET', '/masters/nope', { token: admin.token })).status, 404);
  });
});

describe('leads extras', () => {
  test('export returns CSV with the documented header', async () => {
    const res = await fetch(`${BASE}/leads/export?status=active`, { headers: { Authorization: `Bearer ${admin.token}` } });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/csv/);
    assert.match(res.headers.get('content-disposition'), /attachment; filename="leads-\d+\.csv"/);
    const text = await res.text();
    assert.ok(text.startsWith('Lead No,First Name,Last Name,Mobile,Email,City,State,Source,Channel,Stage,Sub Stage,Status,Owner'));
  });

  test('export: chosen columns in the chosen order; unknown column or format is 400', async () => {
    const res = await fetch(`${BASE}/leads/export?columns=owner,leadNo,tags,stage,subStage&status=active`, {
      headers: { Authorization: `Bearer ${admin.token}` },
    });
    assert.equal(res.status, 200);
    const [header] = (await res.text()).split('\n');
    assert.equal(header, 'Owner,Lead No,Tags,Stage,Sub Stage');
    assert.equal((await call('GET', '/leads/export?columns=leadNo,password', { token: admin.token })).status, 400);
    assert.equal((await call('GET', '/leads/export?format=pdf', { token: admin.token })).status, 400);
  });

  test('export as Excel returns a real .xlsx; masking still applies', async () => {
    const res = await fetch(`${BASE}/leads/export?format=xlsx&columns=leadNo,mobile,email`, { headers: { Authorization: `Bearer ${admin.token}` } });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /spreadsheetml/);
    assert.match(res.headers.get('content-disposition'), /\.xlsx"$/);
    const bytes = new Uint8Array(await res.arrayBuffer());
    assert.equal(String.fromCharCode(bytes[0], bytes[1]), 'PK', 'xlsx is a zip container');

    const mkt = await login('dev.mkt@gccschool.com', 'Welcome@123');
    const csv = await fetch(`${BASE}/leads/export?columns=mobile,email`, { headers: { Authorization: `Bearer ${mkt.token}` } });
    const firstRow = (await csv.text()).split('\n')[1];
    assert.match(firstRow, /^\*+\d{4},/, 'mobile masked for marketing');
  });

  test('list filters: unassigned, status, created range, pagination block', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const res = await call('GET', `/leads?unassigned=true&status=active&created_from=2000-01-01&created_to=${today}&page_size=2`, { token: admin.token });
    assert.equal(res.status, 200);
    for (const lead of res.body.data) {
      assert.equal(lead.owner, undefined);
      assert.equal(lead.status, 'active');
    }
    assert.deepEqual(Object.keys(res.body.pagination).sort(), ['current_page', 'next_page', 'page_size', 'previous_page', 'total_pages', 'total_results']);
  });

  test('custom field values are validated against their definition', async () => {
    const key = `cf${RUN}`;
    const def = await call('POST', '/masters/custom-fields', { token: admin.token, body: { key, label: 'Exp', type: 'number' } });
    assert.equal(def.status, 201, JSON.stringify(def.body));
    const bad = await call('POST', '/leads', { token: admin.token, body: { firstName: 'Cf', mobile: `93${RUN}1`, source: sourceId('Walk-in'), customFields: { [key]: 'three' } } });
    assert.equal(bad.status, 400);
    assert.ok(bad.body.errors[`customFields.${key}`]);
    const ok = await call('POST', '/leads', { token: admin.token, body: { firstName: 'Cf', mobile: `93${RUN}1`, source: sourceId('Walk-in'), customFields: { [key]: 3 } } });
    assert.equal(ok.status, 201, JSON.stringify(ok.body));
    assert.equal(ok.body.data.customFields[key], 3);
    await call('DELETE', `/leads/${ok.body.data._id}`, { token: admin.token });
    await call('DELETE', `/masters/custom-fields/${def.body.data._id}`, { token: admin.token });
  });
});

describe('notifications & teams extras', () => {
  test('mark one and all notifications read; unread header', async () => {
    const res = await call('GET', '/notifications?page_size=5', { token: admin.token });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('x-unread-count'), String(res.body.data.unreadCount));
    const id = res.body.data.items[0]?._id;
    if (id) assert.equal((await call('PATCH', `/notifications/${id}/read`, { token: admin.token })).status, 200);
    assert.equal((await call('PATCH', '/notifications/read-all', { token: admin.token })).status, 200);
    const after = await call('GET', '/notifications?unread=true', { token: admin.token });
    assert.equal(after.body.data.unreadCount, 0);
  });

  test('team update clears fields with null and validates the manager', async () => {
    const created = await call('POST', '/teams', { token: admin.token, body: { name: `Upd Team ${RUN}`, location: 'Pune', code: `u${RUN}` } });
    const id = created.body.data._id;
    const cleared = await call('PUT', `/teams/${id}`, { token: admin.token, body: { location: null, code: '' } });
    assert.equal(cleared.status, 200, JSON.stringify(cleared.body));
    assert.equal(cleared.body.data.location, undefined);
    assert.equal(cleared.body.data.code, undefined);
    const badManager = await call('PUT', `/teams/${id}`, { token: admin.token, body: { manager: '000000000000000000000000' } });
    assert.equal(badManager.status, 400);
    assert.equal((await call('DELETE', `/teams/${id}`, { token: admin.token })).status, 200);
  });
});
