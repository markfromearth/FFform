import React from 'react';
import { useApplication } from '../../context/ApplicationContext';
import { AlertCircle } from 'lucide-react';
export const Step4FinalDetails = () => {
    const { data, updateInvoices, nextStep, prevStep, errors, validateField, clearError } = useApplication();
    const handlePurposeToggle = (val) => {
        const current = data.invoices?.funding_purpose || [];
        let newPurpose;
        if (current.includes(val)) {
            newPurpose = current.filter(g => g !== val);
        }
        else {
            newPurpose = [...current, val];
        }
        updateInvoices({ funding_purpose: newPurpose });
        if (newPurpose.length > 0) {
            clearError('funding_purpose');
        }
        else {
            validateField(3, 'funding_purpose');
        }
    };
    const handleSwitchReasonToggle = (val) => {
        const current = data.invoices?.reason_for_switch || [];
        if (current.includes(val)) {
            updateInvoices({ reason_for_switch: current.filter(g => g !== val) });
        }
        else {
            updateInvoices({ reason_for_switch: [...current, val] });
        }
    };
    return (<div className="max-w-2xl mx-auto px-4">
      <div className="mb-8">
        <h2 className="text-title-s text-primary tracking-wide uppercase mb-1">Final details</h2>
        <h1 className="text-display-s text-on-surface mb-3">Anything we should know?</h1>
        <p className="text-on-surface-variant text-body-l">This helps avoid unsuitable lender approaches and lets us deal with anything important from the outset.</p>
      </div>
      
      <div className="space-y-8">
        <fieldset>
          <legend className="block text-title-s text-on-surface mb-3">Are you currently using invoice finance?</legend>
          <div className="flex gap-4 max-w-sm">
            <label htmlFor="existing-yes" className={`flex-1 flex items-center justify-center p-3 border rounded-xl cursor-pointer transition-colors min-h-touch ${data.invoices?.existing_invoice_finance === true ? 'border-primary bg-surface-variant ring-1 ring-primary' : 'border-outline-variant hover:bg-surface-variant'}`}>
              <input id="existing-yes" type="radio" name="existing" className="sr-only" checked={data.invoices?.existing_invoice_finance === true} onChange={() => { updateInvoices({ existing_invoice_finance: true }); clearError('existing_invoice_finance'); }}/>
              <span className={`text-label-m ${data.invoices?.existing_invoice_finance === true ? 'text-primary' : 'text-on-surface'}`}>Yes</span>
            </label>
            <label htmlFor="existing-no" className={`flex-1 flex items-center justify-center p-3 border rounded-xl cursor-pointer transition-colors min-h-touch ${data.invoices?.existing_invoice_finance === false ? 'border-primary bg-surface-variant ring-1 ring-primary' : 'border-outline-variant hover:bg-surface-variant'}`}>
              <input id="existing-no" type="radio" name="existing" className="sr-only" checked={data.invoices?.existing_invoice_finance === false} onChange={() => { updateInvoices({ existing_invoice_finance: false }); clearError('existing_invoice_finance'); }}/>
              <span className={`text-label-m ${data.invoices?.existing_invoice_finance === false ? 'text-primary' : 'text-on-surface'}`}>No</span>
            </label>
          </div>
          {errors.existing_invoice_finance && (<p className="mt-2 text-label-s text-error flex items-center gap-1" id="existing_invoice_finance_error">
              <AlertCircle className="w-4 h-4"/>
              {errors.existing_invoice_finance}
            </p>)}
        </fieldset>

        {data.invoices?.existing_invoice_finance === true && (<div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label htmlFor="current_provider" className="block text-title-s text-on-surface mb-2">Who is the current provider?</label>
                <input id="current_provider" type="text" placeholder="e.g. Acme Corp" className="w-full min-h-touch p-3 border rounded-lg focus:ring-2 focus:ring-accent focus:border-primary text-body-l bg-surface border-outline" value={data.invoices?.current_provider || ''} onChange={(e) => updateInvoices({ current_provider: e.target.value })}/>
              </div>
              <div>
                <label htmlFor="current_facility_limit" className="block text-title-s text-on-surface mb-2">Current facility limit</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-on-surface-variant text-body-m">£</span>
                  </div>
                  <input id="current_facility_limit" type="number" placeholder="e.g. 50000" className="w-full pl-8 min-h-touch p-3 border rounded-lg focus:ring-2 focus:ring-accent focus:border-primary text-body-l bg-surface border-outline" value={data.invoices?.current_facility_limit || ''} onChange={(e) => updateInvoices({ current_facility_limit: parseInt(e.target.value) || undefined })}/>
                </div>
              </div>
            </div>

            <fieldset>
              <legend className="block text-title-s text-on-surface mb-2">What would you like to improve?</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                { id: 'more_funding', label: 'More funding' },
                { id: 'lower_cost', label: 'Lower cost' },
                { id: 'better_service', label: 'Better service' },
                { id: 'more_flexibility', label: 'More flexibility' },
                { id: 'provider_exiting', label: 'Current provider exiting or given notice' },
                { id: 'other', label: 'Other' },
            ].map(option => (<label key={option.id} htmlFor={`switch_reason_${option.id}`} className="flex items-center min-h-touch">
                    <input id={`switch_reason_${option.id}`} type="checkbox" className="h-4 w-4 text-primary focus:ring-accent border-outline rounded" checked={data.invoices?.reason_for_switch?.includes(option.id)} onChange={() => handleSwitchReasonToggle(option.id)}/>
                    <span className="ml-2 text-body-m text-on-surface">{option.label}</span>
                  </label>))}
              </div>
            </fieldset>

            <div>
              <label htmlFor="notice_or_exit_date" className="block text-title-s text-on-surface mb-2">Has notice been served or is there a deadline?</label>
              <input id="notice_or_exit_date" type="text" placeholder="e.g. Notice expires 31st Oct" className="w-full min-h-touch p-3 border rounded-lg focus:ring-2 focus:ring-accent focus:border-primary text-body-l bg-surface border-outline" value={data.invoices?.notice_or_exit_date || ''} onChange={(e) => updateInvoices({ notice_or_exit_date: e.target.value })}/>
            </div>
          </div>)}

        <div className="pt-4 border-t border-outline-variant">
          <label htmlFor="hmrc_status" className="block text-title-s text-on-surface mb-2">Is the business up to date with HMRC?</label>
          <select id="hmrc_status" className={`w-full sm:w-2/3 min-h-touch p-3 border rounded-lg focus:ring-2 focus:ring-accent focus:border-primary text-body-l bg-surface ${errors.hmrc_status ? 'border-error text-error focus:ring-error focus:border-error' : 'border-outline'}`} value={data.invoices?.hmrc_status || ''} onChange={(e) => { updateInvoices({ hmrc_status: e.target.value }); clearError('hmrc_status'); }} onBlur={() => validateField(3, 'hmrc_status')} aria-invalid={!!errors.hmrc_status} aria-describedby={errors.hmrc_status ? "hmrc_status_error" : undefined}>
            <option value="">Select status</option>
            <option value="up_to_date">Yes</option>
            <option value="ttp">Time to Pay arrangement</option>
            <option value="arrears">Arrears without an arrangement</option>
            <option value="not_sure">Not sure</option>
          </select>
          {errors.hmrc_status && (<p className="mt-1 text-label-s text-error flex items-center gap-1" id="hmrc_status_error">
              <AlertCircle className="w-4 h-4"/>
              {errors.hmrc_status}
            </p>)}
        </div>

        {data.invoices?.hmrc_status && data.invoices.hmrc_status !== 'up_to_date' && (<div className="animate-in fade-in slide-in-from-top-4 duration-300">
            <label htmlFor="hmrc_arrears_amount" className="block text-title-s text-on-surface mb-2">Approximate HMRC arrears amount</label>
            <div className="relative w-full sm:w-2/3">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-on-surface-variant text-body-m">£</span>
              </div>
              <input id="hmrc_arrears_amount" type="number" placeholder="e.g. 10000" className="w-full pl-8 min-h-touch p-3 border rounded-lg focus:ring-2 focus:ring-accent focus:border-primary text-body-l bg-surface border-outline" value={data.invoices?.hmrc_arrears_amount || ''} onChange={(e) => updateInvoices({ hmrc_arrears_amount: parseInt(e.target.value) || undefined })}/>
            </div>
          </div>)}

        <fieldset>
          <legend className="block text-title-s text-on-surface mb-3">Why do you need the facility?</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
            { id: 'support_growth', label: 'Support growth' },
            { id: 'improve_cashflow', label: 'Improve day-to-day cash flow' },
            { id: 'payroll_suppliers', label: 'Payroll or supplier payments' },
            { id: 'replace_existing', label: 'Replace an existing provider' },
            { id: 'fund_contract', label: 'Fund a new contract' },
            { id: 'acquisition', label: 'Acquisition or restructuring' },
            { id: 'other', label: 'Other' },
        ].map(option => (<label key={option.id} htmlFor={`funding_purpose_${option.id}`} className="flex items-center min-h-touch">
                <input id={`funding_purpose_${option.id}`} type="checkbox" className="h-4 w-4 text-primary focus:ring-accent border-outline rounded" checked={data.invoices?.funding_purpose?.includes(option.id)} onChange={() => handlePurposeToggle(option.id)} aria-invalid={!!errors.funding_purpose} aria-describedby={errors.funding_purpose ? "funding_purpose_error" : undefined}/>
                <span className="ml-2 text-body-m text-on-surface">{option.label}</span>
              </label>))}
          </div>
          {errors.funding_purpose && (<p className="mt-2 text-label-s text-error flex items-center gap-1" id="funding_purpose_error">
              <AlertCircle className="w-4 h-4"/>
              {errors.funding_purpose}
            </p>)}
        </fieldset>

        <div>
          <label htmlFor="additional_context" className="block text-title-s text-on-surface mb-2">
            Is there anything else a lender should know at this stage? <span className="text-on-surface-variant font-normal">(optional)</span>
          </label>
          <textarea id="additional_context" className="w-full min-h-touch p-3 border rounded-lg focus:ring-2 focus:ring-accent focus:border-primary text-body-l bg-surface border-outline resize-y min-h-[100px]" placeholder="e.g. growth plans, a recent loss, poor credit, disputed invoices, or a major new contract." value={data.invoices?.additional_context || ''} onChange={(e) => updateInvoices({ additional_context: e.target.value })} maxLength={750}></textarea>
        </div>

      </div>
      
      <div className="mt-8 flex items-center justify-end border-t border-outline-variant pt-6">
        <div className="flex gap-3">
          <button onClick={prevStep} className="px-6 py-3 bg-surface border border-outline text-on-surface text-label-m rounded-full hover:bg-surface-variant transition-colors min-h-touch">
            Back
          </button>
          <button onClick={nextStep} className="px-6 py-3 bg-primary text-on-primary shadow-elevation-1 hover:shadow-elevation-2 rounded-full min-h-touch flex items-center gap-2 text-label-m transition-colors">
            Continue
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
          </button>
        </div>
      </div>
    </div>);
};
