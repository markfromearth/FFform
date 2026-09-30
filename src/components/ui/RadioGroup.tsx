import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface RadioOption<T extends string | number | boolean> {
  value: T;
  label: string;
  description?: string;
  badge?: string;
}

interface RadioGroupProps<T extends string | number | boolean> {
  name: string;
  label?: string;
  hint?: string;
  options: RadioOption<T>[];
  value: T | null | undefined;
  onChange: (val: T) => void;
  error?: string;
  columns?: 1 | 2 | 3 | 4;
  className?: string;
  isPrepopulated?: boolean;
  prepopulatedSource?: string;
  variant?: 'standard' | 'compact';
}

export function RadioGroup<T extends string | number | boolean>({
  name,
  label,
  hint,
  options,
  value,
  onChange,
  error,
  columns = 2,
  className,
  isPrepopulated = false,
  prepopulatedSource,
  variant = 'standard',
}: RadioGroupProps<T>) {
  const groupId = `radio_group_${name}`;

  const colStyles = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-3',
    4: 'grid-cols-2 sm:grid-cols-4',
  };

  return (
    <div className={twMerge('space-y-2', className)} role="radiogroup" aria-labelledby={label ? groupId : undefined}>
      {label && (
        <div>
          <span id={groupId} className="block text-sm font-semibold text-white">
            {label}
          </span>
          {hint && <p className="text-xs text-white/70 mt-0.5">{hint}</p>}
        </div>
      )}

      <div className={clsx('grid gap-3', colStyles[columns])}>
        {options.map((opt) => {
          const isSelected = value === opt.value;
          const optId = `${name}_${String(opt.value)}`;

          return (
            <label
              key={String(opt.value)}
              htmlFor={optId}
              className={clsx(
                'choice',
                variant === 'compact' ? 'p-2.5' : '',
                isSelected && 'is-selected',
                error && 'has-error'
              )}
            >
              <input
                type="radio"
                id={optId}
                name={name}
                value={String(opt.value)}
                checked={isSelected}
                onChange={() => onChange(opt.value)}
                className="sr-only"
                aria-checked={isSelected}
                aria-invalid={!!error}
              />

              <div
                className={clsx(
                  'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors',
                  isSelected
                    ? 'border-primary bg-primary'
                    : 'border-outline bg-surface'
                )}
                aria-hidden="true"
              >
                {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={clsx('text-sm font-medium', isSelected ? 'text-white font-semibold' : 'text-white')}>
                    {opt.label}
                  </span>
                  {opt.badge && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-surface-variant text-white">
                      {opt.badge}
                    </span>
                  )}
                </div>
                {opt.description && (
                  <p className="field-hint">
                    {opt.description}
                  </p>
                )}
              </div>
            </label>
          );
        })}
      </div>

      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
