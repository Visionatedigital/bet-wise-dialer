// Utility functions for formatting data

import { COUNTRY_MAP } from '@/config/countries';

export const CURRENCY_SYMBOLS: Record<string, string> = {
  UGX: 'UGX',
  GHS: 'GH¢',
  NGN: '₦',
  TZS: 'TZS',
  KES: 'KSh',
};

// Format an amount in the currency for the given country code (e.g. 'UG', 'NG')
export const formatCurrency = (amount: number, countryCode: string): string => {
  const currency = COUNTRY_MAP[countryCode]?.currency ?? 'UGX';
  const symbol = CURRENCY_SYMBOLS[currency] || currency;
  const formatted = new Intl.NumberFormat('en', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
  return `${symbol} ${formatted}`;
};

export const getCurrentCountryCode = (): string => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('bangbet_user_country') || 'UG';
  }
  return 'UG';
};

// Format branch currency based on current user context
export const formatUGX = (amount: number): string => {
  const countryCode = getCurrentCountryCode();
  return formatCurrency(amount, countryCode);
};

// Format date/time in Kampala/branch timezone
export const formatKampalaTime = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const countryCode = getCurrentCountryCode();
  const tz = COUNTRY_MAP[countryCode]?.timezone || 'Africa/Kampala';
  return new Intl.DateTimeFormat('en-UG', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(d);
};

// Get current time in EAT (East Africa Time, UTC+3) or other local timezone
// This ensures timestamps are always saved in the correct timezone
// regardless of the agent's computer timezone settings
export const getEATTimestamp = (): string => {
  const now = new Date();
  return now.toISOString();
};

// Format date/time for display in branch timezone
// Converts UTC timestamps from database to local branch timezone for display
export const formatEAT = (dateString: string): string => {
  if (!dateString) return 'N/A';
  
  const date = new Date(dateString);
  
  if (isNaN(date.getTime())) {
    return 'Invalid Date';
  }
  
  const countryCode = getCurrentCountryCode();
  const c = COUNTRY_MAP[countryCode] || COUNTRY_MAP['UG'];
  const tz = c.timezone;
  
  // Get offset in hours
  const COUNTRY_OFFSETS: Record<string, number> = {
    UG: 3,
    KE: 3,
    TZ: 3,
    NG: 1,
    GH: 0,
  };
  const offsetHours = COUNTRY_OFFSETS[countryCode] ?? 3;
  
  // Subtract the offset hours to account for timestamps being stored as if local time was UTC
  const correctedDate = new Date(date.getTime() - (offsetHours * 60 * 60 * 1000));
  
  // Now convert to branch timezone for display
  return correctedDate.toLocaleString('en-US', {
    timeZone: tz,
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

// Mask phone numbers for agent-facing UI (multi-country)
export const maskPhone = (phone: string): string => {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  const prefixes: [string, string][] = [
    ['256', 'UG'], ['233', 'GH'], ['234', 'NG'], ['255', 'TZ'], ['254', 'KE'],
  ];
  for (const [dial] of prefixes) {
    if (digits.startsWith(dial) && digits.length > dial.length + 4) {
      const local = digits.slice(dial.length);
      const first = local.slice(0, 3);
      const last = local.slice(-3);
      return `+${dial} ${first} XXX ${last}`;
    }
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
