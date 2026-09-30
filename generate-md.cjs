const fs = require('fs');

const rawData = JSON.parse(fs.readFileSync('../a11y/01-automated.json', 'utf8'));

const severityMap = {
  critical: 'Critical',
  serious: 'Serious',
  moderate: 'Moderate',
  minor: 'Minor'
};

const deDuped = {};

rawData.forEach(violation => {
  const key = violation.id;
  if (!deDuped[key]) {
    deDuped[key] = {
      id: violation.id,
      description: violation.description,
      helpUrl: violation.helpUrl,
      impact: severityMap[violation.impact] || violation.impact,
      tags: violation.tags.filter(t => t.startsWith('wcag')).join(', '),
      instances: []
    };
  }
  
  violation.nodes.forEach(node => {
    deDuped[key].instances.push({
      step: violation.step,
      html: node.html,
      selector: node.target.join(', ')
    });
  });
});

let md = '# Automated Accessibility Checks (Axe-Core)\n\n';

Object.values(deDuped).forEach(issue => {
  md += `## [${issue.impact}] ${issue.description} (${issue.id})\n\n`;
  md += `**WCAG Success Criteria:** ${issue.tags}\n\n`;
  
  // Deduplicate instances by selector
  const uniqueInstances = {};
  issue.instances.forEach(inst => {
    if (!uniqueInstances[inst.selector]) {
      uniqueInstances[inst.selector] = { html: inst.html, steps: new Set() };
    }
    uniqueInstances[inst.selector].steps.add(inst.step);
  });
  
  md += `### Affected Elements:\n`;
  Object.keys(uniqueInstances).forEach(selector => {
    const data = uniqueInstances[selector];
    const steps = Array.from(data.steps).join(', ');
    md += `- **Selector:** \`${selector}\`\n`;
    md += `  - **Found in steps:** ${steps}\n`;
    md += `  - **HTML:** \`${data.html}\`\n\n`;
  });
  md += `---\n\n`;
});

md += `\n*Note: Automated tools catch only around 30-40% of issues, so a manual review is necessary.*`;

fs.writeFileSync('../a11y/01-automated.md', md);
