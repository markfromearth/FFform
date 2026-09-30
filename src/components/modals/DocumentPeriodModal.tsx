import React, { useState, useEffect } from 'react';
import { StatementPeriod } from '../../types/application';
import { generatePeriodRange } from '../../utils/bankStatementParser';
import { Calendar, Check, HelpCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

interface DocumentPeriodModalProps {
  isOpen: boolean;
  documentName: string;
  onClose: () => void;
  onConfirm: (periods: StatementPeriod[]) => void;
}

const MONTH_OPTIONS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];

export const DocumentPeriodModal: React.FC<DocumentPeriodModalProps> = ({
  isOpen,
  documentName,
  onClose,
  onConfirm,
}) => {
  const [isRange, setIsRange] = useState(false);
  const [startMonth, setStartMonth] = useState<number>(1);
  const [startYear, setStartYear] = useState<number>(CURRENT_YEAR);
  const [endMonth, setEndMonth] = useState<number>(6);
  const [endYear, setEndYear] = useState<number>(CURRENT_YEAR);

  useEffect(() => {
    if (isOpen) {
      setIsRange(false);
      setStartMonth(1);
      setStartYear(CURRENT_YEAR);
      setEndMonth(6);
      setEndYear(CURRENT_YEAR);
    }
  }, [isOpen]);

  const handleSave = () => {
    if (isRange) {
      const periods = generatePeriodRange(
        { month: startMonth, year: startYear },
        { month: endMonth, year: endYear }
      );
      onConfirm(periods);
    } else {
      onConfirm([{ month: startMonth, year: startYear }]);
    }
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Identify statement period"
      description={documentName}
      icon={
        <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
          <Calendar className="w-4 h-4 stroke-[2.2]" />
        </div>
      }
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleSave}
            leftIcon={<Check className="w-4 h-4" />}
          >
            Confirm Period
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs sm:text-sm">
          <HelpCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p>
            We couldn't automatically detect the statement period from this file name. Please let us know which calendar period this document covers.
          </p>
        </div>

        {/* Single month vs Multi-month range toggle */}
        <div className="flex items-center gap-4 text-sm font-medium text-white/90">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="periodType"
              checked={!isRange}
              onChange={() => setIsRange(false)}
              className="w-4 h-4 text-brand-700 border-white/20 focus:ring-brand-500"
            />
            <span>Single month</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="periodType"
              checked={isRange}
              onChange={() => setIsRange(true)}
              className="w-4 h-4 text-brand-700 border-white/20 focus:ring-brand-500"
            />
            <span>Multi-month range (e.g. 2–6 months)</span>
          </label>
        </div>

        {!isRange ? (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="single-month-select"
                className="block text-xs font-semibold text-white/90 mb-1.5"
              >
                Statement Month
              </label>
              <select
                id="single-month-select"
                value={startMonth}
                onChange={(e) => setStartMonth(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2.5 rounded-xl border border-white/20 bg-white/10 text-sm text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              >
                {MONTH_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="single-year-select"
                className="block text-xs font-semibold text-white/90 mb-1.5"
              >
                Statement Year
              </label>
              <select
                id="single-year-select"
                value={startYear}
                onChange={(e) => setStartYear(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2.5 rounded-xl border border-white/20 bg-white/10 text-sm text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              >
                {YEAR_OPTIONS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 rounded-xl border border-white/10 bg-slate-50/60 space-y-3">
              <span className="text-xs font-bold text-white block">From (Start Month)</span>
              <div className="grid grid-cols-2 gap-3">
                <select
                  aria-label="Start Month"
                  value={startMonth}
                  onChange={(e) => setStartMonth(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 rounded-xl border border-white/20 bg-white/10 text-sm"
                >
                  {MONTH_OPTIONS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Start Year"
                  value={startYear}
                  onChange={(e) => setStartYear(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 rounded-xl border border-white/20 bg-white/10 text-sm"
                >
                  {YEAR_OPTIONS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-white/10 bg-slate-50/60 space-y-3">
              <span className="text-xs font-bold text-white block">To (End Month)</span>
              <div className="grid grid-cols-2 gap-3">
                <select
                  aria-label="End Month"
                  value={endMonth}
                  onChange={(e) => setEndMonth(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 rounded-xl border border-white/20 bg-white/10 text-sm"
                >
                  {MONTH_OPTIONS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="End Year"
                  value={endYear}
                  onChange={(e) => setEndYear(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 rounded-xl border border-white/20 bg-white/10 text-sm"
                >
                  {YEAR_OPTIONS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
