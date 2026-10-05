/**
 * Idempotent seed: bootstraps the super admin, the SOW "Roles & Access" permission
 * templates, default masters (stages, dispositions, sources, programs, cohorts, tags),
 * a demo team with counsellors, and a dozen sample leads (only when the DB has none).
 *
 * Run: npm run seed
 */
import bcrypt from 'bcryptjs';
import { connectDatabase, disconnectDatabase } from '../config/db';
import logger from '../config/logger';
import { User } from '../models/User';
import { Team } from '../models/Team';
import { PermissionTemplate } from '../models/PermissionTemplate';
import { Cohort, Disposition, Program, Source, Stage, Tag } from '../models/masters';
import { Lead } from '../models/Lead';
import { LeadActivity } from '../models/LeadActivity';
import { nextSequence } from '../models/Counter';
import { LEAD_STAGES } from './leadStages';
import { ActionKey, ModuleKey, ModulePermission } from '../constants/permissions';

const p = (module: ModuleKey, ...actions: ActionKey[]): ModulePermission => ({ module, actions });

const DEMO_PASSWORD = 'Welcome@123';

async function seedTemplates() {
  const templates = [
    {
      key: 'admissions-admin',
      name: 'Admissions Admin',
      description: 'Full operational access across the candidate journey; view-only on settings.',
      dataScope: 'all' as const,
      permissions: [
        p('dashboard', 'view'),
        p('leads', 'view', 'create', 'edit', 'export', 'import', 'reassign'),
        p('tasks', 'view', 'create', 'edit'),
        p('applications', 'view', 'edit', 'approve'),
        p('documents', 'view', 'edit', 'approve'),
        p('exams', 'view', 'edit'),
        p('interviews', 'view', 'create', 'edit', 'approve'),
        p('offers', 'view', 'create', 'edit'),
        p('payments', 'view'),
        p('loans', 'view', 'edit'),
        p('reports', 'view', 'export'),
        p('users', 'view'),
        p('teams', 'view'),
        p('masters', 'view'),
        p('audit', 'view'),
      ],
      fieldRules: [],
    },
    {
      key: 'team-leader',
      name: 'Team Leader',
      description: 'Runs a counselling team: team-scoped leads, reassignment, team reports.',
      dataScope: 'team' as const,
      permissions: [
        p('dashboard', 'view'),
        p('leads', 'view', 'create', 'edit', 'export', 'reassign'),
        p('tasks', 'view', 'create', 'edit'),
        p('applications', 'view'),
        p('exams', 'view'),
        p('interviews', 'view', 'create', 'edit'),
        p('offers', 'view'),
        p('payments', 'view'),
        p('loans', 'view'),
        p('reports', 'view', 'export'),
        p('masters', 'view'),
      ],
      fieldRules: [],
    },
    {
      key: 'counsellor',
      name: 'Counsellor',
      description: 'Works own leads: add, counsel, follow up. No export, no reassignment.',
      dataScope: 'own' as const,
      permissions: [
        p('dashboard', 'view'),
        p('leads', 'view', 'create', 'edit'),
        p('tasks', 'view', 'create', 'edit'),
        p('applications', 'view'),
        p('exams', 'view'),
        p('interviews', 'view', 'create'),
        p('offers', 'view'),
        p('payments', 'view'),
        p('loans', 'view'),
        p('masters', 'view'),
      ],
      fieldRules: [],
    },
    {
      key: 'marketing',
      name: 'Marketing',
      description: 'Read-only lead book with masked contacts; owns sources, campaigns and imports.',
      dataScope: 'all' as const,
      permissions: [
        p('dashboard', 'view'),
        p('leads', 'view', 'import', 'export'),
        p('communications', 'view', 'create', 'edit'),
        p('reports', 'view', 'export'),
        p('masters', 'view', 'create', 'edit'),
      ],
      fieldRules: [
        { field: 'mobile', mode: 'masked' as const },
        { field: 'email', mode: 'masked' as const },
      ],
    },
    {
      key: 'finance',
      name: 'Finance',
      description: 'Payment configuration, reconciliation and finance reporting.',
      dataScope: 'all' as const,
      permissions: [
        p('dashboard', 'view'),
        p('payments', 'view', 'create', 'edit', 'approve', 'export'),
        p('offers', 'view'),
        p('loans', 'view'),
        p('reports', 'view', 'export'),
      ],
      fieldRules: [],
    },
    {
      key: 'interviewer',
      name: 'Interviewer',
      description: 'Sees own interview panel: evaluations, decisions, exam scorecards.',
      dataScope: 'own' as const,
      permissions: [
        p('dashboard', 'view'),
        p('interviews', 'view', 'edit', 'approve'),
        p('exams', 'view'),
      ],
      fieldRules: [],
    },
    {
      key: 'support',
      name: 'Support',
      description: 'Handles candidate queries; sees own tasks and tickets.',
      dataScope: 'own' as const,
      permissions: [p('dashboard', 'view'), p('tasks', 'view', 'create', 'edit'), p('leads', 'view')],
      fieldRules: [],
    },
  ];

  for (const t of templates) {
    await PermissionTemplate.findOneAndUpdate(
      { key: t.key },
      { ...t, isSystem: true },
      { upsert: true, returnDocument: 'after' }
    );
  }
  logger.info(`Seeded ${templates.length} permission templates`);
}

/**
 * Lead stages from the Lead Stages sheet (seed/leadStages.ts). Sub-stages are
 * matched by name so their ids — referenced by leads — survive a re-seed.
 * Stages no longer in the list are deactivated (never deleted) and any lead
 * still sitting in one moves to Untouched with a timeline entry.
 */
async function seedStages() {
  for (const [i, def] of LEAD_STAGES.entries()) {
    const existing = await Stage.findOne({ name: def.name });
    const subStages = def.subStages.map((ss) => {
      const prev = existing?.subStages.find((e) => e.name === ss.name);
      return { ...(prev ? { _id: prev._id } : {}), name: ss.name, counsellorAction: ss.counsellorAction, isActive: true };
    });
    await Stage.findOneAndUpdate(
      { name: def.name },
      { name: def.name, type: def.type, color: def.color, order: i + 1, isSystem: !!def.isSystem, isActive: true, subStages },
      { upsert: true }
    );
  }

  const names = LEAD_STAGES.map((st) => st.name);
  const retired = await Stage.find({ name: { $nin: names }, isActive: true }).select('_id name').lean();
  if (retired.length) {
    await Stage.updateMany({ _id: { $in: retired.map((r) => r._id) } }, { isActive: false });
    logger.info(`Deactivated old stages: ${retired.map((r) => r.name).join(', ')}`);
  }

  const untouched = await Stage.findOne({ name: 'Untouched' }).lean();
  const inactiveIds = (await Stage.find({ isActive: false }).select('_id name').lean());
  const stranded = await Lead.find({ stage: { $in: inactiveIds.map((st) => st._id) } }).select('_id stage').lean();
  for (const lead of stranded) {
    const old = inactiveIds.find((st) => String(st._id) === String(lead.stage));
    await Lead.updateOne(
      { _id: lead._id },
      { stage: untouched!._id, subStage: null, status: 'active', stageChangedAt: new Date() }
    );
    await LeadActivity.create({
      lead: lead._id,
      type: 'stage_change',
      title: `Stage changed: ${old?.name ?? '—'} → Untouched (stage list updated)`,
      actorType: 'system',
      data: { from: old?.name, to: 'Untouched' },
    });
  }
  if (stranded.length) logger.info(`Moved ${stranded.length} lead(s) from retired stages to Untouched`);
}

async function seedMasters() {
  await seedStages();

  const dispositions: [string, boolean][] = [
    ['Connected — Interested', true],
    ['Connected — Not Interested', false],
    ['Connected — Follow-up Scheduled', true],
    ['Call Back Later', true],
    ['Not Reachable', true],
    ['Switched Off', true],
    ['Busy', true],
    ['No Answer', true],
    ['Wrong Number', false],
    ['Do Not Call', false],
  ];
  for (const [i, [name, requiresFollowUp]] of dispositions.entries()) {
    await Disposition.findOneAndUpdate(
      { name },
      { name, requiresFollowUp, sortOrder: i + 1 },
      { upsert: true }
    );
  }

  const sources: [string, string][] = [
    ['Website', 'organic'],
    ['Landing Page', 'paid'],
    ['Google Ads', 'paid'],
    ['Meta Ads', 'paid'],
    ['Referral', 'referral'],
    ['Channel Partner', 'partner'],
    ['Walk-in', 'direct'],
    ['Event', 'event'],
    ['Other', 'other'],
  ];
  for (const [i, [name, channel]] of sources.entries()) {
    await Source.findOneAndUpdate({ name }, { name, channel, sortOrder: i + 1 }, { upsert: true });
  }

  const programs: [string, string, number][] = [
    ['Global MBA', 'GMBA', 18],
    ['BBA Global', 'BBAG', 36],
    ['Executive MBA', 'EMBA', 12],
  ];
  for (const [name, code, durationMonths] of programs) {
    await Program.findOneAndUpdate({ code }, { name, code, durationMonths }, { upsert: true });
  }

  const gmba = await Program.findOne({ code: 'GMBA' });
  const bbag = await Program.findOne({ code: 'BBAG' });
  if (gmba) {
    await Cohort.findOneAndUpdate(
      { program: gmba._id, name: 'Jan 2027' },
      { program: gmba._id, name: 'Jan 2027', startDate: new Date('2027-01-11'), capacity: 120, status: 'open' },
      { upsert: true }
    );
    await Cohort.findOneAndUpdate(
      { program: gmba._id, name: 'Apr 2027' },
      { program: gmba._id, name: 'Apr 2027', startDate: new Date('2027-04-05'), capacity: 120, status: 'planned' },
      { upsert: true }
    );
  }
  if (bbag) {
    await Cohort.findOneAndUpdate(
      { program: bbag._id, name: 'Jul 2027' },
      { program: bbag._id, name: 'Jul 2027', startDate: new Date('2027-07-12'), capacity: 180, status: 'planned' },
      { upsert: true }
    );
  }

  const tags: [string, string][] = [
    ['Hot', '#ef4444'],
    ['Warm', '#f59e0b'],
    ['Cold', '#64748b'],
    ['Priority', '#8b5cf6'],
    ['NRI', '#0ea5e9'],
    ['Scholarship', '#22c55e'],
  ];
  for (const [i, [name, color]] of tags.entries()) {
    await Tag.findOneAndUpdate({ name }, { name, color, sortOrder: i + 1 }, { upsert: true });
  }

  logger.info('Seeded masters (stages, dispositions, sources, programs, cohorts, tags)');
}

async function seedUsers() {
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? 'admin@gccschool.com').toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@12345';

  let admin = await User.findOne({ email: adminEmail });
  if (!admin) {
    admin = await User.create({
      name: 'Super Admin',
      email: adminEmail,
      passwordHash: await bcrypt.hash(adminPassword, 10),
      isSuperAdmin: true,
      dataScope: 'all',
      designation: 'Super Admin',
    });
    logger.info(`Created super admin: ${adminEmail}`);
  }

  // Admissions department → Team A, so the hierarchy view has two levels.
  let department = await Team.findOne({ name: 'Admissions' });
  if (!department) {
    department = await Team.create({ name: 'Admissions', code: 'ADM', type: 'department', location: 'Mumbai' });
  }
  let team = await Team.findOne({ name: 'Admissions Team A' });
  if (!team) {
    team = await Team.create({ name: 'Admissions Team A', location: 'Mumbai' });
  }
  if (!team.parent || !team.code) {
    await Team.updateOne(
      { _id: team._id },
      { $set: { parent: team.parent ?? department._id, code: team.code ?? 'ADM-A', type: 'team' } }
    );
  }

  const templates = new Map(
    (await PermissionTemplate.find().lean()).map((t) => [t.key, t])
  );

  const demoUsers: {
    name: string;
    email: string;
    templateKey: string;
    receivesLeads?: boolean;
    designation: string;
  }[] = [
    { name: 'Tanvi Rao', email: 'tanvi.tl@gccschool.com', templateKey: 'team-leader', designation: 'Team Leader' },
    { name: 'Arjun Mehta', email: 'arjun.c@gccschool.com', templateKey: 'counsellor', receivesLeads: true, designation: 'Counsellor' },
    { name: 'Sara Khan', email: 'sara.c@gccschool.com', templateKey: 'counsellor', receivesLeads: true, designation: 'Counsellor' },
    { name: 'Dev Patel', email: 'dev.mkt@gccschool.com', templateKey: 'marketing', designation: 'Marketing Manager' },
  ];

  const createdUsers: Record<string, InstanceType<typeof User>> = {};
  for (const d of demoUsers) {
    let user = await User.findOne({ email: d.email });
    if (!user) {
      const template = templates.get(d.templateKey);
      user = await User.create({
        name: d.name,
        email: d.email,
        passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10),
        designation: d.designation,
        team: team._id,
        receivesLeads: d.receivesLeads ?? false,
        templateKey: d.templateKey,
        permissions: template?.permissions ?? [],
        dataScope: template?.dataScope ?? 'own',
        fieldRules: template?.fieldRules ?? [],
        createdBy: admin._id,
      });
      logger.info(`Created demo user ${d.email} (${d.templateKey}) — password: ${DEMO_PASSWORD}`);
    }
    createdUsers[d.templateKey + ':' + d.email] = user;
  }

  // Team leader manages the team; counsellors report to them.
  const leader = await User.findOne({ email: 'tanvi.tl@gccschool.com' });
  if (leader) {
    await Team.updateOne({ _id: team._id }, { manager: leader._id });
    await User.updateMany(
      { email: { $in: ['arjun.c@gccschool.com', 'sara.c@gccschool.com'] } },
      { reportingManager: leader._id }
    );
  }

  return { admin, team };
}

async function seedSampleLeads() {
  const count = await Lead.countDocuments();
  if (count > 0) {
    logger.info(`Skipping sample leads (${count} leads already exist)`);
    return;
  }

  const [stages, sources, programs, counsellors] = await Promise.all([
    Stage.find({ isActive: true }).sort({ order: 1 }).lean(),
    Source.find().lean(),
    Program.find().lean(),
    User.find({ receivesLeads: true }).lean(),
  ]);
  const stageByName = (n: string) => stages.find((s) => s.name === n)?._id;
  const sourceByName = (n: string) => sources.find((s) => s.name === n)?._id;
  const programByCode = (c: string) => programs.find((pr) => pr.code === c)?._id;

  const samples = [
    { firstName: 'Aarav', lastName: 'Sharma', mobile: '9820011001', email: 'aarav.sharma@example.com', city: 'Mumbai', source: 'Google Ads', stage: 'Untouched', program: 'GMBA', track: 'ads', utm: { source: 'google', medium: 'cpc', campaign: 'gmba-jan27' } },
    { firstName: 'Diya', lastName: 'Iyer', mobile: '9820011002', email: 'diya.iyer@example.com', city: 'Chennai', source: 'Meta Ads', stage: 'Interested', subStage: 'Call Back', program: 'GMBA', track: 'ads', utm: { source: 'facebook', medium: 'paid-social', campaign: 'gmba-lookalike' } },
    { firstName: 'Kabir', lastName: 'Verma', mobile: '9820011003', email: 'kabir.verma@example.com', city: 'Delhi', source: 'Channel Partner', stage: 'NFET', subStage: 'NFET scheduled', program: 'GMBA', track: 'partner', referral: { code: 'CP-204', partnerName: 'EduBridge Consultants' } },
    { firstName: 'Ananya', lastName: 'Nair', mobile: '9820011004', email: 'ananya.nair@example.com', city: 'Kochi', source: 'Website', stage: 'Interested', subStage: 'Parents Counselling Stage', program: 'BBAG', track: 'other' },
    { firstName: 'Vihaan', lastName: 'Gupta', mobile: '9820011005', email: 'vihaan.g@example.com', city: 'Pune', source: 'Referral', stage: 'NFET', subStage: 'NFET profile pending', program: 'GMBA', track: 'other', referral: { code: 'REF-88' } },
    { firstName: 'Zara', lastName: 'Sheikh', mobile: '9820011006', email: 'zara.sheikh@example.com', city: 'Hyderabad', source: 'Landing Page', stage: 'Not Connected', subStage: 'Ringing / No answer', program: 'EMBA', track: 'ads', utm: { source: 'google', medium: 'cpc', campaign: 'emba-working-pros', landingPage: '/emba' } },
    { firstName: 'Ishaan', lastName: 'Reddy', mobile: '9820011007', email: 'ishaan.reddy@example.com', city: 'Bengaluru', source: 'Event', stage: 'Interview', subStage: 'Interview Slot Booked', program: 'GMBA', track: 'other' },
    { firstName: 'Myra', lastName: 'Joshi', mobile: '9820011008', email: 'myra.joshi@example.com', city: 'Ahmedabad', source: 'Channel Partner', stage: 'NFET', subStage: 'NFET appeared - result awaited', program: 'BBAG', track: 'partner', referral: { code: 'CP-112', partnerName: 'CareerLaunch' } },
    { firstName: 'Advait', lastName: 'Kulkarni', mobile: '9820011009', email: 'advait.k@example.com', city: 'Nagpur', source: 'Google Ads', stage: 'Interview', subStage: 'Interview Cleared', program: 'GMBA', track: 'ads' },
    { firstName: 'Riya', lastName: 'Chatterjee', mobile: '9820011010', email: 'riya.c@example.com', city: 'Kolkata', source: 'Website', stage: 'Closed - Lost', subStage: 'Fee concern', program: 'BBAG', track: 'other' },
    { firstName: 'Aditya', lastName: 'Singh', mobile: '9820011011', email: 'aditya.singh@example.com', city: 'Lucknow', source: 'Meta Ads', stage: 'PPO', subStage: 'Pre-Placement Offer (PPO) letter issued', program: 'GMBA', track: 'ads' },
    { firstName: 'Navya', lastName: 'Menon', mobile: '9820011012', email: 'navya.menon@example.com', city: 'Thiruvananthapuram', source: 'Walk-in', stage: 'Enrolled', subStage: 'Admission confirmed - seat allotted', program: 'EMBA', track: 'other' },
  ];

  for (const [i, s] of samples.entries()) {
    const seq = await nextSequence('lead');
    const owner = counsellors.length ? counsellors[i % counsellors.length]._id : undefined;
    const stageId = stageByName(s.stage);
    const stageDoc = stages.find((st) => String(st._id) === String(stageId));
    const subStageId = stageDoc?.subStages.find((ss) => ss.name === s.subStage)?._id;
    const lead = await Lead.create({
      leadNo: `LD-${String(seq).padStart(6, '0')}`,
      firstName: s.firstName,
      lastName: s.lastName,
      mobile: s.mobile,
      email: s.email,
      city: s.city,
      source: sourceByName(s.source),
      firstSource: sourceByName(s.source),
      utm: s.utm,
      referral: s.referral,
      track: s.track as 'ads' | 'partner' | 'other',
      programInterest: s.program ? programByCode(s.program) : undefined,
      stage: stageId,
      subStage: subStageId,
      stageChangedAt: new Date(),
      status: stageDoc?.type === 'converted' ? 'converted' : stageDoc?.type === 'lost' ? 'lost' : 'active',
      owner,
      assignedAt: owner ? new Date() : undefined,
      createdVia: 'manual',
      lastActivityAt: new Date(),
    });
    await LeadActivity.create({
      lead: lead._id,
      type: 'created',
      title: 'Lead created via seed data',
      actorType: 'system',
    });
  }
  logger.info(`Seeded ${samples.length} sample leads`);
}

async function main() {
  await connectDatabase();
  await seedTemplates();
  await seedMasters();
  await seedUsers();
  await seedSampleLeads();
  logger.info('Seed complete');
  logger.info(`Sign in as ${process.env.SEED_ADMIN_EMAIL ?? 'admin@gccschool.com'} / ${process.env.SEED_ADMIN_PASSWORD ?? 'Admin@12345'}`);
  await disconnectDatabase();
}

main().catch(async (err) => {
  logger.error(`Seed failed: ${err.message}`, { stack: err.stack });
  await disconnectDatabase();
  process.exit(1);
});
