import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { inventory, snapshot, freshness, validateGraph, validateReview, artifactHashes } from './graphify.mjs';

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'graphify-검증 '));
  execFileSync('git', ['init', '-q', root]);
  execFileSync('git', ['-C', root, 'config', 'user.name', 'Graph Test']);
  execFileSync('git', ['-C', root, 'config', 'user.email', 'graph-test@example.invalid']);
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'src/a.ts'), 'export function decision() { return false; }\n');
  execFileSync('git', ['-C', root, 'add', '.']);
  execFileSync('git', ['-C', root, 'commit', '-qm', 'fixture']);
  return root;
}
const node = { id: 'src_a_decision', label: 'decision', file_type: 'code', source_file: 'src/a.ts' };
const graph = () => ({ directed: true, multigraph: false, nodes: [{ ...node }], links: [{ source: node.id, target: node.id, relation: 'references', confidence: 'EXTRACTED', confidence_score: 1 }] });

test('captures body-only changes at the same HEAD plus staged/new Korean paths and Python tools', () => {
  const root = fixture(), before = snapshot(root);
  writeFileSync(join(root, 'src/a.ts'), 'export function decision() { return true; }\n');
  writeFileSync(join(root, 'src/새 파일.ts'), 'export const 새값 = 1;\n');
  mkdirSync(join(root, 'scripts'));
  writeFileSync(join(root, 'scripts/pipeline.py'), 'print("local")\n');
  execFileSync('git', ['-C', root, 'add', 'src/새 파일.ts']);
  const after = snapshot(root);
  assert.equal(after.head, before.head);
  assert.notEqual(after.digest, before.digest);
  assert.ok('scripts/pipeline.py' in after.files);
  assert.ok('src/새 파일.ts' in after.files);
});

test('renames/deletions change inventory and generated runtime/output do not enter scope', () => {
  const root = fixture(), before = snapshot(root);
  execFileSync('git', ['-C', root, 'mv', 'src/a.ts', 'src/b.ts']);
  assert.ok(!('src/a.ts' in inventory(root)));
  assert.ok('src/b.ts' in inventory(root));
  assert.notEqual(snapshot(root).digest, before.digest);
  for (const dir of ['.graphify-runtime', '.graphify-work', 'graphify-out']) {
    mkdirSync(join(root, dir)); writeFileSync(join(root, dir, 'generated.json'), '{}');
  }
  assert.deepEqual(Object.keys(inventory(root)), ['src/b.ts']);
});

test('exclusion and toolchain changes invalidate same-source freshness', () => {
  const root = fixture(), before = snapshot(root);
  writeFileSync(join(root, '.graphifyignore'), '*.csv\n');
  assert.notEqual(snapshot(root).digest, before.digest);
  const after = snapshot(root);
  writeFileSync(join(root, 'graphify-toolchain.json'), '{"version":"next"}\n');
  assert.notEqual(snapshot(root).digest, after.digest);
});

test('LF and CRLF input/control text preserve freshness across checkout platforms', () => {
  const root = fixture();
  writeFileSync(join(root, '.gitignore'), 'graphify-out/\n');
  const lf = snapshot(root);
  writeFileSync(join(root, 'src/a.ts'), 'export function decision() { return false; }\r\n');
  writeFileSync(join(root, '.gitignore'), 'graphify-out/\r\n');
  const crlf = snapshot(root);
  assert.equal(crlf.files['src/a.ts'], lf.files['src/a.ts']);
  assert.equal(crlf.controls['.gitignore'], lf.controls['.gitignore']);
  assert.equal(crlf.digest, lf.digest);
});

test('freshness follows content hashes rather than commit identity', () => {
  const input = { digest: 'same', head: 'first' }, artifacts = { 'graph.json': 'hash' };
  const state = { status: 'verified', input, artifacts };
  assert.equal(freshness({ ...input, head: 'later' }, state, artifacts), 'current');
  assert.equal(freshness({ digest: 'changed' }, state, artifacts), 'stale');
  assert.equal(freshness(input, state, { 'graph.json': 'corrupt' }), 'artifact-drift');
  assert.equal(freshness(input, null, artifacts), 'unverified');
});

test('detects missing artifacts and changed graph bytes', () => {
  const root = fixture(); mkdirSync(join(root, 'graphify-out'));
  const absent = artifactHashes(root);
  assert.equal(absent['graph.json'], null);
  writeFileSync(join(root, 'graphify-out/graph.json'), '{}');
  const first = artifactHashes(root);
  writeFileSync(join(root, 'graphify-out/graph.json'), '{"corrupt":true}');
  assert.notEqual(artifactHashes(root)['graph.json'], first['graph.json']);
});

test('rejects source coverage, node/reference and confidence failures', () => {
  const files = { 'src/a.ts': 'h' }, scope = { files }, good = graph();
  assert.deepEqual(validateGraph(good, files, scope), []);
  assert.ok(validateGraph(good, { ...files, 'src/missing.ts': 'h' }, scope).some(x => x.startsWith('Missing input coverage')));
  assert.ok(validateGraph({ ...good, nodes: [...good.nodes, { ...node }] }, files, scope).some(x => x.startsWith('Missing/duplicate')));
  assert.ok(validateGraph({ ...good, links: [{ ...good.links[0], target: 'absent' }] }, files, scope).some(x => x.startsWith('Dangling')));
  assert.ok(validateGraph({ ...good, links: [{ ...good.links[0], confidence_score: 2 }] }, files, scope).some(x => x.startsWith('Invalid confidence score')));
});

test('unchanged symbol and relationship loss is found even at the same node count', () => {
  const files = { 'src/a.ts': 'h' }, prior = graph();
  prior.nodes.push({ ...node, id: 'src_a_preserve', label: 'preserve' });
  prior.links.push({ ...prior.links[0], target: 'src_a_preserve' });
  const candidate = graph();
  candidate.nodes.push({ ...node, id: 'src_a_replacement', label: 'replacement' });
  const issues = validateGraph(candidate, files, { files }, { graph: prior, files });
  assert.ok(issues.some(x => x.startsWith('Lost unchanged symbol')));
  assert.ok(issues.some(x => x.startsWith('Lost unchanged relation')));
});

test('six review entries require distinct cases and real source/node evidence', () => {
  const cases = ['attendee-member-conversion', 'board-member-snapshot', 'planning-confirmed-preservation', 'shared-firestore-consumers', 'public-admin-legacy-schedule', 'freshness-semantic-and-omission'].map(id => ({ id, answer: 'source checked', graphFinding: 'node checked', limits: [], codeCitations: ['src/a.ts:1'], graphNodeIds: [node.id] }));
  const files = { 'src/a.ts': 'h' };
  assert.deepEqual(validateReview({ cases }, graph(), files), []);
  assert.ok(validateReview({ cases: cases.map(() => cases[0]) }, graph(), files).length);
  assert.ok(validateReview({ cases: cases.map(c => ({ ...c, graphNodeIds: ['invented'] })) }, graph(), files).length);
  assert.ok(validateReview({ cases: cases.map(c => ({ ...c, codeCitations: ['missing.ts:1'] })) }, graph(), files).length);
});
