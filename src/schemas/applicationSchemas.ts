import { z } from 'zod';

export const businessDetailsSchema = z.object({
  b2b_completed_supply: z.enum(['yes', 'no', 'mixture'], { required_error: 'Please select an option' }),
  company_number: z.string().optional(),
  company_name: z.string().min(1, 'Company name is required'),
  company_status: z.string().optional(),
  entity_type: z.string().min(1, 'Entity type is required'),
  incorporation_date: z.string().optional(),
  registered_address: z.object({
    address_line_1: z.string().optional(),
    locality: z.string().optional(),
    postal_code: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
  trading_address_same_as_registered: z.boolean().default(true),
  trading_address: z.object({
    address_line_1: z.string().optional(),
    locality: z.string().optional(),
    postal_code: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
  sic_codes: z.array(z.string()).optional(),
  companies_house_source: z.string().optional(),
  companies_house_retrieved_at: z.string().optional(),
  selected_officer_id: z.string().optional(),
  selected_officer_name: z.string().optional(),
  applicant_relationship: z.string().optional(),
  industry: z.string().min(1, 'Please select an industry'),
  annual_turnover: z.number({ required_error: 'Annual turnover is required', invalid_type_error: 'Turnover must be a number' }).min(0),
  gross_debtor_book: z.number({ required_error: 'Debtor book is required', invalid_type_error: 'Debtor book must be a number' }).min(0),
});

export const contactDetailsSchema = z.object({
  contact_full_name: z.string().min(1, 'Name is required'),
  contact_role: z.string().min(1, 'Role is required'),
  phone: z.string().min(1, 'Phone number is required'),
  email: z.string().email('Please enter a valid email address'),
  funding_timescale: z.string().min(1, 'Please select a timescale'),
});

export const invoicesSchema = z.object({
  desired_outcome: z.string().min(1, 'Please select a desired outcome'),
  requested_facility: z.number({ required_error: 'Funding limit is required' }).min(0),
  payment_terms_days: z.string().min(1, 'Please select payment terms'),
  largest_debtor_concentration_pct: z.string().min(1, 'Please select customer concentration'),
  debtor_geography: z.array(z.string()).min(1, 'Please select at least one location'),
  export_sales_pct: z.string().optional(),
  
  existing_invoice_finance: z.boolean({ required_error: 'Please select if you use invoice finance' }),
  current_provider: z.string().optional(),
  current_facility_limit: z.number().optional(),
  reason_for_switch: z.array(z.string()).optional(),
  notice_or_exit_date: z.string().optional(),
  
  hmrc_status: z.string().min(1, 'Please select HMRC status'),
  hmrc_arrears_amount: z.number().optional(),
  
  funding_purpose: z.array(z.string()).min(1, 'Please select a funding purpose'),
  additional_context: z.string().optional(),
  
  // conditional
  construction_invoicing_type: z.string().optional(),
  construction_main_contract_or: z.string().optional(),
  construction_retention: z.string().optional(),
  
  recruitment_type: z.string().optional(),
  payroll_support_required: z.string().optional(),
  
  invoice_currency: z.string().optional(),
});

export const consentsSchema = z.object({
  processing_notice_acknowledged: z.literal(true, {
    errorMap: () => ({ message: 'You must acknowledge the processing notice to proceed' }),
  }),
  marketing_email: z.boolean().default(false),
  marketing_sms: z.boolean().default(false),
  consent_version: z.string().optional(),
  consent_timestamp: z.string().optional(),
  consent_source: z.string().optional(),
});

export const fullApplicationSchema = z.object({
  business: businessDetailsSchema,
  contact: contactDetailsSchema,
  invoices: invoicesSchema,
  consents: consentsSchema,
});

export type BusinessDetails = z.infer<typeof businessDetailsSchema>;
export type ContactDetails = z.infer<typeof contactDetailsSchema>;
export type InvoicesDetails = z.infer<typeof invoicesSchema>;
export type ConsentsDetails = z.infer<typeof consentsSchema>;
export type ApplicationData = z.infer<typeof fullApplicationSchema>;
