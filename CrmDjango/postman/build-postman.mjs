// Generates the Postman v2.1 collection for the Django CRM API (Go-Live Minimum Scope rules).
//   node build-postman.mjs            → writes CrmDjango/postman/CRM_Django_API.postman_collection.json
// Run it with newman from CrmDjango/postman (the upload requests read files from that folder):
//   npx newman run CRM_Django_API.postman_collection.json
import { writeFileSync } from 'fs';

const OUT = process.env.POSTMAN_OUT ?? new URL('./CRM_Django_API.postman_collection.json', import.meta.url);

/* ------------------------------------------------------------ helpers */
const status = (code) => `pm.test("Status is ${code}", () => pm.response.to.have.status(${code}));`;
const envelope = `pm.test("Envelope has success/message/status", () => { const b = pm.response.json(); pm.expect(b).to.have.property("success"); pm.expect(b).to.have.property("message"); });`;
const save = (name, expr) => `pm.collectionVariables.set("${name}", ${expr});`;
const get = (name) => `pm.collectionVariables.get("${name}")`;
const json = 'const res = pm.response.json();';
const t = (title, body) => `pm.test(${JSON.stringify(title)}, () => { ${body} });`;
const hasError = (field) => t(`field error: ${field}`, `pm.expect(pm.response.json().errors).to.have.property(${JSON.stringify(field)});`);

function req(name, method, path, opts = {}) {
  const { body, auth, tests = [], pre = [], headers = [], description, formdata, root } = opts;
  const item = {
    name,
    request: {
      method,
      header: [...headers],
      url: `${root ? '{{rootUrl}}' : '{{baseUrl}}'}${path}`,
      ...(description ? { description } : {}),
    },
    event: [],
  };
  if (auth === 'none') item.request.auth = { type: 'noauth' };
  if (auth && auth !== 'none') item.request.auth = { type: 'bearer', bearer: [{ key: 'token', value: auth, type: 'string' }] };
  if (body !== undefined) {
    item.request.header.push({ key: 'Content-Type', value: 'application/json' });
    item.request.body = { mode: 'raw', raw: JSON.stringify(body, null, 2), options: { raw: { language: 'json' } } };
  }
  if (formdata) item.request.body = { mode: 'formdata', formdata };
  if (pre.length) item.event.push({ listen: 'prerequest', script: { type: 'text/javascript', exec: pre } });
  item.event.push({ listen: 'test', script: { type: 'text/javascript', exec: tests.length ? tests : [status(200)] } });
  return item;
}

const folder = (name, description, item) => ({ name, description, item });
const apiKey = [{ key: 'x-api-key', value: '{{captureApiKey}}' }];
const webhookSecret = [{ key: 'x-webhook-secret', value: '{{captureApiKey}}' }];
const fileField = (src, description) => ({ key: 'file', type: 'file', src, ...(description ? { description } : {}) });
const text = (key, value) => ({ key, type: 'text', value });
const COUNSELLOR = '{{counsellorToken}}';

/** A Meta leadgen webhook body (sandbox: answers are read from field_data, no Graph token). */
const metaEvent = (leadgenId, answers, extra = {}) => ({
  object: 'page',
  entry: [{
    id: 'page1', time: 1759650000,
    changes: [{
      field: 'leadgen',
      value: {
        leadgen_id: leadgenId, page_id: 'page1', form_id: 'pmform{{run}}', ad_id: 'ad1',
        campaign_id: 'c1', campaign_name: 'Postman Campaign', adset_id: 's1', adset_name: 'Postman Ad Set',
        ad_name: 'Postman Ad', form_name: 'Postman Form {{run}}',
        field_data: Object.entries(answers).map(([n, value]) => ({ name: n, values: [value] })),
        ...extra,
      },
    }],
  }],
});

/* --------------------------------------------------------- 00 health */
const health = folder('00 Health', 'Liveness check (outside /api/v1).', [
  req('Health', 'GET', '/health', { root: true, auth: 'none', tests: [status(200), t('uptime present', 'pm.expect(pm.response.json().data.uptime).to.be.a("number");')] }),
]);

/* ----------------------------------------------------------- 01 auth */
const auth = folder('01 Auth', 'Login stores the access token in {{accessToken}} (used by every other request) and the refresh token in the crm_rt cookie. The pre-request script of "Login (admin)" also creates the per-run ids: {{run}} (7 digits), {{runTag}} (the same digits spelled with letters, because person names allow letters only) and unique Indian mobiles (10 digits, starting 6-9).', [
  req('Login (admin)', 'POST', '/auth/login', {
    auth: 'none',
    body: { email: '{{adminEmail}}', password: '{{adminPassword}}' },
    pre: [
      '// Unique suffix for every run so created records never clash',
      'const run = Date.now().toString().slice(-7);',
      save('run', 'run'),
      '// names allow letters only (go-live), so the run id is spelled with letters: 0→a … 9→j',
      save('runTag', 'run.split("").map(d => "abcdefghij"[Number(d)]).join("")'),
      save('leadMobile', '"91" + run + "1"'),
      save('profileMobile', '"93" + run + "2"'),
      save('captureMobile', '"94" + run + "3"'),
      save('metaMobile', '"95" + run + "4"'),
      save('googleMobile', '"96" + run + "5"'),
      save('lead2Mobile', '"97" + run + "6"'),
      save('lead3Mobile', '"98" + run + "7"'),
      save('freeMobile', '"99" + run + "8"'),
      save('errMobile', '"89" + run + "9"'),
    ],
    tests: [status(200), json, save('accessToken', 'res.data.access_token'), save('adminId', 'res.data.user._id'),
      t('Super Admin', 'pm.expect(res.data.user.role).to.eql("super_admin");'),
      t('Refresh cookie set', 'pm.expect(pm.response.headers.get("Set-Cookie") || "").to.include("crm_rt=");')],
  }),
  req('Login - wrong password (401)', 'POST', '/auth/login', { auth: 'none', body: { email: '{{adminEmail}}', password: 'wrong-password' }, tests: [status(401), envelope] }),
  req('Login - invalid payload (400)', 'POST', '/auth/login', { auth: 'none', body: { email: 'not-an-email', password: '' }, tests: [status(400), hasError('email')] }),
  req('Me', 'GET', '/auth/me', { tests: [status(200), t('permissions array', 'pm.expect(pm.response.json().data.user.permissions).to.be.an("array");')] }),
  req('Refresh access token (cookie)', 'POST', '/auth/refresh', {
    auth: 'none',
    description: 'Uses the crm_rt cookie Postman stored at login. The cookie rotates on every call; reusing an old one revokes the session. You can also send {"refresh_token": "..."} in the body.',
    tests: [status(200), json, save('accessToken', 'res.data.access_token')],
  }),
  req('Forgot password', 'POST', '/auth/forgot-password', { auth: 'none', body: { email: '{{adminEmail}}' }, description: 'Always 200 (no user enumeration). Without SMTP the reset link is printed in the Django console (or written to MAIL_OUTBOX_DIR).' }),
  req('Reset password - invalid token (400)', 'POST', '/auth/reset-password', { auth: 'none', body: { token: 'not-a-real-token', password: 'Welcome@123' }, tests: [status(400)] }),
  req('Change password - wrong current (400)', 'POST', '/auth/change-password', { body: { currentPassword: 'not-my-password', newPassword: 'Changed@123' }, tests: [status(400), hasError('currentPassword')], description: 'A correct currentPassword changes it and signs out every other session.' }),
  req('Login (counsellor)', 'POST', '/auth/login', {
    auth: 'none', body: { email: '{{counsellorEmail}}', password: 'Welcome@123' },
    description: 'Seeded Admission Counsellor (role counsellor, own data scope). Its token {{counsellorToken}} is used by the counsellor-only checks below.',
    tests: [status(200), json, save('counsellorToken', 'res.data.access_token'), save('counsellorId', 'res.data.user._id'),
      t('role counsellor', 'pm.expect(res.data.user.role).to.eql("counsellor");')],
  }),
]);

/* -------------------------------------------------------- 02 masters */
const masterTypes = ['sources', 'programs', 'cohorts', 'stages', 'dispositions', 'tags', 'custom-fields'];
const masters = folder('02 Masters', 'Dropdown data. Every type supports list/create/get/update/deactivate at /masters/:type. Delete deactivates (cohorts are closed).', [
  req('Bootstrap (all active masters)', 'GET', '/masters/bootstrap', {
    tests: [status(200), json, 'const d = res.data;',
      save('sourceId', 'd.sources[0]._id'),
      save('sourceWalkinId', '(d.sources.find(s => s.name === "Walk-in") || d.sources[0])._id'),
      save('programId', 'd.programs[0]._id'),
      save('tagId', 'd.tags[0]._id'),
      'const prospects = d.stages.find(s => s.name === "Prospects");',
      save('stageProspectsId', 'prospects._id'),
      save('subStageHotId', 'prospects.subStages.find(s => s.name === "Hot")._id'),
      'const enrolled = d.stages.find(s => s.name === "Enrolled");',
      save('stageEnrolledId', 'enrolled._id'),
      save('subStageEnrolledId', 'enrolled.subStages[0]._id'),
      save('stageUntouchedId', 'd.stages.find(s => s.name === "Untouched")._id'),
      t('go-live stages present', 'const names = d.stages.map(s => s.name); ["Untouched", "Interested", "Re-enquired", "Application Submitted", "Closed - Lost", "Enrolled"].forEach(n => pm.expect(names).to.include(n));'),
    ],
  }),
  ...masterTypes.map((ty) => req(`List ${ty}`, 'GET', `/masters/${ty}?page=1&page_size=25&search=&is_active=true&sort_order=asc`)),
  req('Get stage (Prospects, with sub-stages)', 'GET', '/masters/stages/{{stageProspectsId}}', { tests: [status(200), t('has sub-stages + counsellor action', 'pm.expect(pm.response.json().data.subStages[0]).to.have.property("counsellorAction");')] }),
  req('Create tag', 'POST', '/masters/tags', { body: { name: 'PM Tag {{run}}', color: '#123456' }, tests: [status(201), json, save('newTagId', 'res.data._id')] }),
  req('Create tag - duplicate (409)', 'POST', '/masters/tags', { body: { name: 'PM Tag {{run}}' }, tests: [status(409)] }),
  req('Get tag', 'GET', '/masters/tags/{{newTagId}}'),
  req('Update tag', 'PUT', '/masters/tags/{{newTagId}}', { body: { color: '#ef4444', sortOrder: 99 } }),
  req('Deactivate tag', 'DELETE', '/masters/tags/{{newTagId}}', { tests: [status(200), t('inactive', 'pm.expect(pm.response.json().data.isActive).to.eql(false);')] }),
  req('Create cohort', 'POST', '/masters/cohorts', { body: { name: 'PM Cohort {{run}}', program: '{{programId}}', startDate: '2027-10-04', capacity: 50, status: 'planned' }, tests: [status(201), json, save('cohortId', 'res.data._id')] }),
  req('Close cohort', 'DELETE', '/masters/cohorts/{{cohortId}}', { tests: [status(200), t('closed', 'pm.expect(pm.response.json().data.status).to.eql("closed");')] }),
  req('Create custom field', 'POST', '/masters/custom-fields', { body: { key: 'pm{{run}}', label: 'Work experience (years)', type: 'number' }, tests: [status(201), json, save('customFieldId', 'res.data._id'), save('customFieldKey', 'res.data.key')] }),
  req('Create source', 'POST', '/masters/sources', { body: { name: 'PM Source {{run}}', channel: 'event', description: 'Created from Postman' }, tests: [status(201), json, save('newSourceId', 'res.data._id')] }),
  req('Deactivate source', 'DELETE', '/masters/sources/{{newSourceId}}'),
]);

/* --------------------------------------------------------- 03 users */
const users = folder('03 Users & Access', 'Users (go-live: name letters only, designation required, role admin | counsellor; without a password a 12-character temporary password is emailed and must be changed at first login), the per-user permission builder and permission templates.', [
  req('User options (any signed-in user)', 'GET', '/users/options', {
    tests: [status(200), json,
      save('saraId', 'res.data.find(u => u.email === "sara.c@gccschool.com")._id'),
      t('counsellor listed', `pm.expect(res.data.some(u => u._id === ${get('counsellorId')})).to.eql(true);`)],
  }),
  req('List users', 'GET', '/users?page=1&page_size=25&search=&sort_by=name&sort_order=asc&is_active=true'),
  req('List counsellors (role filter)', 'GET', '/users?role=counsellor&page_size=100', {
    tests: [status(200), t('only counsellors', 'pm.response.json().data.forEach(u => pm.expect(u.role).to.eql("counsellor"));')],
  }),
  req('Create user (counsellor)', 'POST', '/users', {
    body: {
      name: 'Postman User {{runTag}}', email: 'postman{{run}}@gccschool.com', password: 'Welcome@123',
      designation: 'Admission Counsellor', role: 'counsellor', receivesLeads: false,
    },
    description: 'name: letters and spaces only. role: admin | counsellor (an Admin can only create counsellors). Leave password out to email a temporary one.',
    tests: [status(201), json, save('userId', 'res.data._id'),
      t('role counsellor', 'pm.expect(res.data.role).to.eql("counsellor");'),
      t('no password hash', 'pm.expect(res.data).to.not.have.property("passwordHash");')],
  }),
  req('Create user - invalid name / designation (400)', 'POST', '/users', {
    body: { name: 'R2D2', email: 'bad{{run}}@gccschool.com', designation: '', role: 'counsellor' },
    tests: [status(400), hasError('name'), hasError('designation')],
  }),
  req('Create user - duplicate email (409)', 'POST', '/users', { body: { name: 'Dup', email: '{{adminEmail}}', designation: 'Counsellor', role: 'counsellor', password: 'Welcome@123' }, tests: [status(409)] }),
  req('Create user - weak password (400)', 'POST', '/users', { body: { name: 'Weak', email: 'weak{{run}}@x.com', designation: 'Counsellor', role: 'counsellor', password: 'short' }, tests: [status(400), hasError('password')] }),
  req('Get user', 'GET', '/users/{{userId}}'),
  req('Update user', 'PUT', '/users/{{userId}}', {
    body: { designation: 'Senior Counsellor', mobile: '9811122233' },
    tests: [status(200), t('designation saved', 'pm.expect(pm.response.json().data.designation).to.eql("Senior Counsellor");')],
  }),
  req('Update user - email is not editable (400)', 'PUT', '/users/{{userId}}', { body: { email: 'changed{{run}}@gccschool.com' }, tests: [status(400)] }),
  req('Set permissions', 'POST', '/users/{{userId}}/permissions', {
    body: { permissions: [{ module: 'leads', actions: ['view', 'export'] }], dataScope: 'team', fieldRules: [{ field: 'mobile', mode: 'masked' }], templateKey: null },
  }),
  req('List permission templates', 'GET', '/permission-templates', { tests: [status(200), json, save('systemTemplateId', 'res.data.find(x => x.isSystem)._id')] }),
  req('Create permission template', 'POST', '/permission-templates', {
    body: { key: 'postman-{{run}}', name: 'Postman Template', description: 'Created from Postman', permissions: [{ module: 'leads', actions: ['view'] }], dataScope: 'own', fieldRules: [] },
    tests: [status(201), json, save('templateId', 'res.data._id')],
  }),
  req('Update permission template', 'PUT', '/permission-templates/{{templateId}}', { body: { name: 'Postman Template (edited)' } }),
  req('Delete system template (422)', 'DELETE', '/permission-templates/{{systemTemplateId}}', { tests: [status(422)] }),
  req('Delete permission template', 'DELETE', '/permission-templates/{{templateId}}'),
]);

const goLiveUsers = folder('03b Go-live Users', 'GL-02: resend login credentials (a new 48-hour temporary password is emailed; the old one stops working), deactivate (logs the user out at once and takes them out of round-robin) and reactivate.', [
  req('Resend credentials', 'POST', '/users/{{userId}}/resend-credentials', {
    tests: [status(200), t('emailed', 'pm.expect(pm.response.json().message).to.include("postman");'),
      t('password change forced', 'pm.expect(pm.response.json().data.mustChangePassword).to.eql(true);')],
  }),
  req('Resend credentials - counsellor (403)', 'POST', '/users/{{userId}}/resend-credentials', { auth: COUNSELLOR, tests: [status(403)] }),
  req('Deactivate user', 'DELETE', '/users/{{userId}}', { tests: [status(200), t('inactive', 'pm.expect(pm.response.json().data.isActive).to.eql(false);')] }),
  req('Reactivate user', 'POST', '/users/{{userId}}/reactivate', { tests: [status(200), t('active again', 'pm.expect(pm.response.json().data.isActive).to.eql(true);')] }),
  req('Cannot deactivate yourself (400)', 'PUT', '/users/{{adminId}}', { body: { isActive: false }, tests: [status(400)] }),
]);

/* --------------------------------------------------------- 04 teams */
const teams = folder('04 Teams', 'Departments → teams → counsellor groups. Team data scope follows this hierarchy.', [
  req('Team options', 'GET', '/teams/options'),
  req('Team tree', 'GET', '/teams/tree?include_inactive=false'),
  req('Create department', 'POST', '/teams', { body: { name: 'PM Dept {{run}}', code: 'PMD{{run}}', type: 'department', location: 'Pune' }, tests: [status(201), json, save('deptId', 'res.data._id')] }),
  req('Create team under department', 'POST', '/teams', {
    body: { name: 'PM Team {{run}}', code: 'PMT{{run}}', type: 'team', parent: '{{deptId}}', manager: '{{adminId}}', location: 'Pune', programs: ['{{programId}}'], receivesLeads: true, description: 'Created from Postman' },
    tests: [status(201), json, save('teamId', 'res.data._id')],
  }),
  req('Create team - duplicate name (409)', 'POST', '/teams', { body: { name: 'pm team {{run}}' }, tests: [status(409)] }),
  req('Update - parent cycle (422)', 'PUT', '/teams/{{deptId}}', { body: { parent: '{{teamId}}' }, tests: [status(422)] }),
  req('List teams', 'GET', '/teams?page=1&page_size=25&search=PM&type=&is_active=true&sort_by=name&sort_order=asc'),
  req('Get team (members, sub-teams, breadcrumb)', 'GET', '/teams/{{teamId}}'),
  req('Update team', 'PUT', '/teams/{{teamId}}', { body: { location: 'Mumbai', receivesLeads: false } }),
  req('Add members', 'POST', '/teams/{{teamId}}/members', { body: { userIds: ['{{userId}}'], setReportingManager: true }, tests: [status(200), t('one added', 'pm.expect(pm.response.json().data.added).to.eql(1);')] }),
  req('Team stats (rolled up)', 'GET', '/teams/{{deptId}}/stats?include_sub_teams=true'),
  req('Deactivate team with members (422)', 'DELETE', '/teams/{{teamId}}', { tests: [status(422)] }),
  req('Remove member', 'DELETE', '/teams/{{teamId}}/members/{{userId}}'),
  req('Deactivate team', 'DELETE', '/teams/{{teamId}}'),
  req('Deactivate department', 'DELETE', '/teams/{{deptId}}'),
]);

/* --------------------------------------------------------- 05 leads */
const inHoursPre = (name, hours) => `pm.collectionVariables.set("${name}", new Date(Date.now() + ${hours} * 3600 * 1000).toISOString());`;
const leads = folder('05 Leads', 'Quick Add (GL-10: source required, letters-only names, Indian 10-digit mobile starting 6-9, live duplicate check), lead numbers GCC-L-0000123, stage moves (open stages need a future followUpAt), assignment with a reason (only role-counsellor users can own leads), notes, timeline, export and bulk upload. Results respect the caller\'s data scope and field masking.', [
  req('List leads (filters)', 'GET', '/leads?page=1&page_size=25&search=&sort_by=createdAt&sort_order=desc&status=active&unassigned=&created_from=&created_to='),
  req('Check duplicate - new mobile', 'GET', '/leads/check-duplicate?mobile={{leadMobile}}', {
    description: 'Quick Add calls this as the mobile is typed. Also accepts email= and exclude=<leadId>.',
    tests: [status(200), t('no duplicate', 'pm.expect(pm.response.json().data.exists).to.eql(false);')],
  }),
  req('Create lead (Quick Add)', 'POST', '/leads', {
    body: {
      firstName: 'Postman', lastName: 'Lead {{runTag}}', mobile: '{{leadMobile}}', email: 'lead{{run}}@example.com',
      city: 'Pune', state: 'Maharashtra', source: '{{sourceId}}', programInterest: '{{programId}}', note: 'Created from Postman',
      tags: ['{{tagId}}'], utm: { source: 'postman', medium: 'api', campaign: 'smoke' },
      customFields: { 'pm{{run}}': 3 },
    },
    description: 'Required: firstName (letters, spaces, "."), mobile (Indian, 10 digits, 6-9), source (Source id from /masters/bootstrap). A counsellor\'s Quick Add is assigned to them; an Admin\'s stays unassigned unless owner/autoAssign is given.',
    tests: [status(201), json, save('leadId', 'res.data._id'), save('leadNo', 'res.data.leadNo'),
      t('starts in Untouched', 'pm.expect(res.data.stage.name).to.eql("Untouched");'),
      t('GCC-L lead number', 'pm.expect(res.data.leadNo).to.match(/^GCC-L-\\d{7}$/);'),
      t('admin Quick Add is unassigned', 'pm.expect(res.data.owner).to.eql(undefined);')],
  }),
  req('Create lead - duplicate mobile (409)', 'POST', '/leads', { body: { firstName: 'Dup', mobile: '+91 {{leadMobile}}', source: '{{sourceWalkinId}}' }, tests: [status(409), hasError('mobile')] }),
  req('Create lead - invalid (400)', 'POST', '/leads', {
    body: { firstName: 'R2', mobile: '12345' },
    tests: [status(400), hasError('firstName'), hasError('mobile'), hasError('source')],
  }),
  req('Check duplicate - existing mobile', 'GET', '/leads/check-duplicate?mobile={{leadMobile}}', {
    tests: [status(200), json, t('exists with lead number', `pm.expect(res.data.exists).to.eql(true); pm.expect(res.data.message).to.include(${get('leadNo')});`)],
  }),
  req('Get lead', 'GET', '/leads/{{leadId}}'),
  req('Get lead - malformed id (400)', 'GET', '/leads/not-an-id', { tests: [status(400)] }),
  req('Update lead', 'PUT', '/leads/{{leadId}}', { body: { city: 'Mumbai', lastDisposition: 'Call Back Later' }, tests: [status(200), t('city saved', 'pm.expect(pm.response.json().data.city).to.eql("Mumbai");')] }),
  req('Change stage - missing sub-stage (400)', 'PUT', '/leads/{{leadId}}', { body: { stage: '{{stageProspectsId}}' }, tests: [status(400), hasError('subStage')] }),
  req('Change stage - open stage without follow-up (400)', 'PUT', '/leads/{{leadId}}', { body: { stage: '{{stageProspectsId}}', subStage: '{{subStageHotId}}' }, tests: [status(400), hasError('followUpAt')] }),
  req('Change stage to Enrolled (status → converted)', 'PUT', '/leads/{{leadId}}', {
    body: { stage: '{{stageEnrolledId}}', subStage: '{{subStageEnrolledId}}' },
    tests: [status(200), t('status converted', 'pm.expect(pm.response.json().data.status).to.eql("converted");')],
  }),
  req('Change stage + sub-stage + follow-up', 'PUT', '/leads/{{leadId}}', {
    pre: [inHoursPre('followUpAt', 2)],
    body: { stage: '{{stageProspectsId}}', subStage: '{{subStageHotId}}', followUpAt: '{{followUpAt}}', followUpType: 'follow_up_call' },
    description: 'Open stages need a future followUpAt (and optional followUpType); the follow-up is created with the stage move.',
    tests: [status(200), t('sub-stage saved', `pm.expect(pm.response.json().data.subStage).to.eql(${get('subStageHotId')});`)],
  }),
  req('Assign lead - no reason (400)', 'POST', '/leads/{{leadId}}/assign', { body: { owner: '{{saraId}}' }, tests: [status(400), hasError('reason')] }),
  req('Assign lead - not a counsellor (400)', 'POST', '/leads/{{leadId}}/assign', { body: { owner: '{{adminId}}', reason: 'Other' }, tests: [status(400), hasError('owner')] }),
  req('Assign lead (to Sara)', 'POST', '/leads/{{leadId}}/assign', {
    body: { owner: '{{saraId}}', reason: 'New allocation' },
    description: 'reason: New allocation | Workload | Leave | Language | Performance | Other. Only active role-counsellor users can own leads.',
    tests: [status(200), t('owner set', `pm.expect(pm.response.json().data.owner._id).to.eql(${get('saraId')});`)],
  }),
  req('Reassign lead (to counsellor)', 'POST', '/leads/{{leadId}}/assign', {
    body: { owner: '{{counsellorId}}', reason: 'Workload' },
    description: 'The previous owner gets a lead_reassigned notification; open follow-ups move to the new owner.',
    tests: [status(200), t('owner set', `pm.expect(pm.response.json().data.owner._id).to.eql(${get('counsellorId')});`)],
  }),
  req('Add note', 'POST', '/leads/{{leadId}}/notes', { body: { body: 'Discussed GMBA fees from Postman', category: 'Counselling' }, tests: [status(201), json, save('noteId', 'res.data._id'), t('editable by author', 'pm.expect(res.data.editable).to.eql(true);')] }),
  req('Add note - over 2,000 characters (400)', 'POST', '/leads/{{leadId}}/notes', { body: { body: 'x'.repeat(2001) }, tests: [status(400), hasError('body')] }),
  req('Edit note (author, within 15 min)', 'PUT', '/leads/{{leadId}}/notes/{{noteId}}', { body: { body: 'Discussed GMBA fees from Postman (edited)' }, tests: [status(200), t('edited', 'pm.expect(pm.response.json().data.body).to.include("(edited)");')] }),
  req('Edit note - not the author (403)', 'PUT', '/leads/{{leadId}}/notes/{{noteId}}', { auth: COUNSELLOR, body: { body: 'hijack' }, tests: [status(403)] }),
  req('List notes', 'GET', '/leads/{{leadId}}/notes'),
  req('Timeline', 'GET', '/leads/{{leadId}}/timeline?page=1&page_size=25', {
    tests: [status(200), t('assignment entries', 'pm.expect(pm.response.json().data.some(a => a.type === "assignment")).to.eql(true);')],
  }),
  req('Export CSV', 'GET', '/leads/export?status=active&search={{leadMobile}}', {
    tests: [status(200), t('CSV', 'pm.expect(pm.response.headers.get("Content-Type")).to.include("text/csv");'),
      t('documented header', 'pm.expect(pm.response.text()).to.match(/^Lead No,First Name,Last Name,Mobile/);')],
  }),
  req('Export Excel (chosen columns)', 'GET', '/leads/export?format=xlsx&columns=leadNo,firstName,lastName,mobile,stage,subStage,owner,tags,createdAt&status=active&search={{leadMobile}}', {
    description: 'format = csv | xlsx. columns = comma-separated keys in the order you want them (see GET /leads/filter-fields → exportColumns), incl. profile fields pf.* and counsellor-discussion fields cf.*. Over 10,000 rows the export runs in the background (202 + /leads/exports/:id).',
    tests: [status(200), t('xlsx', 'pm.expect(pm.response.headers.get("Content-Type")).to.include("spreadsheetml");')],
  }),
  req('Export - unknown column (400)', 'GET', '/leads/export?columns=leadNo,password', { tests: [status(400)] }),
  req('Import template (.xlsx)', 'GET', '/leads/import/template', {
    tests: [status(200), t('xlsx', 'pm.expect(pm.response.headers.get("Content-Type")).to.include("spreadsheetml");')],
  }),
  req('Import preview (first 20 rows)', 'POST', '/leads/import/preview', {
    formdata: [fileField('sample-leads.csv', 'postman/sample-leads.csv')],
    tests: [status(200), json, t('mapping detected', 'pm.expect(res.data.mapping.mobile).to.eql("Mobile");'), t('rows', 'pm.expect(res.data.rows).to.be.an("array").that.is.not.empty;')],
  }),
  req('Bulk upload - no source (400)', 'POST', '/leads/bulk-upload', {
    formdata: [fileField('sample-leads.csv'), text('options', '{"assignMode":"unassigned"}')],
    tests: [status(400), hasError('source')],
  }),
  req('Bulk upload (CSV/XLSX)', 'POST', '/leads/bulk-upload', {
    formdata: [
      fileField('sample-leads.csv', 'Pick postman/sample-leads.csv (or any CSV/XLSX up to 10 MB / 5,000 rows)'),
      text('mapping', '{"firstName":"Name","mobile":"Mobile","email":"Email","city":"City"}'),
      text('options', '{"source":"{{sourceId}}","assignMode":"one","owners":["{{counsellorId}}"],"duplicates":"skip","sendWelcome":false}'),
    ],
    description: 'options: source (required), assignMode (unassigned | one | round_robin…), owners [userIds], duplicates (skip | update), sendWelcome. Rows already in the CRM are skipped (or updated), bad rows are failed and listed in the downloadable errorFile, so re-running this is safe.',
    tests: [status(200), json,
      t('import report', 'pm.expect(res.data).to.include.keys("total", "created", "updated", "skipped", "failed", "errorFile");'),
      t('every row accounted for', 'const d = res.data; pm.expect(d.total).to.eql(4); pm.expect(d.created + d.updated + d.skipped + d.failed).to.eql(4); pm.expect(d.failed).to.be.at.least(1);'),
      save('errorFile', 'res.data.errorFile')],
  }),
  req('Download upload error file', 'GET', '/leads/import/errors/{{errorFile}}', {
    tests: [status(200), t('xlsx', 'pm.expect(pm.response.headers.get("Content-Type")).to.include("spreadsheetml");')],
  }),
]);

/* ---------------------------------------------- 05a lead page (go-live) */
const leadExtras = folder('05a Leads - Go-live extras', 'Search, filters, My Day, dispositions (Log Call / Update), calls, History tab, Counsellor Discussion, bulk assign and exports with profile (pf.*) and counsellor (cf.*) fields.', [
  req('Global search', 'GET', '/leads/search?q={{leadMobile}}', {
    tests: [status(200), json, t('finds the lead', `pm.expect(res.data.items.some(l => l._id === ${get('leadId')})).to.eql(true);`)],
  }),
  req('Filter fields (advanced filter + export metadata)', 'GET', '/leads/filter-fields', {
    tests: [status(200), json,
      t('profile and counsellor fields', 'const keys = res.data.fields.map(f => f.key); pm.expect(keys).to.include("pf.gender"); pm.expect(keys).to.include("cf.employmentStatus");'),
      t('assign reasons', 'pm.expect(res.data.assignReasons).to.include("Workload");'),
      t('export columns', 'pm.expect(res.data.exportColumns).to.be.an("array").that.is.not.empty;')],
  }),
  req('List leads - smart filter (unassigned)', 'GET', '/leads?smart=unassigned&page_size=5', {
    tests: [status(200), t('no owner', 'pm.response.json().data.forEach(l => pm.expect(l.owner).to.eql(undefined));')],
  }),
  req('List leads - advanced filters', 'GET', '/leads?page_size=5&filters=[{"field":"mobile","op":"contains","value":"{{leadMobile}}"},{"field":"city","op":"contains","value":"mum"}]', {
    description: 'filters = JSON array of {field, op, value}; fields and their ops come from GET /leads/filter-fields.',
    tests: [status(200), t('one match', `pm.expect(pm.response.json().data.map(l => l._id)).to.include(${get('leadId')});`)],
  }),
  req('Save filter', 'POST', '/leads/saved-filters', { body: { name: 'PM Filter {{run}}', params: { smart: 'untouched' } }, tests: [status(201), json, save('savedFilterId', 'res.data._id')] }),
  req('List saved filters', 'GET', '/leads/saved-filters', { tests: [status(200), t('saved filter listed', `pm.expect(pm.response.json().data.some(f => f._id === ${get('savedFilterId')})).to.eql(true);`)] }),
  req('Delete saved filter', 'DELETE', '/leads/saved-filters/{{savedFilterId}}'),
  req('My Day counters', 'GET', '/leads/my-day', {
    auth: COUNSELLOR,
    tests: [status(200), t('four counters', 'const d = pm.response.json().data; ["newUntouched", "followUpsToday", "overdue", "interestedNoActivity"].forEach(k => pm.expect(d[k]).to.be.a("number"));')],
  }),
  req('Disposition options', 'GET', '/leads/disposition-options', {
    auth: COUNSELLOR,
    tests: [status(200), json, 'const s = (n) => res.data.stages.find(x => x.name === n);',
      save('stageInterestedId', 's("Interested")._id'),
      save('subStageInterestedId', 's("Interested").subStages[0]._id'),
      save('stageNotInterestedId', 's("Not Interested")._id'),
      save('stageAppSubmittedId', 's("Application Submitted")._id'),
      t('six follow-up types', 'pm.expect(res.data.followUpTypes.map(f => f.value)).to.have.members(["call_back", "follow_up_call", "counselling_session", "expert_one_on_one", "document_collection", "other"]);')],
  }),
  req('Disposition - open stage without follow-up (400)', 'POST', '/leads/{{leadId}}/disposition', {
    auth: COUNSELLOR, body: { stage: '{{stageInterestedId}}', subStage: '{{subStageInterestedId}}' },
    tests: [status(400), hasError('followUpAt')],
  }),
  req('Disposition - lost stage without reason (400)', 'POST', '/leads/{{leadId}}/disposition', {
    auth: COUNSELLOR, body: { stage: '{{stageNotInterestedId}}' },
    tests: [status(400), hasError('subStage')],
  }),
  req('Disposition - locked stage for counsellor (422)', 'POST', '/leads/{{leadId}}/disposition', {
    auth: COUNSELLOR, pre: [inHoursPre('followUpAt', 5)],
    body: { stage: '{{stageAppSubmittedId}}', followUpAt: '{{followUpAt}}', interaction: 'update' },
    tests: [status(422)],
  }),
  req('Log Call (disposition + follow-up + call)', 'POST', '/leads/{{leadId}}/disposition', {
    auth: COUNSELLOR, pre: [inHoursPre('followUpAt', 24)],
    body: {
      stage: '{{stageInterestedId}}', subStage: '{{subStageInterestedId}}', followUpAt: '{{followUpAt}}', followUpType: 'call_back',
      note: 'Wants brochure', interaction: 'call', call: { status: 'answered', durationSeconds: 185 },
    },
    description: 'interaction: call | update. Open stages need a future followUpAt; lost stages need a subStage (reason). Counsellors cannot pick Application Submitted or Re-enquired (422).',
    tests: [status(200), t('stage Interested', 'pm.expect(pm.response.json().data.lead.stage.name).to.eql("Interested");')],
  }),
  req('Call log', 'GET', '/leads/{{leadId}}/calls', {
    auth: COUNSELLOR,
    tests: [status(200), t('call recorded', 'pm.expect(pm.response.json().data[0].durationSeconds).to.eql(185);')],
  }),
  req('History tab (field changes)', 'GET', '/leads/{{leadId}}/history?page=1&page_size=50', {
    tests: [status(200), t('city change with old and new value', 'const h = pm.response.json().data.find(x => x.field === "city"); pm.expect(h.newValue).to.eql("Mumbai");')],
  }),
  req('History tab - counsellor (403)', 'GET', '/leads/{{leadId}}/history', { auth: COUNSELLOR, tests: [status(403)] }),
  req('Counsellor discussion', 'GET', '/leads/{{leadId}}/discussion', {
    tests: [status(200), t('27 numbered fields', 'pm.expect(pm.response.json().data.fields.filter(f => Number.isInteger(f.no)).length).to.eql(27);')],
  }),
  req('Save counsellor discussion', 'PUT', '/leads/{{leadId}}/discussion', {
    body: { employmentStatus: 'Working', currentCompany: 'Acme Corp', currentSalary: 45000, experienceRelevant: 'Yes' },
    tests: [status(200), t('saved', 'pm.expect(pm.response.json().data.data.currentCompany).to.eql("Acme Corp");')],
  }),
  req('Save counsellor discussion - invalid (400)', 'PUT', '/leads/{{leadId}}/discussion', { body: { familySize: 3, earningMembers: 5 }, tests: [status(400)] }),
  req('Profile options (states, cities)', 'GET', '/leads/profile-options', {
    tests: [status(200), t('states and cities', 'const d = pm.response.json().data; pm.expect(d.states).to.include("Maharashtra"); pm.expect(d.citiesByState).to.have.property("Maharashtra");')],
  }),
  req('Quick Add - second lead', 'POST', '/leads', {
    body: { firstName: 'Second', lastName: '{{runTag}}', mobile: '{{lead2Mobile}}', email: 'second{{run}}@example.com', source: '{{sourceWalkinId}}' },
    tests: [status(201), json, save('lead2Id', 'res.data._id')],
  }),
  req('Quick Add - third lead', 'POST', '/leads', {
    body: { firstName: 'Third', lastName: '{{runTag}}', mobile: '{{lead3Mobile}}', source: '{{sourceWalkinId}}' },
    tests: [status(201), json, save('lead3Id', 'res.data._id')],
  }),
  req('Bulk assign - preview', 'POST', '/leads/bulk-assign', {
    body: { leadIds: ['{{lead2Id}}', '{{lead3Id}}'], owners: ['{{counsellorId}}', '{{saraId}}'], reason: 'New allocation', preview: true },
    description: 'leadIds, or selectAll + filters. Leads are split evenly across owners. preview:true only returns the split.',
    tests: [status(200), t('split 1 / 1', 'pm.expect(pm.response.json().data.perCounsellor.map(p => p.count)).to.eql([1, 1]);')],
  }),
  req('Bulk assign - confirm', 'POST', '/leads/bulk-assign', {
    body: { leadIds: ['{{lead2Id}}', '{{lead3Id}}'], owners: ['{{counsellorId}}', '{{saraId}}'], reason: 'New allocation' },
    tests: [status(200), t('two assigned', 'pm.expect(pm.response.json().data.assigned).to.eql(2);')],
  }),
  req('Bulk assign - counsellor (403)', 'POST', '/leads/bulk-assign', { auth: COUNSELLOR, body: {}, tests: [status(403)] }),
  req('Export with profile + counsellor fields', 'GET', '/leads/export?format=csv&columns=leadNo,firstName,profileCompletion,pf.gender,cf.employmentStatus,cf.currentCompany&search={{leadMobile}}', {
    tests: [status(200), t('profile + CF headers', 'const header = pm.response.text().split("\\n")[0]; pm.expect(header).to.include("Profile: Gender"); pm.expect(header).to.include("CF 4: Fresher or Working");'),
      t('one row', 'pm.expect(pm.response.text().trim().split("\\n").length).to.eql(2);')],
  }),
]);

/* ------------------------------------------------------ 05b follow-ups */
const followUps = folder('05b Follow-ups', 'Next actions on a lead (Deep Dive §10.2). Types: call_back | follow_up_call | counselling_session | expert_one_on_one | document_collection | other. Reminders go out reminderMinutes before the due time, overdue alerts at the due time, and an Admin escalation after 2 hours (sent by the scheduler tick).', [
  req('Schedule follow-up', 'POST', '/leads/{{leadId}}/tasks', {
    pre: [inHoursPre('followUpDue', 2)],
    body: { type: 'call_back', dueAt: '{{followUpDue}}', priority: 'high', reminderMinutes: 15, notes: 'Candidate asked for a call after 6 pm', assignee: '{{counsellorId}}' },
    description: 'assignee defaults to the lead owner; own-scope users can only assign themselves.',
    tests: [status(201), json, save('taskId', 'res.data._id'), t('open, not overdue', 'pm.expect(res.data.status).to.eql("open"); pm.expect(res.data.isOverdue).to.eql(false);')],
  }),
  req('Schedule follow-up - past due (400)', 'POST', '/leads/{{leadId}}/tasks', { body: { type: 'call_back', dueAt: '2020-01-01T10:00:00Z' }, tests: [status(400), hasError('dueAt')] }),
  req('Schedule follow-up - retired type (400)', 'POST', '/leads/{{leadId}}/tasks', {
    pre: [inHoursPre('followUpDue', 2)],
    body: { type: 'parent_call', dueAt: '{{followUpDue}}' }, tests: [status(400), hasError('type')],
  }),
  req('Lead follow-ups', 'GET', '/leads/{{leadId}}/tasks'),
  req('My follow-ups (open)', 'GET', '/tasks?view=open&assignee=me&page=1&page_size=25', { auth: COUNSELLOR, description: 'view: today | overdue | upcoming | open | completed. assignee: me | <userId> | omitted (everyone in your data scope). Also: lead, type, priority.' }),
  req('Follow-up counts', 'GET', '/tasks/summary?assignee=me', { tests: [status(200), t('counts + six types', 'const d = pm.response.json().data; pm.expect(d.counts).to.have.keys("today", "overdue", "upcoming", "completed"); pm.expect(d.types.length).to.eql(6);')] }),
  req('Reschedule follow-up', 'PUT', '/tasks/{{taskId}}', {
    pre: [inHoursPre('followUpDue', 26)],
    body: { dueAt: '{{followUpDue}}', priority: 'normal' },
  }),
  req('Complete follow-up', 'PUT', '/tasks/{{taskId}}', {
    body: { status: 'done', outcome: 'Spoke to the candidate; brochure sent' },
    tests: [status(200), t('done', 'pm.expect(pm.response.json().data.status).to.eql("done");')],
  }),
  req('Timeline - follow-ups only', 'GET', '/leads/{{leadId}}/timeline?type=task&page=1&page_size=25', {
    description: 'type filter (comma-separated): created, note, task, call, stage_change, status_change, assignment, communication, re_enquiry, document, profile, edit, import, export (Super Admin), system.',
    tests: [status(200), t('only follow-up entries', 'pm.response.json().data.forEach(a => pm.expect(a.type).to.eql("task"));')],
  }),
]);

/* ------------------------------------------------------- 06 profile */
const docUpload = (type, src) => req(`Upload document - ${type}`, 'POST', '/leads/{{leadId}}/documents', {
  formdata: [text('type', type), fileField(src)],
  tests: [status(201), json, ...(type === 'aadhaar' ? [save('documentId', 'res.data._id')] : []), t('type saved', `pm.expect(res.data.type).to.eql("${type}");`)],
});
const profile = folder('06 Student Profile & Documents', 'Deep Dive §4.2 four-step profile on a lead plus documents (Aadhaar and marksheets PDF/JPG/PNG, photo and signature JPG/PNG). The declaration needs steps 1-3 and the mandatory documents, and locks the profile; an Admin or Super Admin can unlock. Upload requests read sample-document.pdf / sample-photo.png from the postman folder.', [
  req('Get profile - new profile is prefilled from the lead', 'GET', '/leads/{{lead2Id}}/profile', {
    tests: [status(200), t('prefilled', 'const d = pm.response.json().data; pm.expect(d.exists).to.eql(false); pm.expect(d.personal.firstName).to.eql("Second"); pm.expect(d.personal.mobile).to.eql(pm.collectionVariables.get("lead2Mobile"));')],
  }),
  req('Get profile', 'GET', '/leads/{{leadId}}/profile', {
    description: 'This lead already has a profile row (the Counsellor Discussion in 05a saved work fields), so it is returned as stored.',
    tests: [status(200), t('work from the counsellor discussion', 'pm.expect(pm.response.json().data.work.organization).to.eql("Acme Corp");')],
  }),
  req('Step 1 - validation errors (400)', 'PUT', '/leads/{{leadId}}/profile/personal', { body: { personal: { firstName: 'Ishaan2' } }, tests: [status(400)] }),
  req('Step 1 - personal & guardian', 'PUT', '/leads/{{leadId}}/profile/personal', {
    body: {
      personal: { firstName: 'Postman', lastName: 'Lead', email: 'lead{{run}}@example.com', mobile: '{{profileMobile}}', dob: '2001-05-14', gender: 'Male', state: 'Maharashtra', city: 'Pune', pinCode: '411001', address: '12 MG Road, Pune' },
      guardian: { name: 'Rakesh Verma', relationship: 'Father', mobile: '9822012345', email: 'rakesh{{run}}@example.com' },
    },
    tests: [status(200), t('step 1 complete', 'pm.expect(pm.response.json().data.steps.personal).to.eql(true);')],
  }),
  req('Step 2 - academic', 'PUT', '/leads/{{leadId}}/profile/academic', {
    body: {
      academic: {
        class10: { yearOfPassing: 2016, gradeType: 'CGPA', score: 9.2, medium: 'English' },
        class12: { yearOfPassing: 2018, gradeType: 'Percentage', score: 85.5, medium: 'English' },
        ug: { qualification: 'BBA', status: 'Completed', institution: 'Pune University', gradeType: 'Percentage', score: 72.5, yearOfPassing: 2021, medium: 'English' },
        higherQualification: { has: false },
      },
    },
  }),
  req('Step 3 - work experience', 'PUT', '/leads/{{leadId}}/profile/work', {
    body: { work: { employmentStatus: 'Experienced', organization: 'Acme Corp', designation: 'Analyst', functionalArea: 'Finance', experienceYears: 2, experienceMonths: 6 } },
  }),
  req('Declaration - documents missing (422)', 'POST', '/leads/{{leadId}}/profile/declaration', { body: { accepted: true }, tests: [status(422)] }),
  req('Upload document - wrong format (400)', 'POST', '/leads/{{leadId}}/documents', {
    formdata: [text('type', 'photo'), fileField('sample-document.pdf')],
    tests: [status(400), hasError('file')],
  }),
  docUpload('aadhaar', 'sample-document.pdf'),
  docUpload('class10_marksheet', 'sample-document.pdf'),
  docUpload('class12_marksheet', 'sample-document.pdf'),
  docUpload('graduation_marksheet', 'sample-document.pdf'),
  docUpload('photo', 'sample-photo.png'),
  docUpload('signature', 'sample-photo.png'),
  req('List documents', 'GET', '/leads/{{leadId}}/documents'),
  req('Download document', 'GET', '/leads/{{leadId}}/documents/{{documentId}}/download', {
    tests: [status(200), t('file body', 'pm.expect(pm.response.text()).to.include("%PDF");')],
  }),
  req('Step 4 - accept declaration (locks)', 'POST', '/leads/{{leadId}}/profile/declaration', {
    body: { accepted: true },
    tests: [status(200), t('locked at 100%', 'const d = pm.response.json().data; pm.expect(d.locked).to.eql(true); pm.expect(d.completionPercent).to.eql(100);')],
  }),
  req('Save while locked (422)', 'PUT', '/leads/{{leadId}}/profile/work', { body: { work: { employmentStatus: 'Fresher' } }, tests: [status(422)] }),
  req('Unlock profile (admin)', 'POST', '/leads/{{leadId}}/profile/unlock', { body: { reason: 'Candidate asked to fix city' }, tests: [status(200), t('unlocked', 'pm.expect(pm.response.json().data.locked).to.eql(false);')] }),
]);

/* ------------------------------------------------------- 07 capture */
const capture = folder('07 Public Capture & Webhooks', 'Website/landing-page forms (x-api-key = {{captureApiKey}} = CAPTURE_API_KEY), the Meta Lead Ads webhook (GET hub.* handshake with META_VERIFY_TOKEN; POST leadgen events — without META_ACCESS_TOKEN the answers are read from field_data) and the Google connector.', [
  req('Capture - missing API key (401)', 'POST', '/leads/capture', { auth: 'none', body: { name: 'No Key', mobile: '9111111111' }, tests: [status(401)] }),
  req('Website capture', 'POST', '/leads/capture', {
    auth: 'none', headers: apiKey,
    body: { name: 'Rohan Desai', mobile: '{{captureMobile}}', email: 'rohan{{run}}@example.com', source: 'Website', program: 'GMBA', utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'gmba-jan27', landing_page: '/gmba' },
    tests: [status(201), json, save('captureLeadId', 'res.data.lead._id'), t('new lead', 'pm.expect(res.data.duplicate).to.eql(false);')],
  }),
  req('Re-enquiry (same mobile)', 'POST', '/leads/capture', {
    auth: 'none', headers: apiKey,
    body: { name: 'Rohan Desai', mobile: '{{captureMobile}}', source: 'Landing Page' },
    tests: [status(201), t('duplicate → re-enquiry on the same lead', `const d = pm.response.json().data; pm.expect(d.duplicate).to.eql(true); pm.expect(d.lead._id).to.eql(${get('captureLeadId')});`)],
  }),
  req('Meta webhook - verify handshake', 'GET', '/webhooks/meta-leads?hub.mode=subscribe&hub.verify_token={{metaVerifyToken}}&hub.challenge=pm{{run}}', {
    auth: 'none', tests: [status(200), t('echoes the challenge', `pm.expect(pm.response.text()).to.eql("pm" + ${get('run')});`)],
  }),
  req('Meta webhook - wrong verify token (403)', 'GET', '/webhooks/meta-leads?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=1', { auth: 'none', tests: [status(403)] }),
  req('Meta webhook - leadgen event', 'POST', '/webhooks/meta-leads', {
    auth: 'none',
    body: metaEvent('pm{{run}}', { full_name: 'Meta Lead', phone_number: '+91 {{metaMobile}}', email: 'meta{{run}}@example.com', city: 'Pune', preferred_batch: 'January' }),
    description: 'Meta posts {object:"page", entry:[{changes:[{field:"leadgen", value:{leadgen_id, form_id, page_id, …}}]}]}. Signed with X-Hub-Signature-256 when META_APP_SECRET is set. Returns counts {received, created, reEnquiries, duplicates, failed}.',
    tests: [status(200), t('one created', 'const d = pm.response.json().data; pm.expect(d.received).to.eql(1); pm.expect(d.created).to.eql(1);')],
  }),
  req('Meta webhook - resent event (no second lead)', 'POST', '/webhooks/meta-leads', {
    auth: 'none',
    body: metaEvent('pm{{run}}', { full_name: 'Meta Lead', phone_number: '{{metaMobile}}' }),
    tests: [status(200), t('duplicate', 'const d = pm.response.json().data; pm.expect(d.duplicates).to.eql(1); pm.expect(d.created).to.eql(0);')],
  }),
  req('Meta webhook - failing fetch (retried later)', 'POST', '/webhooks/meta-leads', {
    auth: 'none',
    body: metaEvent('pmerr{{run}}', { full_name: 'Err Lead', phone_number: '{{errMobile}}' }, { simulate_error: 'Graph API timeout' }),
    description: 'simulate_error (sandbox only) makes the fetch fail, so the event lands in Integration errors with a retry schedule.',
    tests: [status(200), t('failed', 'pm.expect(pm.response.json().data.failed).to.eql(1);')],
  }),
  req('Find the Meta lead', 'GET', '/leads?search={{metaMobile}}', {
    tests: [status(200), json, save('metaLeadId', 'res.data[0]._id'), t('one Meta lead', 'pm.expect(res.pagination.total_results).to.eql(1);')],
  }),
  req('Get Meta lead (attribution)', 'GET', '/leads/{{metaLeadId}}', {
    tests: [status(200), json, t('Meta attribution', 'pm.expect(res.data.createdVia).to.eql("meta"); pm.expect(res.data.source.name).to.eql("Meta Ads"); pm.expect(res.data.meta.campaignName).to.eql("Postman Campaign");')],
  }),
  req('Google lead form webhook', 'POST', '/webhooks/google-leads', {
    auth: 'none', headers: apiKey,
    body: { firstName: 'Google', lastName: 'Lead', mobile: '{{googleMobile}}', source: 'Google Ads', utm_campaign: 'google-test' },
    tests: [status(201), json, save('googleLeadId', 'res.data.lead._id')],
  }),
]);

/* ------------------------------------------------------- 08 messaging */
const messaging = folder('08 Messaging (SMS / Email)', 'GL-21..25: DLT SMS and email templates, automations, per-lead sends, bulk campaigns (9 am - 9 pm IST window), delivery-status and inbound-SMS (STOP) webhooks (header x-webhook-secret = MESSAGING_WEBHOOK_SECRET, default CAPTURE_API_KEY) and the public email unsubscribe link.', [
  req('Messaging options', 'GET', '/messaging/options', {
    tests: [status(200), t('placeholders + triggers', 'const d = pm.response.json().data; pm.expect(d.placeholders).to.include("first_name"); pm.expect(d.triggers).to.be.an("array").that.is.not.empty;')],
  }),
  req('List templates', 'GET', '/messaging/templates?active=true', {
    tests: [status(200), json,
      save('welcomeSmsId', 'res.data.find(x => x.name === "Welcome SMS")._id'),
      save('emailTemplateId', 'res.data.find(x => x.channel === "email")._id')],
  }),
  req('Create SMS template - invalid (400)', 'POST', '/messaging/templates', {
    body: { name: 'PM Bad {{run}}', channel: 'sms', body: 'Hi {first_name} {bogus}' },
    tests: [status(400), hasError('dltTemplateId'), hasError('senderId'), hasError('body')],
  }),
  req('Create SMS template', 'POST', '/messaging/templates', {
    body: { name: 'PM SMS {{run}}', channel: 'sms', body: 'Hi {first_name}, your counsellor {counsellor_name} will call you. GCC School', dltTemplateId: '1107{{run}}', senderId: 'GCCSCH' },
    description: 'SMS needs a numeric DLT Template ID and a 6-letter Sender ID. Placeholders: {first_name} {last_name} {counsellor_name} {counsellor_mobile} {program_interest} {lead_id}.',
    tests: [status(201), json, save('smsTemplateId', 'res.data._id')],
  }),
  req('Create email template', 'POST', '/messaging/templates', {
    body: { name: 'PM Email {{run}}', channel: 'email', subject: 'Hello {first_name}', body: '<p>Hi {first_name},</p><p>Thanks for your interest.</p>' },
    tests: [status(201), json, save('newEmailTemplateId', 'res.data._id')],
  }),
  req('Update template', 'PUT', '/messaging/templates/{{smsTemplateId}}', {
    body: { body: 'Hi {first_name}, {counsellor_name} from GCC School will call you today.' },
    tests: [status(200), t('placeholders', 'pm.expect(pm.response.json().data.placeholders).to.include("counsellor_name");')],
  }),
  req('Update template - channel cannot change (400)', 'PUT', '/messaging/templates/{{smsTemplateId}}', { body: { channel: 'email' }, tests: [status(400)] }),
  req('List automations', 'GET', '/messaging/automations', {
    tests: [status(200), json, 'const rule = res.data.find(r => r.trigger === "lead_created" && r.channel === "sms");',
      save('automationId', 'rule._id'), save('automationActive', 'String(rule.isActive)'), save('automationTemplateId', 'rule.template ? rule.template._id : ""')],
  }),
  req('Update automation (same settings)', 'PUT', '/messaging/automations/{{automationId}}', {
    pre: ['// re-saves the rule with its current values, so running the collection does not change the automations',
      'pm.variables.set("automationBody", JSON.stringify({ isActive: pm.collectionVariables.get("automationActive") === "true", template: pm.collectionVariables.get("automationTemplateId") || null }));'],
    body: '__AUTOMATION_BODY__',
    description: 'Body: {isActive, template}. A rule can only be switched on with a template of its channel.',
    tests: [status(200), t('unchanged', `pm.expect(String(pm.response.json().data.isActive)).to.eql(${get('automationActive')});`)],
  }),
  req('Preview message for lead', 'POST', '/leads/{{leadId}}/messages/preview', {
    body: { template: '{{welcomeSmsId}}' },
    tests: [status(200), t('rendered with the lead name', 'pm.expect(pm.response.json().data.body).to.include("Postman");')],
  }),
  req('Send SMS to lead', 'POST', '/leads/{{leadId}}/messages', {
    body: { template: '{{welcomeSmsId}}' },
    description: 'Counsellors can message their own leads only. Email templates also accept an edited subject/body.',
    tests: [status(201), json, save('messageId', 'res.data._id'), t('sent', 'pm.expect(["sent", "delivered"]).to.include(res.data.status);')],
  }),
  req('Lead messages', 'GET', '/leads/{{leadId}}/messages', {
    tests: [status(200), t('message listed', `pm.expect(pm.response.json().data.some(m => m._id === ${get('messageId')})).to.eql(true);`)],
  }),
  req('Delivery status webhook - wrong secret (401)', 'POST', '/webhooks/messaging/status', {
    auth: 'none', headers: [{ key: 'x-webhook-secret', value: 'wrong' }], body: { messageId: '{{messageId}}', status: 'delivered' }, tests: [status(401)],
  }),
  req('Delivery status webhook', 'POST', '/webhooks/messaging/status', {
    auth: 'none', headers: webhookSecret, body: { messageId: '{{messageId}}', status: 'delivered' },
    description: 'Provider delivery report: {messageId | providerMessageId, status: sent | delivered | failed | bounced, error}.',
    tests: [status(200), t('delivered', 'pm.expect(pm.response.json().data.status).to.eql("delivered");')],
  }),
  req('Inbound SMS webhook (STOP)', 'POST', '/webhooks/messaging/inbound-sms', {
    auth: 'none', headers: webhookSecret, body: { from: '+91{{captureMobile}}', text: 'STOP' },
    tests: [status(200), t('lead opted out', 'pm.expect(pm.response.json().data.optedOut).to.eql(1);')],
  }),
  req('Opted-out lead', 'GET', '/leads/{{captureLeadId}}', { tests: [status(200), t('sms opt-out', 'pm.expect(pm.response.json().data.optedOut.sms).to.eql(true);')] }),
  req('Public unsubscribe - invalid link', 'GET', '/public/unsubscribe/not-a-valid-token', {
    auth: 'none',
    description: 'The signed link at the foot of every email. A valid token opts the lead out of email.',
    tests: [status(200), t('explains the link is invalid', 'pm.expect(pm.response.text()).to.include("not valid");')],
  }),
  req('Bulk send - preview', 'POST', '/messaging/campaigns', {
    pre: ['// tomorrow 12:00 IST (06:30 UTC) is inside the 9 am - 9 pm bulk window',
      'const d = new Date(); d.setUTCDate(d.getUTCDate() + 1); d.setUTCHours(6, 30, 0, 0);', save('campaignAt', 'd.toISOString()')],
    body: { channel: 'sms', template: '{{welcomeSmsId}}', audience: { leadIds: ['{{leadId}}', '{{lead2Id}}', '{{captureLeadId}}'] }, scheduledAt: '{{campaignAt}}', preview: true },
    description: 'audience: {leadIds} or {selectAll: true, filters: {...list filters}}. Opted-out, invalid and duplicate addresses are excluded.',
    tests: [status(200), t('exclusions', 'const d = pm.response.json().data; pm.expect(d.selected).to.eql(3); pm.expect(d.excluded.optedOut).to.eql(1); pm.expect(d.final).to.eql(2);')],
  }),
  req('Bulk send - schedule', 'POST', '/messaging/campaigns', {
    body: { name: 'PM Campaign {{run}}', channel: 'sms', template: '{{welcomeSmsId}}', audience: { leadIds: ['{{leadId}}', '{{lead2Id}}'] }, scheduledAt: '{{campaignAt}}' },
    tests: [status(201), json, save('campaignId', 'res.data.campaign._id'), t('scheduled', 'pm.expect(res.data.campaign.status).to.eql("scheduled");')],
  }),
  req('List campaigns', 'GET', '/messaging/campaigns', { tests: [status(200), t('listed', `pm.expect(pm.response.json().data.some(c => c._id === ${get('campaignId')})).to.eql(true);`)] }),
  req('Get campaign (report)', 'GET', '/messaging/campaigns/{{campaignId}}', { tests: [status(200), t('report', 'pm.expect(pm.response.json().data.report).to.have.property("delivered");')] }),
  req('Cancel campaign', 'POST', '/messaging/campaigns/{{campaignId}}/cancel', { tests: [status(200), t('cancelled', 'pm.expect(pm.response.json().data.status).to.eql("cancelled");')] }),
  req('Cancel campaign again (422)', 'POST', '/messaging/campaigns/{{campaignId}}/cancel', { tests: [status(422)] }),
  req('Bulk send - counsellor (403)', 'POST', '/messaging/campaigns', { auth: COUNSELLOR, body: {}, tests: [status(403)] }),
  req('Deactivate SMS template', 'PUT', '/messaging/templates/{{smsTemplateId}}', { body: { isActive: false }, tests: [status(200), t('inactive', 'pm.expect(pm.response.json().data.isActive).to.eql(false);')] }),
  req('Deactivate email template', 'PUT', '/messaging/templates/{{newEmailTemplateId}}', { body: { isActive: false }, tests: [status(200), t('inactive', 'pm.expect(pm.response.json().data.isActive).to.eql(false);')] }),
]);

/* ---------------------------------------------------- 09 integrations */
const integrations = folder('09 Integrations (Meta, Super Admin)', 'Meta Lead Ads admin screens: per-form question → CRM field mapping, received events / Integration errors with Retry, and the daily Meta-vs-CRM count check. Super Admin only.', [
  req('Meta forms + mapping fields', 'GET', '/integrations/meta/forms', {
    tests: [status(200), json, t('this run\'s form', `pm.expect(res.data.forms.some(f => f.formId === "pmform" + ${get('run')})).to.eql(true);`), t('mappable fields', 'pm.expect(res.data.fields.map(f => f.value)).to.include("phone_number");')],
  }),
  req('Save form mapping', 'PUT', '/integrations/meta/forms/pmform{{run}}', {
    body: { formName: 'Postman Form {{run}}', mapping: { preferred_city: 'city', your_name: 'full_name' }, isActive: true },
    description: 'mapping = {"<form question>": "<CRM field>" | "ignore"}; CRM fields come from GET /integrations/meta/forms → fields.',
    tests: [status(200), t('mapping saved', 'pm.expect(pm.response.json().data.mapping.preferred_city).to.eql("city");')],
  }),
  req('Save form mapping - unknown field (400)', 'PUT', '/integrations/meta/forms/pmform{{run}}', { body: { mapping: { q: 'password' } }, tests: [status(400)] }),
  req('Meta events - errors', 'GET', '/integrations/meta/events?status=errors', {
    description: 'status: errors (failed + error) | processed | failed | error | omitted (all).',
    tests: [status(200), json, 'const e = res.data.find(x => x.leadgenId === "pmerr" + pm.collectionVariables.get("run"));', save('metaEventId', 'e._id'),
      t('failed with a retry scheduled', 'pm.expect(e.status).to.eql("failed"); pm.expect(e.nextAttemptAt).to.be.a("string");')],
  }),
  req('Retry Meta event', 'POST', '/integrations/meta/events/{{metaEventId}}/retry', {
    tests: [status(200), t('retried (still failing in the sandbox)', 'pm.expect(pm.response.json().data.outcome).to.eql("failed");')],
  }),
  req('Meta daily check', 'GET', '/integrations/meta/daily-check', {
    description: 'Optional ?date=YYYY-MM-DD (default today, IST).',
    tests: [status(200), t('this run\'s form counted', `pm.expect(pm.response.json().data.forms.some(f => f.formId === "pmform" + ${get('run')})).to.eql(true);`)],
  }),
  req('Meta events - counsellor (403)', 'GET', '/integrations/meta/events', { auth: COUNSELLOR, tests: [status(403)] }),
]);

/* ------------------------------------------------ 10 notifications etc */
const misc = folder('10 Notifications, Dashboard, Audit & System', '', [
  req('Notifications', 'GET', '/notifications?page=1&page_size=15&unread=', {
    tests: [status(200), json,
      t('items + unreadCount', 'pm.expect(res.data.items).to.be.an("array"); pm.expect(res.data.unreadCount).to.be.a("number");'),
      t('unread header', 'pm.expect(pm.response.headers.get("X-Unread-Count")).to.eql(String(res.data.unreadCount));'),
      'if (res.data.items.length) pm.collectionVariables.set("notificationId", res.data.items[0]._id);'],
  }),
  req('Counsellor notifications (reassignment alert)', 'GET', '/notifications?page_size=50', {
    auth: COUNSELLOR,
    tests: [status(200), t('alert about this lead', `pm.expect(pm.response.json().data.items.some(n => n.data && n.data.leadId === ${get('leadId')})).to.eql(true);`)],
  }),
  req('Mark notification read', 'PATCH', '/notifications/{{notificationId}}/read'),
  req('Mark all notifications read', 'PATCH', '/notifications/read-all'),
  req('Dashboard summary', 'GET', '/dashboard/summary', { tests: [status(200), t('totals', 'pm.expect(pm.response.json().data.totals.total).to.be.above(0);')] }),
  req('Audit logs', 'GET', '/audit-logs?page=1&page_size=25&module=leads&action=&search=&created_from=&created_to='),
  req('Audit logs - exports', 'GET', '/audit-logs?action=export&page_size=5', { tests: [status(200), t('export logged', 'pm.expect(pm.response.json().data.length).to.be.above(0);')] }),
  req('Audit log export (CSV)', 'GET', '/audit-logs/export', {
    tests: [status(200), t('CSV header', 'pm.expect(pm.response.text().split("\\n")[0]).to.match(/Time \\(IST\\),User,Action/);')],
  }),
  req('System tick (scheduler)', 'POST', '/system/tick', {
    body: {},
    description: 'Super Admin: runs reminders, overdue alerts, escalations, Untouched alerts, pool hand-out, Meta retries and scheduled campaigns once. Optional {"at": ISO time} to simulate the clock.',
    tests: [status(200), t('counters', 'pm.expect(pm.response.json().data).to.include.keys("reminders", "overdue", "escalations", "metaRetries", "campaigns");')],
  }),
  req('System tick - counsellor (403)', 'POST', '/system/tick', { auth: COUNSELLOR, body: {}, tests: [status(403)] }),
]);

/* ------------------------------------------------------ 11 RBAC */
const rbac = folder('11 RBAC & Masking (other roles)', 'Uses the seeded counsellor and marketing users to show permissions, data scope and masking enforced by the API.', [
  req('Counsellor - list users (403)', 'GET', '/users', { auth: COUNSELLOR, tests: [status(403)] }),
  req('Counsellor - export leads (403)', 'GET', '/leads/export', { auth: COUNSELLOR, tests: [status(403)] }),
  req('Counsellor - assign lead (403)', 'POST', '/leads/{{leadId}}/assign', { auth: COUNSELLOR, body: { owner: '{{counsellorId}}', reason: 'Other' }, tests: [status(403)] }),
  req('Counsellor - only own leads', 'GET', '/leads?page_size=100', {
    auth: COUNSELLOR,
    tests: [status(200), 'const me = pm.response.json().data;', t('every lead is own', `me.forEach(l => pm.expect(l.owner && l.owner._id).to.eql(${get('counsellorId')}));`)],
  }),
  req('Counsellor - another counsellor\'s lead (404)', 'GET', '/leads/{{lead3Id}}', {
    auth: COUNSELLOR,
    description: 'lead3 went to Sara in the bulk assign. Search and the duplicate check only say "Lead exists, assigned to another counsellor".',
    tests: [status(404)],
  }),
  req('Counsellor - duplicate check hides details', 'GET', '/leads/check-duplicate?mobile={{lead3Mobile}}', {
    auth: COUNSELLOR,
    tests: [status(200), t('no details leak', 'const d = pm.response.json().data; pm.expect(d.message).to.eql("Lead exists, assigned to another counsellor"); pm.expect(d.leadId).to.eql(undefined);')],
  }),
  req('Counsellor - Quick Add is assigned to them', 'POST', '/leads', {
    auth: COUNSELLOR, body: { firstName: 'Counsellor', lastName: 'Add {{runTag}}', mobile: '{{freeMobile}}', source: '{{sourceWalkinId}}' },
    tests: [status(201), json, save('lead4Id', 'res.data._id'), t('own lead', `pm.expect(res.data.owner._id).to.eql(${get('counsellorId')});`)],
  }),
  req('Login (marketing)', 'POST', '/auth/login', { auth: 'none', body: { email: 'dev.mkt@gccschool.com', password: 'Welcome@123' }, tests: [status(200), json, save('marketingToken', 'res.data.access_token')] }),
  req('Marketing - masked contacts', 'GET', '/leads?page_size=5', {
    auth: '{{marketingToken}}',
    tests: [status(200), 'const l = pm.response.json().data.find(x => x.mobile);', t('mobile masked', 'pm.expect(l.mobile).to.match(/^\\*+\\d{4}$/);')],
  }),
  req('Marketing - create lead (403)', 'POST', '/leads', { auth: '{{marketingToken}}', body: { firstName: 'M', mobile: '9000000000' }, tests: [status(403)] }),
]);

/* ---------------------------------------------------- 12 cleanup */
const cleanup = folder('12 Cleanup & Logout', 'Soft-deletes the records this run created, then signs out.', [
  req('Delete lead', 'DELETE', '/leads/{{leadId}}'),
  req('Delete second lead', 'DELETE', '/leads/{{lead2Id}}'),
  req('Delete third lead', 'DELETE', '/leads/{{lead3Id}}'),
  req('Delete counsellor\'s lead', 'DELETE', '/leads/{{lead4Id}}'),
  req('Delete captured lead', 'DELETE', '/leads/{{captureLeadId}}'),
  req('Delete Meta lead', 'DELETE', '/leads/{{metaLeadId}}'),
  req('Delete Google lead', 'DELETE', '/leads/{{googleLeadId}}'),
  req('Deleted lead is gone (404)', 'GET', '/leads/{{leadId}}', { tests: [status(404)] }),
  req('Deactivate custom field', 'DELETE', '/masters/custom-fields/{{customFieldId}}'),
  req('Deactivate user', 'DELETE', '/users/{{userId}}'),
  req('Logout', 'POST', '/auth/logout', { auth: 'none' }),
  req('Refresh after logout (401)', 'POST', '/auth/refresh', { auth: 'none', tests: [status(401)] }),
]);

const variables = {
  rootUrl: 'http://localhost:4000',
  baseUrl: 'http://localhost:4000/api/v1',
  adminEmail: 'admin@gccschool.com',
  adminPassword: 'Admin@12345',
  counsellorEmail: 'arjun.c@gccschool.com',
  captureApiKey: 'dev-capture-key-123',
  metaVerifyToken: 'gcc-crm-meta-verify',
  accessToken: '', adminId: '', counsellorToken: '', counsellorId: '', saraId: '', marketingToken: '',
  run: '', runTag: '', leadMobile: '', profileMobile: '', captureMobile: '', metaMobile: '', googleMobile: '',
  lead2Mobile: '', lead3Mobile: '', freeMobile: '', errMobile: '',
  sourceId: '', sourceWalkinId: '', programId: '', tagId: '', stageProspectsId: '', subStageHotId: '', stageEnrolledId: '', subStageEnrolledId: '', stageUntouchedId: '',
  stageInterestedId: '', subStageInterestedId: '', stageNotInterestedId: '', stageAppSubmittedId: '',
  newTagId: '', cohortId: '', customFieldId: '', customFieldKey: '', newSourceId: '',
  userId: '', systemTemplateId: '', templateId: '', deptId: '', teamId: '',
  leadId: '', leadNo: '', lead2Id: '', lead3Id: '', lead4Id: '', noteId: '', savedFilterId: '', errorFile: '', followUpAt: '',
  taskId: '', followUpDue: '', documentId: '',
  captureLeadId: '', metaLeadId: '', googleLeadId: '', metaEventId: '',
  welcomeSmsId: '', emailTemplateId: '', smsTemplateId: '', newEmailTemplateId: '', automationId: '', automationActive: '', automationTemplateId: '',
  messageId: '', campaignAt: '', campaignId: '', notificationId: '',
};

const collection = {
  info: {
    name: 'GCC CRM API (Django)',
    description: [
      'Every endpoint of the Django CRM API (CrmDjango/) under the Go-Live Minimum Scope rules (see CrmDjango/README.md).',
      '',
      'Run it top to bottom (Collection Runner or newman):',
      '1. Start the API: `cd CrmDjango && .venv\\Scripts\\python manage.py runserver 127.0.0.1:4000` (after `migrate` + `seed`). For repeated runs use the QA settings from the README (AUTH_RATE_LIMIT, API_RATE_LIMIT, MAIL_OUTBOX_DIR).',
      '2. "01 Auth / Login (admin)" stores {{accessToken}}; every request uses it via collection-level Bearer auth. "Login (counsellor)" stores {{counsellorToken}} for the counsellor checks.',
      '3. Requests save the ids they create (leadId, teamId, …) into collection variables for the next ones.',
      '',
      'Each run uses a unique {{run}} suffix (and {{runTag}}, the same digits as letters, for person names), so it can be repeated.',
      'Upload requests (bulk upload, import preview, documents) read sample-leads.csv, sample-document.pdf and sample-photo.png from the postman folder: run newman from CrmDjango/postman (or pass --working-dir CrmDjango/postman); in Postman desktop put the files in its working directory.',
      '',
      'Generated by build-postman.mjs — edit the generator, not this JSON.',
    ].join('\n'),
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{accessToken}}', type: 'string' }] },
  variable: Object.entries(variables).map(([key, value]) => ({ key, value, type: 'string' })),
  item: [health, auth, masters, users, goLiveUsers, teams, leads, leadExtras, followUps, profile, capture, messaging, integrations, misc, rbac, cleanup],
};

// the automation body is built in its pre-request script (boolean + nullable id from variables)
let out = JSON.stringify(collection, null, 2);
out = out.replace('"raw": "\\"__AUTOMATION_BODY__\\""', '"raw": "{{automationBody}}"');
if (out.includes('__AUTOMATION_BODY__')) throw new Error('automation body placeholder not replaced');

writeFileSync(OUT, `${out}\n`);
const count = collection.item.reduce((n, f) => n + f.item.length, 0);
console.log(`wrote ${OUT}: ${collection.item.length} folders, ${count} requests`);
