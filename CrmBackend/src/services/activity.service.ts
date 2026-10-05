import { Types } from 'mongoose';
import { ActivityType, LeadActivity } from '../models/LeadActivity';
import { Lead } from '../models/Lead';
import logger from '../config/logger';

interface ActivityInput {
  type: ActivityType;
  title: string;
  description?: string;
  data?: Record<string, unknown>;
  actor?: string;
  actorType?: 'user' | 'system' | 'student';
  actorName?: string;
}

/** Appends to the lead timeline and bumps lastActivityAt. Never throws. */
export async function logActivity(leadId: Types.ObjectId | string, input: ActivityInput): Promise<void> {
  try {
    await LeadActivity.create({
      lead: leadId,
      actorType: input.actor ? 'user' : (input.actorType ?? 'system'),
      ...input,
    });
    await Lead.updateOne({ _id: leadId }, { lastActivityAt: new Date() });
  } catch (err) {
    logger.error(`Activity write failed for lead ${leadId}: ${(err as Error).message}`);
  }
}
