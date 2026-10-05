"""
Sends due follow-up reminders, overdue alerts, team-leader escalations and
untouched-lead alerts. Schedule it every minute in production (cron / Windows
Task Scheduler), or run `--loop` as a small worker process.
"""
import time

from django.core.management.base import BaseCommand

from apps.tasks.reminders import process_due


class Command(BaseCommand):
    help = 'Send due follow-up reminders and overdue / untouched alerts.'

    def add_arguments(self, parser):
        parser.add_argument('--loop', action='store_true', help='keep running, once every --interval seconds')
        parser.add_argument('--interval', type=int, default=60)

    def handle(self, *args, loop=False, interval=60, **options):
        while True:
            sent = process_due()
            self.stdout.write(', '.join(f'{k}: {v}' for k, v in sent.items()))
            if not loop:
                return
            time.sleep(interval)
