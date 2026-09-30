/**
 * Format a number as GBP currency (£XX,XXX)
 */
export function formatCurrency(amount) {
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
export function parseCurrencyInput(value) {
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
export function formatPhone(phone) {
    return phone.trim();
}
/**
 * Format date string DD/MM/YYYY into human readable date
 */
export function formatDisplayDate(dateStr) {
    if (!dateStr)
        return '—';
    return dateStr;
}
/**
 * Generate a professional application reference number e.g. BZL-2026-98142
 */
export function generateApplicationRef() {
    const year = new Date().getFullYear();
    const randomPart = Math.floor(10000 + Math.random() * 90000);
    return `FF-${year}-${randomPart}`;
}
/**
 * Format percentage e.g. 50%
 */
export function formatPercentage(pct) {
    if (pct === null || pct === undefined || isNaN(pct))
        return '';
    return `${pct}%`;
}
/**
 * Format raw select values (e.g. 20_39) into human readable labels
 */
export function formatLabel(value) {
    if (typeof value === 'boolean')
        return value ? 'Yes' : 'No';
    if (typeof value === 'number')
        return String(value);
    if (value === null || value === undefined)
        return '';
    if (Array.isArray(value))
        return value.map(v => formatLabel(v)).join(', ');
    if (typeof value === 'boolean')
        return value ? 'Yes' : 'No';
    if (typeof value === 'number')
        return String(value);
    if (typeof value !== 'string')
        return String(value);
    const labels = {
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
    if (labels[value])
        return labels[value];
    const spaced = value.replace(/_/g, ' ');
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
