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

// Get current time in EAT (East Africa Time, UTC+3)
// This ensures timestamps are always saved in the correct timezone
// regardless of the agent's computer timezone settings
export const getEATTimestamp = (): string => {
  const now = new Date();
  // Get UTC time
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
  // Add 3 hours for EAT (UTC+3)
  const eatTime = new Date(utcTime + (3 * 60 * 60 * 1000));
  // Return as ISO string (this will be UTC, but represents EAT time)
  // Actually, we need to return it in a way that represents the EAT moment correctly
  // The best approach is to create a date string that represents the EAT time as UTC
  // But actually, PostgreSQL TIMESTAMP WITH TIME ZONE stores UTC internally
  // So we should save the actual UTC time that corresponds to the current EAT time
  // If it's 1:47 PM EAT, that's 10:47 AM UTC
  // So we need to subtract 3 hours from the current UTC time if the computer is in EAT
  // Or we can use the server's timezone
  
  // Actually, the simplest solution: use the current UTC time
  // The database will store it correctly as UTC
  // When displaying, we convert UTC to EAT
  return now.toISOString();
};

// Format date/time for display in EAT (East Africa Time)
// Converts UTC timestamps from database to EAT (UTC+3) for display
export const formatEAT = (dateString: string): string => {
  if (!dateString) return 'N/A';
  
  // Supabase returns TIMESTAMP WITH TIME ZONE as ISO strings
  // These are always in UTC format (ending with 'Z' or '+00:00')
  // Parse the date - JavaScript will interpret ISO strings as UTC
  const date = new Date(dateString);
  
  if (isNaN(date.getTime())) {
    return 'Invalid Date';
  }
  
  // If times are showing 3 hours ahead when they shouldn't be,
  // it means the stored timestamps might already be in EAT (not UTC)
  // OR Supabase is returning them in a different format
  
  // Based on debug logs, timestamps are being stored incorrectly:
  // They're stored as if EAT time is UTC (e.g., 1:41 PM EAT stored as 1:41 PM UTC)
  // Instead of being stored as UTC (e.g., 1:41 PM EAT should be 10:41 AM UTC)
  // 
  // To fix display: subtract 3 hours from the stored UTC time before converting to EAT
  // This compensates for the incorrect storage
  
  // Subtract 3 hours (10800000 ms) to account for timestamps being stored incorrectly
  const correctedDate = new Date(date.getTime() - (3 * 60 * 60 * 1000));
  
  // Now convert to EAT for display
  return correctedDate.toLocaleString('en-US', {
    timeZone: 'Africa/Kampala',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
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
