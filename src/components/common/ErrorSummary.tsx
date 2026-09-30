import React from 'react';
import { AlertCircle } from 'lucide-react';

const fieldLabels: Record<string, string> = {
  b2b_completed_supply: "Invoice other businesses",
  company_name: "Business Name",
  entity_type: "Entity Type",
  industry: "Industry",
  annual_turnover: "Annual Turnover",
  gross_debtor_book: "Unpaid Invoices",
  contact_full_name: "Full Name",
  contact_role: "Job Role",
  phone: "Phone Number",
  email: "Email Address",
  funding_timescale: "Funding Timescale",
  desired_outcome: "Desired Outcome",
  requested_facility: "Requested Facility Limit",
  payment_terms_days: "Payment Terms",
  largest_debtor_concentration_pct: "Largest Customer Concentration",
  debtor_geography: "Customer Locations",
  export_sales_pct: "Export Sales",
  existing_invoice_finance: "Existing Invoice Finance",
  current_provider: "Current Provider",
  current_facility_limit: "Current Facility Limit",
  reason_for_switch: "Reason for Switching",
  notice_or_exit_date: "Notice Date",
  hmrc_status: "HMRC Status",
  hmrc_arrears_amount: "HMRC Arrears Amount",
  funding_purpose: "Funding Purpose",
  additional_context: "Additional Context",
  processing_notice_acknowledged: "Data Processing Notice",
  marketing_email: "Marketing Consent",
  construction_invoicing_type: "Invoicing Type",
  construction_main_contract_or: "Main Contractor",
  construction_retention: "Retention",
  recruitment_type: "Recruitment Type",
  payroll_support_required: "Payroll Support",
};

interface ErrorSummaryProps {
  errors: Record<string, string>;
}

export const ErrorSummary: React.FC<ErrorSummaryProps> = ({ errors }) => {
  if (!errors || Object.keys(errors).length === 0) return null;

  return (
    <div className="p-4 bg-error/10 border border-error/20 rounded-lg flex items-start gap-3 w-full mb-4">
      <AlertCircle className="w-5 h-5 text-error shrink-0 mt-0.5" />
      <div className="text-body-m text-error">
        <p className="font-medium mb-1">Please provide the missing information to continue:</p>
        <ul className="list-disc pl-5 space-y-1">
          {Object.entries(errors).map(([field, msg]) => (
            <li key={field}>
              <span className="font-semibold">{fieldLabels[field] || field}:</span> {msg}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
