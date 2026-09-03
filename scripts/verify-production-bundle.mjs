import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const distDirectory = join(projectRoot, 'dist');
const forbiddenFiles = [join(distDirectory, 'design.html')];
const forbiddenMarkers = [
  'AVALON_SCENARIO_LAB',
  'avalon-design-tester@scenario.invalid',
  'scenario-member-',
  'src/scenario-lab',
  'src\\scenario-lab',
];
const textExtensions = new Set(['.css', '.html', '.js', '.json', '.map', '.mjs', '.txt']);

if (!existsSync(distDirectory)) {
  throw new Error('Production bundle verification requires an existing dist directory.');
}

for (const filePath of forbiddenFiles) {
  if (existsSync(filePath)) {
    throw new Error(`Production bundle contains forbidden Scenario Lab entry: ${relative(projectRoot, filePath)}`);
  }
}

const pending = [distDirectory];
const violations = [];
while (pending.length > 0) {
  const current = pending.pop();
  if (!current) continue;
  for (const name of readdirSync(current)) {
    const filePath = join(current, name);
    if (statSync(filePath).isDirectory()) {
      pending.push(filePath);
      continue;
    }
    if (!textExtensions.has(extname(filePath))) continue;
    const contents = readFileSync(filePath, 'utf8');
    for (const marker of forbiddenMarkers) {
      if (contents.includes(marker)) violations.push(`${relative(projectRoot, filePath)} contains ${marker}`);
    }
  }
}

if (violations.length > 0) {
  throw new Error(`Scenario Lab code leaked into the production bundle:\n${violations.join('\n')}`);
}

console.log('Production bundle verified: Scenario Lab entry, fixtures, and identity are absent.');
