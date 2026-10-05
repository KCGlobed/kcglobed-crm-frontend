/** Normalisers used for duplicate blocking (SOW ID 16): match on mobile and email. */

export function normalizeEmail(email?: string | null): string | undefined {
  const trimmed = email?.trim().toLowerCase();
  return trimmed || undefined;
}

/** Keeps digits only and strips a leading country code for 10-digit Indian numbers. */
export function normalizeMobile(mobile?: string | null): string | undefined {
  if (!mobile) return undefined;
  let digits = mobile.replace(/\D/g, '');
  if (digits.length > 10 && digits.startsWith('91')) digits = digits.slice(-10);
  if (digits.length > 10 && digits.startsWith('0')) digits = digits.replace(/^0+/, '');
  return digits || undefined;
}

export function maskMobile(mobile?: string): string | undefined {
  if (!mobile) return mobile;
  if (mobile.length <= 4) return '****';
  return `${'*'.repeat(mobile.length - 4)}${mobile.slice(-4)}`;
}

export function maskEmail(email?: string): string | undefined {
  if (!email) return email;
  const [local, domain] = email.split('@');
  if (!domain) return '****';
  const visible = local.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(2, local.length - 2))}@${domain}`;
}
