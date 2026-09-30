import React, { InputHTMLAttributes, TextareaHTMLAttributes, forwardRef, useRef } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { AlertCircle } from 'lucide-react';
import { trackFieldFocused, trackFieldCompleted, trackFieldCleared } from '../../lib/analytics';

export interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: string;
  hint?: string;
  error?: string;
  multiline?: boolean;
  rows?: number;
  leftAddon?: React.ReactNode;
  rightAddon?: React.ReactNode;
  required?: boolean;
  wrapperClassName?: string;
  isPrepopulated?: boolean;
  prepopulatedSource?: string;
}

export const TextInput = forwardRef<HTMLInputElement | HTMLTextAreaElement, TextInputProps>(({
  id,
  name,
  label,
  hint,
  error,
  multiline = false,
  rows = 3,
  leftAddon,
  rightAddon,
  required = false,
  className,
  wrapperClassName,
  disabled,
  isPrepopulated = false,
  prepopulatedSource,
  onFocus,
  onBlur,
  ...props
}, ref) => {
  const inputId = id || name || `input_${Math.random().toString(36).substring(2, 9)}`;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;

  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  const focusStartTimeRef = useRef<number | null>(null);
  const initialValueOnFocusRef = useRef<string>('');

  const handleFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    focusStartTimeRef.current = Date.now();
    initialValueOnFocusRef.current = e.target.value || '';
    const fieldType = multiline ? 'textarea' : (props as any).type || 'text';
    trackFieldFocused(id || name || 'field_input', fieldType);
    onFocus?.(e as any);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const fieldType = multiline ? 'textarea' : (props as any).type || 'text';
    const fieldId = id || name || 'field_input';
    if (focusStartTimeRef.current !== null) {
      const duration = (Date.now() - focusStartTimeRef.current) / 1000;
      if (e.target.value && e.target.value.trim().length > 0) {
        trackFieldCompleted({
          fieldId,
          fieldType,
          timeToCompleteSeconds: duration,
        });
      }
      focusStartTimeRef.current = null;
    }

    if (initialValueOnFocusRef.current.trim().length > 0 && (!e.target.value || e.target.value.trim().length === 0)) {
      trackFieldCleared(fieldId, fieldType);
    }

    onBlur?.(e as any);
  };

  const baseInputStyles = clsx(
    'w-full block transition-colors duration-150 text-white placeholder:text-white/60 border rounded-xl',
    'focus:outline-none focus:ring-4 focus:ring-offset-0 disabled:bg-slate-50 disabled:text-white/70 disabled:cursor-not-allowed',
    error
      ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-200 bg-rose-50/20'
      : isPrepopulated
      ? 'border-emerald-300 bg-emerald-50/50 text-white focus:border-emerald-500 focus:ring-emerald-500/20 hover:border-emerald-400'
      : 'border-white/20 bg-white/10 focus:border-accent focus:ring-accent-soft hover:border-slate-400',
    multiline ? 'p-3 text-base min-h-[92px]' : 'px-[13px] py-[11px] text-base min-h-[48px]',
    leftAddon ? 'pl-10' : '',
    rightAddon ? 'pr-10' : '',
    className
  );

  return (
    <div className={twMerge('w-full flex flex-col gap-1.5', wrapperClassName)}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={inputId} className="text-sm font-semibold text-white flex items-center gap-1">
          {label}
          {required && <span className="text-rose-600 font-bold" aria-hidden="true">*</span>}
        </label>
      </div>

      {hint && (
        <p id={hintId} className="text-xs text-white/70 leading-relaxed">
          {hint}
        </p>
      )}

      <div className="relative">
        {leftAddon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-white/70">
            {leftAddon}
          </div>
        )}

        {multiline ? (
          <textarea
            id={inputId}
            name={name}
            ref={ref as React.ForwardedRef<HTMLTextAreaElement>}
            rows={rows}
            disabled={disabled}
            required={required}
            aria-describedby={describedBy}
            aria-invalid={!!error}
            aria-errormessage={errorId}
            className={baseInputStyles}
            onFocus={handleFocus}
            onBlur={handleBlur}
            {...(props as TextareaHTMLAttributes<HTMLTextAreaElement>)}
          />
        ) : (
          <input
            id={inputId}
            name={name}
            ref={ref as React.ForwardedRef<HTMLInputElement>}
            disabled={disabled}
            required={required}
            aria-describedby={describedBy}
            aria-invalid={!!error}
            aria-errormessage={errorId}
            className={baseInputStyles}
            onFocus={handleFocus}
            onBlur={handleBlur}
            {...props}
          />
        )}

        {rightAddon && !error && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-white/60">
            {rightAddon}
          </div>
        )}

        {error && (
          <div className="absolute top-3 right-3 flex items-center pointer-events-none text-rose-500">
            <AlertCircle className="w-4 h-4" aria-hidden="true" />
          </div>
        )}
      </div>

      {error && (
        <p id={errorId} className="text-xs font-medium text-rose-600 flex items-center gap-1 mt-0.5" role="alert">
          <span>{error}</span>
        </p>
      )}
    </div>
  );
});

TextInput.displayName = 'TextInput';
