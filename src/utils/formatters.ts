/**
 * Format a number as GBP currency (£XX,XXX)
 */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '';
  }
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(amount);
}

/**
 * Parse a raw currency input string into a pure number or null
 * Handles '£', commas, spaces, etc.
 */
export function parseCurrencyInput(value: string): number | null {
  const clean = value.replace(/[^0-9.-]+/g, '');
  if (!clean || isNaN(Number(clean))) {
    return null;
  }
  const parsed = parseFloat(clean);
  return Math.round(parsed); // Loan values are typically integer GBP
}

/**
 * Normalizes a phone number to standard E.164 format.
 * Automatically converts UK local numbers (e.g. 07700 900123) to +447700900123,
 * preserves numbers already entered with +44, and handles international numbers.
 */
export function normalizePhone(rawPhone: string | null | undefined): string {
  if (!rawPhone || typeof rawPhone !== 'string') return '';
  // Remove all whitespace, hyphens, brackets, dots
  let cleaned = rawPhone.trim().replace(/[\s\-\(\)\.]/g, '');

  // Handle international prefix '00' (e.g. 0044... -> +44...)
  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.slice(2);
  }
  // Standard UK local numbers starting with '0' (e.g. 07700 900123 -> +447700900123)
  else if (cleaned.startsWith('0')) {
    cleaned = '+44' + cleaned.slice(1);
  }
  // UK numbers starting with '44' without plus (e.g. 447700900123)
  else if (/^44\d{9,10}$/.test(cleaned)) {
    cleaned = '+' + cleaned;
  }
  // If numeric string without leading plus or zero
  else if (!cleaned.startsWith('+') && /^\d+$/.test(cleaned)) {
    cleaned = '+' + cleaned;
  }

  // Handle +44(0)... where (0) was stripped, leaving +440...
  if (cleaned.startsWith('+440')) {
    cleaned = '+44' + cleaned.slice(4);
  }

  return cleaned;
}

/**
 * Validates whether a phone number (raw or normalized) is a valid UK or international number.
 * Valid UK numbers: +44 followed by 9 to 10 digits (e.g. +447700900123).
 * Valid international numbers: + followed by 7 to 15 digits.
 */
export function isValidPhone(phone: string | null | undefined): boolean {
  if (!phone || typeof phone !== 'string') return false;
  const normalized = normalizePhone(phone);
  // UK numbers: +44 followed by 9 or 10 digits, beginning with 1-9 (e.g. +447..., +441..., +442...)
  // or general E.164: + followed by country code [1-9] and 6-14 digits
  return /^\+(?:44[1-9]\d{8,9}|[1-9]\d{6,14})$/.test(normalized);
}

/**
 * Format raw digits into a readable telephone representation
 */
export function formatPhone(phone: string): string {
  if (!phone) return '';
  return phone.trim();
}

/**
 * Format date string DD/MM/YYYY into human readable date
 */
export function formatDisplayDate(dateStr?: string): string {
  if (!dateStr) return '—';
  return dateStr;
}

/**
 * Generate a professional application reference number e.g. BZL-2026-98142
 */
export function generateApplicationRef(): string {
  const year = new Date().getFullYear();
  const randomPart = Math.floor(10000 + Math.random() * 90000);
  return `FF-${year}-${randomPart}`;
}

/**
 * Format percentage e.g. 50%
 */
export function formatPercentage(pct: number | null | undefined): string {
  if (pct === null || pct === undefined || isNaN(pct)) return '';
  return `${pct}%`;
}

/**
 * Format raw select values (e.g. 20_39) into human readable labels
 */
export function formatLabel(value: any): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return String(value);
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map(v => formatLabel(v)).join(', ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return String(value);
  if (typeof value !== 'string') return String(value);
  const labels: Record<string, string> = {
    'under_10': 'Under 10%',
    '10_25': '10–25%',
    '26_50': '26–50%',
    'over_50': 'Over 50%',
    'under_20': 'Under 20%',
    '20_39': '20–39%',
    '40_59': '40–59%',
    '60_79': '60–79%',
    '80_plus': '80%+',
    '30_or_less': '30 days or less',
    '31_60': '31–60 days',
    '61_90': '61–90 days',
    'more_than_90': 'More than 90 days',
    'gbp_only': 'GBP only',
    'gbp_and_foreign': 'GBP and foreign currencies',
    'mainly_foreign': 'Mainly foreign currencies',
    'main_contractor': 'Main contractor',
    'not_sure': 'Not sure',
    'uk': 'UK',
    'europe': 'Europe',
    'north_america': 'North America',
    'other_international': 'Other international',
  };
  
  if (labels[value]) return labels[value];
  
  const spaced = value.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
