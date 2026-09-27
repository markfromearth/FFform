import React from 'react';
import { AlertCircle } from 'lucide-react';

interface ErrorSummaryProps {
  errors: Record<string, string>;
  title?: string;
}

export const ErrorSummary: React.FC<ErrorSummaryProps> = ({
  errors,
  title = 'There are errors that require your attention',
}) => {
  const errorKeys = Object.keys(errors);
  if (errorKeys.length === 0) return null;

  const handleFocusField = (fieldKey: string) => {
    const el = document.getElementById(fieldKey) || document.querySelector<HTMLElement>(`[name="${fieldKey}"]`);
    if (el) {
      el.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      el.focus();
    }
  };

  return (
    <div
      role="alert"
      tabIndex={-1}
      aria-labelledby="error-summary-title"
      className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-4 sm:p-5 text-rose-900 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <h2 id="error-summary-title" className="text-sm font-bold text-rose-900">
            {title}
          </h2>
          <ul className="mt-2 text-xs sm:text-sm space-y-1.5 text-rose-800 list-disc list-inside">
            {errorKeys.map((key) => (
              <li key={key} className="leading-snug">
                <button
                  type="button"
                  onClick={() => handleFocusField(key)}
                  className="text-left font-medium text-rose-800 hover:text-rose-950 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 rounded px-1 -mx-1"
                >
                  {errors[key]}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
