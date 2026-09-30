const { Resend } = require('resend');
require('dotenv').config({ path: '.env.local' });

async function test() {
  console.log("Using API Key:", process.env.RESEND_API_KEY ? "Present" : "Missing");
  console.log("From:", process.env.RESEND_FROM_EMAIL);
  console.log("To:", process.env.APPLICATION_NOTIFICATION_EMAIL);
  
  const resend = new Resend(process.env.RESEND_API_KEY);
  try {
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL,
      to: [process.env.APPLICATION_NOTIFICATION_EMAIL],
      subject: 'Test Email from CLI',
      html: '<p>Testing 123</p>'
    });
    console.log("Result:", { data, error });
  } catch (err) {
    console.error("Crash:", err.message);
  }
}
test();
