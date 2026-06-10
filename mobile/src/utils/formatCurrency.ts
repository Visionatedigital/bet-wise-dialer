import { COUNTRY_MAP, detectCountryFromPhone } from '../config/countries';

export const CURRENCY_SYMBOLS: Record<string, string> = {
  UGX: 'UGX',
  GHS: 'GH¢',
  NGN: '₦',
  TZS: 'TZS',
  KES: 'KSh',
};

export function formatCurrency(amount: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency] || currency;
  const formatted = new Intl.NumberFormat('en', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
  return `${symbol} ${formatted}`;
}

export function getCurrencyFromCountry(countryCode: string): string {
  return COUNTRY_MAP[countryCode]?.currency ?? 'UGX';
}

export function getCurrencyFromPhone(phone: string, defaultCountry = 'UG'): string {
  return getCurrencyFromCountry(detectCountryFromPhone(phone, defaultCountry));
}
