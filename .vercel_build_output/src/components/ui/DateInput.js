import React from 'react';
import { TextInput } from './TextInput';
import { Calendar } from 'lucide-react';
export const DateInput = ({ value, onChange, formatType = 'DD/MM/YYYY', label, hint, error, placeholder, ...props }) => {
    const defaultPlaceholder = formatType === 'DD/MM/YYYY' ? 'DD/MM/YYYY' : 'MM/YY';
    const handleChange = (e) => {
        let input = e.target.value.replace(/[^0-9/]/g, '');
        // Auto-insert slash for DD/MM/YYYY
        if (formatType === 'DD/MM/YYYY') {
            const numbers = input.replace(/\D/g, '');
            if (numbers.length <= 2) {
                input = numbers;
            }
            else if (numbers.length <= 4) {
                input = `${numbers.slice(0, 2)}/${numbers.slice(2)}`;
            }
            else {
                input = `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}/${numbers.slice(4, 8)}`;
            }
        }
        else if (formatType === 'MM/YY') {
            const numbers = input.replace(/\D/g, '');
            if (numbers.length <= 2) {
                input = numbers;
            }
            else {
                input = `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}`;
            }
        }
        onChange(input);
    };
    return (<TextInput label={label} hint={hint || `Format: ${formatType}`} error={error} value={value || ''} onChange={handleChange} placeholder={placeholder || defaultPlaceholder} leftAddon={<Calendar className="w-4 h-4 text-slate-400" aria-hidden="true"/>} maxLength={formatType === 'DD/MM/YYYY' ? 10 : 5} inputMode="numeric" {...props}/>);
};
