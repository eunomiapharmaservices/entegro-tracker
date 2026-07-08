// Change this to whichever email domain should be allowed to register.
export const ALLOWED_EMAIL_DOMAIN = "lumen.com";

export function isAllowedEmail(email: string): boolean {
  const e = email.trim().toLowerCase();
  return e.endsWith("@" + ALLOWED_EMAIL_DOMAIN);
}

export interface PasswordCheck {
  valid: boolean;
  issues: string[];
}

// Basic password standard: 8+ chars, at least one uppercase, one lowercase,
// one number. Not asking for special characters to keep it reasonable for a
// small internal team.
export function checkPassword(password: string): PasswordCheck {
  const issues: string[] = [];
  if (password.length < 8) issues.push("at least 8 characters");
  if (!/[A-Z]/.test(password)) issues.push("one uppercase letter");
  if (!/[a-z]/.test(password)) issues.push("one lowercase letter");
  if (!/[0-9]/.test(password)) issues.push("one number");
  return { valid: issues.length === 0, issues };
}
