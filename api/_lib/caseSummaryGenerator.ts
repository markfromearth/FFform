import { formatLabel } from '../../src/utils/formatters.js';
import { ApplicationData } from '../../src/schemas/applicationSchemas.js';

export interface SummaryOptions {
  submissionRef: string;
  submittedAt: string;
}

export function generateCaseSummary(application: ApplicationData, options: SummaryOptions): string {
  const { business, contact, invoices } = application;
  const { submissionRef, submittedAt } = options;
  
  const formattedDate = new Date(submittedAt).toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  // Determine internal routing flags
  const internalFlags: string[] = [];
  
  if (invoices.hmrc_status !== 'up_to_date' && invoices.hmrc_status !== '') {
    internalFlags.push(`HMRC Arrears: ${invoices.hmrc_status === 'ttp' ? 'Time to Pay' : 'Unarranged'} (£${invoices.hmrc_arrears_amount || 'Unknown'})`);
  }
  
  if (business.industry === 'construction') {
    internalFlags.push(`Construction: ${invoices.construction_invoicing_type || 'Unknown'} / ${invoices.construction_main_contract_or || 'Unknown'}`);
    if (invoices.construction_retention === 'yes') {
      internalFlags.push('Contains Retentions');
    }
  }

  if (business.industry === 'recruitment') {
    internalFlags.push(`Recruitment: ${invoices.recruitment_type || 'Unknown'}`);
  }

  const hasExport = invoices.debtor_geography?.some(g => ['europe', 'north_america', 'other_international'].includes(g));
  if (hasExport) {
    internalFlags.push(`Export Debt (${invoices.export_sales_pct || 'Unknown'}%)`);
  }

  // Format currency
  const formatCurrency = (amount?: number) => {
    if (amount === undefined || amount === null) return 'Not disclosed';
    return `£${amount.toLocaleString('en-GB')}`;
  };

  // Format geography
  const formatGeography = () => {
    if (!invoices.debtor_geography || invoices.debtor_geography.length === 0) return 'Not disclosed';
    return invoices.debtor_geography.map(g => g.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())).join(', ');
  };

  // Format reasons for switch
  const formatReasons = () => {
    if (!invoices.reason_for_switch || invoices.reason_for_switch.length === 0) return 'None specified';
    return invoices.reason_for_switch.map(r => r.replace(/_/g, ' ')).join(', ');
  };

  // Format funding purpose
  const formatPurpose = () => {
    if (!invoices.funding_purpose || invoices.funding_purpose.length === 0) return 'None specified';
    return invoices.funding_purpose.map(p => p.replace(/_/g, ' ')).join(', ');
  };

  return `
# INVOICE FINANCE ENQUIRY SUMMARY
Reference: ${submissionRef}
Date: ${formattedDate}

---
## INTERNAL ROUTING FLAGS
${internalFlags.length > 0 ? internalFlags.map(f => `- [FLAG] ${f}`).join('\n') : '- None'}

---
## 1. BUSINESS PROFILE
Company Name: ${business.company_name || 'Not provided'}
Company Number: ${business.company_number || 'N/A'}
Entity Type: ${business.entity_type?.replace(/_/g, ' ') || 'Unknown'}
Industry: ${business.industry?.replace(/_/g, ' ') || 'Unknown'}
Annual Turnover: ${formatCurrency(business.annual_turnover)}
B2B Supply: ${business.b2b_completed_supply === 'yes' ? 'Yes (Completed)' : business.b2b_completed_supply === 'mixture' ? 'Mixture B2B/B2C' : 'No'}

---
## 2. REQUIREMENT
Desired Outcome: ${formatLabel(invoices.desired_outcome) || 'Not specified'}
Requested Facility Limit: ${formatCurrency(invoices.requested_facility)}
Primary Funding Purpose: ${formatPurpose()}
Timescale: ${formatLabel(contact.funding_timescale) || 'Not specified'}

---
## 3. LEDGER PROFILE
Gross Debtor Book: ${formatCurrency(business.gross_debtor_book)}
Customer Payment Terms: ${formatLabel(invoices.payment_terms_days) || 'Not specified'}
Largest Debtor Concentration: ${formatLabel(invoices.largest_debtor_concentration_pct) || 'Not specified'}
Debtor Geography: ${formatGeography()}

---
## 4. EXISTING POSITION & POINTS TO NOTE
Currently using Invoice Finance? ${invoices.existing_invoice_finance ? 'Yes' : 'No'}
${invoices.existing_invoice_finance ? `Current Provider: ${invoices.current_provider || 'Not disclosed'}
Current Facility Limit: ${formatCurrency(invoices.current_facility_limit)}
Reasons for Switch: ${formatReasons()}
Notice / Deadline: ${invoices.notice_or_exit_date || 'None specified'}` : ''}

HMRC Status: ${formatLabel(invoices.hmrc_status) || 'Unknown'}

Additional Context provided by applicant:
> ${invoices.additional_context || 'None'}

---
## 5. CONTACT DETAILS
Name: ${contact.contact_full_name || 'Unknown'}
Role: ${contact.contact_role?.replace(/_/g, ' ') || 'Unknown'}
Email: ${contact.email || 'Unknown'}
Phone: ${contact.phone || 'Unknown'}
`.trim();
}
