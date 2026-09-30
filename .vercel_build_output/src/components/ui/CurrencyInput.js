import React, { useState, useEffect } from 'react';
import { TextInput } from './TextInput';
import { parseCurrencyInput } from '../../utils/formatters';
export const CurrencyInput = ({ value, onChange, allowZero = false, label, hint, error, placeholder = '0', ...props }) => {
    // Local display state for active editing
    const [displayValue, setDisplayValue] = useState(() => {
        if (value === null || value === undefined)
            return '';
        return value.toLocaleString('en-GB');
    });
    const [isFocused, setIsFocused] = useState(false);
    useEffect(() => {
        if (!isFocused) {
            if (value === null || value === undefined) {
                setDisplayValue('');
            }
            else {
                setDisplayValue(value.toLocaleString('en-GB'));
            }
        }
    }, [value, isFocused]);
    const handleChange = (e) => {
        const raw = e.target.value;
        // Allow digits and empty string
        const digitsOnly = raw.replace(/[^0-9]/g, '');
        setDisplayValue(digitsOnly);
        const parsed = parseCurrencyInput(digitsOnly);
        onChange(parsed);
    };
    const handleBlur = (e) => {
        setIsFocused(false);
        if (value !== null && value !== undefined) {
            setDisplayValue(value.toLocaleString('en-GB'));
        }
        props.onBlur?.(e);
    };
    const handleFocus = (e) => {
        setIsFocused(true);
        if (value !== null && value !== undefined) {
            setDisplayValue(value.toString());
        }
        props.onFocus?.(e);
    };
    return (<TextInput label={label} hint={hint} error={error} value={displayValue} onChange={handleChange} onFocus={handleFocus} onBlur={handleBlur} placeholder={placeholder} leftAddon={<span className="font-semibold text-slate-500 text-base">£</span>} inputMode="numeric" autoComplete="off" {...props}/>);
};
