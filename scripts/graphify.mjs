/** Project-local Graphify launcher and content-hash verification. No analysis implementation. */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync, renameSync, copyFileSync } from 'node:fs';
import { join, resolve, isAbsolute } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { inventory as legacyInventory } from './knowledge-graph.mjs';

const artifacts = ['graph.json', 'graph.html', 'GRAPH_REPORT.md', 'manifest.json', 'scope.json', 'semantic-review.json'];
const hash = value => createHash('sha256').update(value).digest('hex');
const inputHash = path => hash(readFileSync(path, 'utf8').replaceAll('\r\n', '\n'));
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const slash = value => value.replaceAll('\\', '/');
const git = (root, args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' });
function atomic(path, data) {
  mkdirSync(resolve(path, '..'), { recursive: true });
  const temp = `${path}.tmp-${process.pid}`;
  writeFileSync(temp, `${JSON.stringify(data, null, 2)}\n`);
  renameSync(temp, path);
}
export function inventory(root) {
  const files = legacyInventory(root);
  function walk(dir) {
    if (!existsSync(join(root, dir))) return;
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      const path = slash(join(dir, entry.name));
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile() && /\.py$/i.test(path)) files[path] = inputHash(join(root, path));
    }
  }
  walk('scripts');
  return Object.fromEntries(Object.keys(files).sort((a, b) => a.localeCompare(b, 'en')).map(path => [path, inputHash(join(root, path))]));
}
export function snapshot(root) {
  const files = inventory(root);
  const controls = Object.fromEntries(['.gitignore', '.graphifyignore', 'AGENTS.md', 'graphify-toolchain.json'].sort()
    .filter(path => existsSync(join(root, path))).map(path => [path, inputHash(join(root, path))]));
  return { head: git(root, ['rev-parse', 'HEAD']).trim(), files, controls, digest: hash(JSON.stringify({ files, controls })) };
}
export function artifactHashes(root) {
  return Object.fromEntries(artifacts.map(name => [name, existsSync(join(root, 'graphify-out', name)) ? hash(readFileSync(join(root, 'graphify-out', name))) : null]));
}
export function freshness(input, state, hashes) {
  if (!state || state.status !== 'verified') return 'unverified';
  if (JSON.stringify(hashes) !== JSON.stringify(state.artifacts)) return 'artifact-drift';
  return input.digest === state.input.digest ? 'current' : 'stale';
}
export function validateGraph(graph, files, scope, previous = null) {
  const issues = [], ids = new Set(), covered = new Set();
  if (!Array.isArray(graph.nodes) || !Array.isArray(graph.links)) return ['Missing graph nodes/links'];
  if (!graph.directed || graph.multigraph) issues.push('Expected directed simple graph');
  if (!graph.nodes.length || !graph.links.length) issues.push('Empty graph');
  for (const node of graph.nodes) {
    if (typeof node.id !== 'string' || !node.id || ids.has(node.id)) issues.push(`Missing/duplicate node: ${node.id}`);
    ids.add(node.id);
    if (!node.label || !node.file_type) issues.push(`Invalid node: ${node.id}`);
    if (node.source_file && !isAbsolute(node.source_file) && !node.source_file.includes('\\') && node.source_file in files) covered.add(node.source_file);
  }
  for (const edge of graph.links) {
    if (!ids.has(edge.source) || !ids.has(edge.target)) issues.push(`Dangling edge: ${edge.source} -> ${edge.target}`);
    if (!edge.relation || !['EXTRACTED', 'INFERRED', 'AMBIGUOUS'].includes(edge.confidence)) issues.push(`Invalid relation/confidence: ${edge.source}`);
    if (!Number.isFinite(edge.confidence_score) || edge.confidence_score < 0 || edge.confidence_score > 1) issues.push(`Invalid confidence score: ${edge.source}`);
  }
  if (JSON.stringify(scope?.files) !== JSON.stringify(files)) issues.push('Scope hashes differ from current inventory');
  for (const path of Object.keys(files)) if (!covered.has(path)) issues.push(`Missing input coverage: ${path}`);
  if (previous) {
    const unchanged = new Set(Object.keys(files).filter(path => previous.files[path] === files[path]));
    for (const node of previous.graph.nodes) if (unchanged.has(node.source_file) && !ids.has(node.id)) issues.push(`Lost unchanged symbol: ${node.id}`);
    const keys = new Set(graph.links.map(e => JSON.stringify([e.source, e.target, e.relation])));
    const old = new Map(previous.graph.nodes.map(n => [n.id, n]));
    for (const edge of previous.graph.links) if (unchanged.has(old.get(edge.source)?.source_file) && unchanged.has(old.get(edge.target)?.source_file) && !keys.has(JSON.stringify([edge.source, edge.target, edge.relation]))) issues.push(`Lost unchanged relation: ${edge.source} -> ${edge.target}`);
  }
  return issues;
}
export function validateReview(review, graph, files) {
  const expected = ['attendee-member-conversion', 'board-member-snapshot', 'planning-confirmed-preservation', 'shared-firestore-consumers', 'public-admin-legacy-schedule', 'freshness-semantic-and-omission'];
  const cases = review.cases ?? [], ids = new Set(graph.nodes.map(n => n.id));
  if (cases.length !== expected.length || new Set(cases.map(c => c.id)).size !== expected.length || expected.some(id => !cases.some(c => c.id === id))) return ['Incomplete six-case review'];
  const issues = [];
  for (const item of cases) {
    if (!item.answer || !item.graphFinding || !Array.isArray(item.limits) || !item.codeCitations?.length || !item.graphNodeIds?.length) issues.push(`Incomplete review evidence: ${item.id}`);
    for (const citation of item.codeCitations ?? []) if (!(citation.replace(/:\d+$/, '') in files)) issues.push(`Unknown review source: ${citation}`);
    for (const id of item.graphNodeIds ?? []) if (!ids.has(id)) issues.push(`Unknown reviewed graph node: ${id}`);
  }
  return issues;
}
export async function main(args) {
  const [command = 'status', ...rest] = args;
  const root = resolve('.'), output = join(root, 'graphify-out');
  const toolchain = read(join(root, 'graphify-toolchain.json'));
  if (!['status', 'begin', 'verify', 'accept'].includes(command)) {
    const python = join(root, '.graphify-runtime', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
    if (!existsSync(python)) throw new Error('Install the pinned local runtime as documented in docs/knowledge-graph.md');
    const version = execFileSync(python, ['-m', 'graphify', '--version'], { encoding: 'utf8' }).trim();
    if (version !== `graphify ${toolchain.version}`) throw new Error(`Runtime differs from pinned Graphify: ${version}`);
    const env = { ...process.env };
    if (command === 'update') {
      const candidate = join(root, '.graphify-work', 'update-candidate');
      mkdirSync(candidate, { recursive: true });
      for (const name of artifacts) if (existsSync(join(output, name))) copyFileSync(join(output, name), join(candidate, name));
      env.GRAPHIFY_OUT = candidate;
    }
    const result = spawnSync(python, ['-m', 'graphify', command, ...rest], { cwd: root, stdio: 'inherit', env });
    if (result.error) throw result.error;
    return { exitCode: result.status ?? 3, status: 'official-command-completed', command };
  }
  const input = snapshot(root), statePath = join(output, 'verification-state.json');
  const state = existsSync(statePath) ? read(statePath) : null;
  if (command === 'status') {
    const status = freshness(input, state, artifactHashes(root));
    return { exitCode: status === 'current' ? 0 : 2, status, files: Object.keys(input.files).length, head: input.head };
  }
  const pendingPath = join(root, '.graphify-work', 'pending-input.json');
  const baselinePath = join(root, '.graphify-work', 'previous-verified.json');
  if (command === 'begin') {
    const intact = state?.status === 'verified' && JSON.stringify(artifactHashes(root)) === JSON.stringify(state.artifacts);
    atomic(baselinePath, intact ? { graph: read(join(output, 'graph.json')), files: state.input.files } : null);
    atomic(pendingPath, input);
    return { exitCode: 0, status: 'analysis-input-recorded', files: Object.keys(input.files).length };
  }
  const graph = read(join(output, 'graph.json')), scope = read(join(output, 'scope.json'));
  const review = read(join(output, 'semantic-review.json'));
  const hashes = artifactHashes(root);
  const previous = command === 'accept' && existsSync(baselinePath) ? read(baselinePath) : null;
  const issues = [...validateGraph(graph, input.files, scope, previous), ...validateReview(review, graph, input.files)];
  if (graph.graph?.graphify_version !== toolchain.version) issues.push('Graphify version mismatch');
  if (!graph.graph?.schema_version) issues.push('Missing official schema version');
  if (review.status !== 'passed' || review.inputDigest !== input.digest || review.graphHash !== hashes['graph.json'] || review.cases?.length !== 6) issues.push('Missing/stale six-case semantic review');
  if (command === 'accept') {
    const pending = read(pendingPath);
    if (pending.digest !== input.digest) issues.push('Inputs changed during analysis');
    if (Object.values(hashes).some(value => !value)) issues.push('Incomplete shared bundle');
    if (!issues.length) atomic(statePath, { version: 1, status: 'verified', verifiedAt: new Date().toISOString(), tool: toolchain, input, artifacts: hashes });
  } else if (freshness(input, state, hashes) !== 'current') issues.push('Shared bundle is stale or damaged');
  return { exitCode: issues.length ? 3 : 0, status: issues.length ? 'invalid' : command === 'accept' ? 'verified' : 'structurally-valid', issues, files: Object.keys(input.files).length, nodes: graph.nodes.length, edges: graph.links.length };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { const result = await main(process.argv.slice(2)); console.log(JSON.stringify(result, null, 2)); process.exitCode = result.exitCode; }
  catch (error) { console.error(JSON.stringify({ status: 'invalid', error: error.message })); process.exitCode = 3; }
}
