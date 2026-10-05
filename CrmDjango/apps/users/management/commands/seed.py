"""
Idempotent seed: the super admin, the SOW "Roles & Access" permission templates,
default masters (lead stages from the Lead Stages sheet, dispositions, sources,
programs, cohorts, tags), a demo team hierarchy with counsellors, and a dozen
sample leads (only when there are none).

Run: python manage.py seed
"""
import json
import os
from datetime import datetime, timezone
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone as dj_timezone

from apps.authentication.passwords import hash_password
from apps.leads.models import Counter, Lead, LeadActivity
from apps.masters.models import Cohort, Disposition, Program, Source, Stage, SubStage, Tag
from apps.teams.models import Team
from apps.users.models import PermissionTemplate, User

DEMO_PASSWORD = 'Welcome@123'
STAGES_FILE = Path(__file__).resolve().parents[3] / 'masters' / 'fixtures' / 'lead_stages.json'


def p(module: str, *actions: str) -> dict:
    return {'module': module, 'actions': list(actions)}


TEMPLATES = [
    {
        'key': 'admissions-admin', 'name': 'Admissions Admin',
        'description': 'Full operational access across the candidate journey; view-only on settings.',
        'dataScope': 'all', 'fieldRules': [],
        'permissions': [
            p('dashboard', 'view'), p('leads', 'view', 'create', 'edit', 'export', 'import', 'reassign'),
            p('tasks', 'view', 'create', 'edit'), p('applications', 'view', 'edit', 'approve'),
            p('documents', 'view', 'edit', 'approve'), p('exams', 'view', 'edit'),
            p('interviews', 'view', 'create', 'edit', 'approve'), p('offers', 'view', 'create', 'edit'),
            p('payments', 'view'), p('loans', 'view', 'edit'), p('reports', 'view', 'export'),
            p('users', 'view'), p('teams', 'view'), p('masters', 'view'), p('audit', 'view'),
        ],
    },
    {
        'key': 'team-leader', 'name': 'Team Leader',
        'description': 'Runs a counselling team: team-scoped leads, reassignment, team reports.',
        'dataScope': 'team', 'fieldRules': [],
        'permissions': [
            p('dashboard', 'view'), p('leads', 'view', 'create', 'edit', 'export', 'reassign'),
            p('tasks', 'view', 'create', 'edit'), p('applications', 'view'), p('exams', 'view'),
            p('interviews', 'view', 'create', 'edit'), p('offers', 'view'), p('payments', 'view'),
            p('loans', 'view'), p('reports', 'view', 'export'), p('masters', 'view'),
        ],
    },
    {
        'key': 'counsellor', 'name': 'Counsellor',
        'description': 'Works own leads: add, counsel, follow up. No export, no reassignment.',
        'dataScope': 'own', 'fieldRules': [],
        'permissions': [
            p('dashboard', 'view'), p('leads', 'view', 'create', 'edit'), p('tasks', 'view', 'create', 'edit'),
            p('applications', 'view'), p('exams', 'view'), p('interviews', 'view', 'create'), p('offers', 'view'),
            p('payments', 'view'), p('loans', 'view'), p('masters', 'view'),
        ],
    },
    {
        'key': 'marketing', 'name': 'Marketing',
        'description': 'Read-only lead book with masked contacts; owns sources, campaigns and imports.',
        'dataScope': 'all',
        'fieldRules': [{'field': 'mobile', 'mode': 'masked'}, {'field': 'email', 'mode': 'masked'}],
        'permissions': [
            p('dashboard', 'view'), p('leads', 'view', 'import', 'export'),
            p('communications', 'view', 'create', 'edit'), p('reports', 'view', 'export'),
            p('masters', 'view', 'create', 'edit'),
        ],
    },
    {
        'key': 'finance', 'name': 'Finance',
        'description': 'Payment configuration, reconciliation and finance reporting.',
        'dataScope': 'all', 'fieldRules': [],
        'permissions': [
            p('dashboard', 'view'), p('payments', 'view', 'create', 'edit', 'approve', 'export'),
            p('offers', 'view'), p('loans', 'view'), p('reports', 'view', 'export'),
        ],
    },
    {
        'key': 'interviewer', 'name': 'Interviewer',
        'description': 'Sees own interview panel: evaluations, decisions, exam scorecards.',
        'dataScope': 'own', 'fieldRules': [],
        'permissions': [p('dashboard', 'view'), p('interviews', 'view', 'edit', 'approve'), p('exams', 'view')],
    },
    {
        'key': 'support', 'name': 'Support',
        'description': 'Handles candidate queries; sees own tasks and tickets.',
        'dataScope': 'own', 'fieldRules': [],
        'permissions': [p('dashboard', 'view'), p('tasks', 'view', 'create', 'edit'), p('leads', 'view')],
    },
]

DISPOSITIONS = [
    ('Connected — Interested', True), ('Connected — Not Interested', False),
    ('Connected — Follow-up Scheduled', True), ('Call Back Later', True), ('Not Reachable', True),
    ('Switched Off', True), ('Busy', True), ('No Answer', True), ('Wrong Number', False), ('Do Not Call', False),
]
SOURCES = [
    ('Website', 'organic'), ('Landing Page', 'paid'), ('Google Ads', 'paid'), ('Meta Ads', 'paid'),
    ('Referral', 'referral'), ('Channel Partner', 'partner'), ('Walk-in', 'direct'), ('Event', 'event'),
    ('Inbound Call', 'direct'), ('Other', 'other'),
]
PROGRAMS = [('Global MBA', 'GMBA', 18), ('BBA Global', 'BBAG', 36), ('Executive MBA', 'EMBA', 12)]
TAGS = [
    ('Hot', '#ef4444'), ('Warm', '#f59e0b'), ('Cold', '#64748b'), ('Priority', '#8b5cf6'),
    ('NRI', '#0ea5e9'), ('Scholarship', '#22c55e'),
]
DEMO_USERS = [
    ('Tanvi Rao', 'tanvi.tl@gccschool.com', 'team-leader', False, 'Team Leader'),
    ('Arjun Mehta', 'arjun.c@gccschool.com', 'counsellor', True, 'Counsellor'),
    ('Sara Khan', 'sara.c@gccschool.com', 'counsellor', True, 'Counsellor'),
    ('Dev Patel', 'dev.mkt@gccschool.com', 'marketing', False, 'Marketing Manager'),
    ('Priya Nair', 'priya.admin@gccschool.com', None, False, 'Admissions Manager'),
    ('Neha Joshi', 'neha.c@gccschool.com', None, True, 'Admission Counsellor'),
]
# Go-live roles (§2) for the demo users
DEMO_ROLES = {
    'priya.admin@gccschool.com': 'admin',
    'arjun.c@gccschool.com': 'counsellor', 'sara.c@gccschool.com': 'counsellor', 'neha.c@gccschool.com': 'counsellor',
}

# GL-21/24 starter templates (DLT ids are placeholders until the vendor registers them)
MESSAGE_TEMPLATES = [
    ('sms', 'Welcome SMS', None, 'Hi {first_name}, thank you for your interest in GCC School. Our counsellor will call you shortly. Ref {lead_id}', '1107170000000000001'),
    ('email', 'Welcome email', 'Welcome to GCC School, {first_name}', '<p>Hi {first_name},</p><p>Thank you for your interest in <b>GCC School</b>. Your counsellor will reach out shortly.</p><p>Reference: {lead_id}</p>', None),
    ('sms', 'Counsellor assigned', None, 'Hi {first_name}, {counsellor_name} ({counsellor_mobile}) is your GCC School counsellor. Ref {lead_id}', '1107170000000000002'),
    ('sms', 'We tried to reach you', None, 'Hi {first_name}, we tried to reach you about GCC School. Call {counsellor_name} on {counsellor_mobile}.', '1107170000000000003'),
    ('email', 'Program details', 'Program details: {program_interest}', '<p>Hi {first_name},</p><p>Here are the details of <b>{program_interest}</b> you asked about.</p><p>{counsellor_name}<br>GCC School</p>', None),
    ('sms', 'Application received', None, 'Hi {first_name}, we have received your GCC School application. Ref {lead_id}', '1107170000000000004'),
    ('email', 'Application received', 'We received your application, {first_name}', '<p>Hi {first_name},</p><p>Your application ({lead_id}) has been received. We will be in touch soon.</p>', None),
    ('sms', 'Re-enquiry', None, 'Hi {first_name}, thanks for reaching out again. Your counsellor will call you shortly.', '1107170000000000005'),
]
# trigger → (channel → template name), and whether it starts On (§8.4 Default column)
AUTOMATION_DEFAULTS = {
    'lead_created': ({'sms': 'Welcome SMS', 'email': 'Welcome email'}, True),
    'lead_created_bulk': ({'sms': 'Welcome SMS', 'email': 'Welcome email'}, False),
    'lead_assigned': ({'sms': 'Counsellor assigned'}, True),
    'first_not_connected': ({'sms': 'We tried to reach you'}, True),
    'stage_interested': ({'email': 'Program details'}, True),
    'stage_application_submitted': ({'sms': 'Application received', 'email': 'Application received'}, True),
    're_enquired': ({'sms': 'Re-enquiry'}, True),
}

SAMPLE_LEADS = [
    dict(firstName='Aarav', lastName='Sharma', mobile='9820011001', email='aarav.sharma@example.com', city='Mumbai', source='Google Ads', stage='Untouched', program='GMBA', track='ads', utm={'source': 'google', 'medium': 'cpc', 'campaign': 'gmba-jan27'}),
    dict(firstName='Diya', lastName='Iyer', mobile='9820011002', email='diya.iyer@example.com', city='Chennai', source='Meta Ads', stage='Interested', subStage='Call Back', program='GMBA', track='ads', utm={'source': 'facebook', 'medium': 'paid-social', 'campaign': 'gmba-lookalike'}),
    dict(firstName='Kabir', lastName='Verma', mobile='9820011003', email='kabir.verma@example.com', city='Delhi', source='Channel Partner', stage='NFET', subStage='NFET scheduled', program='GMBA', track='partner', referral={'code': 'CP-204', 'partnerName': 'EduBridge Consultants'}),
    dict(firstName='Ananya', lastName='Nair', mobile='9820011004', email='ananya.nair@example.com', city='Kochi', source='Website', stage='Interested', subStage='Parents Counselling Stage', program='BBAG', track='other'),
    dict(firstName='Vihaan', lastName='Gupta', mobile='9820011005', email='vihaan.g@example.com', city='Pune', source='Referral', stage='NFET', subStage='NFET profile pending', program='GMBA', track='other', referral={'code': 'REF-88'}),
    dict(firstName='Zara', lastName='Sheikh', mobile='9820011006', email='zara.sheikh@example.com', city='Hyderabad', source='Landing Page', stage='Not Connected', subStage='Ringing / No answer', program='EMBA', track='ads', utm={'source': 'google', 'medium': 'cpc', 'campaign': 'emba-working-pros', 'landingPage': '/emba'}),
    dict(firstName='Ishaan', lastName='Reddy', mobile='9820011007', email='ishaan.reddy@example.com', city='Bengaluru', source='Event', stage='Interview', subStage='Interview Slot Booked', program='GMBA', track='other'),
    dict(firstName='Myra', lastName='Joshi', mobile='9820011008', email='myra.joshi@example.com', city='Ahmedabad', source='Channel Partner', stage='NFET', subStage='NFET appeared - result awaited', program='BBAG', track='partner', referral={'code': 'CP-112', 'partnerName': 'CareerLaunch'}),
    dict(firstName='Advait', lastName='Kulkarni', mobile='9820011009', email='advait.k@example.com', city='Nagpur', source='Google Ads', stage='Interview', subStage='Interview Cleared', program='GMBA', track='ads'),
    dict(firstName='Riya', lastName='Chatterjee', mobile='9820011010', email='riya.c@example.com', city='Kolkata', source='Website', stage='Closed - Lost', subStage='Fee concern', program='BBAG', track='other'),
    dict(firstName='Aditya', lastName='Singh', mobile='9820011011', email='aditya.singh@example.com', city='Lucknow', source='Meta Ads', stage='PPO', subStage='Pre-Placement Offer (PPO) letter issued', program='GMBA', track='ads'),
    dict(firstName='Navya', lastName='Menon', mobile='9820011012', email='navya.menon@example.com', city='Thiruvananthapuram', source='Walk-in', stage='Enrolled', subStage='Admission confirmed - seat allotted', program='EMBA', track='other'),
]


class Command(BaseCommand):
    help = 'Seed templates, masters, demo users and sample leads (idempotent).'

    @transaction.atomic
    def handle(self, *args, **options):
        self.seed_templates()
        self.seed_stages()
        self.seed_masters()
        self.seed_users()
        self.seed_messaging()
        self.seed_sample_leads()
        email = os.environ.get('SEED_ADMIN_EMAIL', 'admin@gccschool.com')
        password = os.environ.get('SEED_ADMIN_PASSWORD', 'Admin@12345')
        self.stdout.write(self.style.SUCCESS(f'Seed complete. Sign in as {email} / {password}'))

    def seed_templates(self):
        for t in TEMPLATES:
            PermissionTemplate.objects.update_or_create(key=t['key'], defaults={
                'name': t['name'], 'description': t['description'], 'permissions': t['permissions'],
                'data_scope': t['dataScope'], 'field_rules': t['fieldRules'], 'is_system': True,
            })
        self.stdout.write(f'Seeded {len(TEMPLATES)} permission templates')

    def seed_stages(self):
        """
        Lead stages from the Lead Stages sheet. Sub-stages are matched by name so
        their ids — referenced by leads — survive a re-seed. Stages no longer in
        the list are deactivated (never deleted) and their leads move to Untouched.
        """
        definitions = json.loads(STAGES_FILE.read_text(encoding='utf-8'))
        for i, d in enumerate(definitions):
            stage, _ = Stage.objects.update_or_create(name=d['name'], defaults={
                'type': d['type'], 'color': d['color'], 'order': i + 1,
                'is_system': bool(d.get('isSystem')), 'is_active': True,
            })
            existing = {s.name: s for s in stage.sub_stages.all()}
            keep = []
            for position, sub in enumerate(d['subStages']):
                obj = existing.get(sub['name']) or SubStage(stage=stage, name=sub['name'])
                obj.counsellor_action = sub['counsellorAction']
                obj.is_active = True
                obj.position = position
                obj.save()
                keep.append(obj.id)
            stage.sub_stages.exclude(pk__in=keep).delete()

        names = [d['name'] for d in definitions]
        retired = Stage.objects.filter(is_active=True).exclude(name__in=names)
        if retired.exists():
            self.stdout.write(f"Deactivated old stages: {', '.join(retired.values_list('name', flat=True))}")
            retired.update(is_active=False)

        untouched = Stage.objects.get(name='Untouched')
        stranded = Lead.objects.filter(stage__is_active=False).select_related('stage')
        for lead in stranded:
            old = lead.stage.name
            Lead.objects.filter(pk=lead.pk).update(
                stage=untouched, sub_stage=None, status='active', stage_changed_at=dj_timezone.now()
            )
            LeadActivity.objects.create(
                lead=lead, type='stage_change', title=f'Stage changed: {old} → Untouched (stage list updated)',
                actor_type='system', data={'from': old, 'to': 'Untouched'},
            )

    def seed_masters(self):
        for i, (name, requires) in enumerate(DISPOSITIONS):
            Disposition.objects.update_or_create(name=name, defaults={'requires_follow_up': requires, 'sort_order': i + 1})
        for i, (name, channel) in enumerate(SOURCES):
            Source.objects.update_or_create(name=name, defaults={'channel': channel, 'sort_order': i + 1})
        for name, code, months in PROGRAMS:
            Program.objects.update_or_create(code=code, defaults={'name': name, 'duration_months': months})

        gmba, bbag = Program.objects.get(code='GMBA'), Program.objects.get(code='BBAG')
        for program, name, start, capacity, status in [
            (gmba, 'Jan 2027', '2027-01-11', 120, 'open'),
            (gmba, 'Apr 2027', '2027-04-05', 120, 'planned'),
            (bbag, 'Jul 2027', '2027-07-12', 180, 'planned'),
        ]:
            Cohort.objects.update_or_create(program=program, name=name, defaults={
                'start_date': datetime.fromisoformat(start).replace(tzinfo=timezone.utc),
                'capacity': capacity, 'status': status,
            })
        for i, (name, color) in enumerate(TAGS):
            Tag.objects.update_or_create(name=name, defaults={'color': color, 'sort_order': i + 1})
        self.stdout.write('Seeded masters (stages, dispositions, sources, programs, cohorts, tags)')

    def seed_users(self):
        email = os.environ.get('SEED_ADMIN_EMAIL', 'admin@gccschool.com').lower()
        password = os.environ.get('SEED_ADMIN_PASSWORD', 'Admin@12345')
        admin = User.objects.filter(email=email).first()
        if not admin:
            admin = User.objects.create(
                name='Super Admin', email=email, password_hash=hash_password(password),
                is_super_admin=True, data_scope='all', designation='Super Admin',
            )
            self.stdout.write(f'Created super admin: {email}')

        # Admissions department → Team A, so the hierarchy view has two levels.
        department, _ = Team.objects.get_or_create(
            name='Admissions', defaults={'code': 'ADM', 'type': 'department', 'location': 'Mumbai'}
        )
        team, _ = Team.objects.get_or_create(name='Admissions Team A', defaults={'location': 'Mumbai'})
        if not team.parent_id or not team.code:
            team.parent_id = team.parent_id or department.id
            team.code = team.code or 'ADM-A'
            team.type = 'team'
            team.save()

        templates = {t.key: t for t in PermissionTemplate.objects.all()}
        for name, user_email, template_key, receives_leads, designation in DEMO_USERS:
            if User.objects.filter(email=user_email).exists():
                continue
            template = templates.get(template_key) if template_key else None
            User.objects.create(
                name=name, email=user_email, password_hash=hash_password(DEMO_PASSWORD), designation=designation,
                team=team, receives_leads=receives_leads, template_key=template_key,
                permissions=template.permissions if template else [],
                data_scope=template.data_scope if template else 'own',
                field_rules=template.field_rules if template else [],
                created_by=admin,
            )
            self.stdout.write(f'Created demo user {user_email} ({template_key}) — password: {DEMO_PASSWORD}')

        # Team leader manages the team; counsellors report to them.
        leader = User.objects.filter(email='tanvi.tl@gccschool.com').first()
        if leader:
            Team.objects.filter(pk=team.pk).update(manager=leader)
            User.objects.filter(email__in=['arjun.c@gccschool.com', 'sara.c@gccschool.com']).update(reporting_manager=leader)
        self.seed_roles(admin)

    def seed_roles(self, admin):
        from apps.users.services import _apply_role

        User.objects.filter(is_super_admin=True).update(role='super_admin')
        for email, role in DEMO_ROLES.items():
            user = User.objects.filter(email=email).first()
            if user and user.role != role:
                _apply_role(user, role)
                user.save()
                self.stdout.write(f'Role {role} for {email}')

    def seed_messaging(self):
        from apps.messaging.automations import ensure_rules
        from apps.messaging.models import AutomationRule, MessageTemplate

        for channel, name, subject, body, dlt in MESSAGE_TEMPLATES:
            MessageTemplate.objects.get_or_create(channel=channel, name=name, defaults={
                'subject': subject, 'body': body, 'dlt_template_id': dlt, 'sender_id': 'GCCSCH' if channel == 'sms' else None,
            })
        ensure_rules()
        for trigger, (by_channel, on) in AUTOMATION_DEFAULTS.items():
            for channel, template_name in by_channel.items():
                rule = AutomationRule.objects.get(trigger=trigger, channel=channel)
                if rule.template_id is None:
                    rule.template = MessageTemplate.objects.get(channel=channel, name=template_name)
                    rule.is_active = on
                    rule.save()
        self.stdout.write('Seeded message templates and automations')

    def seed_sample_leads(self):
        count = Lead.objects.count()
        if count:
            self.stdout.write(f'Skipping sample leads ({count} leads already exist)')
            return
        stages = {s.name: s for s in Stage.objects.filter(is_active=True).prefetch_related('sub_stages')}
        sources = {s.name: s for s in Source.objects.all()}
        programs = {pr.code: pr for pr in Program.objects.all()}
        counsellors = list(User.objects.filter(role='counsellor', is_active=True).order_by('id'))
        now = dj_timezone.now()

        for i, s in enumerate(SAMPLE_LEADS):
            stage = stages.get(s['stage'])
            sub = next((x for x in stage.sub_stages.all() if x.name == s.get('subStage')), None) if stage else None
            owner = counsellors[i % len(counsellors)] if counsellors else None
            source = sources.get(s['source'])
            lead = Lead.objects.create(
                lead_no=f"GCC-L-{Counter.next_range('lead'):07d}",
                first_name=s['firstName'], last_name=s['lastName'], mobile=s['mobile'], email=s['email'],
                city=s['city'], source=source, first_source=source, utm=s.get('utm', {}),
                referral=s.get('referral', {}), track=s['track'], program_interest=programs.get(s['program']),
                stage=stage, sub_stage=sub, stage_changed_at=now,
                status='converted' if stage and stage.type == 'converted' else 'lost' if stage and stage.type == 'lost' else 'active',
                owner=owner, assigned_at=now if owner else None, created_via='manual', last_activity_at=now,
            )
            LeadActivity.objects.create(lead=lead, type='created', title='Lead created via seed data', actor_type='system')
        self.stdout.write(f'Seeded {len(SAMPLE_LEADS)} sample leads')
