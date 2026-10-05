import { Request } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/respond';
import { audit } from '../services/audit.service';
import { ActorContext } from '../services/lead.service';
import * as profileService from '../services/leadProfile.service';

function actorOf(req: Request): ActorContext {
  const u = req.user!;
  return {
    id: u.id,
    name: u.name,
    isSuperAdmin: u.isSuperAdmin,
    dataScope: u.dataScope,
    fieldRules: u.fieldRules,
    team: u.team,
  };
}

export const get = asyncHandler(async (req, res) => {
  ok(res, 'Profile fetched successfully', await profileService.getProfile(actorOf(req), req.params.id));
});

const saveStep = (step: profileService.ProfileStep, label: string) =>
  asyncHandler(async (req, res) => {
    const { before, profile } = await profileService.saveStep(actorOf(req), req.params.id, step, req.body);
    audit(req, {
      action: `profile_${step}`,
      module: 'leads',
      entityType: 'LeadProfile',
      entityId: req.params.id,
      before: before ?? undefined,
      after: req.body,
    });
    ok(res, `${label} saved`, profile);
  });

export const savePersonal = saveStep('personal', 'Personal information');
export const saveAcademic = saveStep('academic', 'Academic information');
export const saveWork = saveStep('work', 'Work experience');

export const declare = asyncHandler(async (req, res) => {
  const profile = await profileService.acceptDeclaration(actorOf(req), req.params.id);
  audit(req, { action: 'profile_declaration', module: 'leads', entityType: 'LeadProfile', entityId: req.params.id });
  ok(res, 'Declaration accepted', profile);
});

export const unlock = asyncHandler(async (req, res) => {
  const profile = await profileService.unlockProfile(actorOf(req), req.params.id, req.body.reason);
  audit(req, {
    action: 'profile_unlock',
    module: 'leads',
    entityType: 'LeadProfile',
    entityId: req.params.id,
    after: { reason: req.body.reason },
  });
  ok(res, 'Profile unlocked', profile);
});
