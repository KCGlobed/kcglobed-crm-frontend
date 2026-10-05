import nodemailer from 'nodemailer';
import { env } from '../config/env';
import logger from '../config/logger';

interface MailOptions {
  to: string;
  subject: string;
  html: string;
}

/**
 * Mail adapter: uses SMTP when configured, otherwise logs the message so
 * flows like password reset remain testable in development.
 */
export async function sendMail({ to, subject, html }: MailOptions): Promise<void> {
  if (!env.smtp.host) {
    logger.info(`[mail:dev] To: ${to} | Subject: ${subject}\n${html}`);
    return;
  }
  const transport = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.port === 465,
    auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
  });
  await transport.sendMail({ from: env.smtp.from, to, subject, html });
}
