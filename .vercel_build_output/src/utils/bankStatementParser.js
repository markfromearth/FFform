const MONTH_NAMES = {
    january: 1,
    jan: 1,
    february: 2,
    feb: 2,
    march: 3,
    mar: 3,
    april: 4,
    apr: 4,
    may: 5,
    june: 6,
    jun: 6,
    july: 7,
    jul: 7,
    august: 8,
    aug: 8,
    september: 9,
    sept: 9,
    sep: 9,
    october: 10,
    oct: 10,
    november: 11,
    nov: 11,
    december: 12,
    dec: 12,
};
const MONTH_FULL_LABELS = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
];
export function monthToSeq(year, month) {
    return year * 12 + (month - 1);
}
export function seqToPeriod(seq) {
    const year = Math.floor(seq / 12);
    const month = (seq % 12) + 1;
    return { year, month };
}
export function formatPeriod(period) {
    const name = MONTH_FULL_LABELS[period.month - 1] || `Month ${period.month}`;
    return `${name} ${period.year}`;
}
export function formatPeriodRange(start, end) {
    if (!start && !end)
        return '';
    if (start && !end)
        return formatPeriod(start);
    if (!start && end)
        return formatPeriod(end);
    if (start && end && start.month === end.month && start.year === end.year) {
        return formatPeriod(start);
    }
    return `${formatPeriod(start)} → ${formatPeriod(end)}`;
}
/**
 * Generate all consecutive StatementPeriod objects from start to end (inclusive)
 */
export function generatePeriodRange(start, end) {
    const startSeq = monthToSeq(start.year, start.month);
    const endSeq = monthToSeq(end.year, end.month);
    if (startSeq > endSeq) {
        return generatePeriodRange(end, start);
    }
    const periods = [];
    for (let seq = startSeq; seq <= endSeq; seq++) {
        periods.push(seqToPeriod(seq));
    }
    return periods;
}
/**
 * Parse statement period(s) from a filename or text snippet.
 * Returns an array of StatementPeriods covered by the document.
 * Returns empty array if period is ambiguous or unidentifiable.
 */
export function detectPeriodsFromFileName(fileName) {
    // Convert extension removal and underscores to dashes so word boundaries work cleanly
    const cleanName = fileName
        .replace(/\.[^/.]+$/, '')
        .replace(/_/g, '-')
        .trim()
        .toLowerCase();
    // 1. Check for Quarter / Half patterns e.g. "Q1 2026", "H1 2026", "Q2_2025"
    const qMatch = cleanName.match(/\b(q[1-4]|h[1-2])[\s_.-]*([12]\d{3})\b/);
    if (qMatch) {
        const term = qMatch[1];
        const year = parseInt(qMatch[2], 10);
        if (term === 'q1')
            return generatePeriodRange({ month: 1, year }, { month: 3, year });
        if (term === 'q2')
            return generatePeriodRange({ month: 4, year }, { month: 6, year });
        if (term === 'q3')
            return generatePeriodRange({ month: 7, year }, { month: 9, year });
        if (term === 'q4')
            return generatePeriodRange({ month: 10, year }, { month: 12, year });
        if (term === 'h1')
            return generatePeriodRange({ month: 1, year }, { month: 6, year });
        if (term === 'h2')
            return generatePeriodRange({ month: 7, year }, { month: 12, year });
    }
    // 2. Check for month range with years e.g.:
    // "November 2025 - April 2026" or "Nov 2025 to Apr 2026"
    const twoYearRangeMatch = cleanName.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[\s_.-]*([12]\d{3})[\s_.-]*(?:to|-|through|until)[\s_.-]*(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[\s_.-]*([12]\d{3})\b/);
    if (twoYearRangeMatch) {
        const startM = MONTH_NAMES[twoYearRangeMatch[1]];
        const startY = parseInt(twoYearRangeMatch[2], 10);
        const endM = MONTH_NAMES[twoYearRangeMatch[3]];
        const endY = parseInt(twoYearRangeMatch[4], 10);
        if (startM && startY && endM && endY) {
            return generatePeriodRange({ month: startM, year: startY }, { month: endM, year: endY });
        }
    }
    // 3. Check for month range sharing the same year e.g.:
    // "January - June 2026", "Jan to Jun 2026", "Jan-Jun 2026", "Jan_Feb_2026"
    const singleYearRangeMatch = cleanName.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[\s_.-]*(?:to|-|through|and|&|_)[\s_.-]*(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[\s_.-]*([12]\d{3})\b/);
    if (singleYearRangeMatch) {
        const startM = MONTH_NAMES[singleYearRangeMatch[1]];
        const endM = MONTH_NAMES[singleYearRangeMatch[2]];
        const year = parseInt(singleYearRangeMatch[3], 10);
        if (startM && endM && year) {
            return generatePeriodRange({ month: startM, year }, { month: endM, year });
        }
    }
    // 4. Check for ISO numeric date range:
    // "2026-01-to-2026-06", "2026-01_2026-06", "2026.01-2026.06"
    const numericRangeMatch = cleanName.match(/\b([12]\d{3})[-._](0?[1-9]|1[0-2])[\s_.-]*(?:to|-|through)[\s_.-]*([12]\d{3})[-._](0?[1-9]|1[0-2])\b/);
    if (numericRangeMatch) {
        const startY = parseInt(numericRangeMatch[1], 10);
        const startM = parseInt(numericRangeMatch[2], 10);
        const endY = parseInt(numericRangeMatch[3], 10);
        const endM = parseInt(numericRangeMatch[4], 10);
        return generatePeriodRange({ month: startM, year: startY }, { month: endM, year: endY });
    }
    // 5. Check for single named month + 4-digit year:
    // "January 2026", "Jan-2026", "2026 January", "Statement Jan 2026"
    const namedSingleMatch1 = cleanName.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[\s_.-]*([12]\d{3})\b/);
    if (namedSingleMatch1) {
        const m = MONTH_NAMES[namedSingleMatch1[1]];
        const y = parseInt(namedSingleMatch1[2], 10);
        if (m && y)
            return [{ month: m, year: y }];
    }
    const namedSingleMatch2 = cleanName.match(/\b([12]\d{3})[\s_.-]*(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/);
    if (namedSingleMatch2) {
        const y = parseInt(namedSingleMatch2[1], 10);
        const m = MONTH_NAMES[namedSingleMatch2[2]];
        if (m && y)
            return [{ month: m, year: y }];
    }
    // 6. Check for numeric year-month "2026-01", "2026_01", "2026.01"
    const numYearMonth = cleanName.match(/\b([12]\d{3})[-._](0?[1-9]|1[0-2])\b/);
    if (numYearMonth) {
        const y = parseInt(numYearMonth[1], 10);
        const m = parseInt(numYearMonth[2], 10);
        return [{ month: m, year: y }];
    }
    // 7. Check for numeric month-year "01-2026", "01_2026", "01.2026"
    const numMonthYear = cleanName.match(/\b(0?[1-9]|1[0-2])[-._]([12]\d{3})\b/);
    if (numMonthYear) {
        const m = parseInt(numMonthYear[1], 10);
        const y = parseInt(numMonthYear[2], 10);
        return [{ month: m, year: y }];
    }
    // If none matched, return empty array indicating ambiguous
    return [];
}
/**
 * Calculates aggregated coverage from a list of documents.
 * Evaluates whether 6 consecutive months are satisfied.
 */
export function calculateBankStatementCoverage(documents, requiredMonths = 6) {
    const activeDocs = documents.filter((doc) => doc.uploadStatus === 'uploaded');
    if (activeDocs.length === 0) {
        return {
            months: [],
            consecutiveMonths: 0,
            isComplete: false,
        };
    }
    // Map each month seq -> array of doc IDs that cover it
    const seqToDocsMap = new Map();
    let hasAmbiguousDocs = false;
    activeDocs.forEach((doc) => {
        const periods = doc.manuallyConfirmedPeriods && doc.manuallyConfirmedPeriods.length > 0
            ? doc.manuallyConfirmedPeriods
            : doc.detectedPeriods;
        if (!periods || periods.length === 0) {
            hasAmbiguousDocs = true;
            return;
        }
        periods.forEach((p) => {
            const seq = monthToSeq(p.year, p.month);
            const existing = seqToDocsMap.get(seq) || [];
            existing.push(doc.id);
            seqToDocsMap.set(seq, existing);
        });
    });
    const coveredSeqs = Array.from(seqToDocsMap.keys()).sort((a, b) => a - b);
    if (coveredSeqs.length === 0) {
        return {
            months: [],
            consecutiveMonths: 0,
            isComplete: false,
        };
    }
    // Find longest consecutive sequence
    let maxConsecutive = 0;
    let currentConsecutive = 0;
    let bestRunStartSeq = coveredSeqs[0];
    let bestRunEndSeq = coveredSeqs[0];
    let tempRunStartSeq = coveredSeqs[0];
    for (let i = 0; i < coveredSeqs.length; i++) {
        if (i === 0 || coveredSeqs[i] === coveredSeqs[i - 1] + 1) {
            currentConsecutive++;
        }
        else {
            currentConsecutive = 1;
            tempRunStartSeq = coveredSeqs[i];
        }
        if (currentConsecutive > maxConsecutive) {
            maxConsecutive = currentConsecutive;
            bestRunStartSeq = tempRunStartSeq;
            bestRunEndSeq = coveredSeqs[i];
        }
    }
    // Build month items across the target span
    const minSeq = coveredSeqs[0];
    const maxSeq = coveredSeqs[coveredSeqs.length - 1];
    // If span is smaller than requiredMonths and not consecutive, expand to show full requirement
    const startSpanSeq = minSeq;
    // Span goes at least from minSeq to maxSeq, or at least minSeq + (requiredMonths - 1)
    const endSpanSeq = Math.max(maxSeq, minSeq + requiredMonths - 1);
    const months = [];
    for (let seq = startSpanSeq; seq <= endSpanSeq; seq++) {
        const period = seqToPeriod(seq);
        const docs = seqToDocsMap.get(seq);
        let status = 'missing';
        if (docs && docs.length > 1) {
            status = 'duplicate';
        }
        else if (docs && docs.length === 1) {
            status = 'covered';
        }
        months.push({
            month: period.month,
            year: period.year,
            status,
            documentIds: docs || [],
        });
    }
    const isComplete = maxConsecutive >= requiredMonths && !hasAmbiguousDocs;
    // Compute representative start and end period
    const startDate = seqToPeriod(bestRunStartSeq);
    const endDate = seqToPeriod(bestRunEndSeq);
    return {
        months,
        consecutiveMonths: maxConsecutive,
        isComplete,
        startDate,
        endDate,
    };
}
/**
 * Identify any missing months between uploaded statements
 */
export function getMissingMonthAlert(coverage) {
    if (coverage.isComplete)
        return null;
    const missingItems = coverage.months.filter((m) => m.status === 'missing');
    if (missingItems.length === 0)
        return null;
    // If there's a gap between covered months
    const coveredItems = coverage.months.filter((m) => m.status === 'covered' || m.status === 'duplicate');
    if (coveredItems.length < 2) {
        return `We need 6 consecutive months of bank statement coverage. Currently ${coverage.consecutiveMonths} month(s) detected.`;
    }
    const missingNames = missingItems.map((m) => formatPeriod({ month: m.month, year: m.year }));
    if (missingNames.length === 1) {
        return `We appear to be missing ${missingNames[0]}.`;
    }
    return `We appear to be missing ${missingNames.slice(0, 3).join(', ')}${missingNames.length > 3 ? ' and other months' : ''}.`;
}
/**
 * Identify any duplicate months uploaded in more than one document
 */
export function getDuplicateMonthAlert(coverage) {
    const duplicates = coverage.months.filter((m) => m.status === 'duplicate');
    if (duplicates.length === 0)
        return null;
    const dupNames = duplicates.map((m) => formatPeriod({ month: m.month, year: m.year }));
    return `We already have a statement covering ${dupNames.join(', ')}. Please check whether you intended to upload a different statement.`;
}
