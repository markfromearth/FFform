import React from 'react';
import { useApplication } from '../../context/ApplicationContext';
import { Info, AlertCircle } from 'lucide-react';

export const Step3YourInvoices: React.FC = () => {
  const { data, updateInvoices, nextStep, prevStep, errors, validateField, clearError } = useApplication();
  
  const isConstruction = data.business?.industry === 'construction';
  const isRecruitment = data.business?.industry === 'recruitment';
  const hasExport = data.invoices?.debtor_geography?.some(g => ['europe', 'north_america', 'other_international'].includes(g));

  const handleGeographyToggle = (val: string) => {
    const current = data.invoices?.debtor_geography || [];
    let newGeography;
    if (current.includes(val)) {
      newGeography = current.filter(g => g !== val);
    } else {
      newGeography = [...current, val];
    }
    updateInvoices({ debtor_geography: newGeography });
    if (newGeography.length > 0) {
      clearError('debtor_geography');
    } else {
      validateField(2, 'debtor_geography');
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4">
      <div className="mb-8">
        <h2 className="text-title-s text-primary tracking-wide uppercase mb-1">Your invoices</h2>
        <h1 className="text-display-s text-on-surface mb-3">What would you like the facility to do?</h1>
        <p className="text-on-surface-variant text-body-l">Tell us the outcome you want. You do not need to know which invoice finance product is right for you.</p>
      </div>
      
      <div className="space-y-8">
        <fieldset>
          <legend className="block text-title-s text-on-surface mb-3">What would be most useful?</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { id: 'release_all', label: 'Release cash from all unpaid invoices' },
              { id: 'help_credit_control', label: 'Help with credit control and collections' },
              { id: 'keep_control', label: 'Keep control of customer collections' },
              { id: 'fund_selected', label: 'Fund selected invoices or customers' },
              { id: 'replace_existing', label: 'Replace an existing provider' },
              { id: 'not_sure', label: 'Not sure — give me options' },
            ].map(option => (
              <label key={option.id} htmlFor={`outcome_${option.id}`} className={`flex items-start p-4 border rounded-xl cursor-pointer transition-colors min-h-touch ${data.invoices?.desired_outcome === option.id ? 'border-primary bg-surface-variant ring-1 ring-primary' : 'border-outline-variant hover:bg-surface-variant'}`}>
                <input
                  id={`outcome_${option.id}`}
                  type="radio"
                  name="outcome"
                  className="mt-0.5 h-4 w-4 text-primary focus:ring-accent border-outline"
                  checked={data.invoices?.desired_outcome === option.id}
                  onChange={() => { updateInvoices({ desired_outcome: option.id }); clearError('desired_outcome'); }}
                  aria-invalid={!!errors.desired_outcome}
                  aria-describedby={errors.desired_outcome ? "desired_outcome_error" : undefined}
                />
                <span className="ml-3 text-label-m text-on-surface leading-tight">{option.label}</span>
              </label>
            ))}
          </div>
          {errors.desired_outcome && (
            <p className="mt-2 text-label-s text-error flex items-center gap-1" id="desired_outcome_error">
              <AlertCircle className="w-4 h-4" />
              {errors.desired_outcome}
            </p>
          )}
        </fieldset>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-outline-variant">
          <div>
            <label htmlFor="requested_facility" className="block text-title-s text-on-surface mb-2">Ideal funding limit</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-on-surface-variant text-body-m">£</span>
              </div>
              <input
                id="requested_facility"
                type="number"
                className={`w-full pl-8 min-h-touch p-3 border rounded-lg focus:ring-2 focus:ring-accent focus:border-primary text-body-l bg-surface ${errors.requested_facility ? 'border-error text-error focus:ring-error focus:border-error' : 'border-outline'}`}
                placeholder="e.g. 150000"
                value={data.invoices?.requested_facility || ''}
                onChange={(e) => { updateInvoices({ requested_facility: parseInt(e.target.value) || undefined }); clearError('requested_facility'); }}
                onBlur={() => validateField(2, 'requested_facility')}
                aria-invalid={!!errors.requested_facility}
                aria-describedby={errors.requested_facility ? "requested_facility_error" : undefined}
              />
            </div>
            {errors.requested_facility && (
              <p className="mt-1 text-label-s text-error flex items-center gap-1" id="requested_facility_error">
                <AlertCircle className="w-4 h-4" />
                {errors.requested_facility}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="payment_terms_days" className="block text-title-s text-on-surface mb-2">Usual customer payment terms</label>
            <select
              id="payment_terms_days"
              className={`w-full min-h-touch p-3 border rounded-lg focus:ring-2 focus:ring-accent focus:border-primary text-body-l bg-surface ${errors.payment_terms_days ? 'border-error text-error focus:ring-error focus:border-error' : 'border-outline'}`}
              value={data.invoices?.payment_terms_days || ''}
              onChange={(e) => { updateInvoices({ payment_terms_days: e.target.value }); clearError('payment_terms_days'); }}
              onBlur={() => validateField(2, 'payment_terms_days')}
              aria-invalid={!!errors.payment_terms_days}
              aria-describedby={errors.payment_terms_days ? "payment_terms_days_error" : undefined}
            >
              <option value="">Select terms</option>
              <option value="30_or_less">30 days or less</option>
              <option value="31_60">31–60 days</option>
              <option value="61_90">61–90 days</option>
              <option value="more_than_90">More than 90 days</option>
              <option value="varies">Varies</option>
            </select>
            {errors.payment_terms_days && (
              <p className="mt-1 text-label-s text-error flex items-center gap-1" id="payment_terms_days_error">
                <AlertCircle className="w-4 h-4" />
                {errors.payment_terms_days}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label htmlFor="largest_debtor_concentration_pct" className="block text-title-s text-on-surface mb-2">What percentage of sales comes from your largest customer?</label>
            <select
              id="largest_debtor_concentration_pct"
              className={`w-full min-h-touch p-3 border rounded-lg focus:ring-2 focus:ring-accent focus:border-primary text-body-l bg-surface ${errors.largest_debtor_concentration_pct ? 'border-error text-error focus:ring-error focus:border-error' : 'border-outline'}`}
              value={data.invoices?.largest_debtor_concentration_pct || ''}
              onChange={(e) => { updateInvoices({ largest_debtor_concentration_pct: e.target.value }); clearError('largest_debtor_concentration_pct'); }}
              onBlur={() => validateField(2, 'largest_debtor_concentration_pct')}
              aria-invalid={!!errors.largest_debtor_concentration_pct}
              aria-describedby={errors.largest_debtor_concentration_pct ? "largest_debtor_concentration_pct_error" : undefined}
            >
              <option value="">Select concentration</option>
              <option value="under_20">Under 20%</option>
              <option value="20_39">20–39%</option>
              <option value="40_59">40–59%</option>
              <option value="60_79">60–79%</option>
              <option value="80_plus">80%+</option>
              <option value="not_sure">Not sure</option>
            </select>
            {errors.largest_debtor_concentration_pct ? (
              <p className="mt-1 text-label-s text-error flex items-center gap-1" id="largest_debtor_concentration_pct_error">
                <AlertCircle className="w-4 h-4" />
                {errors.largest_debtor_concentration_pct}
              </p>
            ) : (
              <p className="mt-2 text-label-s text-on-surface-variant">Your best estimate is fine.</p>
            )}
          </div>
          <div>
             <fieldset>
                <legend className="block text-title-s text-on-surface mb-2">Where are most customers based?</legend>
                <div className="space-y-2">
                  {[
                    { id: 'uk', label: 'UK' },
                    { id: 'europe', label: 'Europe' },
                    { id: 'north_america', label: 'North America' },
                    { id: 'other_international', label: 'Other international' },
                  ].map(option => (
                    <label key={option.id} htmlFor={`geo_${option.id}`} className="flex items-center min-h-touch">
                      <input
                        id={`geo_${option.id}`}
                        type="checkbox"
                        className="h-4 w-4 text-primary focus:ring-accent border-outline rounded"
                        checked={data.invoices?.debtor_geography?.includes(option.id)}
                        onChange={() => handleGeographyToggle(option.id)}
                        aria-invalid={!!errors.debtor_geography}
                        aria-describedby={errors.debtor_geography ? "debtor_geography_error" : undefined}
                      />
                      <span className="ml-2 text-body-m text-on-surface">{option.label}</span>
                    </label>
                  ))}
                </div>
                {errors.debtor_geography && (
                  <p className="mt-2 text-label-s text-error flex items-center gap-1" id="debtor_geography_error">
                    <AlertCircle className="w-4 h-4" />
                    {errors.debtor_geography}
                  </p>
                )}
             </fieldset>
          </div>
        </div>

        {hasExport && (
        <>
          <div className="animate-in fade-in slide-in-from-top-4 duration-300 pt-4 border-t border-outline-variant">
            <label htmlFor="export_sales_pct" className="block text-title-s text-on-surface mb-2">Approximately what percentage of sales is to customers outside the UK?</label>
            <select
              id="export_sales_pct"
              className="w-full sm:w-1/2 min-h-touch p-3 border rounded-lg focus:ring-2 focus:ring-accent focus:border-primary text-body-l bg-surface border-outline"
              value={data.invoices?.export_sales_pct || ''}
              onChange={(e) => updateInvoices({ export_sales_pct: e.target.value })}
            >
              <option value="">Select percentage</option>
              <option value="under_10">Under 10%</option>
              <option value="10_25">10–25%</option>
              <option value="26_50">26–50%</option>
              <option value="over_50">Over 50%</option>
            </select>
          </div>
          <div className="mt-6">
            <label htmlFor="invoice_currency" className="block text-title-s text-on-surface mb-2">What currencies do you normally invoice in?</label>
            <select
              id="invoice_currency"
              className="w-full sm:w-1/2 min-h-touch p-3 border rounded-lg focus:ring-2 focus:ring-accent focus:border-primary text-body-l bg-surface border-outline"
              value={data.invoices?.invoice_currency || ''}
              onChange={(e) => updateInvoices({ invoice_currency: e.target.value })}
            >
              <option value="">Select currency</option>
              <option value="gbp_only">GBP only</option>
              <option value="gbp_and_foreign">GBP and foreign currencies</option>
              <option value="mainly_foreign">Mainly foreign currencies</option>
            </select>
          </div>
        </>
        )}

        {isConstruction && (
          <div className="space-y-6 pt-6 border-t border-outline-variant animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-center gap-2 text-primary mb-4">
               <Info className="w-5 h-5" />
               <span className="text-label-m">Construction sector questions</span>
            </div>
            <fieldset>
              <legend className="block text-title-s text-on-surface mb-3">How do you normally invoice for construction work?</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { id: 'applications', label: 'Applications for payment' },
                  { id: 'valuations', label: 'Valuations or stage payments' },
                  { id: 'completed', label: 'Completed-work invoices' },
                  { id: 'mixture', label: 'A mixture' },
                ].map(option => (
                  <label key={option.id} htmlFor={`const_inv_${option.id}`} className={`flex items-start p-4 border rounded-xl cursor-pointer transition-colors min-h-touch ${data.invoices?.construction_invoicing_type === option.id ? 'border-primary bg-surface-variant ring-1 ring-primary' : 'border-outline-variant hover:bg-surface-variant'}`}>
                    <input
                      id={`const_inv_${option.id}`}
                      type="radio"
                      name="construction_invoicing"
                      className="mt-0.5 h-4 w-4 text-primary focus:ring-accent border-outline"
                      checked={data.invoices?.construction_invoicing_type === option.id}
                      onChange={() => updateInvoices({ construction_invoicing_type: option.id })}
                    />
                    <span className="ml-3 text-label-m text-on-surface leading-tight">{option.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label htmlFor="construction_main_contract_or" className="block text-title-s text-on-surface mb-2">How does the business normally work?</label>
                <select
                  id="construction_main_contract_or"
                  className="w-full min-h-touch p-3 border rounded-lg focus:ring-2 focus:ring-accent focus:border-primary text-body-l bg-surface border-outline"
                  value={data.invoices?.construction_main_contract_or || ''}
                  onChange={(e) => updateInvoices({ construction_main_contract_or: e.target.value })}
                >
                  <option value="">Select option</option>
                  <option value="main_contractor">Main contractor</option>
                  <option value="subcontractor">Subcontractor</option>
                  <option value="both">Both</option>
                </select>
              </div>
              <div>
                <label htmlFor="construction_retention" className="block text-title-s text-on-surface mb-2">Are retentions normally deducted?</label>
                <select
                  id="construction_retention"
                  className="w-full min-h-touch p-3 border rounded-lg focus:ring-2 focus:ring-accent focus:border-primary text-body-l bg-surface border-outline"
                  value={data.invoices?.construction_retention || ''}
                  onChange={(e) => updateInvoices({ construction_retention: e.target.value })}
                >
                  <option value="">Select option</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                  <option value="sometimes">Sometimes</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {isRecruitment && (
          <div className="space-y-6 pt-6 border-t border-outline-variant animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-center gap-2 text-primary mb-4">
               <Info className="w-5 h-5" />
               <span className="text-label-m">Recruitment sector questions</span>
            </div>
            <fieldset>
              <legend className="block text-title-s text-on-surface mb-3">What type of recruitment does the business provide?</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { id: 'permanent', label: 'Permanent recruitment' },
                  { id: 'temporary', label: 'Temporary or contract recruitment' },
                  { id: 'mixture', label: 'A mixture of both' },
                ].map(option => (
                  <label key={option.id} htmlFor={`recruit_type_${option.id}`} className={`flex items-start p-4 border rounded-xl cursor-pointer transition-colors min-h-touch ${data.invoices?.recruitment_type === option.id ? 'border-primary bg-surface-variant ring-1 ring-primary' : 'border-outline-variant hover:bg-surface-variant'}`}>
                    <input
                      id={`recruit_type_${option.id}`}
                      type="radio"
                      name="recruitment_type"
                      className="mt-0.5 h-4 w-4 text-primary focus:ring-accent border-outline"
                      checked={data.invoices?.recruitment_type === option.id}
                      onChange={() => updateInvoices({ recruitment_type: option.id })}
                    />
                    <span className="ml-3 text-label-m text-on-surface leading-tight">{option.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="block text-title-s text-on-surface mb-3">Would payroll support be useful?</legend>
              <div className="flex gap-4">
                {[
                  { id: 'yes', label: 'Yes' },
                  { id: 'no', label: 'No' },
                  { id: 'not_sure', label: 'Not sure' },
                ].map(option => (
                  <label key={option.id} htmlFor={`payroll_${option.id}`} className={`flex-1 flex items-center justify-center p-3 border rounded-xl cursor-pointer transition-colors min-h-touch ${data.invoices?.payroll_support_required === option.id ? 'border-primary bg-surface-variant ring-1 ring-primary' : 'border-outline-variant hover:bg-surface-variant'}`}>
                    <input
                      id={`payroll_${option.id}`}
                      type="radio"
                      name="payroll_support"
                      className="sr-only"
                      checked={data.invoices?.payroll_support_required === option.id}
                      onChange={() => updateInvoices({ payroll_support_required: option.id })}
                    />
                    <span className={`text-label-m ${data.invoices?.payroll_support_required === option.id ? 'text-primary' : 'text-on-surface'}`}>{option.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        )}

      </div>
      
      <div className="mt-8 flex items-center justify-end border-t border-outline-variant pt-6">
        <div className="flex gap-3">
          <button
            onClick={prevStep}
            className="px-6 py-3 bg-surface border border-outline text-on-surface text-label-m rounded-full hover:bg-surface-variant transition-colors min-h-touch"
          >
            Back
          </button>
          <button
            onClick={nextStep}
            className="px-6 py-3 bg-primary text-on-primary shadow-elevation-1 hover:shadow-elevation-2 rounded-full min-h-touch flex items-center gap-2 text-label-m transition-colors"
          >
            Continue
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
          </button>
        </div>
      </div>
    </div>
  );
};
