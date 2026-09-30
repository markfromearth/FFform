const fs = require('fs');
const path = require('path');

const visited = new Set();
const outOfApiFiles = new Set();
const extensionIssues = [];
const frontendIssues = [];

function parseImports(filePath) {
  if (!fs.existsSync(filePath)) {
    // try adding .ts or .tsx
    if (fs.existsSync(filePath + '.ts')) filePath += '.ts';
    else if (fs.existsSync(filePath + '.tsx')) filePath += '.tsx';
    else return []; // can't find
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  const importRegex = /(?:import|export).*?from\s+['"]([^'"]+)['"]/g;
  const deps = [];
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    deps.push({ specifier: match[1], line: getLineNumber(content, match.index), code: match[0] });
  }
  return deps;
}

function getLineNumber(content, index) {
  return content.substring(0, index).split('\n').length;
}

function checkFrontendIssues(filePath, content) {
  const issues = [];
  if (content.includes('import React') || content.includes('from "react"') || content.includes("from 'react'")) {
    issues.push('Imports React');
  }
  if (/\.(css|svg|png|jpg|jpeg|gif|ico)['"]/.test(content)) {
    issues.push('Imports CSS/Image asset');
  }
  if (/\bwindow\b/.test(content) && !content.includes('typeof window')) {
    issues.push('Uses window global');
  }
  if (/\bdocument\b/.test(content)) {
    issues.push('Uses document global');
  }
  if (/\blocalStorage\b/.test(content)) {
    issues.push('Uses localStorage');
  }
  if (content.includes('import.meta.env')) {
    issues.push('Uses import.meta.env');
  }
  return issues;
}

function traverse(filePath) {
  const resolvedPath = path.resolve(filePath);
  if (visited.has(resolvedPath)) return;
  visited.add(resolvedPath);

  let actualPath = resolvedPath;
  if (!fs.existsSync(actualPath)) {
    if (fs.existsSync(actualPath + '.ts')) actualPath += '.ts';
    else if (fs.existsSync(actualPath + '.tsx')) actualPath += '.tsx';
    else if (fs.existsSync(actualPath + '.js')) actualPath += '.js';
    else return;
  }

  const isOutsideApi = !actualPath.includes('/api/');
  if (isOutsideApi) {
    outOfApiFiles.add(actualPath);
  }

  const content = fs.readFileSync(actualPath, 'utf8');
  
  if (isOutsideApi) {
    const feIssues = checkFrontendIssues(actualPath, content);
    if (feIssues.length > 0) {
      frontendIssues.push({ file: actualPath, issues: feIssues });
    }
  }

  const deps = parseImports(actualPath);
  
  for (const dep of deps) {
    const { specifier, line, code } = dep;
    // We only care about relative imports (or path aliases if any)
    if (specifier.startsWith('.')) {
      if (isOutsideApi) {
        // Check for extension or directory import
        if (!specifier.endsWith('.js') && !specifier.endsWith('.ts') && !specifier.endsWith('.tsx') && !specifier.endsWith('.json')) {
          extensionIssues.push({
            file: actualPath,
            line,
            code,
            specifier,
            issue: 'Missing file extension or directory import'
          });
        }
      }
      
      // Resolve path
      let nextPath = path.resolve(path.dirname(actualPath), specifier);
      // Strip .js if it was added, so we can find the actual .ts file on disk
      if (nextPath.endsWith('.js')) {
        nextPath = nextPath.slice(0, -3);
      }
      traverse(nextPath);
    } else if (specifier.startsWith('@/') || specifier.startsWith('~/')) {
      if (isOutsideApi) {
        extensionIssues.push({
          file: actualPath,
          line,
          code,
          specifier,
          issue: 'Uses path alias (not supported natively in Node ESM)'
        });
      }
    }
  }
}

// Find all entry points in api/
function getEntryPoints(dir) {
  let entries = [];
  fs.readdirSync(dir).forEach(file => {
    const full = path.join(dir, file);
    if (fs.statSync(full).isDirectory()) {
      entries = entries.concat(getEntryPoints(full));
    } else if (full.endsWith('.ts')) {
      entries.push(full);
    }
  });
  return entries;
}

const entries = getEntryPoints('./api');
entries.forEach(traverse);

console.log('--- Out of API Files Reached ---');
outOfApiFiles.forEach(f => console.log(f.replace(process.cwd() + '/', '')));

console.log('\n--- Extension / Resolution Issues ---');
extensionIssues.forEach(i => console.log(`${i.file.replace(process.cwd() + '/', '')}:${i.line}\n  Code: ${i.code}\n  Issue: ${i.issue}`));

console.log('\n--- Frontend / Browser Issues ---');
frontendIssues.forEach(i => console.log(`${i.file.replace(process.cwd() + '/', '')}\n  Issues: ${i.issues.join(', ')}`));

