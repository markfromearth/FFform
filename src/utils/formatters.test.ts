import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  parseCurrencyInput,
  formatPercentage,
  generateApplicationRef,
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
    it('generates a reference matching BZL-YYYY-XXXXX', () => {
      const ref = generateApplicationRef();
      const currentYear = new Date().getFullYear();
      expect(ref).toMatch(new RegExp(`^BZL-${currentYear}-\\d{5}$`));
    });
  });
});
