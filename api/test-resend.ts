import { Resend } from 'resend';
export default async function handler(req: any, res: any) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send({
    from: 'BizLoans4U Applications <onboarding@resend.dev>',
    to: [process.env.APPLICATION_NOTIFICATION_EMAIL || 'ben@factoringfinance.co.uk'],
    subject: 'Test API',
    html: '<p>Test</p>',
  });
  res.status(200).json({ data, error, hasKey: !!process.env.RESEND_API_KEY, envTarget: process.env.APPLICATION_NOTIFICATION_EMAIL });
}
