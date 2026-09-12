import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, renameSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { inventory, snapshot, freshness, validateGraph, cosmeticReviewIssues } from './knowledge-graph.mjs';

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'avalon-ua-test-'));
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'src/a.ts'), 'export function decision() { return false; }\n');
  execFileSync('git', ['init', '--quiet', root]);
  execFileSync('git', ['-C', root, 'add', '.']);
  execFileSync('git', ['-C', root, '-c', 'user.name=UA verification', '-c', 'user.email=ua-test@localhost', 'commit', '--quiet', '-m', 'isolated test fixture']);
  return root;
}
const node = { id: 'file:src/a.ts', type: 'file', name: 'a.ts', filePath: 'src/a.ts', summary: '반환값 정책', tags: ['policy'], complexity: 'simple' };
const graph = () => ({ nodes: [{ ...node }], edges: [], layers: [{ id: 'domain', name: '정책', description: '업무 정책', nodeIds: [node.id] }], tour: [{ order: 1, title: '정책', description: '정책 확인', nodeIds: [node.id] }] });

test('same HEAD captures body-only, staged, and new Korean/spaced paths', () => {
  const root = fixture(), before = snapshot(root);
  writeFileSync(join(root, 'src/a.ts'), 'export function decision() { return true; }\n');
  const dirty = snapshot(root);
  assert.equal(dirty.head, before.head);
  assert.notEqual(dirty.digest, before.digest);
  assert.deepEqual(dirty.worktree.unstaged, ['src/a.ts']);
  execFileSync('git', ['-C', root, 'add', 'src/a.ts']);
  writeFileSync(join(root, 'src/새 테스트.test.ts'), 'export const fixture = 1;');
  const staged = snapshot(root);
  assert.deepEqual(staged.worktree.staged, ['src/a.ts']);
  assert.deepEqual(staged.worktree.untracked, ['src/새 테스트.test.ts']);
});
test('rename and deletion change inventory without a new commit', () => {
  const root = fixture(), before = snapshot(root);
  renameSync(join(root, 'src/a.ts'), join(root, 'src/renamed.ts'));
  const after = snapshot(root);
  assert.equal(after.head, before.head);
  assert.notEqual(after.digest, before.digest);
  assert.ok(!('src/a.ts' in after.files));
  assert.ok('src/renamed.ts' in after.files);
  unlinkSync(join(root, 'src/renamed.ts'));
  assert.deepEqual(inventory(root), {});
});
test('ignored reference documents and controls affect freshness; artifacts do not affect input', () => {
  const root = fixture();
  mkdirSync(join(root, 'agent_docs'));
  mkdirSync(join(root, '.ua'));
  writeFileSync(join(root, 'agent_docs/project_diary.md'), '기존 결정');
  const before = snapshot(root);
  writeFileSync(join(root, 'agent_docs/project_diary.md'), '갱신된 결정');
  assert.notEqual(snapshot(root).digest, before.digest);
  const referenceUpdated = snapshot(root);
  writeFileSync(join(root, '.ua/knowledge-graph.json'), '{}');
  assert.equal(snapshot(root).digest, referenceUpdated.digest);
  writeFileSync(join(root, '.ua/.understandignore'), 'tests/');
  assert.notEqual(snapshot(root).digest, referenceUpdated.digest);
});
test('dirty baseline becoming clean requires full rebaseline', () => {
  const root = fixture(), input = snapshot(root), artifacts = { graph: 'hash' };
  const state = { status: 'verified', input: { ...input, dirty: true }, artifacts };
  assert.equal(freshness(input, state, artifacts), 'clean-rebaseline-required');
  assert.equal(freshness(input, state, { graph: 'corrupt' }), 'artifact-drift');
  assert.equal(freshness(input, null, artifacts), 'unverified');
});
test('validation rejects missing files, dangling references and duplicate IDs', () => {
  const candidate = graph();
  candidate.nodes.push({ ...node });
  candidate.edges.push({ source: node.id, target: 'missing', type: 'calls', direction: 'forward', weight: 0.8 });
  candidate.tour[0].nodeIds.push('missing');
  const issues = validateGraph(candidate, { 'src/a.ts': 'a', 'src/b.ts': 'b' });
  for (const fragment of ['duplicate', 'Missing file', 'Dangling edge', 'Dangling tour']) assert.ok(issues.some(issue => issue.includes(fragment)));
  assert.deepEqual(validateGraph({}, {}), ['Missing graph arrays']);
});
test('same node count cannot hide a lost unchanged symbol or relationship', () => {
  const old = graph();
  const symbol = { ...node, id: 'function:src/a.ts:decision', type: 'function', name: 'decision' };
  old.nodes.push(symbol);
  old.edges.push({ source: node.id, target: symbol.id, type: 'contains', direction: 'forward', weight: 1 });
  const candidate = graph();
  candidate.nodes.push({ ...symbol, id: 'function:src/a.ts:other', name: 'other' });
  const issues = validateGraph(candidate, { 'src/a.ts': 'a' }, { ...old, files: { 'src/a.ts': 'a' } });
  assert.ok(issues.some(issue => issue.startsWith('Lost unchanged symbol')));
  assert.ok(issues.some(issue => issue.startsWith('Lost unchanged edge')));
});
test('source traversal and unsafe paths are rejected', () => {
  const candidate = graph();
  candidate.nodes[0].filePath = '../outside.ts';
  assert.ok(validateGraph(candidate, {}).some(issue => issue.startsWith('Unknown source')));
});

test('cosmetic classification needs explicit evidence for every changed file', () => {
  const paths = ['src/a.ts', 'src/b.ts'];
  const reviewed = [{ path: paths[0], unchangedMeaning: true, evidence: 'Only whitespace changed in the source diff.' }];
  assert.equal(cosmeticReviewIssues(paths, reviewed).length, 1);
  assert.equal(cosmeticReviewIssues(paths, [...reviewed, { path: paths[1], unchangedMeaning: false, evidence: 'Return value changed.' }]).length, 1);
  assert.equal(cosmeticReviewIssues(paths, [...reviewed, { path: paths[1], unchangedMeaning: true, evidence: '' }]).length, 1);
  assert.deepEqual(cosmeticReviewIssues([paths[0]], reviewed), []);
});
