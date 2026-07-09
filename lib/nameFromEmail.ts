// Guesses a display name from an email address — used to save retyping a
// name that's usually already right there in the email. Always editable
// afterward; this is just a starting suggestion, not a source of truth.
export function deriveNameFromEmail(email: string): string {
  const local = email.trim().split("@")[0];
  if (!local) return "";
  const firstPart = local.split(/[._-]/)[0];
  if (!firstPart) return "";
  return firstPart.charAt(0).toUpperCase() + firstPart.slice(1).toLowerCase();
}
