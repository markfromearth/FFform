import { describe, it, expect } from 'vitest';
import {
  detectPeriodsFromFileName,
  calculateBankStatementCoverage,
  getMissingMonthAlert,
  getDuplicateMonthAlert,
  formatPeriod,
  formatPeriodRange,
  generatePeriodRange,
} from './bankStatementParser';
import { BankStatementDocument } from '../types/application';

describe('Bank Statement Parser & Coverage Engine', () => {
  describe('Period Detection from File Name', () => {
    it('detects single month from standard named month and year', () => {
      expect(detectPeriodsFromFileName('January 2026.pdf')).toEqual([{ month: 1, year: 2026 }]);
      expect(detectPeriodsFromFileName('February 2026.PDF')).toEqual([{ month: 2, year: 2026 }]);
      expect(detectPeriodsFromFileName('statement_mar_2026.pdf')).toEqual([{ month: 3, year: 2026 }]);
      expect(detectPeriodsFromFileName('April-2026.pdf')).toEqual([{ month: 4, year: 2026 }]);
      expect(detectPeriodsFromFileName('2026-May.pdf')).toEqual([{ month: 5, year: 2026 }]);
      expect(detectPeriodsFromFileName('June 2026.png')).toEqual([{ month: 6, year: 2026 }]);
      expect(detectPeriodsFromFileName('July 2026.jpg')).toEqual([{ month: 7, year: 2026 }]);
    });

    it('detects single month from numeric patterns', () => {
      expect(detectPeriodsFromFileName('2026-01.pdf')).toEqual([{ month: 1, year: 2026 }]);
      expect(detectPeriodsFromFileName('statement_2026_02.pdf')).toEqual([{ month: 2, year: 2026 }]);
      expect(detectPeriodsFromFileName('03-2026-bank.pdf')).toEqual([{ month: 3, year: 2026 }]);
    });

    it('detects multi-month ranges within the same year', () => {
      // 6 months in single file
      const sixMonths = detectPeriodsFromFileName('January - June 2026.pdf');
      expect(sixMonths).toHaveLength(6);
      expect(sixMonths[0]).toEqual({ month: 1, year: 2026 });
      expect(sixMonths[5]).toEqual({ month: 6, year: 2026 });

      // 2 months
      const twoMonths = detectPeriodsFromFileName('Jan_Feb_2026.pdf');
      expect(twoMonths).toEqual([
        { month: 1, year: 2026 },
        { month: 2, year: 2026 },
      ]);

      // 3 months
      const threeMonths = detectPeriodsFromFileName('Jan to Mar 2026.pdf');
      expect(threeMonths).toEqual([
        { month: 1, year: 2026 },
        { month: 2, year: 2026 },
        { month: 3, year: 2026 },
      ]);
    });

    it('detects multi-month ranges spanning across two years', () => {
      const yearCrossing = detectPeriodsFromFileName('November 2025 - April 2026.pdf');
      expect(yearCrossing).toEqual([
        { month: 11, year: 2025 },
        { month: 12, year: 2025 },
        { month: 1, year: 2026 },
        { month: 2, year: 2026 },
        { month: 3, year: 2026 },
        { month: 4, year: 2026 },
      ]);
    });

    it('detects quarters and half-year naming conventions', () => {
      const q1 = detectPeriodsFromFileName('Q1 2026.pdf');
      expect(q1).toEqual([
        { month: 1, year: 2026 },
        { month: 2, year: 2026 },
        { month: 3, year: 2026 },
      ]);

      const h1 = detectPeriodsFromFileName('H1 2026.pdf');
      expect(h1).toHaveLength(6);
      expect(h1[0]).toEqual({ month: 1, year: 2026 });
      expect(h1[5]).toEqual({ month: 6, year: 2026 });
    });

    it('returns empty array for ambiguous file names', () => {
      expect(detectPeriodsFromFileName('statement.pdf')).toEqual([]);
      expect(detectPeriodsFromFileName('scan001.pdf')).toEqual([]);
      expect(detectPeriodsFromFileName('document.png')).toEqual([]);
      expect(detectPeriodsFromFileName('bank_upload.jpg')).toEqual([]);
    });
  });

  describe('Coverage Calculation', () => {
    const makeDoc = (
      id: string,
      name: string,
      periods: { month: number; year: number }[],
      confirmed?: { month: number; year: number }[]
    ): BankStatementDocument => ({
      id,
      fileName: name,
      fileType: 'application/pdf',
      fileSize: 1024 * 500,
      uploadStatus: 'uploaded',
      detectedPeriods: periods,
      manuallyConfirmedPeriods: confirmed,
      uploadedAt: new Date().toISOString(),
    });

    it('Scenario A: 6 individual monthly statements (Jan-Jun 2026) -> complete', () => {
      const docs: BankStatementDocument[] = [
        makeDoc('1', 'January 2026.pdf', [{ month: 1, year: 2026 }]),
        makeDoc('2', 'February 2026.pdf', [{ month: 2, year: 2026 }]),
        makeDoc('3', 'March 2026.pdf', [{ month: 3, year: 2026 }]),
        makeDoc('4', 'April 2026.pdf', [{ month: 4, year: 2026 }]),
        makeDoc('5', 'May 2026.pdf', [{ month: 5, year: 2026 }]),
        makeDoc('6', 'June 2026.pdf', [{ month: 6, year: 2026 }]),
      ];

      const coverage = calculateBankStatementCoverage(docs);
      expect(coverage.isComplete).toBe(true);
      expect(coverage.consecutiveMonths).toBe(6);
      expect(formatPeriodRange(coverage.startDate, coverage.endDate)).toBe('January 2026 → June 2026');
      expect(getMissingMonthAlert(coverage)).toBeNull();
    });

    it('Scenario B: 3 files containing 2 months each -> complete', () => {
      const docs: BankStatementDocument[] = [
        makeDoc('1', 'Jan_Feb_2026.pdf', generatePeriodRange({ month: 1, year: 2026 }, { month: 2, year: 2026 })),
        makeDoc('2', 'Mar_Apr_2026.pdf', generatePeriodRange({ month: 3, year: 2026 }, { month: 4, year: 2026 })),
        makeDoc('3', 'May_Jun_2026.pdf', generatePeriodRange({ month: 5, year: 2026 }, { month: 6, year: 2026 })),
      ];

      const coverage = calculateBankStatementCoverage(docs);
      expect(coverage.isComplete).toBe(true);
      expect(coverage.consecutiveMonths).toBe(6);
    });

    it('Scenario C: 1 single PDF containing all 6 months -> complete', () => {
      const docs: BankStatementDocument[] = [
        makeDoc('1', 'Jan_to_Jun_2026.pdf', generatePeriodRange({ month: 1, year: 2026 }, { month: 6, year: 2026 })),
      ];

      const coverage = calculateBankStatementCoverage(docs);
      expect(coverage.isComplete).toBe(true);
      expect(coverage.consecutiveMonths).toBe(6);
    });

    it('Scenario D: Mixture of PDFs and image statements -> complete', () => {
      const docs: BankStatementDocument[] = [
        makeDoc('1', 'Jan-Apr 2026.pdf', generatePeriodRange({ month: 1, year: 2026 }, { month: 4, year: 2026 })),
        makeDoc('2', 'May 2026.jpg', [{ month: 5, year: 2026 }]),
        makeDoc('3', 'June 2026.png', [{ month: 6, year: 2026 }]),
      ];

      const coverage = calculateBankStatementCoverage(docs);
      expect(coverage.isComplete).toBe(true);
      expect(coverage.consecutiveMonths).toBe(6);
    });

    it('handles 7+ months without rejecting or blocking', () => {
      const docs: BankStatementDocument[] = [
        makeDoc('1', 'Jan-Jul 2026.pdf', generatePeriodRange({ month: 1, year: 2026 }, { month: 7, year: 2026 })),
      ];

      const coverage = calculateBankStatementCoverage(docs);
      expect(coverage.isComplete).toBe(true);
      expect(coverage.consecutiveMonths).toBe(7);
      expect(formatPeriodRange(coverage.startDate, coverage.endDate)).toBe('January 2026 → July 2026');
    });

    it('identifies missing month in coverage gap (Jan–Mar and May–Jun missing April)', () => {
      const docs: BankStatementDocument[] = [
        makeDoc('1', 'Jan-Mar 2026.pdf', generatePeriodRange({ month: 1, year: 2026 }, { month: 3, year: 2026 })),
        makeDoc('2', 'May-Jun 2026.pdf', generatePeriodRange({ month: 5, year: 2026 }, { month: 6, year: 2026 })),
      ];

      const coverage = calculateBankStatementCoverage(docs);
      expect(coverage.isComplete).toBe(false);
      expect(coverage.consecutiveMonths).toBe(3); // longest consecutive is Jan-Mar
      const alert = getMissingMonthAlert(coverage);
      expect(alert).toContain('We appear to be missing April 2026.');
    });

    it('identifies duplicate period uploaded in more than one file', () => {
      const docs: BankStatementDocument[] = [
        makeDoc('1', 'January 2026.pdf', [{ month: 1, year: 2026 }]),
        makeDoc('2', 'February 2026.pdf', [{ month: 2, year: 2026 }]),
        makeDoc('3', 'March 2026.pdf', [{ month: 3, year: 2026 }]),
        makeDoc('4', 'Another_March_2026.pdf', [{ month: 3, year: 2026 }]),
      ];

      const coverage = calculateBankStatementCoverage(docs);
      const dupAlert = getDuplicateMonthAlert(coverage);
      expect(dupAlert).toContain('We already have a statement covering March 2026.');
    });

    it('flags ambiguous document and resolves via manuallyConfirmedPeriods', () => {
      const ambiguousDoc = makeDoc('1', 'statement.pdf', []);
      const coverageBefore = calculateBankStatementCoverage([ambiguousDoc]);
      expect(coverageBefore.isComplete).toBe(false);

      // Resolve ambiguous doc manually
      const resolvedDoc = makeDoc(
        '1',
        'statement.pdf',
        [],
        generatePeriodRange({ month: 1, year: 2026 }, { month: 6, year: 2026 })
      );
      const coverageAfter = calculateBankStatementCoverage([resolvedDoc]);
      expect(coverageAfter.isComplete).toBe(true);
      expect(coverageAfter.consecutiveMonths).toBe(6);
    });
  });
});
