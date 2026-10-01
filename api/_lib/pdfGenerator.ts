import { PDFDocument, rgb, StandardFonts, PDFFont } from 'pdf-lib';
import { formatLabel } from '../../src/utils/formatters.js';

export async function generateApplicationPdf(
  applicationId: string, 
  submissionRef: string, 
  submittedAt: string, 
  data: any
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  let page = pdfDoc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();
  const margin = 50;
  let y = height - margin;

  const drawText = (text: string, fontToUse: PDFFont, size: number, color = rgb(0,0,0)) => {
    if (y < margin + 20) {
      page = pdfDoc.addPage([595.28, 841.89]);
      y = height - margin;
    }
    page.drawText(text, { x: margin, y, size, font: fontToUse, color });
    y -= (size + 6);
  };

  const drawSection = (title: string) => {
    y -= 10;
    drawText(title, boldFont, 14, rgb(0.1, 0.3, 0.6));
    y -= 5;
  };

  const drawField = (label: string, value: any) => {
    if (value === undefined || value === null || value === '') return;
    
    let displayValue = String(value);
    
    if (typeof value === 'boolean') {
      displayValue = value ? 'Yes' : 'No';
    } else if (Array.isArray(value)) {
      displayValue = value.map(v => formatLabel(v)).join(', ');
    } else {
      displayValue = formatLabel(value);
    }
    
    if (y < margin + 20) {
      page = pdfDoc.addPage([595.28, 841.89]);
      y = height - margin;
    }
    
    page.drawText(label + ':', { x: margin, y, size: 10, font: boldFont });
    
    // Wrap text logic
    const maxWidth = width - margin - 180 - margin; // Right margin 50
    const lines: string[] = [];
    let currentLine = '';
    const words = displayValue.split(/\s+/);
    
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const lineWidth = font.widthOfTextAtSize(testLine, 10);
      if (lineWidth > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }

    for (const line of lines) {
      if (y < margin + 20) {
        page = pdfDoc.addPage([595.28, 841.89]);
        y = height - margin;
      }
      page.drawText(line, { x: margin + 180, y, size: 10, font });
      y -= 14;
    }
    
    y -= 4; // Add a small gap after the field
  };

  // Header
  drawText('Factoring Finance Application', boldFont, 20);
  y -= 10;
  drawField('Application Reference', submissionRef);
  drawField('Submitted At', new Date(submittedAt).toLocaleString('en-GB'));
  drawField('Application ID', applicationId);
  drawField('Status', 'Completed (Introduction Ready)');
  
  // Business Info
  if (data.business) {
    drawSection('Business Information');
    drawField('Company Name', data.business.company_name);
    drawField('Company Number', data.business.company_number);
    drawField('Company Status', data.business.company_status);
    drawField('Entity Type', data.business.entity_type);
    drawField('Incorporation Date', data.business.incorporation_date);
    drawField('Industry', data.business.industry);
    if (data.business.sic_codes?.length) {
      drawField('SIC Codes', data.business.sic_codes);
    }
    drawField('B2B Completed Supply', data.business.b2b_completed_supply);
    drawField('Annual Turnover', data.business.annual_turnover ? `£${data.business.annual_turnover.toLocaleString()}` : '');
    drawField('Gross Debtor Book', data.business.gross_debtor_book ? `£${data.business.gross_debtor_book.toLocaleString()}` : '');
    if (data.business.registered_address) {
       const addr = [
         data.business.registered_address.address_line_1,
         data.business.registered_address.locality,
         data.business.registered_address.postal_code
       ].filter(Boolean).join(', ');
       drawField('Registered Address', addr);
    }
    if (data.business.trading_address && !data.business.trading_address_same_as_registered) {
       const addr = [
         data.business.trading_address.address_line_1,
         data.business.trading_address.locality,
         data.business.trading_address.postal_code
       ].filter(Boolean).join(', ');
       drawField('Trading Address', addr);
    } else {
       drawField('Trading Address', 'Same as Registered');
    }
  }

  // Contact Info
  if (data.contact) {
    drawSection('Applicant / Contact Information');
    drawField('Full Name', data.contact.contact_full_name);
    drawField('Role', data.contact.contact_role);
    drawField('Email', data.contact.email);
    drawField('Phone', data.contact.phone);
    drawField('Funding Timescale', data.contact.funding_timescale);
  }

  // Invoice Details
  if (data.invoices) {
    drawSection('Invoice / Factoring Requirements');
    drawField('Funding Purpose', data.invoices.funding_purpose);
    drawField('Desired Outcome', data.invoices.desired_outcome);
    drawField('Requested Facility', data.invoices.requested_facility ? `£${data.invoices.requested_facility.toLocaleString()}` : '');
    drawField('Currency', data.invoices.invoice_currency);
    drawField('Payment Terms', data.invoices.payment_terms_days);
    drawField('Largest Customer %', data.invoices.largest_debtor_concentration_pct);
    drawField('Debtor Geography', data.invoices.debtor_geography);
    drawField('Export Sales %', data.invoices.export_sales_pct);
    
    drawField('Existing Invoice Finance', data.invoices.existing_invoice_finance);
    if (data.invoices.existing_invoice_finance) {
      drawField('Current Provider', data.invoices.current_provider);
      drawField('Current Facility Limit', data.invoices.current_facility_limit ? `£${data.invoices.current_facility_limit.toLocaleString()}` : '');
      drawField('Reason for Switch', data.invoices.reason_for_switch);
      drawField('Notice / Exit Date', data.invoices.notice_or_exit_date);
    }

    drawField('HMRC Arrears', data.invoices.hmrc_status);
    if (data.invoices.hmrc_status !== 'no_arrears' && data.invoices.hmrc_status !== 'none' && data.invoices.hmrc_arrears_amount) {
      drawField('HMRC Arrears Amount', `£${data.invoices.hmrc_arrears_amount.toLocaleString()}`);
    }
    
    if (data.invoices.construction_invoicing_type) {
      drawSection('Construction Specifics');
      drawField('Invoicing Type', data.invoices.construction_invoicing_type);
      drawField('Main Contractor', data.invoices.construction_main_contract_or);
      drawField('Retention %', data.invoices.construction_retention);
    }
    
    if (data.invoices.recruitment_type) {
      drawSection('Recruitment Specifics');
      drawField('Recruitment Type', data.invoices.recruitment_type);
      drawField('Payroll Support', data.invoices.payroll_support_required);
    }
    
    if (data.invoices.additional_context) {
      drawSection('Additional Context');
      drawField('Notes', data.invoices.additional_context);
    }
  }

  // Consents
  if (data.consents) {
    drawSection('Declaration / Consents');
    drawField('Marketing Email', data.consents.marketing_email);
    drawField('Marketing SMS', data.consents.marketing_sms);
  }

  return await pdfDoc.save();
}
