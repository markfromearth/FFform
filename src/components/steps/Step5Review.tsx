import React, { useState } from 'react';
import { useApplication } from '../../context/ApplicationContext';
import { ShieldCheck, CheckCircle2 } from 'lucide-react';

export const Step5Review: React.FC = () => {
  const { data, prevStep, updateConsents, validateStep, clearError, errors } = useApplication();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async () => {
    // Validate the consent checkboxes (step 4 in zero-index maps to consents schema)
    if (!validateStep(4)) {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      return;
    }
    
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      // Generate a UUID-like id for the application
      const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36);
      
      const response = await fetch('/api/submit-application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          application: data,
          id
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Something went wrong');
      }

      setIsSuccess(true);
      window.scrollTo(0, 0);
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to submit application. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="max-w-2xl mx-auto px-4 text-center py-12">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-primary-container rounded-full flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-primary" />
          </div>
        </div>
        <h1 className="display-s text-on-surface mb-4">Enquiry submitted successfully</h1>
        <p className="body-l text-on-surface-variant mb-8">
          Thank you for choosing Factoring Finance. A specialist will review your details and contact you shortly at {data.contact?.email}.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4">
      <div className="mb-8">
        <h2 className="label-m text-primary tracking-wide uppercase mb-1">Review</h2>
        <h1 className="display-s text-on-surface mb-3">Check your enquiry</h1>
        <p className="body-l text-on-surface-variant">These are the details we will use to assess your requirement and identify suitable finance providers.</p>
      </div>
      
      <div className="bg-surface-container-low border border-outline-variant rounded-2xl p-6 space-y-4">
        <div className="flex justify-between items-start gap-4 pb-2 border-b border-outline-variant">
          <span className="body-l text-on-surface-variant w-1/3">Business</span>
          <strong className="body-l text-on-surface w-2/3 text-right">{data.business?.company_name || 'Not provided'}</strong>
        </div>
        <div className="flex justify-between items-start gap-4 pb-2 border-b border-outline-variant">
          <span className="body-l text-on-surface-variant w-1/3">Company number</span>
          <strong className="body-l text-on-surface w-2/3 text-right">{data.business?.company_number || 'N/A'}</strong>
        </div>
        <div className="flex justify-between items-start gap-4 pb-2 border-b border-outline-variant">
          <span className="body-l text-on-surface-variant w-1/3">Contact</span>
          <strong className="body-l text-on-surface w-2/3 text-right">{data.contact?.contact_full_name} ({data.contact?.email})</strong>
        </div>
        <div className="flex justify-between items-start gap-4 pb-2 border-b border-outline-variant">
          <span className="body-l text-on-surface-variant w-1/3">Annual turnover</span>
          <strong className="body-l text-on-surface w-2/3 text-right">
            {data.business?.annual_turnover ? `£${data.business.annual_turnover.toLocaleString()}` : 'Not provided'}
          </strong>
        </div>
        <div className="flex justify-between items-start gap-4 pb-2 border-b border-outline-variant">
          <span className="body-l text-on-surface-variant w-1/3">Funding required</span>
          <strong className="body-l text-on-surface w-2/3 text-right">
            {data.invoices?.requested_facility ? `£${data.invoices.requested_facility.toLocaleString()}` : 'Not provided'}
          </strong>
        </div>
        <div className="flex justify-between items-start gap-4 pb-2 border-b border-outline-variant">
          <span className="body-l text-on-surface-variant w-1/3">Debtor book</span>
          <strong className="body-l text-on-surface w-2/3 text-right">
            {data.business?.gross_debtor_book ? `£${data.business.gross_debtor_book.toLocaleString()}` : 'Not provided'}
          </strong>
        </div>
        {data.invoices?.payment_terms_days && (
           <div className="flex justify-between items-start gap-4 pb-2 border-b border-outline-variant">
             <span className="body-l text-on-surface-variant w-1/3">Payment terms</span>
             <strong className="body-l text-on-surface w-2/3 text-right">{data.invoices.payment_terms_days.replace(/_/g, ' ')}</strong>
           </div>
        )}
      </div>

      <div className="bg-surface border border-outline-variant rounded-2xl p-6 mt-6">
        <h3 className="title-m text-on-surface mb-4">Privacy & Permissions</h3>
        
        <div className="space-y-4">
          <label className="flex items-start gap-3 p-3 bg-surface-container-low border border-outline-variant rounded-xl cursor-pointer min-h-touch">
            <input 
              type="checkbox" 
              className={`mt-1 h-5 w-5 rounded border-outline text-primary focus:ring-primary ${errors.processing_notice_acknowledged ? 'ring-2 ring-error ring-offset-1 border-error' : ''}`}
              checked={data.consents?.processing_notice_acknowledged === true}
              onChange={(e) => { 
                updateConsents({ 
                  processing_notice_acknowledged: e.target.checked || undefined as any,
                  consent_version: 'v1.1',
                  consent_source: 'web_enquiry_form',
                  consent_timestamp: new Date().toISOString()
                }); 
                clearError('processing_notice_acknowledged');
              }}
            />
            <div className="body-l text-on-surface-variant leading-relaxed">
              <span className="label-m text-on-surface block mb-1">Enquiry Processing Notice</span>
              I acknowledge that my details will be securely processed to assess my funding requirement and match me with suitable lenders, in accordance with the Privacy Policy.
              {errors.processing_notice_acknowledged && (
                <span className="block mt-1 text-error label-m">{errors.processing_notice_acknowledged}</span>
              )}
            </div>
          </label>

          <div className="p-4 border border-outline-variant rounded-xl">
            <span className="label-m text-on-surface block mb-2">Optional: Promotional Contact</span>
            <p className="body-l text-on-surface-variant mb-3">Factoring Finance may occasionally send you relevant market updates or alternative funding offers. Please select how you'd like to hear from us:</p>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer min-h-touch">
                <input 
                  type="checkbox" 
                  className="h-5 w-5 rounded border-outline text-primary focus:ring-primary"
                  checked={data.consents?.marketing_email === true}
                  onChange={(e) => updateConsents({ marketing_email: e.target.checked })}
                />
                <span className="body-l text-on-surface-variant">Email</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer min-h-touch">
                <input 
                  type="checkbox" 
                  className="h-5 w-5 rounded border-outline text-primary focus:ring-primary"
                  checked={data.consents?.marketing_sms === true}
                  onChange={(e) => updateConsents({ marketing_sms: e.target.checked })}
                />
                <span className="body-l text-on-surface-variant">SMS</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {submitError && (
        <div className="mt-6 p-4 bg-error/10 border border-error/20 rounded-xl text-error body-l flex items-start gap-3">
           <ShieldCheck className="w-5 h-5 text-error shrink-0 mt-0.5" />
           <span>{submitError}</span>
        </div>
      )}
      
      <div className="mt-8 flex flex-col sm:flex-row sm:items-center justify-between border-t border-outline-variant pt-6 gap-4">
        <p className="body-l text-on-surface-variant flex items-start gap-2 max-w-sm leading-tight">
          <ShieldCheck className="w-5 h-5 text-primary shrink-0" />
          <span>Your data is encrypted and stored securely. We do not sell your data to third parties.</span>
        </p>
        <div className="flex gap-3">
          <button
            onClick={prevStep}
            disabled={isSubmitting}
            className="px-6 py-3 bg-surface border border-outline text-primary label-m rounded-full hover:bg-surface-container transition-colors disabled:opacity-50 min-h-touch focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            Back
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-6 py-3 bg-primary text-on-primary label-m rounded-full hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-75 min-h-touch focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            {isSubmitting ? 'Submitting...' : 'Submit my enquiry'}
            {!isSubmitting && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>}
          </button>
        </div>
      </div>
    </div>
  );
};
