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
 * Format raw digits into a readable telephone representation
 */
export function formatPhone(phone: string): string {
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
  return `BZL-${year}-${randomPart}`;
}

/**
 * Format percentage e.g. 50%
 */
export function formatPercentage(pct: number | null | undefined): string {
  if (pct === null || pct === undefined || isNaN(pct)) return '';
  return `${pct}%`;
}
