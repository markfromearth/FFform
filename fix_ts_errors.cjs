const fs = require('fs');

// Fix caseSummaryGenerator
let caseSumPath = '/Users/trinity/Documents/MEM Digital/Factoring/FFform/api/lib/caseSummaryGenerator.ts';
let caseSumContent = fs.readFileSync(caseSumPath, 'utf8');
if (!caseSumContent.includes('formatLabel')) {
   // Wait, if it has 'formatLabel' but no import...
}
if (!caseSumContent.includes("import { formatLabel }")) {
  caseSumContent = "import { formatLabel } from '../../src/utils/formatters';\n" + caseSumContent;
  fs.writeFileSync(caseSumPath, caseSumContent);
}

// Fix emailService
let emailPath = '/Users/trinity/Documents/MEM Digital/Factoring/FFform/api/lib/emailService.ts';
let emailContent = fs.readFileSync(emailPath, 'utf8');
emailContent = emailContent.replace(/application\.contact\?\.full_name/g, 'application.contact?.contact_full_name');
fs.writeFileSync(emailPath, emailContent);
