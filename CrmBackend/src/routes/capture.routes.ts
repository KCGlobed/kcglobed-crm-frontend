import { Router } from 'express';
import * as controller from '../controllers/lead.controller';
import { requireCaptureKey } from '../middlewares/apiKey';
import { validate } from '../middlewares/validate';
import { captureLeadSchema } from '../validators/lead.schema';

/**
 * Public multi-source capture (SOW ID 10): website, landing pages and the
 * Meta/Google connectors all post here with the shared API key.
 * The connector webhooks reuse the same handler with a fixed channel.
 */
const router = Router();

router.post('/leads/capture', requireCaptureKey, validate(captureLeadSchema), controller.capture);

router.post(
  '/webhooks/meta-leads',
  requireCaptureKey,
  (req, _res, next) => {
    req.body.channel = 'meta';
    next();
  },
  validate(captureLeadSchema),
  controller.capture
);

router.post(
  '/webhooks/google-leads',
  requireCaptureKey,
  (req, _res, next) => {
    req.body.channel = 'google';
    next();
  },
  validate(captureLeadSchema),
  controller.capture
);

export default router;
