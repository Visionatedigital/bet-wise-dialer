export interface CountryConfig {
  code: string;
  name: string;
  dialCode: string;   // without +
  flag: string;
  localLength: number; // digits after country code
  currency: string;
  timezone: string;
  supportNumber: string;
}

export const COUNTRIES: CountryConfig[] = [
  { code: 'UG', name: 'Uganda',   dialCode: '256', flag: '🇺🇬', localLength: 9,  currency: 'UGX', timezone: 'Africa/Kampala',       supportNumber: '+256 800 123456' },
  { code: 'GH', name: 'Ghana',    dialCode: '233', flag: '🇬🇭', localLength: 9,  currency: 'GHS', timezone: 'Africa/Accra',         supportNumber: '+233 800 123456' },
  { code: 'NG', name: 'Nigeria',  dialCode: '234', flag: '🇳🇬', localLength: 10, currency: 'NGN', timezone: 'Africa/Lagos',         supportNumber: '+234 800 123456' },
  { code: 'TZ', name: 'Tanzania', dialCode: '255', flag: '🇹🇿', localLength: 9,  currency: 'TZS', timezone: 'Africa/Dar_es_Salaam', supportNumber: '+255 800 123456' },
  { code: 'KE', name: 'Kenya',    dialCode: '254', flag: '🇰🇪', localLength: 9,  currency: 'KES', timezone: 'Africa/Nairobi',       supportNumber: '+254 800 123456' },
];

export const COUNTRY_OFFSETS: Record<string, number> = {
  UG: 3,
  KE: 3,
  TZ: 3,
  NG: 1,
  GH: 0,
};

export const COUNTRY_MAP: Record<string, CountryConfig> = Object.fromEntries(
  COUNTRIES.map(c => [c.code, c])
);

/** Detect country code from a raw phone number string */
export function detectCountryFromPhone(phone: string, defaultCountry = 'UG'): string {
  const d = phone.replace(/\D/g, '');
  if (d.startsWith('256')) return 'UG';
  if (d.startsWith('233')) return 'GH';
  if (d.startsWith('234')) return 'NG';
  if (d.startsWith('255')) return 'TZ';
  if (d.startsWith('254')) return 'KE';
  return defaultCountry; // default
}

/** Normalise a raw phone string to E.164 format for the given country */
export function formatPhoneForCountry(raw: string, countryCode: string): string {
  const c = COUNTRY_MAP[countryCode] || COUNTRY_MAP['UG'];
  let digits = raw.replace(/\D/g, '');
  // Strip leading 0 and prepend country dial code
  if (digits.startsWith('0')) digits = c.dialCode + digits.slice(1);
  // If still doesn't start with the dial code, prepend it
  if (!digits.startsWith(c.dialCode)) digits = c.dialCode + digits;
  return '+' + digits;
}

/** Display a phone with masked middle digits, country-aware */
export function maskPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  for (const c of COUNTRIES) {
    if (digits.startsWith(c.dialCode)) {
      const local = digits.slice(c.dialCode.length);
      if (local.length >= 6) {
        return `+${c.dialCode} ${local.slice(0, 2)}XXX${local.slice(-2)}`;
      }
    }
  }
  // Generic fallback
  if (digits.length >= 8) return `${digits.slice(0, 4)}****${digits.slice(-2)}`;
  return phone;
}

/** Get country config by code (with fallback) */
export function getCountry(code: string): CountryConfig {
  return COUNTRY_MAP[code] || COUNTRY_MAP['UG'];
}
