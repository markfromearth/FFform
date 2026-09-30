import React from 'react';
import { TextInput } from './TextInput';
import { Phone } from 'lucide-react';
export const PhoneInput = ({ value, onChange, label, hint = 'e.g. 020 7946 0991 or +44 7700 900077', error, placeholder = '07700 900000', ...props }) => {
    const handleChange = (e) => {
        onChange(e.target.value);
    };
    return (<TextInput id={props.id} name={props.name || 'tel'} label={label} hint={hint} error={error} value={value || ''} onChange={handleChange} placeholder={placeholder} leftAddon={<Phone className="w-4 h-4 text-slate-400" aria-hidden="true"/>} type="tel" autoComplete={props.autoComplete || 'tel'} {...props}/>);
};
