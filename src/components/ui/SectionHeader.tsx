import React from 'react';

interface SectionHeaderProps {
  stepNumber?: number;
  totalSteps?: number;
  category?: string;
  title: string;
  description?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  stepNumber,
  totalSteps,
  category,
  title,
  description,
}) => {
  return (
    <div className="mb-6 sm:mb-8">
      <div className="flex items-center gap-2 mb-2">
        {stepNumber && totalSteps && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-50 text-brand-700 border border-brand-200">
            Step {stepNumber} of {totalSteps}
          </span>
        )}
        {category && (
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            {category}
          </span>
        )}
      </div>

      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 leading-tight">
        {title}
      </h1>

      {description && (
        <p className="mt-2 text-sm sm:text-base text-slate-600 max-w-2xl leading-relaxed">
          {description}
        </p>
      )}
    </div>
  );
};
