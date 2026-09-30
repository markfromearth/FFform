import React from 'react';
import { TextInput, TextInputProps } from './TextInput';
import { Phone } from 'lucide-react';

interface PhoneInputProps extends Omit<TextInputProps, 'onChange' | 'value'> {
  value: string;
  onChange: (val: string) => void;
}

export const PhoneInput: React.FC<PhoneInputProps> = ({
  value,
  onChange,
  label,
  hint = 'e.g. 020 7946 0991 or +44 7700 900077',
  error,
  placeholder = '07700 900000',
  ...props
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  return (
    <TextInput
      id={props.id}
      name={props.name || 'tel'}
      label={label}
      hint={hint}
      error={error}
      value={value || ''}
      onChange={handleChange}
      placeholder={placeholder}
      leftAddon={<Phone className="w-4 h-4 text-white/60" aria-hidden="true" />}
      type="tel"
      autoComplete={props.autoComplete || 'tel'}
      {...props}
    />
  );
};
