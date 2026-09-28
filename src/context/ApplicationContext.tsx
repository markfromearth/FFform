import React, { createContext, useContext, useState, ReactNode } from 'react';
import { 
  ApplicationData, 
  BusinessDetails, 
  ContactDetails, 
  InvoicesDetails,
  ConsentsDetails,
  businessDetailsSchema,
  contactDetailsSchema,
  invoicesSchema,
  consentsSchema
} from '../schemas/applicationSchemas';
import { z } from 'zod';

interface PartialApplicationData {
  business: Partial<BusinessDetails>;
  contact: Partial<ContactDetails>;
  invoices: Partial<InvoicesDetails>;
  consents: Partial<ConsentsDetails>;
  documents: any[];
}

interface ApplicationContextType {
  applicationId: string;
  uploadToken: string | null;
  setUploadToken: (token: string) => void;
  data: PartialApplicationData;
  updateBusiness: (data: Partial<BusinessDetails>) => void;
  updateContact: (data: Partial<ContactDetails>) => void;
  updateInvoices: (data: Partial<InvoicesDetails>) => void;
  updateConsents: (data: Partial<ConsentsDetails>) => void;
  addDocument: (doc: any) => void;
  currentStep: number;
  setCurrentStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  errors: Record<string, string>;
  validateField: (step: number, field: string) => void;
  validateStep: (step: number) => boolean;
  clearError: (field: string) => void;
}

const ApplicationContext = createContext<ApplicationContextType | undefined>(undefined);

export const ApplicationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const tokenFromUrl = searchParams.get('token');
  
  const [uploadToken, setUploadToken] = useState<string | null>(tokenFromUrl);
  const [applicationId] = useState(() => crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36));
  const [data, setData] = useState<PartialApplicationData>({
    business: {
      trading_address_same_as_registered: true
    },
    contact: {},
    invoices: {
      debtor_geography: [],
      reason_for_switch: [],
      funding_purpose: [],
    },
    consents: {
      marketing_email: false,
      marketing_sms: false,
    },
    documents: []
  });
  const [currentStep, setCurrentStep] = useState(tokenFromUrl ? 5 : 0);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const clearError = (field: string) => {
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  };

  const updateBusiness = (businessData: Partial<BusinessDetails>) => {
    setData((prev) => ({ ...prev, business: { ...prev.business, ...businessData } }));
  };

  const updateContact = (contactData: Partial<ContactDetails>) => {
    setData((prev) => ({ ...prev, contact: { ...prev.contact, ...contactData } }));
  };

  const updateInvoices = (invoicesData: Partial<InvoicesDetails>) => {
    setData((prev) => ({ ...prev, invoices: { ...prev.invoices, ...invoicesData } }));
  };

  const addDocument = (doc: any) => {
    setData((prev) => ({ ...prev, documents: [...(prev.documents || []), doc] }));
  };
  const updateConsents = (consentsData: Partial<ConsentsDetails>) => {
    setData((prev) => ({ ...prev, consents: { ...prev.consents, ...consentsData } }));
  };

  const validateStep = (step: number): boolean => {
    try {
      if (step === 0) {
        businessDetailsSchema.parse(data.business);
      } else if (step === 1) {
        contactDetailsSchema.parse(data.contact);
      } else if (step === 2) {
        // Step 3 in UI (Your Invoices) - Only validate fields collected in this step
        invoicesSchema.pick({
          desired_outcome: true,
          requested_facility: true,
          payment_terms_days: true,
          largest_debtor_concentration_pct: true,
          debtor_geography: true,
          export_sales_pct: true,
          construction_invoicing_type: true,
          construction_main_contract_or: true,
          construction_retention: true,
          recruitment_type: true,
          payroll_support_required: true,
        }).parse(data.invoices);
      } else if (step === 3) {
        // Step 4 in UI (Final Details) - Validate everything including the final questions
        invoicesSchema.parse(data.invoices);
      } else if (step === 4) {
        // Step 5 Review (and consents)
        consentsSchema.parse(data.consents);
      }
      setErrors({});
      return true;
    } catch (e) {
      if (e instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        e.errors.forEach(err => {
          if (err.path[0]) {
            fieldErrors[err.path[0].toString()] = err.message;
          }
        });
        setErrors(fieldErrors);
      }
      return false;
    }
  };

  const validateField = (step: number, field: string) => {
    try {
      let schema;
      let targetData;
      if (step === 0) {
        schema = businessDetailsSchema.pick({ [field]: true } as any);
        targetData = { [field]: (data.business as any)[field] };
      } else if (step === 1) {
        schema = contactDetailsSchema.pick({ [field]: true } as any);
        targetData = { [field]: (data.contact as any)[field] };
      } else if (step === 2 || step === 3) {
        schema = invoicesSchema.pick({ [field]: true } as any);
        targetData = { [field]: (data.invoices as any)[field] };
      } else if (step === 4) {
        schema = consentsSchema.pick({ [field]: true } as any);
        targetData = { [field]: (data.consents as any)[field] };
      }
      
      if (schema) {
        schema.parse(targetData);
        clearError(field);
      }
    } catch (e) {
      if (e instanceof z.ZodError) {
        const message = e.errors[0]?.message;
        if (message) {
          setErrors(prev => ({ ...prev, [field]: message }));
        }
      }
    }
  };

  const nextStep = async () => {
    // Only allow navigating forward if the current step is valid
    if (validateStep(currentStep)) {
      
      // Partial Save Logic: Save after Step 2 (index 1) is completed
      if (currentStep === 1) {
        try {
          fetch('/api/submit-application', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: applicationId,
        uploadToken,
        setUploadToken,
              status: 'contact_captured',
              application: data
            })
          }).catch(err => console.error('Partial save failed', err));
        } catch (e) {}
      }

      setCurrentStep((prev) => prev + 1);
      window.scrollTo(0, 0);
    }
  };

  const prevStep = () => {
    setErrors({});
    setCurrentStep((prev) => Math.max(0, prev - 1));
    window.scrollTo(0, 0);
  };

  return (
    <ApplicationContext.Provider
      value={{
        applicationId,
        uploadToken,
        setUploadToken,
        data,
        updateBusiness,
        updateContact,
        updateInvoices,
        updateConsents,
        addDocument,
        currentStep,
        setCurrentStep,
        nextStep,
        prevStep,
        errors,
        validateField,
        validateStep,
        clearError
      }}
    >
      {children}
    </ApplicationContext.Provider>
  );
};

export const useApplication = () => {
  const context = useContext(ApplicationContext);
  if (context === undefined) {
    throw new Error('useApplication must be used within an ApplicationProvider');
  }
  return context;
};
