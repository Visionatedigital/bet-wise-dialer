// Utility functions for formatting data

// Format Ugandan Shillings
export const formatUGX = (amount: number): string => {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// Format date/time in Kampala timezone
export const formatKampalaTime = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-UG', {
    timeZone: 'Africa/Kampala',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(d);
};

// Format call duration
export const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Mask phone numbers for agent-facing UI
export const maskPhone = (phone: string): string => {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  // Uganda +256 format: show country code + first 3 digits, mask middle 3, show last 3
  if (digits.startsWith('256') && digits.length >= 9) {
    const p = digits.slice(3); // remove 256
    const first = p.slice(0, 3);
    const last = p.slice(-3);
    return `+256 ${first} XXX ${last}`;
  }
  // Generic mask: keep first 3 and last 3
  return phone.replace(/(\+?\d{3})\d+(\d{3})/, '$1 XXX $2');
};

// Safe display name so agents never see phone numbers as names
export const safeDisplayName = (name?: string): string => {
  const n = (name || '').trim();
  if (!n) return 'Customer';
  // If it's mostly digits or matches a phone-like pattern, hide it
  const digits = n.replace(/\D/g, '');
  const looksLikePhone = /^\+?\d[\d\s\-()]+$/.test(n) || digits.length >= 7;
  if (looksLikePhone) return 'Customer';
  return n;
};
