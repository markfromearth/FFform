import React, { useState, useEffect } from 'react';
import { TextInput, TextInputProps } from './TextInput';
import { formatCurrency, parseCurrencyInput } from '../../utils/formatters';

interface CurrencyInputProps extends Omit<TextInputProps, 'value' | 'onChange' | 'type'> {
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  allowZero?: boolean;
}

export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  value,
  onChange,
  allowZero = false,
  label,
  hint,
  error,
  placeholder = '0',
  ...props
}) => {
  // Local display state for active editing
  const [displayValue, setDisplayValue] = useState<string>(() => {
    if (value === null || value === undefined) return '';
    return value.toLocaleString('en-GB');
  });

  const [isFocused, setIsFocused] = useState<boolean>(false);

  useEffect(() => {
    if (!isFocused) {
      if (value === null || value === undefined) {
        setDisplayValue('');
      } else {
        setDisplayValue(value.toLocaleString('en-GB'));
      }
    }
  }, [value, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Allow digits and empty string
    const digitsOnly = raw.replace(/[^0-9]/g, '');
    setDisplayValue(digitsOnly);

    const parsed = parseCurrencyInput(digitsOnly);
    onChange(parsed);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    if (value !== null && value !== undefined) {
      setDisplayValue(value.toLocaleString('en-GB'));
    }
    props.onBlur?.(e);
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    if (value !== null && value !== undefined) {
      setDisplayValue(value.toString());
    }
    props.onFocus?.(e);
  };

  return (
    <TextInput
      label={label}
      hint={hint}
      error={error}
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={placeholder}
      leftAddon={<span className="font-semibold text-white/70 text-base">£</span>}
      inputMode="numeric"
      autoComplete="off"
      {...props}
    />
  );
};
