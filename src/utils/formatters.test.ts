import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  parseCurrencyInput,
  formatPercentage,
  generateApplicationRef,
  normalizePhone,
  isValidPhone,
} from './formatters';

describe('formatters utility', () => {
  describe('formatCurrency', () => {
    it('formats positive integers to GBP string with pound sign', () => {
      expect(formatCurrency(25000)).toBe('£25,000');
      expect(formatCurrency(1000000)).toBe('£1,000,000');
      expect(formatCurrency(0)).toBe('£0');
    });

    it('returns empty string for null, undefined or NaN', () => {
      expect(formatCurrency(null)).toBe('');
      expect(formatCurrency(undefined)).toBe('');
      expect(formatCurrency(NaN)).toBe('');
    });
  });

  describe('parseCurrencyInput', () => {
    it('parses formatted currency strings into pure numbers', () => {
      expect(parseCurrencyInput('£25,000')).toBe(25000);
      expect(parseCurrencyInput('  £ 75,500 ')).toBe(75500);
      expect(parseCurrencyInput('120000')).toBe(120000);
      expect(parseCurrencyInput('0')).toBe(0);
    });

    it('returns null for empty or non-numeric strings', () => {
      expect(parseCurrencyInput('')).toBeNull();
      expect(parseCurrencyInput('abc')).toBeNull();
    });
  });

  describe('formatPercentage', () => {
    it('formats numeric percentages', () => {
      expect(formatPercentage(60)).toBe('60%');
      expect(formatPercentage(100)).toBe('100%');
      expect(formatPercentage(null)).toBe('');
    });
  });

  describe('generateApplicationRef', () => {
    it('generates a reference matching FF-YYYY-XXXXX', () => {
      const ref = generateApplicationRef();
      const currentYear = new Date().getFullYear();
      expect(ref).toMatch(new RegExp(`^FF-${currentYear}-\\d{5}$`));
    });
  });

  describe('normalizePhone', () => {
    it('converts ordinary UK numbers starting with 0 to +44 format', () => {
      expect(normalizePhone('07700 900123')).toBe('+447700900123');
      expect(normalizePhone('07700900123')).toBe('+447700900123');
      expect(normalizePhone('07700-900-123')).toBe('+447700900123');
      expect(normalizePhone('020 7946 0991')).toBe('+442079460991');
      expect(normalizePhone('0161 496 0000')).toBe('+441614960000');
    });

    it('preserves and cleans numbers already entered with +44', () => {
      expect(normalizePhone('+447700900123')).toBe('+447700900123');
      expect(normalizePhone('+44 7700 900 123')).toBe('+447700900123');
      expect(normalizePhone('+44 (0) 7700 900123')).toBe('+447700900123');
    });

    it('handles international format with 00 or raw 44', () => {
      expect(normalizePhone('0044 7700 900123')).toBe('+447700900123');
      expect(normalizePhone('447700900123')).toBe('+447700900123');
      expect(normalizePhone('+1 202 555 0123')).toBe('+12025550123');
    });

    it('returns empty string for null, undefined or empty input', () => {
      expect(normalizePhone('')).toBe('');
      expect(normalizePhone(null)).toBe('');
      expect(normalizePhone(undefined)).toBe('');
    });
  });

  describe('isValidPhone', () => {
    it('validates UK local numbers and converts safely', () => {
      expect(isValidPhone('07700 900123')).toBe(true);
      expect(isValidPhone('020 7946 0991')).toBe(true);
      expect(isValidPhone('0161 496 0000')).toBe(true);
      expect(isValidPhone('+447700900123')).toBe(true);
      expect(isValidPhone('+44 7700 900 123')).toBe(true);
      expect(isValidPhone('0044 7700 900123')).toBe(true);
    });

    it('validates international phone numbers', () => {
      expect(isValidPhone('+1 202 555 0123')).toBe(true);
      expect(isValidPhone('+353 1 234 5678')).toBe(true);
    });

    it('rejects invalid or too short telephone numbers', () => {
      expect(isValidPhone('0770')).toBe(false);
      expect(isValidPhone('12345')).toBe(false);
      expect(isValidPhone('invalid')).toBe(false);
      expect(isValidPhone('')).toBe(false);
      expect(isValidPhone(null)).toBe(false);
    });
  });
});
