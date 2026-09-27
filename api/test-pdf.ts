import { generateApplicationPdf } from './lib/pdfGenerator.js';
export default async function handler(req: any, res: any) {
  try {
    const pdfBytes = await generateApplicationPdf({
      id: 'test',
      businessProfile: { companyName: 'Test' },
      contactDetails: {},
      certification: { signatures: [] },
      authorisation: { signatures: [] }
    } as any, { submissionRef: 'TEST', submittedAt: 'TEST' });
    res.status(200).json({ success: true, size: pdfBytes.length });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message, stack: err.stack });
  }
}
