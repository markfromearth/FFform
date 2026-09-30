import React, { InputHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Check } from 'lucide-react';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(({
  id,
  name,
  label,
  hint,
  error,
  checked,
  onChange,
  disabled,
  className,
  ...props
}, ref) => {
  const inputId = id || name || `checkbox_${Math.random().toString(36).substring(2, 9)}`;

  return (
    <div className={twMerge('relative flex items-start gap-3', className)}>
      <div className="flex items-center h-5 mt-0.5">
        <input
          id={inputId}
          name={name}
          ref={ref}
          type="checkbox"
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className="sr-only peer"
          aria-invalid={!!error}
          {...props}
        />
        <span
          className={clsx(
            'flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors cursor-pointer select-none',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500 peer-focus-visible:ring-offset-2',
            checked
              ? 'border-brand-600 bg-brand-600 text-white'
              : 'border-white/20 bg-white/10 hover:border-slate-400',
            disabled && 'opacity-50 cursor-not-allowed',
            error && !checked && 'border-rose-500 bg-rose-50/50'
          )}
          aria-hidden="true"
          onClick={() => {
            if (!disabled) {
              document.getElementById(inputId)?.click();
            }
          }}
        >
          {checked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <label htmlFor={inputId} className="text-sm font-medium text-white cursor-pointer select-none">
          {label}
        </label>
        {hint && <div className="text-xs text-white/70 mt-0.5">{hint}</div>}
        {error && (
          <p className="text-xs font-medium text-rose-600 mt-1" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
});

Checkbox.displayName = 'Checkbox';
