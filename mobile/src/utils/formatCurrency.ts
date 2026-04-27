import { COUNTRY_MAP, detectCountryFromPhone } from '../config/countries';

export function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function getCurrencyFromCountry(countryCode: string): string {
  return COUNTRY_MAP[countryCode]?.currency ?? 'UGX';
}

export function getCurrencyFromPhone(phone: string): string {
  return getCurrencyFromCountry(detectCountryFromPhone(phone));
}
