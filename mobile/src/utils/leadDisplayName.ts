/**
 * Generate a display name from a phone number.
 * e.g. "User 2816" from "+256712342816"
 */
export function leadDisplayName(phone: string | undefined | null): string {
  if (!phone) return "Unknown";
  const digits = phone.replace(/[^0-9]/g, "");
  const last4 = digits.slice(-4);
  return last4 ? `User ${last4}` : "Unknown";
}
