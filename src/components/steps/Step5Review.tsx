import React, { useState } from 'react';
import { useApplication } from '../../context/ApplicationContext';
import { ShieldCheck, CheckCircle2, Pencil } from 'lucide-react';
import { formatLabel } from '../../utils/formatters';

export const Step5Review: React.FC = () => {
  const { data, prevStep, setCurrentStep, nextStep, updateConsents, validateStep, clearError, errors, applicationId, setUploadToken, turnstileToken } = useApplication();
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
      const id = applicationId;
      
      const response = await fetch('/api/submit-application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          application: data,
          id,
          turnstileToken,
          status: 'introduction_ready'
        })
      });

      const contentType = response.headers.get("content-type");
      let result;
      if (contentType && contentType.includes("application/json")) {
        result = await response.json();
      } else {
        const text = await response.text();
        throw new Error(`Server Error: ${text.slice(0, 50)}`);
      }

if (!response.ok) {
        throw new Error(result?.error || 'Something went wrong processing your application');
      }

      if (result?.uploadToken) {
        setUploadToken(result.uploadToken);
      }

      nextStep();
      window.scrollTo(0, 0);
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to submit application. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };


  const ReviewRow = ({ label, value }: { label: string, value: React.ReactNode }) => (
    <div className="flex justify-between items-start gap-4 pb-2 border-b border-outline-variant last:border-0 last:pb-0">
      <span className="body-l text-on-surface-variant w-1/3">{label}</span>
      <strong className="body-l text-on-surface w-2/3 text-right break-words">{value || 'Not provided'}</strong>
    </div>
  );
  
  const ReviewSection = ({ title, stepIndex, children }: { title: string, stepIndex: number, children: React.ReactNode }) => (
    <div className="bg-surface border border-outline-variant rounded-2xl p-6 relative">
      <div className="flex justify-between items-center mb-4 pb-2 border-b border-outline-variant">
        <h3 className="title-m text-on-surface">{title}</h3>
        <button 
          onClick={() => setCurrentStep(stepIndex)}
          className="flex items-center gap-1 text-primary hover:text-primary-dark transition-colors text-label-m"
          type="button"
        >
          <Pencil className="w-4 h-4" /> Edit
        </button>
      </div>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );


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
      
      
      <div className="space-y-6">
        <ReviewSection title="Your Business" stepIndex={0}>
          <ReviewRow label="Company" value={data.business?.company_name ? `${data.business.company_name} (${data.business.company_number || 'N/A'})` : null} />
          <ReviewRow label="Industry" value={data.business?.industry ? formatLabel(data.business.industry) : null} />
          <ReviewRow label="Annual turnover" value={data.business?.annual_turnover ? `£${data.business.annual_turnover.toLocaleString()}` : null} />
          <ReviewRow label="Debtor book" value={data.business?.gross_debtor_book ? `£${data.business.gross_debtor_book.toLocaleString()}` : null} />
        </ReviewSection>

        <ReviewSection title="Your Details" stepIndex={1}>
          <ReviewRow label="Contact" value={data.contact?.contact_full_name ? `${data.contact.contact_full_name} (${formatLabel(data.contact.contact_role) || 'Role not specified'})` : null} />
          <ReviewRow label="Phone" value={data.contact?.phone} />
          <ReviewRow label="Email" value={data.contact?.email} />
          <ReviewRow label="Timescale" value={formatLabel(data.contact?.funding_timescale)} />
        </ReviewSection>

        <ReviewSection title="Your Invoices" stepIndex={2}>
          <ReviewRow label="Facility required" value={data.invoices?.requested_facility ? `£${data.invoices.requested_facility.toLocaleString()}` : null} />
          <ReviewRow label="Desired outcome" value={formatLabel(data.invoices?.desired_outcome)} />
          <ReviewRow label="Payment terms" value={formatLabel(data.invoices?.payment_terms_days)} />
          <ReviewRow label="Customer concentration" value={formatLabel(data.invoices?.largest_debtor_concentration_pct)} />
          <ReviewRow label="Geography" value={data.invoices?.debtor_geography?.map(formatLabel).join(', ')} />
        </ReviewSection>

        <ReviewSection title="Final Details" stepIndex={3}>
          <ReviewRow label="Requirement type" value={data.invoices?.existing_invoice_finance ? 'Refinance existing facility' : 'New facility'} />
          <ReviewRow label="HMRC status" value={formatLabel(data.invoices?.hmrc_status)} />
          {data.invoices?.funding_purpose && (
            <ReviewRow label="Funding purpose" value={data.invoices.funding_purpose.map(formatLabel).join(', ')} />
          )}
          {data.invoices?.construction_invoicing_type && (
            <ReviewRow label="Construction invoicing" value={formatLabel(data.invoices.construction_invoicing_type)} />
          )}
          {data.invoices?.recruitment_type && (
            <ReviewRow label="Recruitment type" value={formatLabel(data.invoices.recruitment_type)} />
          )}
        </ReviewSection>
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
