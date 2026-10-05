"""Go-live §6.1: Lead ID is GCC-L-0000001 (sequential). Renumbers LD-000123 → GCC-L-0000123."""
import re

from django.db import migrations


def forwards(apps, schema_editor):
    Lead = apps.get_model('leads', 'Lead')
    for lead in Lead.objects.filter(lead_no__startswith='LD-').only('id', 'lead_no'):
        match = re.match(r'^LD-(\d+)$', lead.lead_no)
        if match:
            Lead.objects.filter(pk=lead.pk).update(lead_no=f'GCC-L-{int(match.group(1)):07d}')


def backwards(apps, schema_editor):
    Lead = apps.get_model('leads', 'Lead')
    for lead in Lead.objects.filter(lead_no__startswith='GCC-L-').only('id', 'lead_no'):
        Lead.objects.filter(pk=lead.pk).update(lead_no=f"LD-{int(lead.lead_no[6:]):06d}")


class Migration(migrations.Migration):
    dependencies = [('leads', '0004_call_exportjob_fieldchange_leaddiscussion_and_more')]
    operations = [migrations.RunPython(forwards, backwards)]
