import React from 'react';
import { useApplication } from '../../context/ApplicationContext';
import { LockKeyhole } from 'lucide-react';

export const Step2YourDetails: React.FC = () => {
  const { data, updateContact, nextStep, prevStep, errors, validateField, clearError } = useApplication();

  return (
    <div className="max-w-2xl mx-auto px-4">
      <div className="mb-8">
        <h2 className="text-label-l text-primary tracking-wide uppercase mb-1">Your details</h2>
        <h1 className="text-display-s text-on-surface mb-3">Where should we send your options?</h1>
        <p className="text-body-l text-on-surface-variant">A specialist will review your enquiry and contact you to discuss the most suitable routes.</p>
      </div>
      
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label htmlFor="contact_full_name" className="block text-label-m text-on-surface mb-1">Your name</label>
            <input
              id="contact_full_name"
              type="text"
              autoComplete="name"
              aria-invalid={!!errors.contact_full_name}
              aria-describedby={errors.contact_full_name ? "contact_full_name_error" : undefined}
              className={`w-full min-h-touch p-3 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-body-l bg-surface ${errors.contact_full_name ? 'border-error text-error focus:ring-error focus:border-error' : 'border-outline-variant text-on-surface'}`}
              value={data.contact?.contact_full_name || ''}
              placeholder="e.g. Jane Doe"
              onChange={(e) => { updateContact({ contact_full_name: e.target.value }); clearError('contact_full_name'); }}
              onBlur={() => validateField(1, 'contact_full_name')}
            />
            {errors.contact_full_name && (
              <p id="contact_full_name_error" className="mt-1 text-label-s text-error flex items-center gap-1">
                 <svg aria-hidden="true" className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                 {errors.contact_full_name}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="contact_role" className="block text-label-m text-on-surface mb-1">Your role</label>
            <select
              id="contact_role"
              aria-invalid={!!errors.contact_role}
              aria-describedby={errors.contact_role ? "contact_role_error" : undefined}
              className={`w-full min-h-touch p-3 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-body-l bg-surface ${errors.contact_role ? 'border-error text-error focus:ring-error focus:border-error' : 'border-outline-variant text-on-surface'}`}
              value={data.contact?.contact_role || ''}
              onChange={(e) => { updateContact({ contact_role: e.target.value }); clearError('contact_role'); }}
              onBlur={() => validateField(1, 'contact_role')}
            >
              <option value="">Select an option</option>
              <option value="director_owner">Director or owner</option>
              <option value="finance_director">Finance director or finance team</option>
              <option value="manager">Manager</option>
              <option value="adviser">Adviser or accountant</option>
              <option value="other">Other</option>
            </select>
            {errors.contact_role && (
              <p id="contact_role_error" className="mt-1 text-label-s text-error flex items-center gap-1">
                 <svg aria-hidden="true" className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                 {errors.contact_role}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label htmlFor="phone" className="block text-label-m text-on-surface mb-1">Phone number</label>
            <input
              id="phone"
              type="tel"
              autoComplete="tel"
              aria-invalid={!!errors.phone}
              aria-describedby={errors.phone ? "phone_error" : undefined}
              className={`w-full min-h-touch p-3 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-body-l bg-surface ${errors.phone ? 'border-error text-error focus:ring-error focus:border-error' : 'border-outline-variant text-on-surface'}`}
              value={data.contact?.phone || ''}
              placeholder="e.g. 07700 900000"
              onChange={(e) => { updateContact({ phone: e.target.value }); clearError('phone'); }}
              onBlur={() => validateField(1, 'phone')}
            />
            {errors.phone && (
              <p id="phone_error" className="mt-1 text-label-s text-error flex items-center gap-1">
                 <svg aria-hidden="true" className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                 {errors.phone}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="email" className="block text-label-m text-on-surface mb-1">Work email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "email_error" : undefined}
              className={`w-full min-h-touch p-3 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-body-l bg-surface ${errors.email ? 'border-error text-error focus:ring-error focus:border-error' : 'border-outline-variant text-on-surface'}`}
              value={data.contact?.email || ''}
              placeholder="e.g. name@company.com"
              onChange={(e) => { updateContact({ email: e.target.value }); clearError('email'); }}
              onBlur={() => validateField(1, 'email')}
            />
            {errors.email && (
              <p id="email_error" className="mt-1 text-label-s text-error flex items-center gap-1">
                 <svg aria-hidden="true" className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                 {errors.email}
              </p>
            )}
          </div>
        </div>

        <fieldset className="pt-4 border-t border-surface-variant">
          <legend className="block text-title-m text-on-surface mb-3">When would you like the funding in place?</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { id: 'asap', label: 'As soon as possible' },
              { id: 'within_2_weeks', label: 'Within 2 weeks' },
              { id: 'within_a_month', label: 'Within a month' },
              { id: '1_to_3_months', label: '1–3 months' },
              { id: 'just_exploring', label: 'Just exploring' },
            ].map(option => (
              <label key={option.id} className={`flex items-center min-h-touch p-4 border rounded-xl cursor-pointer transition-colors ${data.contact?.funding_timescale === option.id ? 'border-primary bg-primary-container ring-1 ring-primary' : 'border-outline-variant hover:bg-surface-container-low'}`}>
                <input
                  type="radio"
                  name="timing"
                  className="h-5 w-5 text-primary focus:ring-primary border-outline"
                  checked={data.contact?.funding_timescale === option.id}
                  onChange={() => { updateContact({ funding_timescale: option.id }); clearError('funding_timescale'); }}
                />
                <span className={`ml-3 text-body-l ${data.contact?.funding_timescale === option.id ? 'text-on-primary-container font-medium' : 'text-on-surface'}`}>{option.label}</span>
              </label>
            ))}
          </div>
          {errors.funding_timescale && (
              <p id="funding_timescale_error" className="mt-2 text-label-s text-error flex items-center gap-1">
                 <svg aria-hidden="true" className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                 {errors.funding_timescale}
              </p>
          )}
        </fieldset>
      </div>
      
      <div className="mt-8 flex items-center justify-between border-t border-surface-variant pt-6">
        <p className="text-body-s text-on-surface-variant flex items-center gap-2">
          <LockKeyhole className="w-4 h-4 text-on-surface-subtle" aria-hidden="true" />
          Your details are encrypted and only used to assess your enquiry.
        </p>
        <div className="flex gap-3">
          <button
            onClick={prevStep}
            className="min-h-touch px-6 py-2 bg-surface border border-outline text-primary font-medium rounded-full hover:bg-surface-variant transition-colors"
          >
            Back
          </button>
          <button
            onClick={nextStep}
            className="min-h-touch px-6 py-2 bg-primary text-on-primary font-medium rounded-full hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-elevation-1 hover:shadow-elevation-2"
          >
            Continue
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
          </button>
        </div>
      </div>
    </div>
  );
};
