import { Request } from 'express';
import { AuditLog } from '../models/AuditLog';
import logger from '../config/logger';

interface AuditEntry {
  action: string;
  module: string;
  entityType?: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
}

/** Fire-and-forget audit write — an audit failure must never fail the request. */
export function audit(req: Request, entry: AuditEntry): void {
  AuditLog.create({
    actor: req.user?.id,
    actorName: req.user?.name ?? 'system',
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    ...entry,
  }).catch((err) => logger.error(`Audit write failed: ${err.message}`));
}
