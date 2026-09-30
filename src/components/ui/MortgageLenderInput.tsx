import React, { useState, useEffect, useRef, useId } from 'react';
import {
  searchMortgageLenders,
  MortgageLenderSearchResult,
  LenderCategory,
} from '../../services/mortgageLenderService';
import { Building2, Search, CheckCircle2, Phone, AlertCircle, X, ShieldCheck } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface MortgageLenderInputProps {
  id?: string;
  name: string;
  label: string;
  hint?: string;
  placeholder?: string;
  value: string;
  onChange: (val: string) => void;
  onSelectLender?: (lender: MortgageLenderSearchResult) => void;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  wrapperClassName?: string;
}

const CATEGORY_STYLES: Record<LenderCategory, { bg: string; text: string; border: string }> = {
  'High Street Bank': {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
  },
  'Specialist Commercial Lender': {
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-200',
  },
  'Building Society': {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
  },
  'Challenger Bank': {
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
  },
  'Private Bank': {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
  },
  'UK Registered Company': {
    bg: 'bg-surface-variant',
    text: 'text-white/90',
    border: 'border-white/10',
  },
};

export const MortgageLenderInput: React.FC<MortgageLenderInputProps> = ({
  id,
  name,
  label,
  hint,
  placeholder = 'e.g. Barclays Commercial Mortgages, Shawbrook Bank, Allica...',
  value,
  onChange,
  onSelectLender,
  error,
  required = false,
  disabled = false,
  wrapperClassName,
}) => {
  const generatedId = useId();
  const inputId = id || name || generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const listboxId = `${inputId}-listbox`;

  const [suggestions, setSuggestions] = useState<MortgageLenderSearchResult[]>([]);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [selectedLender, setSelectedLender] = useState<MortgageLenderSearchResult | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search when input value changes
  useEffect(() => {
    const query = value?.trim() || '';
    if (query.length < 1) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    // Debounce slightly for smooth typing and fallback fetching
    let isMounted = true;
    const timer = setTimeout(async () => {
      const results = await searchMortgageLenders(query, 7, true);
      if (isMounted) {
        setSuggestions(results);
        setIsOpen(results.length > 0);
        setHighlightedIndex(-1);
      }
    }, 150);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [value]);

  const handleSelect = (lender: MortgageLenderSearchResult) => {
    onChange(lender.name);
    setSelectedLender(lender);
    onSelectLender?.(lender);
    setIsOpen(false);
    setSuggestions([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === 'ArrowDown') {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter') {
      if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        e.preventDefault();
        handleSelect(suggestions[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  const handleClear = () => {
    onChange('');
    setSelectedLender(null);
    setSuggestions([]);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className={twMerge('w-full flex flex-col gap-1.5 relative', wrapperClassName)}>
      {/* Label and Source indicator */}
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={inputId} className="text-sm font-semibold text-white flex items-center gap-1">
          {label}
          {required && <span className="field-error" aria-hidden="true">*</span>}
        </label>
        <span className="text-[11px] text-brand-600 font-medium flex items-center gap-1">
          <ShieldCheck className="w-3 h-3 text-brand-600" />
          <span>FCA & UK Finance Verified Lenders</span>
        </span>
      </div>

      {hint && (
        <p id={hintId} className="field-hint">
          {hint}
        </p>
      )}

      {/* Input Field with Left Icon and Clear button */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/60">
          <Building2 className="w-4 h-4" />
        </div>

        <input
          id={inputId}
          name={name}
          ref={inputRef}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-activedescendant={
            highlightedIndex >= 0 ? `${inputId}-option-${highlightedIndex}` : undefined
          }
          autoComplete="off"
          disabled={disabled}
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (selectedLender && e.target.value !== selectedLender.name) {
              setSelectedLender(null);
            }
          }}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className={clsx(
            'field pl-10 pr-10 py-2.5 text-sm min-h-[44px]',
            value && value !== '' && 'is-filled'
          )}
        />

        {value && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-white/60 hover:text-white/80 focus:outline-none"
            aria-label="Clear lender name"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Auto-suggest Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute top-full left-0 right-0 z-50 mt-1 max-h-72 overflow-y-auto rounded-lg border border-white/10 bg-[#264673] shadow-lg py-1.5 focus:outline-none animate-in fade-in-50 duration-100"
        >
          <li className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white/80 border-b border-slate-100 flex items-center justify-between">
            <span>UK Mortgage Lenders & Administrators</span>
            <span className="text-[10px] font-normal lowercase text-white/70">select to auto-fill</span>
          </li>

          {suggestions.map((lender, index) => {
            const isHighlighted = index === highlightedIndex;
            const categoryStyle = CATEGORY_STYLES[lender.category] || CATEGORY_STYLES['UK Registered Company'];

            return (
              <li
                key={lender.id}
                id={`${inputId}-option-${index}`}
                role="option"
                aria-selected={isHighlighted}
                onMouseEnter={() => setHighlightedIndex(index)}
                onClick={() => handleSelect(lender)}
                className={clsx(
                  'px-3.5 py-2.5 cursor-pointer transition-colors border-b border-slate-50 last:border-b-0 flex flex-col gap-1',
                  isHighlighted ? 'bg-surface-variant text-primary' : 'hover:bg-surface-variant text-white'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-sm leading-snug">
                    {lender.name}
                  </span>
                  <span
                    className={clsx(
                      'text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap',
                      categoryStyle.bg,
                      categoryStyle.text,
                      categoryStyle.border
                    )}
                  >
                    {lender.category}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs text-white/70">
                  {lender.phone && (
                    <span className="inline-flex items-center gap-1 font-mono text-[11px] text-white/80">
                      <Phone className="w-3 h-3 text-brand-600" />
                      {lender.phone}
                    </span>
                  )}
                  {lender.department && (
                    <span className="truncate">
                      {lender.department}
                    </span>
                  )}
                  {lender.fcaNumber && (
                    <span className="ml-auto text-[10px] font-mono text-white/70">
                      FRN: {lender.fcaNumber}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {error && (
        <p id={errorId} className="field-error" role="alert">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
};
