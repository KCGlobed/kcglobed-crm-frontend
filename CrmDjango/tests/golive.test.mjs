/**
 * Go-Live Minimum Scope §13.1 — the go-live checklist, end to end against the API.
 *
 * Start the server for QA first (emails to files, no rate limits, jobs inline):
 *   MAIL_OUTBOX_DIR=./tmp-mail AUTH_RATE_LIMIT=1000 API_RATE_LIMIT=100000 RUN_JOBS_INLINE=true \
 *     BULK_SEND_WINDOW=00:00-23:59 .venv/Scripts/python manage.py runserver 127.0.0.1:4000 --noreload
 *   MAIL_OUTBOX_DIR=./tmp-mail node --test tests/golive.test.mjs
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.API_URL ?? 'http://localhost:4000/api/v1';
const OUTBOX = process.env.MAIL_OUTBOX_DIR ?? './tmp-mail';
const RUN = Date.now().toString().slice(-4);
// names allow letters only (GL-01), so the run id is spelled with letters
const TAG = RUN.split('').map((d) => 'abcdefghij'[Number(d)]).join('');
const PASSWORD = 'Welcome@123';

async function call(method, url, { token, body, headers } = {}) {
  const res = await fetch(`${BASE}${url}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers ?? {}),
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

async function upload(url, token, fields, file) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, typeof v === 'string' ? v : JSON.stringify(v));
  form.append('file', new Blob([file.content]), file.name);
  const res = await fetch(`${BASE}${url}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  return { status: res.status, body: await res.json() };
}

async function login(email, password = PASSWORD) {
  const res = await call('POST', '/auth/login', { body: { email, password } });
  assert.equal(res.status, 200, `${email}: ${JSON.stringify(res.body)}`);
  const cookie = res.headers.get('set-cookie')?.split(';')[0];
  return { token: res.body.data.access_token, user: res.body.data.user, cookie };
}

async function logout(session) {
  const res = await call('POST', '/auth/logout', { headers: { Cookie: session.cookie } });
  assert.equal(res.status, 200);
}

function tempPasswordFor(email) {
  const files = fs.readdirSync(OUTBOX).map((f) => path.join(OUTBOX, f));
  files.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    const at = text.lastIndexOf(`Username: ${email}`);
    if (at >= 0) {
      const m = text.slice(at).match(/Temporary password: (\S+)/);
      if (m) return { password: m[1], mail: text };
    }
  }
  return null;
}

const mobile = (prefix, i) => `${prefix}${RUN}${String(i).padStart(5, '0')}`;
const sourceId = (name) => masters.sources.find((s) => s.name === name)._id;
const stageNamed = (name) => dispositionStages.find((s) => s.name === name);

let sa; // Super Admin
let masters;
let dispositionStages;
let otherCounsellors = []; // seeded counsellors paused during the run so rotation counts are exact

async function createUser(session, payload) {
  return call('POST', '/users', { token: session.token, body: { designation: 'Admission Counsellor', ...payload } });
}

async function counsellor(label) {
  const email = `${label}.${RUN}@gccschool.com`;
  const res = await createUser(sa, { name: `${label} ${TAG}`, email, role: 'counsellor', password: PASSWORD });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return { ...res.body.data, email };
}

function metaEvent(leadgenId, answers, extra = {}) {
  return {
    object: 'page',
    entry: [{
      id: 'page1', time: Math.floor(Date.now() / 1000),
      changes: [{
        field: 'leadgen',
        value: {
          leadgen_id: leadgenId, page_id: 'page1', form_id: `form${RUN}`, ad_id: 'ad1',
          created_time: Math.floor(Date.now() / 1000),
          campaign_id: 'c1', campaign_name: 'GMBA Oct', adset_id: 's1', adset_name: 'Mumbai 22-30',
          ad_name: 'Carousel A', form_name: 'GMBA enquiry',
          field_data: Object.entries(answers).map(([name, value]) => ({ name, values: [value] })),
          ...extra,
        },
      }],
    }],
  };
}

const inbox = async (token, type = '') => (await call('GET', `/notifications?page_size=50${type ? `&type=${type}` : ''}`, { token })).body.data.items;
const postMeta = (body) => call('POST', '/webhooks/meta-leads', { body });

before(async () => {
  assert.ok(fs.existsSync(OUTBOX), `Start the server with MAIL_OUTBOX_DIR=${OUTBOX}`);
  sa = await login('admin@gccschool.com', 'Admin@12345');
  masters = (await call('GET', '/masters/bootstrap', { token: sa.token })).body.data;
  dispositionStages = (await call('GET', '/leads/disposition-options', { token: sa.token })).body.data.stages;
  const users = (await call('GET', '/users?role=counsellor&page_size=100', { token: sa.token })).body.data;
  otherCounsellors = users.filter((u) => u.receivesLeads && u.isActive);
  for (const u of otherCounsellors) await call('PUT', `/users/${u._id}`, { token: sa.token, body: { receivesLeads: false } });
});

after(async () => {
  for (const u of otherCounsellors) await call('PUT', `/users/${u._id}`, { token: sa.token, body: { receivesLeads: true } });
});

// ------------------------------------------------------------------ §2 roles

let adminSession;
describe('GL-01..05 roles, user creation and login', () => {
  test('Super Admin creates an Admin with name, email, designation; login email arrives; new password is forced', async () => {
    const email = `admin.${RUN}@gccschool.com`;
    const res = await createUser(sa, { name: `Admin ${TAG}`, email, designation: 'Admissions Manager', role: 'admin' });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.data.role, 'admin');
    assert.equal(res.body.data.mustChangePassword, true);

    const mail = tempPasswordFor(email);
    assert.ok(mail, 'credentials email written');
    assert.match(mail.mail, /Your GCC School CRM login/);
    assert.equal(mail.password.length, 12);

    const first = await login(email, mail.password);
    const blocked = await call('GET', '/leads', { token: first.token });
    assert.equal(blocked.status, 403);
    assert.equal(blocked.body.errors.code, 'PASSWORD_CHANGE_REQUIRED');
    const weak = await call('POST', '/auth/change-password', { token: first.token, body: { currentPassword: mail.password, newPassword: 'weakpass' } });
    assert.equal(weak.status, 400);
    const changed = await call('POST', '/auth/change-password', { token: first.token, body: { currentPassword: mail.password, newPassword: 'Admin@New1' } });
    assert.equal(changed.status, 200, JSON.stringify(changed.body));
    adminSession = await login(email, 'Admin@New1');
    assert.equal((await call('GET', '/leads', { token: adminSession.token })).status, 200);
  });

  test('Admin creates a counsellor (credentials emailed); Admin cannot create another Admin', async () => {
    const email = `made.by.admin.${RUN}@gccschool.com`;
    const res = await createUser(adminSession, { name: `Made ${TAG}`, email, role: 'counsellor' });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.ok(tempPasswordFor(email), 'counsellor got credentials');
    const denied = await createUser(adminSession, { name: `Nope ${TAG}`, email: `nope.${RUN}@gccschool.com`, role: 'admin' });
    assert.equal(denied.status, 403);
  });

  test('create-user validation: name letters only, designation required, email unique, email not editable', async () => {
    const bad = await createUser(sa, { name: 'R2D2', email: `x.${RUN}@gccschool.com`, designation: '' });
    assert.equal(bad.status, 400);
    assert.ok(bad.body.errors.name);
    assert.ok(bad.body.errors.designation);
    const dup = await createUser(sa, { name: `Dup ${TAG}`, email: 'admin@gccschool.com', role: 'counsellor' });
    assert.equal(dup.status, 409);
    const me = adminSession.user;
    const edit = await call('PUT', `/users/${me._id}`, { token: sa.token, body: { email: `changed.${RUN}@x.com` } });
    assert.equal(edit.status, 400);
  });

  test('Resend credentials issues a new temporary password', async () => {
    const email = `resend.${RUN}@gccschool.com`;
    const res = await createUser(sa, { name: `Resend ${TAG}`, email, role: 'counsellor' });
    const firstPw = tempPasswordFor(email).password;
    const again = await call('POST', `/users/${res.body.data._id}/resend-credentials`, { token: sa.token });
    assert.equal(again.status, 200);
    const secondPw = tempPasswordFor(email).password;
    assert.notEqual(firstPw, secondPw);
    assert.equal((await call('POST', '/auth/login', { body: { email, password: firstPw } })).status, 401);
  });
});

// ------------------------------------------------- §5 round-robin + Meta

let c1, c2, c3, c4;
let s1, s2, s3;
describe('GL-09 / GL-12 Meta Lead Ads and round-robin', () => {
  before(async () => {
    [c1, c2, c3, c4] = [await counsellor('rra'), await counsellor('rrb'), await counsellor('rrc'), await counsellor('rrd')];
  });

  test('A deactivated counsellor cannot log in and stops receiving round-robin leads at once', async () => {
    const s = await login(c4.email);
    assert.equal((await call('DELETE', `/users/${c4._id}`, { token: sa.token })).status, 200);
    assert.equal((await call('GET', '/leads', { token: s.token })).status, 401, 'logged out immediately');
    const again = await call('POST', '/auth/login', { body: { email: c4.email, password: PASSWORD } });
    assert.equal(again.status, 403);
    // c4 is never chosen below (asserted with the 3/3/3 split)
  });

  test('With no counsellor logged in, a Meta lead goes to the Unassigned pool, Admin is alerted, and it is assigned when a counsellor logs in', async () => {
    const res = await postMeta(metaEvent(`pool${RUN}`, { full_name: 'Pool Candidate', phone_number: mobile(6, 1), email: `pool${RUN}@example.com` }));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.created, 1);
    const found = (await call('GET', `/leads?search=${mobile(6, 1)}`, { token: sa.token })).body.data[0];
    assert.equal(found.owner, undefined, 'unassigned');
    const alerts = (await inbox(sa.token, 'unassigned_pool'));
    assert.ok(alerts.some((n) => n.type === 'unassigned_pool' && n.data?.leadId === found._id), 'admin alerted');

    s1 = await login(c1.email); // first counsellor logs in → pooled Meta leads are distributed
    const lead = (await call('GET', `/leads/${found._id}`, { token: sa.token })).body.data;
    assert.equal(lead.owner?._id, c1._id);
    const timeline = (await call('GET', `/leads/${found._id}/timeline`, { token: sa.token })).body.data;
    assert.ok(timeline.some((t) => t.type === 'assignment' && /Round-robin/.test(t.title)));
  });

  test('9 Meta leads with 3 counsellors logged in go 3 / 3 / 3; a logged-out counsellor gets none', async () => {
    s2 = await login(c2.email);
    s3 = await login(c3.email);
    const owners = {};
    for (let i = 0; i < 9; i += 1) {
      const res = await postMeta(metaEvent(`rr${RUN}${i}`, { full_name: `Rotation Lead ${'abcdefghi'[i]}`, phone_number: mobile(7, i) }));
      assert.equal(res.body.data.created, 1, JSON.stringify(res.body));
      const lead = (await call('GET', `/leads?search=${mobile(7, i)}`, { token: sa.token })).body.data[0];
      owners[lead.owner._id] = (owners[lead.owner._id] ?? 0) + 1;
    }
    assert.deepEqual(Object.values(owners).sort(), [3, 3, 3], JSON.stringify(owners));
    assert.deepEqual(Object.keys(owners).sort(), [c1._id, c2._id, c3._id].sort());
  });

  test('A test Meta lead appears within 60 s with campaign, ad set, ad and form names; unmapped answers saved as a note', async () => {
    const started = Date.now();
    const res = await postMeta(metaEvent(`meta${RUN}`, {
      full_name: 'Meta Test Lead', phone_number: `+91 ${mobile(8, 1)}`, email: `meta${RUN}@example.com`, city: 'Pune',
      preferred_batch: 'January',
    }));
    assert.equal(res.body.data.created, 1);
    assert.ok(Date.now() - started < 60_000);
    const lead = (await call('GET', `/leads?search=${mobile(8, 1)}`, { token: sa.token })).body.data[0];
    const full = (await call('GET', `/leads/${lead._id}`, { token: sa.token })).body.data;
    assert.match(full.leadNo, /^GCC-L-\d{7}$/);
    assert.equal(full.createdVia, 'meta');
    assert.equal(full.source.name, 'Meta Ads');
    assert.equal(full.firstSource.name, 'Meta Ads');
    assert.equal(full.meta.campaignName, 'GMBA Oct');
    assert.equal(full.meta.adsetName, 'Mumbai 22-30');
    assert.equal(full.meta.adName, 'Carousel A');
    assert.equal(full.meta.formName, 'GMBA enquiry');
    assert.equal(full.meta.leadId, `meta${RUN}`);
    assert.ok([c1._id, c2._id, c3._id].includes(full.owner._id), 'assigned to a logged-in counsellor');
    const notes = (await call('GET', `/leads/${lead._id}/notes`, { token: sa.token })).body.data;
    assert.ok(notes.some((n) => /preferred_batch: January/.test(n.body)), 'Meta answers note');
  });

  test('Resending the same Meta webhook creates no second lead', async () => {
    const res = await postMeta(metaEvent(`meta${RUN}`, { full_name: 'Meta Test Lead', phone_number: mobile(8, 1) }));
    assert.equal(res.body.data.duplicates, 1);
    assert.equal(res.body.data.created, 0);
    const list = (await call('GET', `/leads?search=${mobile(8, 1)}`, { token: sa.token })).body;
    assert.equal(list.pagination.total_results, 1);
  });

  test('A Meta lead with an existing mobile updates the old lead (Re-enquired), no new lead, owner alerted', async () => {
    const before = (await call('GET', `/leads?search=${mobile(8, 1)}`, { token: sa.token })).body.data[0];
    const res = await postMeta(metaEvent(`metare${RUN}`, { full_name: 'Meta Test Lead', phone_number: mobile(8, 1), state: 'Maharashtra' }));
    assert.equal(res.body.data.reEnquiries, 1);
    const list = (await call('GET', `/leads?search=${mobile(8, 1)}`, { token: sa.token })).body;
    assert.equal(list.pagination.total_results, 1, 'no new lead');
    const lead = (await call('GET', `/leads/${before._id}`, { token: sa.token })).body.data;
    assert.equal(lead.reEnquiryCount, 1);
    assert.equal(lead.state, 'Maharashtra', 'empty field filled');
    assert.equal(lead.city, 'Pune', 'filled field kept');
    assert.equal(lead.owner._id, before.owner._id, 'same owner');
    const timeline = (await call('GET', `/leads/${before._id}/timeline`, { token: sa.token })).body.data;
    assert.ok(timeline.some((t) => t.type === 're_enquiry' && /Re-enquired via Meta Ads/.test(t.title)));
    const ownerSession = [s1, s2, s3].find((s) => s.user._id === before.owner._id);
    const alerts = (await inbox(ownerSession.token, 're_enquiry'));
    assert.ok(alerts.some((n) => n.type === 're_enquiry' && n.data?.leadId === before._id));
  });

  test('A failing Meta fetch is retried and lands in Integration errors with a Retry button', async () => {
    const res = await postMeta(metaEvent(`err${RUN}`, { full_name: 'Err Lead', phone_number: mobile(8, 9) }, { simulate_error: 'Graph API timeout' }));
    assert.equal(res.body.data.failed, 1);
    const errors = (await call('GET', '/integrations/meta/events?status=errors', { token: sa.token })).body.data;
    const event = errors.find((e) => e.leadgenId === `err${RUN}`);
    assert.equal(event.status, 'failed');
    assert.ok(event.nextAttemptAt, 'retry scheduled');
    assert.equal((await call('GET', '/integrations/meta/events', { token: adminSession.token })).status, 403, 'Super Admin only');
    const check = (await call('GET', '/integrations/meta/daily-check', { token: sa.token })).body.data;
    assert.ok(check.forms.some((f) => f.formId === `form${RUN}`));
  });

  test('Webhook subscription handshake echoes the challenge only for the right verify token', async () => {
    const okRes = await fetch(`${BASE}/webhooks/meta-leads?hub.mode=subscribe&hub.verify_token=gcc-crm-meta-verify&hub.challenge=12345`);
    assert.equal(await okRes.text(), '12345');
    const bad = await fetch(`${BASE}/webhooks/meta-leads?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=1`);
    assert.equal(bad.status, 403);
  });

  test('New-lead welcome SMS and email fire automatically for Meta leads', async () => {
    const lead = (await call('GET', `/leads?search=${mobile(8, 1)}`, { token: sa.token })).body.data[0];
    const messages = (await call('GET', `/leads/${lead._id}/messages`, { token: sa.token })).body.data;
    assert.ok(messages.some((m) => m.trigger === 'lead_created' && m.channel === 'sms'));
    assert.ok(messages.some((m) => m.trigger === 'lead_created' && m.channel === 'email'));
    assert.ok(messages.every((m) => !/\{\w+\}/.test(m.body)), 'no raw placeholders');
  });
});

// --------------------------------------------------------------- §3 scope

describe('GL-06 / GL-07 visibility', () => {
  test('A counsellor sees only assigned leads in list, search, filters and lead page; another counsellor\'s mobile shows only "assigned to another counsellor"', async () => {
    const mine = (await call('GET', '/leads?page_size=100', { token: s1.token })).body.data;
    assert.ok(mine.length > 0);
    assert.ok(mine.every((l) => l.owner?._id === c1._id));
    const others = (await call('GET', `/leads?owner=${c2._id}`, { token: s1.token })).body.data;
    assert.equal(others.length, 0, 'filters cannot widen scope');

    const theirs = (await call('GET', `/leads?owner=${c2._id}&page_size=1`, { token: sa.token })).body.data[0];
    const search = await call('GET', `/leads?search=${theirs.mobile}`, { token: s1.token });
    assert.equal(search.body.data.length, 0);
    assert.equal(search.body.notice, 'Lead exists, assigned to another counsellor');
    const global = (await call('GET', `/leads/search?q=${theirs.mobile}`, { token: s1.token })).body.data;
    assert.equal(global.items.length, 0);
    assert.equal(global.notice, 'Lead exists, assigned to another counsellor');
    const page = await call('GET', `/leads/${theirs._id}`, { token: s1.token });
    assert.equal(page.status, 404);
    const dup = (await call('GET', `/leads/check-duplicate?mobile=${theirs.mobile}`, { token: s1.token })).body.data;
    assert.equal(dup.message, 'Lead exists, assigned to another counsellor');
    assert.equal(dup.leadId, undefined, 'no details leak');
  });

  test('Counsellor has no export, bulk upload, assign or History access', async () => {
    assert.equal((await call('GET', '/leads/export', { token: s1.token })).status, 403);
    assert.equal((await call('POST', '/leads/bulk-assign', { token: s1.token, body: {} })).status, 403);
    const lead = (await call('GET', '/leads?page_size=1', { token: s1.token })).body.data[0];
    assert.equal((await call('GET', `/leads/${lead._id}/history`, { token: s1.token })).status, 403);
    assert.equal((await call('GET', '/users', { token: s1.token })).status, 403);
  });
});

// ------------------------------------------------------------- §4 capture

describe('GL-10 Quick Add', () => {
  test('Quick Add with an existing mobile is blocked before save', async () => {
    const existing = mobile(8, 1);
    const check = (await call('GET', `/leads/check-duplicate?mobile=${existing}`, { token: sa.token })).body.data;
    assert.equal(check.exists, true);
    assert.match(check.message, /Lead exists: GCC-L-\d{7}/);
    const res = await call('POST', '/leads', { token: sa.token, body: { firstName: 'Dup', mobile: existing, source: sourceId('Walk-in') } });
    assert.equal(res.status, 409);
  });

  test('Quick Add validates fields; source is mandatory; a counsellor\'s lead is assigned to them', async () => {
    const bad = await call('POST', '/leads', { token: s2.token, body: { firstName: 'R2', mobile: '12345' } });
    assert.equal(bad.status, 400);
    assert.ok(bad.body.errors.firstName && bad.body.errors.mobile && bad.body.errors.source);
    const res = await call('POST', '/leads', { token: s2.token, body: {
      firstName: 'Quick', lastName: 'Add', mobile: mobile(9, 1), source: sourceId('Inbound Call'), note: 'Called the front desk',
    } });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.data.owner._id, c2._id);
    assert.equal(res.body.data.createdViaLabel, 'Quick Add');
    const tl = (await call('GET', `/leads/${res.body.data._id}/timeline`, { token: s2.token })).body.data;
    assert.ok(tl.some((t) => t.type === 'assignment' && /by Quick Add/.test(t.title)));
  });

  test('Admin Quick Add can leave the lead unassigned', async () => {
    const res = await call('POST', '/leads', { token: adminSession.token, body: { firstName: 'Pool', mobile: mobile(9, 2), source: sourceId('Event') } });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.owner, undefined);
  });
});

// --------------------------------------------------- §4.4 bulk upload + §5.2

let bulkFile;
describe('GL-11 / GL-13 / GL-37 bulk upload, bulk reassign, import update', () => {
  let reassignIds;

  test('Template downloads as .xlsx; preview shows the first 20 rows with errors', async () => {
    const res = await fetch(`${BASE}/leads/import/template`, { headers: { Authorization: `Bearer ${sa.token}` } });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /spreadsheetml/);
    const csv = 'First Name,Mobile,Email\nGood,9000000001,good@x.com\nBad,12345,\n';
    const preview = await upload('/leads/import/preview', sa.token, {}, { name: 'p.csv', content: csv });
    assert.equal(preview.status, 200, JSON.stringify(preview.body));
    assert.equal(preview.body.data.mapping.mobile, 'Mobile');
    assert.equal(preview.body.data.rows[1].error, 'Mobile invalid');
  });

  test('Source is mandatory for an upload', async () => {
    const res = await upload('/leads/bulk-upload', sa.token, { options: {} }, { name: 'x.csv', content: 'First Name,Mobile\nA,9000000002\n' });
    assert.equal(res.status, 400);
    assert.ok(res.body.errors.source);
  });

  test('Admin bulk-reassigns 100 leads split among 4 counsellors: 25 each; old owner loses access; timeline shows each reassignment', async () => {
    const rows = ['First Name,Last Name,Mobile,Email'];
    for (let i = 0; i < 100; i += 1) rows.push(`Hundred,Lead,${mobile(6, 100 + i)},h${RUN}${i}@example.com`);
    const res = await upload('/leads/bulk-upload', adminSession.token, {
      options: { source: sourceId('Event'), assignMode: 'one', owners: [c1._id] },
    }, { name: `hundred-${RUN}.csv`, content: rows.join('\n') });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.created, 100);
    const leads = (await call('GET', `/leads?upload_file=hundred-${RUN}.csv&page_size=100`, { token: adminSession.token })).body.data;
    assert.equal(leads.length, 100);
    reassignIds = leads.map((l) => l._id);

    const extra = [await counsellor('spa'), await counsellor('spb')];
    const owners = [c2._id, c3._id, extra[0]._id, extra[1]._id];
    const preview = await call('POST', '/leads/bulk-assign', { token: adminSession.token, body: {
      leadIds: reassignIds, owners, reason: 'Workload', preview: true,
    } });
    assert.deepEqual(preview.body.data.perCounsellor.map((p) => p.count), [25, 25, 25, 25]);
    const done = await call('POST', '/leads/bulk-assign', { token: adminSession.token, body: { leadIds: reassignIds, owners, reason: 'Workload' } });
    assert.equal(done.status, 200, JSON.stringify(done.body));
    assert.equal(done.body.data.assigned, 100);

    const lost = await call('GET', `/leads/${reassignIds[0]}`, { token: s1.token });
    assert.equal(lost.status, 404);
    assert.equal(lost.body.message, 'This lead is no longer assigned to you');
    const tl = (await call('GET', `/leads/${reassignIds[0]}/timeline`, { token: adminSession.token })).body.data;
    const entry = tl.find((t) => t.type === 'assignment' && /Reassigned from/.test(t.title));
    assert.ok(entry, 'reassignment entry');
    assert.match(entry.description, /Reason: Workload/);
    const alerts = (await inbox(s2.token, 'lead_assigned'));
    assert.ok(alerts.some((n) => /25 leads assigned to you by/.test(n.title)), 'one bulk alert');
    const away = (await inbox(s1.token, 'lead_reassigned'));
    assert.ok(away.some((n) => n.type === 'lead_reassigned'), 'old counsellor notified');
  });

  test('Single assign needs a reason and an active counsellor', async () => {
    const noReason = await call('POST', `/leads/${reassignIds[1]}/assign`, { token: adminSession.token, body: { owner: c1._id } });
    assert.equal(noReason.status, 400);
    const toAdmin = await call('POST', `/leads/${reassignIds[1]}/assign`, { token: adminSession.token, body: { owner: adminSession.user._id, reason: 'Other' } });
    assert.equal(toAdmin.status, 400);
    const ok = await call('POST', `/leads/${reassignIds[1]}/assign`, { token: adminSession.token, body: { owner: c1._id, reason: 'Language' } });
    assert.equal(ok.status, 200);
  });

  test('Bulk upload of 1,000 rows with 50 bad mobiles and 20 duplicates gives the right counts and an error file', async () => {
    const rows = ['First Name,Last Name,Mobile,Email,City'];
    for (let i = 0; i < 930; i += 1) rows.push(`Bulk,Row,${mobile(6, 1000 + i)},${i < 500 ? `b${RUN}x${i}@example.com` : ''},Pune`);
    for (let i = 0; i < 50; i += 1) rows.push(`Bad,Mobile,12345${i},,`);
    for (let i = 0; i < 20; i += 1) rows.push(`Dup,Row,${mobile(6, 100 + i)},,`);
    bulkFile = `thousand-${RUN}.csv`;
    const res = await upload('/leads/bulk-upload', adminSession.token, {
      options: { source: sourceId('Event'), assignMode: 'unassigned', duplicates: 'skip' },
    }, { name: bulkFile, content: rows.join('\n') });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const r = res.body.data;
    assert.equal(r.total, 1000);
    assert.equal(r.created, 930);
    assert.equal(r.skipped, 20);
    assert.equal(r.failed, 50);
    assert.ok(r.errors.some((e) => e.reason === 'Mobile invalid'));
    assert.ok(r.errors.some((e) => /^Duplicate of lead GCC-L-\d{7}$/.test(e.reason)));
    const file = await fetch(`${BASE}/leads/import/errors/${r.errorFile}`, { headers: { Authorization: `Bearer ${adminSession.token}` } });
    assert.equal(file.status, 200);
    assert.ok((await file.arrayBuffer()).byteLength > 1000);
  });

  test('Bulk-uploaded leads get no welcome message unless "Send welcome message" is ticked', async () => {
    const lead = (await call('GET', `/leads?upload_file=${bulkFile}&page_size=1`, { token: adminSession.token })).body.data[0];
    const quiet = (await call('GET', `/leads/${lead._id}/messages`, { token: adminSession.token })).body.data;
    assert.equal(quiet.length, 0);
    const res = await upload('/leads/bulk-upload', adminSession.token, {
      options: { source: sourceId('Event'), sendWelcome: true },
    }, { name: `welcome-${RUN}.csv`, content: `First Name,Mobile,Email\nWelcome,${mobile(9, 50)},w${RUN}@example.com\n` });
    assert.equal(res.body.data.created, 1);
    const welcomed = (await call('GET', `/leads?search=${mobile(9, 50)}`, { token: adminSession.token })).body.data[0];
    const sent = (await call('GET', `/leads/${welcomed._id}/messages`, { token: adminSession.token })).body.data;
    assert.ok(sent.some((m) => m.trigger === 'lead_created_bulk'));
  });

  test('Import update: rows with a Lead ID update only mapped columns', async () => {
    const lead = (await call('GET', `/leads?upload_file=${bulkFile}&page_size=1`, { token: adminSession.token })).body.data[0];
    const csv = `Lead ID,City\n${lead.leadNo},Nashik\n`;
    const res = await upload('/leads/bulk-upload', adminSession.token, { options: { source: sourceId('Event') } }, { name: 'upd.csv', content: csv });
    assert.equal(res.body.data.updated, 1, JSON.stringify(res.body));
    const after = (await call('GET', `/leads/${lead._id}`, { token: adminSession.token })).body.data;
    assert.equal(after.city, 'Nashik');
    assert.equal(after.firstName, lead.firstName);
  });
});

// ------------------------------------------------------------ §7 stages

describe('GL-16..20 dispositions', () => {
  let leadId;
  before(async () => {
    leadId = (await call('GET', '/leads?page_size=1', { token: s2.token })).body.data[0]._id;
  });
  const inHours = (h) => new Date(Date.now() + h * 3600_000).toISOString();

  test('"Interested" cannot be saved without a follow-up date; "Not interested" cannot be saved without a reason', async () => {
    const interested = stageNamed('Interested');
    const noFollowUp = await call('POST', `/leads/${leadId}/disposition`, { token: s2.token, body: { stage: interested._id, subStage: interested.subStages[0]._id } });
    assert.equal(noFollowUp.status, 400);
    assert.ok(noFollowUp.body.errors.followUpAt);
    const past = await call('POST', `/leads/${leadId}/disposition`, { token: s2.token, body: { stage: interested._id, subStage: interested.subStages[0]._id, followUpAt: inHours(-2) } });
    assert.equal(past.status, 400);
    const notInterested = stageNamed('Not Interested');
    const noReason = await call('POST', `/leads/${leadId}/disposition`, { token: s2.token, body: { stage: notInterested._id } });
    assert.equal(noReason.status, 400);
    assert.ok(noReason.body.errors.subStage);
  });

  test('Log Call saves stage + follow-up + call row; timeline shows stage change and call', async () => {
    const interested = stageNamed('Interested');
    const res = await call('POST', `/leads/${leadId}/disposition`, { token: s2.token, body: {
      stage: interested._id, subStage: interested.subStages[0]._id, followUpAt: inHours(24), followUpType: 'call_back',
      note: 'Wants brochure', interaction: 'call', call: { status: 'answered', durationSeconds: 185 },
    } });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.lead.stage.name, 'Interested');
    const calls = (await call('GET', `/leads/${leadId}/calls`, { token: s2.token })).body.data;
    assert.equal(calls[0].durationSeconds, 185);
    const tl = (await call('GET', `/leads/${leadId}/timeline`, { token: s2.token })).body.data;
    assert.ok(tl.some((t) => t.type === 'stage_change' && /→ Interested/.test(t.title)));
    assert.ok(tl.some((t) => t.type === 'call' && /3m 5s/.test(t.title)));
    const messages = (await call('GET', `/leads/${leadId}/messages`, { token: s2.token })).body.data;
    assert.ok(messages.some((m) => m.trigger === 'stage_interested'), 'Interested automation');
  });

  test('Counsellors cannot set Application Submitted or Re-enquired', async () => {
    const locked = stageNamed('Application Submitted');
    const res = await call('POST', `/leads/${leadId}/disposition`, { token: s2.token, body: { stage: locked._id, followUpAt: inHours(5) } });
    assert.equal(res.status, 422);
  });

  test('A closed lead that re-enquires reopens as Re-enquired', async () => {
    const lead = (await call('GET', `/leads/${leadId}`, { token: s2.token })).body.data;
    const notInterested = stageNamed('Not Interested');
    await call('POST', `/leads/${leadId}/disposition`, { token: s2.token, body: { stage: notInterested._id, subStage: notInterested.subStages[0]._id } });
    const res = await call('POST', '/leads/capture', { headers: { 'x-api-key': process.env.CAPTURE_API_KEY ?? '' }, body: { firstName: 'X', mobile: lead.mobile } });
    if (res.status === 401) return; // capture key not configured in this environment
    const after = (await call('GET', `/leads/${leadId}`, { token: s2.token })).body.data;
    assert.equal(after.stage.name, 'Re-enquired');
  });
});

// ------------------------------------------------ §6.3 counsellor discussion

describe('GL-15 counsellor custom fields', () => {
  test('Working shows #5–7; switching to Fresher hides and clears them; history keeps the old values', async () => {
    const leadId = (await call('GET', '/leads?page_size=1', { token: s3.token })).body.data[0]._id;
    const meta = (await call('GET', `/leads/${leadId}/discussion`, { token: s3.token })).body.data;
    assert.equal(meta.fields.filter((f) => Number.isInteger(f.no)).length, 27);
    const working = await call('PUT', `/leads/${leadId}/discussion`, { token: s3.token, body: {
      employmentStatus: 'Working', currentCompany: 'Deloitte', currentSalary: 45000, experienceRelevant: 'Yes',
    } });
    assert.equal(working.status, 200, JSON.stringify(working.body));
    assert.equal(working.body.data.data.currentCompany, 'Deloitte');
    const profile = (await call('GET', `/leads/${leadId}/profile`, { token: s3.token })).body.data;
    assert.equal(profile.work.employmentStatus, 'Experienced', 'same stored field as profile #29');
    assert.equal(profile.work.organization, 'Deloitte', 'same field as profile #30');

    const fresher = await call('PUT', `/leads/${leadId}/discussion`, { token: s3.token, body: { employmentStatus: 'Fresher' } });
    const data = fresher.body.data.data;
    assert.equal(data.currentCompany, undefined);
    assert.equal(data.currentSalary, undefined);
    assert.equal(data.experienceRelevant, undefined);
    const history = (await call('GET', `/leads/${leadId}/history`, { token: adminSession.token })).body.data;
    const company = history.find((h) => h.field === 'currentCompany' && h.oldValue === 'Deloitte');
    assert.ok(company, 'history keeps the old value');
    assert.equal(company.newValue, null);
  });

  test('Validation: earning members ≤ family size; expert one-on-one creates a follow-up', async () => {
    const leadId = (await call('GET', '/leads?page_size=1', { token: s3.token })).body.data[0]._id;
    const bad = await call('PUT', `/leads/${leadId}/discussion`, { token: s3.token, body: { familySize: 3, earningMembers: 5 } });
    assert.equal(bad.status, 400);
    await call('PUT', `/leads/${leadId}/discussion`, { token: s3.token, body: { expertDiscussion: 'Yes' } });
    const tasks = (await call('GET', `/leads/${leadId}/tasks`, { token: s3.token })).body.data;
    assert.ok(tasks.some((t) => t.type === 'expert_one_on_one' && t.status === 'open'));
  });
});

// ---------------------------------------------------------- §8 SMS / email

describe('GL-21..25 SMS and email', () => {
  test('SMS templates need a DLT Template ID and Sender ID; unknown placeholders are refused', async () => {
    const res = await call('POST', '/messaging/templates', { token: adminSession.token, body: { name: `T ${RUN}`, channel: 'sms', body: 'Hi {first_name} {bogus}' } });
    assert.equal(res.status, 400);
    assert.ok(res.body.errors.dltTemplateId && res.body.errors.senderId && res.body.errors.body);
  });

  test('Per-lead SMS uses a DLT template and shows Delivered on the timeline', async () => {
    const lead = (await call('GET', '/leads?page_size=1', { token: s3.token })).body.data[0];
    const templates = (await call('GET', '/messaging/templates?channel=sms&active=true', { token: s3.token })).body.data;
    const welcome = templates.find((t) => t.name === 'Welcome SMS');
    assert.ok(welcome.dltTemplateId);
    const preview = (await call('POST', `/leads/${lead._id}/messages/preview`, { token: s3.token, body: { template: welcome._id } })).body.data;
    assert.match(preview.body, new RegExp(lead.firstName));
    const sent = await call('POST', `/leads/${lead._id}/messages`, { token: s3.token, body: { template: welcome._id } });
    assert.equal(sent.status, 201, JSON.stringify(sent.body));
    const tl = (await call('GET', `/leads/${lead._id}/timeline?type=communication`, { token: s3.token })).body.data;
    assert.ok(tl.some((t) => /SMS delivered: Welcome SMS/.test(t.title)));
    // provider delivery report updates the same entry
    const other = (await call('GET', '/leads?page_size=1', { token: s1.token })).body.data[0];
    assert.equal((await call('POST', `/leads/${other._id}/messages`, { token: s3.token, body: { template: welcome._id } })).status, 404, 'own leads only');
  });

  test('Bulk email to 500 leads shows a campaign report with exclusions', async () => {
    const templates = (await call('GET', '/messaging/templates?channel=email', { token: adminSession.token })).body.data;
    const email = templates.find((t) => t.name === 'Program details');
    const audience = { selectAll: true, filters: { upload_file: bulkFile } };
    const preview = await call('POST', '/messaging/campaigns', { token: adminSession.token, body: { channel: 'email', template: email._id, audience, preview: true } });
    assert.equal(preview.status, 200, JSON.stringify(preview.body));
    assert.equal(preview.body.data.selected, 930);
    assert.equal(preview.body.data.excluded.invalid, 430, 'no email');
    assert.equal(preview.body.data.final, 500);
    const sent = await call('POST', '/messaging/campaigns', { token: adminSession.token, body: { channel: 'email', template: email._id, audience } });
    assert.equal(sent.status, 201, JSON.stringify(sent.body));
    let report;
    for (let i = 0; i < 60; i += 1) {
      report = (await call('GET', `/messaging/campaigns/${sent.body.data.campaign._id}`, { token: adminSession.token })).body.data;
      if (report.status === 'done') break;
      await new Promise((r) => setTimeout(r, 1000));
    }
    assert.equal(report.status, 'done');
    assert.equal(report.report.sent + report.report.delivered, 500);
    assert.equal((await call('POST', '/messaging/campaigns', { token: s1.token, body: {} })).status, 403, 'counsellors cannot bulk send');
  });

  test('STOP reply opts the lead out of SMS; bulk sends exclude it', async () => {
    const lead = (await call('GET', `/leads?upload_file=${bulkFile}&page_size=1`, { token: adminSession.token })).body.data[0];
    const res = await call('POST', '/webhooks/messaging/inbound-sms', { headers: { 'x-webhook-secret': process.env.CAPTURE_API_KEY ?? '' }, body: { from: `+91${lead.mobile}`, text: 'STOP' } });
    if (res.status === 401) return; // webhook secret not configured
    const after = (await call('GET', `/leads/${lead._id}`, { token: adminSession.token })).body.data;
    assert.equal(after.optedOut.sms, true);
  });

  test('Bulk sends outside 9 am – 9 pm are blocked', async () => {
    const templates = (await call('GET', '/messaging/templates?channel=sms', { token: adminSession.token })).body.data;
    const night = new Date();
    night.setUTCHours(17, 30, 0, 0); // 23:00 IST
    if (night < new Date()) night.setUTCDate(night.getUTCDate() + 1);
    const res = await call('POST', '/messaging/campaigns', { token: adminSession.token, body: {
      channel: 'sms', template: templates[0]._id, audience: { selectAll: true, filters: { upload_file: bulkFile } }, scheduledAt: night.toISOString(), preview: true,
    } });
    const window = process.env.BULK_SEND_WINDOW ?? '09:00-21:00';
    if (window === '09:00-21:00') assert.equal(res.status, 422);
  });
});

// ------------------------------------------------------- §10 notifications

describe('GL-30 / GL-36 follow-ups and notifications', () => {
  test('Follow-up reminder appears 15 minutes before due; overdue alert reaches Admin after 2 hours', async () => {
    const lead = (await call('GET', '/leads?page_size=1', { token: s3.token })).body.data[0];
    const due = new Date(Date.now() + 14 * 60_000).toISOString();
    const task = await call('POST', `/leads/${lead._id}/tasks`, { token: s3.token, body: { type: 'follow_up_call', dueAt: due } });
    assert.equal(task.status, 201, JSON.stringify(task.body));
    await call('POST', '/system/tick', { token: sa.token, body: {} });
    const mine = (await inbox(s3.token, 'task_due'));
    assert.ok(mine.some((n) => n.type === 'task_due' && n.data?.taskId === task.body.data._id), 'reminder');

    const later = new Date(Date.now() + (14 + 125) * 60_000).toISOString();
    await call('POST', '/system/tick', { token: sa.token, body: { at: later } });
    const adminAlerts = (await inbox(adminSession.token, 'task_overdue'));
    assert.ok(adminAlerts.some((n) => n.type === 'task_overdue' && n.data?.taskId === task.body.data._id), 'admin escalation');
  });

  test('Follow-up types are the six of GL-36 and dates must be in the future', async () => {
    const lead = (await call('GET', '/leads?page_size=1', { token: s3.token })).body.data[0];
    const old = await call('POST', `/leads/${lead._id}/tasks`, { token: s3.token, body: { type: 'parent_call', dueAt: new Date(Date.now() + 3600_000).toISOString() } });
    assert.equal(old.status, 400);
    const past = await call('POST', `/leads/${lead._id}/tasks`, { token: s3.token, body: { type: 'call_back', dueAt: new Date(Date.now() - 3600_000).toISOString() } });
    assert.equal(past.status, 400);
  });

  test('My Day returns the four counters', async () => {
    const day = (await call('GET', '/leads/my-day', { token: s3.token })).body.data;
    for (const key of ['newUntouched', 'followUpsToday', 'overdue', 'interestedNoActivity']) assert.equal(typeof day[key], 'number');
  });
});

// ------------------------------------------------------ §11 list / export

describe('GL-32..38 list, filters, notes, export', () => {
  test('Smart filters, advanced filters and saved filters', async () => {
    const meta = (await call('GET', '/leads/filter-fields', { token: adminSession.token })).body.data;
    assert.ok(meta.fields.some((f) => f.key === 'cf.employmentStatus'));
    assert.ok(meta.fields.some((f) => f.key === 'pf.gender'));
    const unassigned = (await call('GET', '/leads?smart=unassigned&page_size=5', { token: adminSession.token })).body.data;
    assert.ok(unassigned.every((l) => !l.owner));
    const filters = JSON.stringify([{ field: 'uploadFile', op: 'is', value: bulkFile }, { field: 'city', op: 'contains', value: 'pun' }]);
    const res = await call('GET', `/leads?filters=${encodeURIComponent(filters)}`, { token: adminSession.token });
    assert.equal(res.status, 200);
    assert.ok(res.body.pagination.total_results > 0);
    const saved = await call('POST', '/leads/saved-filters', { token: s1.token, body: { name: `Mine ${RUN}`, params: { smart: 'untouched' } } });
    assert.equal(saved.status, 201);
    assert.ok((await call('GET', '/leads/saved-filters', { token: s1.token })).body.data.some((f) => f.name === `Mine ${RUN}`));
  });

  test('Notes: 2,000 characters max; author can edit within 15 minutes; others cannot', async () => {
    const lead = (await call('GET', '/leads?page_size=1', { token: s3.token })).body.data[0];
    const tooLong = await call('POST', `/leads/${lead._id}/notes`, { token: s3.token, body: { body: 'x'.repeat(2001) } });
    assert.equal(tooLong.status, 400);
    const note = (await call('POST', `/leads/${lead._id}/notes`, { token: s3.token, body: { body: 'First call done' } })).body.data;
    assert.equal(note.editable, true);
    const edited = await call('PUT', `/leads/${lead._id}/notes/${note._id}`, { token: s3.token, body: { body: 'First call done — parents keen' } });
    assert.equal(edited.status, 200);
    const other = await call('PUT', `/leads/${lead._id}/notes/${note._id}`, { token: sa.token, body: { body: 'hijack' } });
    assert.equal(other.status, 403);
  });

  test('Export by Admin includes profile and custom fields; it is logged (activity log + Super Admin timeline)', async () => {
    const res = await fetch(`${BASE}/leads/export?format=csv&columns=leadNo,firstName,profileCompletion,pf.gender,cf.employmentStatus,cf.currentCompany&upload_file=${bulkFile}`, {
      headers: { Authorization: `Bearer ${adminSession.token}` },
    });
    assert.equal(res.status, 200);
    const text = await res.text();
    const header = text.split('\n')[0];
    assert.match(header, /Profile: Gender/);
    assert.match(header, /CF 4: Fresher or Working/);
    assert.equal(text.trim().split('\n').length, 931);
    const logs = (await call('GET', '/audit-logs?action=export', { token: sa.token })).body.data;
    assert.ok(logs[0].after.rowCount === 930);
    const lead = (await call('GET', `/leads?upload_file=${bulkFile}&page_size=1`, { token: sa.token })).body.data[0];
    const saTl = (await call('GET', `/leads/${lead._id}/timeline?type=export`, { token: sa.token })).body.data;
    assert.ok(saTl.length > 0, 'Super Admin sees the export entry');
    const adminTl = (await call('GET', `/leads/${lead._id}/timeline?type=export`, { token: adminSession.token })).body.data;
    assert.equal(adminTl.length, 0, 'hidden from Admin');
  });
});

// ------------------------------------------------------ §9 activity log

describe('GL-26..28 history and activity log', () => {
  test('Every action above appears in the Super Admin activity log; Admin sees counsellors\' activity; exportable', async () => {
    const logs = (await call('GET', '/audit-logs?page_size=100', { token: sa.token })).body.data;
    const actions = new Set(logs.map((l) => l.action));
    for (const a of ['login', 'create', 'bulk_assign', 'import', 'export', 'bulk_send', 'disposition']) {
      assert.ok(actions.has(a), `activity log has ${a}`);
    }
    const adminView = (await call('GET', '/audit-logs?page_size=100', { token: adminSession.token })).body.data;
    assert.ok(adminView.every((l) => l.actor?._id !== sa.user._id), 'Admin does not see Super Admin activity');
    const csv = await fetch(`${BASE}/audit-logs/export`, { headers: { Authorization: `Bearer ${sa.token}` } });
    assert.equal(csv.status, 200);
    assert.match((await csv.text()).split('\n')[0], /Time \(IST\),User,Action/);
  });

  test('History tab lists field changes with old value, new value, user, time', async () => {
    const lead = (await call('GET', '/leads?page_size=1', { token: s2.token })).body.data[0];
    await call('PUT', `/leads/${lead._id}`, { token: s2.token, body: { city: 'Thane' } });
    const history = (await call('GET', `/leads/${lead._id}/history`, { token: adminSession.token })).body.data;
    const city = history.find((h) => h.field === 'city');
    assert.equal(city.newValue, 'Thane');
    assert.equal(city.changedBy.name, s2.user.name);
  });

  test('Logout drops a counsellor out of rotation', async () => {
    await logout(s3);
    await logout(s2);
    const res = await postMeta(metaEvent(`last${RUN}`, { full_name: 'Last Lead', phone_number: mobile(9, 99) }));
    assert.equal(res.body.data.created, 1);
    const lead = (await call('GET', `/leads?search=${mobile(9, 99)}`, { token: sa.token })).body.data[0];
    assert.equal(lead.owner._id, c1._id, 'only the logged-in counsellor receives it');
    await logout(s1);
  });
});
