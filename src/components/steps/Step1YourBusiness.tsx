import React, { useState, useEffect, useRef } from 'react';
import { useApplication } from '../../context/ApplicationContext';
import { searchCompaniesHouse, getCompanyOfficers, getCompanyProfile, CompaniesHouseCompany, formatOfficerName } from '../../services/companiesHouseService';
import { mapSicToSector } from '../../utils/sicMapping';
import { Check, Search, Building2, User, MapPin, AlertCircle } from 'lucide-react';
import { ErrorSummary } from '../common/ErrorSummary';

export const Step1YourBusiness: React.FC = () => {
  const { data, updateBusiness, nextStep, errors, validateField, clearError } = useApplication();
  
  // Companies House Search State
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CompaniesHouseCompany[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  
  // Company Confirmation State
  const [selectedCompany, setSelectedCompany] = useState<CompaniesHouseCompany | null>(null);
  const [companyConfirmed, setCompanyConfirmed] = useState(false);
  
  // Officers State
  const [officers, setOfficers] = useState<{name: string, role: string}[]>([]);
  const [isLoadingOfficers, setIsLoadingOfficers] = useState(false);
  
  // Manual Entry State
  const [isManualEntry, setIsManualEntry] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);

  // Handle outside click to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced Search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.length >= 3 && !companyConfirmed && !isManualEntry) {
        setIsSearching(true);
        const searchResults = await searchCompaniesHouse(query);
        setResults(searchResults);
        setShowResults(true);
        setIsSearching(false);
      } else {
        setResults([]);
        setShowResults(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [query, companyConfirmed, isManualEntry]);

  const handleSelectCompany = async (company: CompaniesHouseCompany) => {
    setSelectedCompany(company);
    setShowResults(false);
    setQuery('');
    setCompanyConfirmed(false);
    
    // Pre-fetch the full profile just in case we need more details
    const fullProfile = await getCompanyProfile(company.company_number);
    if (fullProfile) {
      setSelectedCompany(fullProfile);
    }
  };

  const handleConfirmCompany = async () => {
    if (!selectedCompany) return;
    
    setCompanyConfirmed(true);
    
    const mappedIndustry = mapSicToSector(selectedCompany.sic_codes);
    
    updateBusiness({
      company_name: selectedCompany.company_name,
      company_number: selectedCompany.company_number,
      company_status: selectedCompany.company_status,
      entity_type: selectedCompany.company_type,
      incorporation_date: selectedCompany.date_of_creation,
      companies_house_source: 'public_data_api',
      companies_house_retrieved_at: new Date().toISOString(),
      sic_codes: selectedCompany.sic_codes || [],
      industry: mappedIndustry,
      registered_address: {
        address_line_1: selectedCompany.registered_office_address.address_line_1 || selectedCompany.registered_office_address.premises,
        locality: selectedCompany.registered_office_address.locality,
        postal_code: selectedCompany.registered_office_address.postal_code,
        country: selectedCompany.registered_office_address.country || 'United Kingdom',
      }
    });
    clearError('company_name');
    clearError('entity_type');
    if (mappedIndustry) {
      clearError('industry');
    }

    // Fetch officers
    setIsLoadingOfficers(true);
    const fetchedOfficers = await getCompanyOfficers(selectedCompany.company_number);
    // Filter active directors
    const activeDirectors = fetchedOfficers
      .filter(o => !o.resigned_on && o.officer_role.toLowerCase().includes('director'))
      .map(o => ({ name: formatOfficerName(o.name), role: o.officer_role }));
    setOfficers(activeDirectors);
    setIsLoadingOfficers(false);
  };

  const handleResetCompany = () => {
    setSelectedCompany(null);
    setCompanyConfirmed(false);
    setIsManualEntry(false);
    setQuery('');
    updateBusiness({
      company_name: '',
      company_number: '',
    });
  };
  
  const handleEnableManualEntry = () => {
    setIsManualEntry(true);
    setSelectedCompany(null);
    setCompanyConfirmed(true);
    setShowResults(false);
  };

  return (
    <div className="max-w-2xl mx-auto px-4">
      <div className="mb-8">
        <h2 className="text-title-s text-primary tracking-wide uppercase mb-1">Check your options</h2>
        <h1 className="text-display-s text-on-surface mb-3">Tell us about your business</h1>
        <p className="text-on-surface-variant text-body-l">We'll use these details to see which invoice finance providers are most likely to suit you.</p>
      </div>
      
      <div className="space-y-8">
        <fieldset>
          <legend className="block text-title-s text-on-surface mb-2">Does your business invoice other businesses for goods or services already supplied?</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label htmlFor="b2b_yes" className={`flex items-center p-4 border rounded-xl cursor-pointer transition-colors min-h-touch ${data.business?.b2b_completed_supply === 'yes' ? 'border-primary bg-surface-variant ring-1 ring-primary' : 'border-outline-variant hover:bg-surface-variant'}`}>
              <input id="b2b_yes" type="radio" name="b2b" className="h-4 w-4 text-primary focus:ring-accent border-outline" checked={data.business?.b2b_completed_supply === 'yes'} onChange={() => { updateBusiness({ b2b_completed_supply: 'yes' }); clearError('b2b_completed_supply'); }} aria-invalid={!!errors.b2b_completed_supply} aria-describedby={errors.b2b_completed_supply ? "b2b_completed_supply_error" : undefined} />
              <span className="ml-3 text-label-m text-on-surface">Yes</span>
            </label>
            <label htmlFor="b2b_mixture" className={`flex items-center p-4 border rounded-xl cursor-pointer transition-colors min-h-touch ${data.business?.b2b_completed_supply === 'mixture' ? 'border-primary bg-surface-variant ring-1 ring-primary' : 'border-outline-variant hover:bg-surface-variant'}`}>
              <input id="b2b_mixture" type="radio" name="b2b" className="h-4 w-4 text-primary focus:ring-accent border-outline" checked={data.business?.b2b_completed_supply === 'mixture'} onChange={() => { updateBusiness({ b2b_completed_supply: 'mixture' }); clearError('b2b_completed_supply'); }} aria-invalid={!!errors.b2b_completed_supply} aria-describedby={errors.b2b_completed_supply ? "b2b_completed_supply_error" : undefined} />
              <span className="ml-3 text-label-m text-on-surface">A mixture of businesses and consumers</span>
            </label>
          </div>
          {errors.b2b_completed_supply && (
            <p className="mt-2 text-label-s text-error flex items-center gap-1" id="b2b_completed_supply_error">
              <AlertCircle className="w-4 h-4" />
              {errors.b2b_completed_supply}
            </p>
          )}
        </fieldset>

        {/* Company Search / Display */}
        <div className="space-y-4" ref={searchRef}>
          <label htmlFor="company_search" className="block text-title-s text-on-surface">What is your business?</label>
          
          {!selectedCompany && !isManualEntry && (
            <div className="relative">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-on-surface-variant" />
                </div>
                <input
                  id="company_search"
                  type="text"
                  role="combobox"
                  aria-expanded={showResults}
                  aria-controls="company_results"
                  aria-autocomplete="list"
                  className={`w-full pl-10 min-h-touch p-3 border rounded-lg focus:ring-2 focus:ring-accent focus:border-primary text-body-l bg-surface ${errors.company_name ? 'border-error text-error focus:ring-error focus:border-error' : 'border-outline'}`}
                  placeholder="e.g. Acme Corp or 12345678"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => { if (results.length > 0) setShowResults(true); }}
                  onKeyDown={(e) => { if (e.key === 'Escape') setShowResults(false); }}
                  aria-invalid={!!errors.company_name}
                  aria-describedby={errors.company_name ? "company_name_error" : undefined}
                />
              </div>
              {errors.company_name ? (
                <p className="mt-2 text-label-s text-error flex items-center gap-1" id="company_name_error">
                  <AlertCircle className="w-4 h-4" />
                  {errors.company_name}
                </p>
              ) : (
                <p className="mt-2 text-label-s text-on-surface-variant">Search by company name or Companies House number</p>
              )}

              {/* Dropdown Results */}
              {showResults && (
                <div id="company_results" role="listbox" className="absolute z-10 w-full mt-1 bg-surface border border-outline-variant rounded-lg shadow-lg overflow-hidden max-h-80 overflow-y-auto">
                  {isSearching ? (
                    <div className="p-4 text-center text-body-m text-on-surface-variant">Searching...</div>
                  ) : results.length > 0 ? (
                    results.map(result => (
                      <button
                        key={result.company_number}
                        type="button"
                        role="option"
                        className="w-full text-left px-4 py-3 border-b border-outline-variant hover:bg-surface-variant focus:bg-surface-variant transition flex justify-between items-center"
                        onClick={() => handleSelectCompany(result)}
                      >
                        <div>
                          <p className="text-label-m text-on-surface">{result.company_name}</p>
                          <p className="text-label-s text-on-surface-variant mt-1">
                            Company {result.company_number} · {result.registered_office_address?.postal_code || ''}
                          </p>
                        </div>
                        <span className={`text-label-s px-2 py-1 rounded-full ${result.company_status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                          {result.company_status}
                        </span>
                      </button>
                    ))
                  ) : query.length >= 3 ? (
                    <div className="p-4 text-center text-body-m text-on-surface-variant">No companies found</div>
                  ) : null}
                </div>
              )}
              
              <button type="button" onClick={handleEnableManualEntry} className="text-label-m text-primary mt-2 hover:underline">
                I cannot find my business
              </button>
            </div>
          )}

          {/* Unconfirmed Company Card */}
          {selectedCompany && !companyConfirmed && !isManualEntry && (
            <div className="bg-surface-variant border border-outline-variant rounded-xl p-5">
              <div className="flex justify-between items-start mb-3">
                <h3 className="text-title-s text-on-surface">{selectedCompany.company_name}</h3>
                <span className={`text-label-s px-2 py-1 rounded-full ${selectedCompany.company_status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                  {selectedCompany.company_status}
                </span>
              </div>
              <div className="space-y-1 text-body-m text-on-surface-variant mb-5">
                <p>Company number: {selectedCompany.company_number}</p>
                <p>Registered office: {[selectedCompany.registered_office_address.address_line_1, selectedCompany.registered_office_address.locality, selectedCompany.registered_office_address.postal_code].filter(Boolean).join(', ')}</p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleConfirmCompany}
                  className="px-4 py-2 bg-primary text-on-primary text-label-m rounded-full shadow-elevation-1 hover:shadow-elevation-2 transition min-h-touch"
                >
                  Yes, this is my company
                </button>
                <button
                  type="button"
                  onClick={handleResetCompany}
                  className="px-4 py-2 bg-surface border border-outline text-on-surface text-label-m rounded-full hover:bg-surface-variant transition min-h-touch"
                >
                  Choose another
                </button>
              </div>
            </div>
          )}

          {/* Confirmed Company Display (API) */}
          {companyConfirmed && selectedCompany && !isManualEntry && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-5 flex items-start justify-between">
              <div className="flex gap-3">
                <div className="mt-1">
                  <Check className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-title-s text-on-surface">{selectedCompany.company_name}</h3>
                  <p className="text-body-m text-on-surface-variant">Company number: {selectedCompany.company_number}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleResetCompany}
                className="text-label-m text-primary hover:underline min-h-touch"
              >
                Change
              </button>
            </div>
          )}
          
          {/* Manual Entry */}
          {isManualEntry && (
             <div className="space-y-4 p-5 border border-outline-variant rounded-xl bg-surface-variant">
               <div className="flex justify-between items-center mb-2">
                 <h3 className="text-title-s text-on-surface">Enter business details manually</h3>
                 <button type="button" onClick={handleResetCompany} className="text-label-m text-primary hover:underline min-h-touch">Cancel</button>
               </div>
               <div>
                  <label htmlFor="manual_company_name" className="block text-label-m text-on-surface mb-1">Business Name</label>
                  <input
                    id="manual_company_name"
                    type="text"
                    className={`w-full min-h-touch p-3 border rounded-lg focus:ring-2 focus:ring-accent focus:border-primary text-body-l bg-surface ${errors.company_name ? 'border-error text-error focus:ring-error focus:border-error' : 'border-outline'}`}
                    placeholder="e.g. Acme Corp"
                    value={data.business?.company_name || ''}
                    onChange={(e) => { updateBusiness({ company_name: e.target.value }); clearError('company_name'); }}
                    onBlur={() => validateField(0, 'company_name')}
                    aria-invalid={!!errors.company_name}
                    aria-describedby={errors.company_name ? "manual_company_name_error" : undefined}
                  />
                  {errors.company_name && (
                    <p className="mt-1 text-label-s text-error flex items-center gap-1" id="manual_company_name_error">
                      <AlertCircle className="w-4 h-4" />
                      {errors.company_name}
                    </p>
                  )}
               </div>
               <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label htmlFor="entity_type" className="block text-label-m text-on-surface mb-1">Entity Type</label>
                    <select
                      id="entity_type"
                      className={`w-full min-h-touch p-3 border rounded-lg focus:ring-2 focus:ring-accent focus:border-primary text-body-l bg-surface ${errors.entity_type ? 'border-error text-error focus:ring-error focus:border-error' : 'border-outline'}`}
                      value={data.business?.entity_type || ''}
                      onChange={(e) => { updateBusiness({ entity_type: e.target.value }); clearError('entity_type'); }}
                      onBlur={() => validateField(0, 'entity_type')}
                      aria-invalid={!!errors.entity_type}
                      aria-describedby={errors.entity_type ? "entity_type_error" : undefined}
                    >
                      <option value="">Select type</option>
                      <option value="limited_company">Limited company</option>
                      <option value="llp">LLP</option>
                      <option value="partnership">Partnership</option>
                      <option value="sole_trader">Sole trader</option>
                      <option value="other">Other</option>
                    </select>
                    {errors.entity_type && (
                      <p className="mt-1 text-label-s text-error flex items-center gap-1" id="entity_type_error">
                        <AlertCircle className="w-4 h-4" />
                        {errors.entity_type}
                      </p>
                    )}
                 </div>
                 <div>
                    <label htmlFor="postal_code" className="block text-label-m text-on-surface mb-1">Postcode</label>
                    <input
                      id="postal_code"
                      type="text"
                      className="w-full min-h-touch p-3 border rounded-lg focus:ring-2 focus:ring-accent focus:border-primary text-body-l bg-surface border-outline"
                      placeholder="e.g. SW1A 1AA"
                      value={data.business?.registered_address?.postal_code || ''}
                      onChange={(e) => updateBusiness({ registered_address: { ...data.business?.registered_address, postal_code: e.target.value }})}
                    />
                 </div>
               </div>
             </div>
          )}
        </div>
        
        {/* Branch: Registered Address Confirmation */}
        {companyConfirmed && !isManualEntry && (
          <fieldset className="animate-in fade-in slide-in-from-top-4 duration-300">
            <legend className="block text-title-s text-on-surface mb-2">Is your trading address the same as your registered office?</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label htmlFor="same-address-yes" className={`flex items-center p-4 border rounded-xl cursor-pointer transition-colors min-h-touch ${data.business?.trading_address_same_as_registered === true ? 'border-primary bg-surface-variant ring-1 ring-primary' : 'border-outline-variant hover:bg-surface-variant'}`}>
                <input id="same-address-yes" type="radio" name="same-address" className="h-4 w-4 text-primary focus:ring-accent border-outline" checked={data.business?.trading_address_same_as_registered === true} onChange={() => updateBusiness({ trading_address_same_as_registered: true })} />
                <span className="ml-3 text-label-m text-on-surface">Yes</span>
              </label>
              <label htmlFor="same-address-no" className={`flex items-center p-4 border rounded-xl cursor-pointer transition-colors min-h-touch ${data.business?.trading_address_same_as_registered === false ? 'border-primary bg-surface-variant ring-1 ring-primary' : 'border-outline-variant hover:bg-surface-variant'}`}>
                <input id="same-address-no" type="radio" name="same-address" className="h-4 w-4 text-primary focus:ring-accent border-outline" checked={data.business?.trading_address_same_as_registered === false} onChange={() => updateBusiness({ trading_address_same_as_registered: false })} />
                <span className="ml-3 text-label-m text-on-surface">No</span>
              </label>
            </div>
            
            {data.business?.trading_address_same_as_registered === false && (
              <div className="mt-4">
                <label htmlFor="trading_address_line_1" className="block text-title-s text-on-surface mb-2">Trading address</label>
                <input
                  id="trading_address_line_1"
                  type="text"
                  className="w-full min-h-touch p-3 border rounded-lg focus:ring-2 focus:ring-accent focus:border-primary text-body-l bg-surface border-outline"
                  placeholder="e.g. 123 High Street"
                  value={data.business?.trading_address?.address_line_1 || ''}
                  onChange={(e) => updateBusiness({ trading_address: { ...data.business?.trading_address, address_line_1: e.target.value }})}
                />
              </div>
            )}
          </fieldset>
        )}
        
        {/* Branch: Officers Dropdown */}
        {companyConfirmed && !isManualEntry && (
          <div className="animate-in fade-in slide-in-from-top-4 duration-300 delay-100">
             <label htmlFor="selected_officer_name" className="block text-title-s text-on-surface mb-2">Who is completing this enquiry?</label>
             {isLoadingOfficers ? (
               <div className="p-3 border border-outline-variant rounded-lg bg-surface-variant text-body-m text-on-surface-variant min-h-touch flex items-center">Loading directors...</div>
             ) : (
               <select
                 id="selected_officer_name"
                 className="w-full min-h-touch p-3 border rounded-lg focus:ring-2 focus:ring-accent focus:border-primary text-body-l bg-surface border-outline"
                 value={data.business?.selected_officer_name || ''}
                 onChange={(e) => updateBusiness({ selected_officer_name: e.target.value })}
               >
                 <option value="">Select an option</option>
                 {officers.map((officer, idx) => (
                   <option key={idx} value={officer.name}>{officer.name} — {officer.role}</option>
                 ))}
                 <option value="not_listed">I am not listed as a director</option>
                 <option value="on_behalf">I am completing this for the business</option>
               </select>
             )}
             <p className="mt-2 text-label-s text-on-surface-variant">Director names are retrieved from Companies House. This does not verify identity or authority.</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-outline-variant">
          <div>
            <label htmlFor="industry" className="block text-title-s text-on-surface mb-2">Industry</label>
            <select
              id="industry"
              className={`w-full min-h-touch p-3 border rounded-lg focus:ring-2 focus:ring-accent focus:border-primary text-body-l bg-surface ${errors.industry ? 'border-error text-error focus:ring-error focus:border-error' : 'border-outline'}`}
              value={data.business?.industry || ''}
              onChange={(e) => { updateBusiness({ industry: e.target.value }); clearError('industry'); }}
              onBlur={() => validateField(0, 'industry')}
              aria-invalid={!!errors.industry}
              aria-describedby={errors.industry ? "industry_error" : undefined}
            >
              <option value="">Select industry</option>
              <option value="construction">Construction and trades</option>
              <option value="haulage">Haulage and logistics</option>
              <option value="recruitment">Recruitment</option>
              <option value="manufacturing">Manufacturing</option>
              <option value="other">Other</option>
            </select>
            {errors.industry && (
              <p className="mt-1 text-label-s text-error flex items-center gap-1" id="industry_error">
                <AlertCircle className="w-4 h-4" />
                {errors.industry}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="annual_turnover" className="block text-title-s text-on-surface mb-2">Approximate annual turnover</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-on-surface-variant text-body-m">£</span>
              </div>
              <input
                id="annual_turnover"
                type="number"
                className={`w-full pl-8 min-h-touch p-3 border rounded-lg focus:ring-2 focus:ring-accent focus:border-primary text-body-l bg-surface ${errors.annual_turnover ? 'border-error text-error focus:ring-error focus:border-error' : 'border-outline'}`}
                placeholder="e.g. 500000"
                value={data.business?.annual_turnover || ''}
                onChange={(e) => { updateBusiness({ annual_turnover: parseInt(e.target.value) || undefined }); clearError('annual_turnover'); }}
                onBlur={() => validateField(0, 'annual_turnover')}
                aria-invalid={!!errors.annual_turnover}
                aria-describedby={errors.annual_turnover ? "annual_turnover_error" : undefined}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                { label: 'Under £100k', val: 50000 },
                { label: '£100k–£250k', val: 175000 },
                { label: '£250k–£500k', val: 375000 },
                { label: '£500k–£1m', val: 750000 },
                { label: '£1m–£5m', val: 2500000 },
                { label: '£5m+', val: 5000000 }
              ].map((btn) => (
                <button
                  key={btn.label}
                  type="button"
                  onClick={() => { updateBusiness({ annual_turnover: btn.val }); clearError('annual_turnover'); }}
                  className="px-3 py-1.5 text-label-s border border-outline-variant rounded-full hover:bg-surface-variant hover:border-primary transition-colors text-on-surface-variant"
                >
                  {btn.label}
                </button>
              ))}
            </div>

            {errors.annual_turnover && (
              <p className="mt-1 text-label-s text-error flex items-center gap-1" id="annual_turnover_error">
                <AlertCircle className="w-4 h-4" />
                {errors.annual_turnover}
              </p>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="gross_debtor_book" className="block text-title-s text-on-surface mb-2">How much is currently owed on unpaid invoices?</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-on-surface-variant text-body-m">£</span>
            </div>
            <input
              id="gross_debtor_book"
              type="number"
              className={`w-full pl-8 min-h-touch p-3 border rounded-lg focus:ring-2 focus:ring-accent focus:border-primary text-body-l bg-surface ${errors.gross_debtor_book ? 'border-error text-error focus:ring-error focus:border-error' : 'border-outline'}`}
              placeholder="e.g. 50000"
              value={data.business?.gross_debtor_book || ''}
              onChange={(e) => { updateBusiness({ gross_debtor_book: parseInt(e.target.value) || undefined }); clearError('gross_debtor_book'); }}
              onBlur={() => validateField(0, 'gross_debtor_book')}
              aria-invalid={!!errors.gross_debtor_book}
              aria-describedby={errors.gross_debtor_book ? "gross_debtor_book_error" : undefined}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              { label: 'Under £10k', val: 5000 },
              { label: '£10k–£50k', val: 30000 },
              { label: '£50k–£100k', val: 75000 },
              { label: '£100k–£250k', val: 175000 },
              { label: '£250k–£500k', val: 375000 },
              { label: '£500k+', val: 750000 }
            ].map((btn) => (
              <button
                key={btn.label}
                type="button"
                onClick={() => { updateBusiness({ gross_debtor_book: btn.val }); clearError('gross_debtor_book'); }}
                className="px-3 py-1.5 text-label-s border border-outline-variant rounded-full hover:bg-surface-variant hover:border-primary transition-colors text-on-surface-variant"
              >
                {btn.label}
              </button>
            ))}
          </div>

          {errors.gross_debtor_book ? (
             <p className="mt-1 text-label-s text-error flex items-center gap-1" id="gross_debtor_book_error">
               <AlertCircle className="w-4 h-4" />
               {errors.gross_debtor_book}
             </p>
          ) : (
             <p className="mt-2 text-label-s text-on-surface-variant">An estimate is fine.</p>
          )}
        </div>
      </div>
      
      <div className="mt-8 flex flex-col gap-4 border-t border-outline-variant pt-6">
        <ErrorSummary errors={errors} />
        <div className="flex items-center justify-between">
          <p className="text-body-m text-on-surface-variant flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
            Initial enquiry only — this will not affect your credit score.
          </p>
          <button
            onClick={nextStep}
            className="px-6 py-3 bg-primary text-on-primary font-medium shadow-elevation-1 hover:shadow-elevation-2 rounded-full min-h-touch flex items-center gap-2 transition-colors"
          >
            Continue
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
          </button>
        </div>
      </div>
    </div>
  );
};
