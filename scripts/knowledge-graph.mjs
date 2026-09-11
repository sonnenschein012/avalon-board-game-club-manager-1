/** Local verification only. Analysis remains owned by Understand-Anything. */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync, renameSync } from 'node:fs';
import { resolve, join, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { homedir } from 'node:os';
import { execFileSync } from 'node:child_process';

const roots = ['src', 'tests', 'scripts', 'docs', '.github', 'public'];
const textExtension = /\.(?:tsx?|jsx?|mjs|cjs|ps1|json|ya?ml|md|html|css|rules|webmanifest)$/i;
const excluded = /(?:^|\/)(?:node_modules|dist|build|coverage|graphify-out|\.ua|\.git|playwright-report|test-results|\.firebase|\.demo-runtime)(?:\/|$)|(?:^|\/)(?:package-lock\.json|stats\.html|\.env[^/]*$)|\.(?:bak|backup)$/;
const fileTypes = new Set(['file', 'config', 'document', 'service', 'pipeline', 'table', 'schema', 'resource', 'endpoint']);
const controls = ['.gitignore', '.understandignore', '.ua/.understandignore', '.ua/config.json', 'AGENTS.md'];
const artifactNames = ['knowledge-graph.json', 'domain-graph.json', 'fingerprints.json', 'meta.json', 'intermediate/scan-result.json'];
const hash = value => createHash('sha256').update(value).digest('hex');
const json = path => JSON.parse(readFileSync(path, 'utf8'));
const canonical = value => JSON.stringify(value);
const slash = value => value.replaceAll('\\', '/');
function atomic(path, value) {
  mkdirSync(resolve(path, '..'), { recursive: true });
  const temp = `${path}.tmp-${process.pid}`;
  writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(temp, path);
}
function git(root, args) {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
}
export function inventory(root) {
  const paths = [];
  function walk(dir) {
    if (!existsSync(join(root, dir))) return;
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
      const path = slash(join(dir, entry.name));
      if (excluded.test(path) || entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile() && textExtension.test(path)) paths.push(path);
    }
  }
  roots.forEach(walk);
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.isFile() && !excluded.test(entry.name) && entry.name !== 'AGENTS.md' &&
        (textExtension.test(entry.name) || ['.firebaserc', '.gitattributes'].includes(entry.name))) paths.push(entry.name);
  }
  return Object.fromEntries([...new Set(paths)].sort().map(path => [path, hash(readFileSync(join(root, path)))]));
}
export function snapshot(root) {
  const files = inventory(root);
  const references = [...controls];
  if (existsSync(join(root, 'agent_docs'))) {
    for (const name of readdirSync(join(root, 'agent_docs'))) if (name.endsWith('.md')) references.push(`agent_docs/${name}`);
  }
  const context = Object.fromEntries(references.sort().filter(path => existsSync(join(root, path)))
    .map(path => [path, hash(readFileSync(join(root, path)))]));
  const changed = args => git(root, args).split('\0').filter(Boolean).map(slash).filter(path => path in files || path in context || !existsSync(join(root, path)) && roots.some(dir => path.startsWith(`${dir}/`)));
  const worktree = {
    staged: changed(['diff', '--cached', '--name-only', '-z', '--', '.']),
    unstaged: changed(['diff', '--name-only', '-z', '--', '.']),
    untracked: changed(['ls-files', '--others', '--exclude-standard', '-z', '--', '.']),
  };
  return { head: git(root, ['rev-parse', 'HEAD']).trim(), files, context,
    digest: hash(canonical({ files, context })), worktree, dirty: Object.values(worktree).some(paths => paths.length) };
}
function safePath(path) {
  return typeof path === 'string' && path && !isAbsolute(path) && !path.includes('\\') && !path.split('/').includes('..');
}
export function validateGraph(graph, files, previous = null) {
  const issues = [];
  if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges) || !Array.isArray(graph.layers) || !Array.isArray(graph.tour)) return ['Missing graph arrays'];
  const ids = new Set(), covered = new Set();
  for (const node of graph.nodes) {
    if (!node.id || ids.has(node.id)) issues.push(`Missing/duplicate node ID: ${node.id}`);
    ids.add(node.id);
    if (!node.type || !node.name || !node.summary?.trim() || !node.tags?.length || !['simple', 'moderate', 'complex'].includes(node.complexity)) issues.push(`Invalid node: ${node.id}`);
    if (node.filePath) {
      if (!safePath(node.filePath) || !(node.filePath in files)) issues.push(`Unknown source: ${node.filePath}`);
      if (fileTypes.has(node.type)) covered.add(node.filePath);
    }
  }
  for (const path of Object.keys(files)) if (!covered.has(path)) issues.push(`Missing file: ${path}`);
  for (const edge of graph.edges) {
    if (!ids.has(edge.source) || !ids.has(edge.target)) issues.push(`Dangling edge: ${edge.source} -> ${edge.target}`);
    if (!edge.type || !['forward', 'backward', 'bidirectional'].includes(edge.direction) || !Number.isFinite(edge.weight) || edge.weight < 0 || edge.weight > 1) issues.push(`Invalid edge: ${edge.source}`);
  }
  const layered = new Set();
  for (const layer of graph.layers) {
    if (!layer.id || !layer.name || !layer.description || !Array.isArray(layer.nodeIds)) issues.push(`Invalid layer: ${layer.id}`);
    for (const id of layer.nodeIds ?? []) {
      if (!ids.has(id)) issues.push(`Dangling layer: ${id}`);
      if (layered.has(id)) issues.push(`Duplicate layer assignment: ${id}`);
      layered.add(id);
    }
  }
  for (const node of graph.nodes) if (fileTypes.has(node.type) && !layered.has(node.id)) issues.push(`Unassigned file: ${node.id}`);
  if (!graph.tour.length) issues.push('Missing guided tour');
  for (const step of graph.tour) {
    if (!step.title || !step.description || !Number.isFinite(step.order) || !Array.isArray(step.nodeIds)) issues.push('Invalid tour step');
    for (const id of step.nodeIds ?? []) if (!ids.has(id)) issues.push(`Dangling tour: ${id}`);
  }
  if (previous) {
    const unchanged = new Set(Object.keys(files).filter(path => files[path] === previous.files[path]));
    for (const node of previous.nodes) if (unchanged.has(node.filePath) && !ids.has(node.id)) issues.push(`Lost unchanged symbol: ${node.id}`);
    const edgeKeys = new Set(graph.edges.map(edge => canonical([edge.source, edge.target, edge.type])));
    const oldNodes = new Map(previous.nodes.map(node => [node.id, node]));
    for (const edge of previous.edges) {
      if (unchanged.has(oldNodes.get(edge.source)?.filePath) && unchanged.has(oldNodes.get(edge.target)?.filePath) && !edgeKeys.has(canonical([edge.source, edge.target, edge.type]))) issues.push(`Lost unchanged edge: ${edge.source} -> ${edge.target}`);
    }
  }
  return issues;
}
export function freshness(current, state, artifacts) {
  if (!state || state.status !== 'verified') return 'unverified';
  if (canonical(artifacts) !== canonical(state.artifacts)) return 'artifact-drift';
  if (current.digest !== state.input.digest) return 'stale';
  if (state.input.dirty && !current.dirty) return 'clean-rebaseline-required';
  if (current.head !== state.input.head) return 'commit-reconciliation-required';
  return 'current';
}
function artifactHashes(root) {
  return Object.fromEntries(artifactNames.map(name => [name, existsSync(join(root, '.ua', name)) ? hash(readFileSync(join(root, '.ua', name))) : null]));
}
export async function main(args) {
  const [command = 'status', rootArg = '.', ...options] = args;
  const root = resolve(rootArg), ua = join(root, '.ua');
  const current = snapshot(root);
  const statePath = join(ua, 'verification-state.json');
  const state = existsSync(statePath) ? json(statePath) : null;
  if (command === 'status') {
    const status = freshness(current, state, artifactHashes(root));
    return { exitCode: status === 'current' ? 0 : 2, status, head: current.head, dirty: current.dirty, worktree: current.worktree, files: Object.keys(current.files).length };
  }
  if (command === 'begin') {
    atomic(join(ua, 'verification', 'pending-input.json'), current);
    return { exitCode: 0, status: 'analysis-input-recorded', files: Object.keys(current.files).length, dirty: current.dirty };
  }
  if (!['verify', 'accept'].includes(command)) throw new Error('Usage: node scripts/knowledge-graph.mjs status|begin|verify|accept [projectRoot] [--full]');
  const graph = json(join(ua, 'knowledge-graph.json'));
  const scan = json(join(ua, 'intermediate/scan-result.json'));
  const fingerprints = json(join(ua, 'fingerprints.json'));
  const meta = json(join(ua, 'meta.json'));
  const domain = json(join(ua, 'domain-graph.json'));
  const installation = json(join(ua, 'installation.json'));
  const toolRoot = join(homedir(), '.understand-anything/repo');
  if (git(toolRoot, ['rev-parse', 'HEAD']).trim() !== installation.commit) throw new Error('Installed tool revision changed; revalidate the upgrade');
  const { KnowledgeGraphSchema } = await import(pathToFileURL(join(toolRoot, 'understand-anything-plugin/packages/core/dist/schema.js')).href);
  const previous = state && existsSync(join(ua, 'verification/accepted-graph.json')) ? { ...json(join(ua, 'verification/accepted-graph.json')), files: state.input.files } : null;
  const issues = validateGraph(graph, current.files, previous);
  for (const [name, value] of [['knowledge', graph], ['domain', domain]]) {
    const result = KnowledgeGraphSchema.safeParse(value);
    if (!result.success) issues.push(`${name} schema: ${result.error.message}`);
  }
  const scanned = new Set(scan.files.map(file => file.path));
  for (const path of Object.keys(current.files)) if (!scanned.has(path)) issues.push(`Scan missed: ${path}`);
  for (const path of scanned) if (!(path in current.files)) issues.push(`Unexpected scan input: ${path}`);
  if (scan.failures?.length) issues.push('Scanner reported file failures');
  for (const path of Object.keys(current.files)) if (fingerprints.files?.[path]?.contentHash !== current.files[path]) issues.push(`Fingerprint mismatch: ${path}`);
  if (graph.project?.gitCommitHash !== current.head || meta.gitCommitHash !== current.head || fingerprints.gitCommitHash !== current.head) issues.push('Analysis commit mismatch');
  if (!domain.nodes?.length || !domain.edges?.length) issues.push('Missing domain analysis');
  const domainIds = new Set(domain.nodes?.map(node => node.id));
  for (const edge of domain.edges ?? []) if (!domainIds.has(edge.source) || !domainIds.has(edge.target)) issues.push(`Dangling domain edge: ${edge.source}`);
  const pending = json(join(ua, 'verification/pending-input.json'));
  if (pending.digest !== current.digest || pending.head !== current.head) issues.push('Inputs changed during analysis; begin and analyze again');
  if (command === 'accept' && !issues.length) {
    const review = json(join(ua, 'verification/semantic-review.json'));
    if (review.status !== 'passed' || review.inputDigest !== current.digest || review.graphHash !== hash(readFileSync(join(ua, 'knowledge-graph.json'))) || review.domainHash !== hash(readFileSync(join(ua, 'domain-graph.json')))) issues.push('Missing or stale semantic review');
    if ((current.dirty || state?.input.dirty) && !options.includes('--full')) issues.push('Dirty input/baseline requires a full analysis');
    const planPath = join(ua, 'intermediate/incremental-plan.json');
    if (!options.includes('--full') && existsSync(planPath) && json(planPath).cosmeticFiles?.length) issues.push('Cosmetic classification may hide behavior changes; perform full semantic analysis');
    if (!issues.length) {
      const next = { version: 1, status: 'verified', verifiedAt: new Date().toISOString(), tool: installation, mode: options.includes('--full') ? 'full' : 'incremental', input: current, artifacts: artifactHashes(root) };
      atomic(join(ua, 'verification/accepted-graph.json'), graph);
      atomic(statePath, next);
    }
  }
  return { exitCode: issues.length ? 3 : 0, status: issues.length ? 'invalid' : command === 'accept' ? 'verified' : 'structurally-valid', issues, files: Object.keys(current.files).length, nodes: graph.nodes.length, edges: graph.edges.length };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { const result = await main(process.argv.slice(2)); console.log(JSON.stringify(result, null, 2)); process.exitCode = result.exitCode; }
  catch (error) { console.error(JSON.stringify({ status: 'invalid', error: error.message })); process.exitCode = 3; }
}
