import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { formatLabel } from '../../src/utils/formatters.js';
export async function generateApplicationPdf(applicationId, submissionRef, submittedAt, data) {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    let page = pdfDoc.addPage([595.28, 841.89]); // A4
    const { width, height } = page.getSize();
    const margin = 50;
    let y = height - margin;
    const drawText = (text, fontToUse, size, color = rgb(0, 0, 0)) => {
        if (y < margin + 20) {
            page = pdfDoc.addPage([595.28, 841.89]);
            y = height - margin;
        }
        page.drawText(text, { x: margin, y, size, font: fontToUse, color });
        y -= (size + 6);
    };
    const drawSection = (title) => {
        y -= 10;
        drawText(title, boldFont, 14, rgb(0.1, 0.3, 0.6));
        y -= 5;
    };
    const drawField = (label, value) => {
        if (value === undefined || value === null || value === '')
            return;
        let displayValue = String(value);
        if (typeof value === 'boolean') {
            displayValue = value ? 'Yes' : 'No';
        }
        else if (Array.isArray(value)) {
            displayValue = value.map(v => formatLabel(v)).join(', ');
        }
        else {
            displayValue = formatLabel(value);
        }
        if (y < margin + 20) {
            page = pdfDoc.addPage([595.28, 841.89]);
            y = height - margin;
        }
        page.drawText(label + ':', { x: margin, y, size: 10, font: boldFont });
        // Wrap long strings simply by cutting them off if too long (acceptable for standard fields)
        const safeDisplayValue = displayValue.length > 70 ? displayValue.substring(0, 67) + '...' : displayValue;
        page.drawText(safeDisplayValue, { x: margin + 180, y, size: 10, font });
        y -= 16;
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
        drawField('Entity Type', data.business.entity_type);
        drawField('Industry', data.business.industry);
        drawField('B2B Completed Supply', data.business.b2b_completed_supply);
        drawField('Annual Turnover', `£${data.business.annual_turnover?.toLocaleString()}`);
        drawField('Gross Debtor Book', `£${data.business.gross_debtor_book?.toLocaleString()}`);
        if (data.business.registered_address) {
            drawField('Registered Postcode', data.business.registered_address.postal_code);
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
        drawField('Desired Outcome', data.invoices.desired_outcome);
        drawField('Requested Facility', `£${data.invoices.requested_facility?.toLocaleString()}`);
        drawField('Payment Terms', data.invoices.payment_terms_days);
        drawField('Largest Customer %', data.invoices.largest_debtor_concentration_pct);
        drawField('Debtor Geography', data.invoices.debtor_geography);
        drawField('Export Sales %', data.invoices.export_sales_pct);
        drawField('Existing Invoice Finance', data.invoices.existing_invoice_finance);
        drawField('HMRC Arrears', data.invoices.hmrc_status);
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
    }
    // Consents
    if (data.consents) {
        drawSection('Declaration / Consents');
        drawField('Marketing Email', data.consents.marketing_email);
        drawField('Marketing SMS', data.consents.marketing_sms);
    }
    return await pdfDoc.save();
}
