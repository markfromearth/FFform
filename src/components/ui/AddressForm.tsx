import React from 'react';
import { PhysicalAddress } from '../../types/application';
import { TextInput } from './TextInput';


interface AddressFormProps {
  address: PhysicalAddress;
  onChange: (updated: PhysicalAddress) => void;
  errors?: Record<string, string>;
  errorPrefix?: string;
  namePrefix?: string;
  idPrefix?: string;
  autoCompletePrefix?: string;
  legend?: string;
  required?: boolean;
  isPrepopulated?: boolean;
  prepopulatedSource?: string;
}

export const AddressForm: React.FC<AddressFormProps> = ({
  address,
  onChange,
  errors = {},
  errorPrefix = '',
  namePrefix = '',
  idPrefix = '',
  autoCompletePrefix = '',
  legend,
  required = true,
  isPrepopulated = false,
  prepopulatedSource = 'Companies House Verified',
}) => {
  const getError = (field: keyof PhysicalAddress) => {
    const key = errorPrefix ? `${errorPrefix}.${field}` : field;
    return errors[key];
  };

  const handleChange = (field: keyof PhysicalAddress, val: string) => {
    onChange({
      ...address,
      [field]: val,
    });
  };

  const pfx = namePrefix ? `${namePrefix}_` : '';
  const idPfx = idPrefix || (namePrefix ? `${namePrefix}_` : 'addr_');
  const acPfx = autoCompletePrefix ? `${autoCompletePrefix} ` : '';

  return (
    <fieldset className="space-y-4 rounded-xl border border-white/10 bg-slate-50/50 p-4 sm:p-5 transition-all">
      {legend && (
        <legend className="px-2 text-sm font-semibold text-white bg-white/10 border border-white/10 rounded-md shadow-xs">
          {legend}
        </legend>
      )}

      <TextInput
        id={`${idPfx}line1`}
        name={`${pfx}address_line1`}
        label="Address Line 1"
        placeholder="Building number and street name"
        value={address.line1 || ''}
        onChange={(e) => handleChange('line1', e.target.value)}
        error={getError('line1')}
        required={required}
        autoComplete={`${acPfx}address-line1`}
        isPrepopulated={isPrepopulated && !!address.line1}
      />

      <TextInput
        id={`${idPfx}line2`}
        name={`${pfx}address_line2`}
        label="Address Line 2 (Optional)"
        placeholder="Suite, unit, building, floor, etc."
        value={address.line2 || ''}
        onChange={(e) => handleChange('line2', e.target.value)}
        error={getError('line2')}
        autoComplete={`${acPfx}address-line2`}
        isPrepopulated={isPrepopulated && !!address.line2}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextInput
          id={`${idPfx}city`}
          name={`${pfx}city`}
          label="Town / City"
          placeholder="e.g. London, Manchester, Glasgow"
          value={address.city || ''}
          onChange={(e) => handleChange('city', e.target.value)}
          error={getError('city')}
          required={required}
          autoComplete={`${acPfx}address-level2`}
          isPrepopulated={isPrepopulated && !!address.city}
        />

        <TextInput
          id={`${idPfx}county`}
          name={`${pfx}county`}
          label="County / Region (Optional)"
          placeholder="e.g. Greater London, West Midlands"
          value={address.county || ''}
          onChange={(e) => handleChange('county', e.target.value)}
          error={getError('county')}
          autoComplete={`${acPfx}address-level1`}
          isPrepopulated={isPrepopulated && !!address.county}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextInput
          id={`${idPfx}postcode`}
          name={`${pfx}postcode`}
          label="Postcode"
          placeholder="e.g. EC1A 1BB"
          value={address.postcode || ''}
          onChange={(e) => handleChange('postcode', e.target.value.toUpperCase())}
          error={getError('postcode')}
          required={required}
          autoComplete={`${acPfx}postal-code`}
          isPrepopulated={isPrepopulated && !!address.postcode}
        />

        <TextInput
          id={`${idPfx}country`}
          name={`${pfx}country`}
          label="Country"
          placeholder="United Kingdom"
          value={address.country || 'United Kingdom'}
          onChange={(e) => handleChange('country', e.target.value)}
          error={getError('country')}
          required={required}
          autoComplete={`${acPfx}country-name`}
          isPrepopulated={isPrepopulated && !!address.country}
        />
      </div>
    </fieldset>
  );
};
