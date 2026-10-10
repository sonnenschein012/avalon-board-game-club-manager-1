"""Orchestrates pinned official Graphify functions; does not implement an extractor."""
import json
import os
import sys
import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / '.graphify-work' / 'candidate'
os.environ['GRAPHIFY_OUT'] = str(OUT)


def load(name):
    return json.loads((OUT / name).read_text(encoding='utf-8'))


def save(name, data):
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / name).write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n', encoding='utf-8', newline='\n')


def scan():
    from graphify.detect import detect
    from graphify.cache import check_semantic_cache
    pending = json.loads((ROOT / '.graphify-work' / 'pending-input.json').read_text(encoding='utf-8'))
    detection = detect(ROOT)
    # Native JSON extraction models package/TypeScript metadata, but does not
    # produce nodes for Firebase/index/toolchain configuration contracts.
    semantic_configs = [f for f in detection['files']['code']
                        if Path(f).suffix == '.json'
                        and Path(f).name not in ('package.json', 'tsconfig.json')]
    detection['files']['code'] = [f for f in detection['files']['code'] if f not in semantic_configs]
    detection['files']['document'].extend(semantic_configs)
    # Unsupported maintained text is explicitly reviewed as semantic content,
    # rather than silently omitted or falsely marked AST-extracted.
    supported = {str(Path(f).resolve()) for group in detection['files'].values() for f in group}
    supplemental = [str((ROOT / path).resolve()) for path in pending['files'] if str((ROOT / path).resolve()) not in supported]
    sensitive = {str(Path(f).resolve()) for f in detection.get('skipped_sensitive', [])}
    if sensitive.intersection(supplemental):
        raise RuntimeError('Maintained inputs flagged sensitive; review before inclusion')
    detection['files']['document'].extend(supplemental)
    actual = {Path(f).resolve().relative_to(ROOT).as_posix() for group in detection['files'].values() for f in group}
    expected = set(pending['files'])
    if actual != expected:
        save('scope-discrepancies.json', {'unexpected': sorted(actual - expected), 'missing': sorted(expected - actual)})
        raise RuntimeError('Official detect and independent inventory differ; see scope-discrepancies.json')
    detection['total_files'] = len(actual)
    detection['semantic_supplemental_files'] = supplemental
    detection['semantic_configuration_files'] = semantic_configs
    save('.graphify_detect.json', detection)
    spec = ROOT / '.codex' / 'skills' / 'graphify' / 'references' / 'extraction-spec.md'
    docs = detection['files']['document']
    nodes, edges, hyperedges, uncached = check_semantic_cache(docs, root=str(ROOT), prompt_file=str(spec))
    save('.graphify_cached.json', {'nodes': nodes, 'edges': edges, 'hyperedges': hyperedges})
    save('semantic-files.json', {'files': uncached, 'spec': str(spec)})
    print(json.dumps({'files': len(actual), 'words': detection['total_words'], 'categories': {k: len(v) for k, v in detection['files'].items()}, 'supplemental': supplemental, 'semanticUncached': len(uncached), 'warning': detection['warning'], 'skippedSensitive': detection['skipped_sensitive']}, ensure_ascii=False))


def ast():
    from graphify.extract import extract
    detected = load('.graphify_detect.json')
    result = extract([Path(p) for p in detected['files']['code']], root=ROOT, cache_root=ROOT, max_workers=2)
    save('.graphify_ast.json', result)
    if result.get('failed_ast_sources'):
        raise RuntimeError('Official AST extraction failed for maintained source files')
    print(json.dumps({'nodes': len(result['nodes']), 'edges': len(result['edges']), 'failedSources': result.get('failed_ast_sources', [])}))


def seal():
    """Record receipts only after host semantic workers finished current inputs."""
    pending = json.loads((ROOT / '.graphify-work' / 'pending-input.json').read_text(encoding='utf-8'))
    receipts = {}
    for chunk in sorted(OUT.glob('semantic-chunk-*.json')):
        data = json.loads(chunk.read_text(encoding='utf-8'))
        sources = {Path(item['source_file']).resolve().relative_to(ROOT).as_posix()
                   for item in data['nodes'] + data['edges'] if item.get('source_file')}
        hashes = {path: hashlib.sha256((ROOT / path).read_bytes().replace(b'\r\n', b'\n')).hexdigest() for path in sources}
        if any(pending['files'].get(path) != value for path, value in hashes.items()):
            raise RuntimeError('Semantic inputs changed during extraction')
        receipts[chunk.name] = {'chunkHash': hashlib.sha256(chunk.read_bytes()).hexdigest(), 'files': hashes}
    save('semantic-receipts.json', receipts)
    print(json.dumps({'sealedChunks': len(receipts)}))


def build():
    from graphify.build import build_from_json, dedupe_edges, _norm_source_file
    from graphify.cluster import cluster, score_all
    from graphify.analyze import god_nodes, surprising_connections, suggest_questions
    from graphify.report import generate
    from graphify.export import to_json
    from graphify.diagnostics import diagnose_extraction
    from graphify.cache import save_semantic_cache
    from graphify.detect import save_manifest
    from graphify.cli import _stamped_manifest_files
    detected = load('.graphify_detect.json')
    structural = load('.graphify_ast.json')
    cached = load('.graphify_cached.json')
    semantic_files = load('semantic-files.json')
    chunks = sorted(OUT.glob('semantic-chunk-*.json'))
    receipts = load('semantic-receipts.json')
    new = {'nodes': [], 'edges': [], 'hyperedges': [], 'input_tokens': 0, 'output_tokens': 0}
    for chunk in chunks:
        receipt = receipts.get(chunk.name, {})
        if receipt.get('chunkHash') != hashlib.sha256(chunk.read_bytes()).hexdigest():
            raise RuntimeError('Unsealed or changed semantic chunk: ' + chunk.name)
        for path, digest in receipt['files'].items():
            if hashlib.sha256((ROOT / path).read_bytes().replace(b'\r\n', b'\n')).hexdigest() != digest:
                raise RuntimeError('Stale semantic evidence: ' + path)
        data = json.loads(chunk.read_text(encoding='utf-8'))
        for key in ('nodes', 'edges', 'hyperedges'):
            new[key].extend(data.get(key, []))
    produced = {str(Path(n['source_file']).resolve()) for n in new['nodes']}
    missing = set(semantic_files['files']) - produced
    if missing:
        raise RuntimeError('Incomplete semantic chunks: ' + repr(sorted(missing)))
    save_semantic_cache(new['nodes'], new['edges'], new['hyperedges'], root=str(ROOT), allowed_source_files=semantic_files['files'], prompt_file=semantic_files['spec'])
    extraction = {'nodes': list(structural['nodes']), 'edges': list(structural['edges']), 'hyperedges': [], 'input_tokens': 0, 'output_tokens': 0}
    known = {n['id'] for n in extraction['nodes']}
    semantic_edges = []
    for data in (new, cached):
        for node in data['nodes']:
            if node['id'] not in known:
                extraction['nodes'].append(node)
                known.add(node['id'])
        semantic_edges.extend(data['edges'])
        extraction['hyperedges'].extend(data.get('hyperedges', []))
    extraction['edges'].extend(dedupe_edges(semantic_edges))
    # Host session token totals are not exposed; zero library counters are not
    # a claim that semantic extraction was free.
    save('.graphify_extract.json', extraction)
    graph = build_from_json(extraction, root=str(ROOT), directed=True)
    for edge in extraction['edges']:
        if edge.get('source_file'):
            edge['source_file'] = _norm_source_file(edge['source_file'], str(ROOT))
    if not graph.number_of_nodes():
        raise RuntimeError('Empty graph; candidate not exported')
    communities = cluster(graph)
    cohesion = score_all(graph, communities)
    gods = god_nodes(graph)
    surprises = surprising_connections(graph, communities)
    labels = load('community-labels.json') if (OUT / 'community-labels.json').exists() else {}
    labels = {cid: labels.get(str(cid), 'Community ' + str(cid)) for cid in communities}
    questions = suggest_questions(graph, communities, labels)
    pending = json.loads((ROOT / '.graphify-work' / 'pending-input.json').read_text(encoding='utf-8'))
    if not to_json(graph, communities, str(OUT / 'graph.json'), built_at_commit=pending['head'], community_labels=labels, original_links=extraction['edges']):
        raise RuntimeError('Official export shrink guard refused candidate')
    report = generate(graph, communities, cohesion, labels, gods, surprises, detected, {'input': 0, 'output': 0}, str(ROOT), suggested_questions=questions, built_at_commit=pending['head'])
    # Replace generic library claims with this project's actual verification
    # and host-session accounting policy; retain the official analysis report.
    report = re.sub(r'^- Unclassified:.*$', '- Maintained input coverage is independently checked against scope.json; classifier gaps receive explicit semantic supplementation.', report, flags=re.MULTILINE)
    report = report.replace('- Token cost: 0 input · 0 output', '- Semantic token totals: unavailable in the current Codex host session.')
    report = report.replace('- Run `git rev-parse HEAD` and compare to check if the graph is stale.', '- Commit records provenance. Run `node scripts/graphify.mjs status` to check input and artifact content hashes.')
    report = report.replace('- Run `graphify update .` after code changes (no API cost).', '- Official AST update is local computation; semantic extraction and six-case review are also required when business meaning changes.')
    report += '\n\n## Project verification boundary\n\nSemantic extraction used the current Codex session. Exact input/output token totals are unavailable; library counters of 0 do not mean no LLM cost. This graph contains current source relationships plus inferred document concepts. Source/tests/Rules remain authoritative.\n'
    (OUT / 'GRAPH_REPORT.md').write_text(report, encoding='utf-8')
    save('.graphify_labels.json', {str(k): v for k, v in labels.items()})
    save('.graphify_analysis.json', {'communities': {str(k): v for k, v in communities.items()}, 'cohesion': {str(k): v for k, v in cohesion.items()}, 'gods': gods, 'surprises': surprises, 'questions': questions})
    save('diagnostics.json', diagnose_extraction(extraction, directed=True, root=str(ROOT)))
    stamped = _stamped_manifest_files(detected['files'], extraction, ROOT)
    raw = {f for group in detected['files'].values() for f in group}
    save_manifest(stamped, root=ROOT, scan_corpus=raw)
    scope = {'files': pending['files'], 'categories': {k: len(v) for k, v in detected['files'].items()}, 'supplemental': [Path(p).relative_to(ROOT).as_posix() for p in detected['semantic_supplemental_files']], 'semanticConfigurations': [Path(p).relative_to(ROOT).as_posix() for p in detected['semantic_configuration_files']], 'tool': 'graphifyy==0.9.84', 'semanticTokenAccounting': 'current Codex session; exact totals unavailable'}
    save('scope.json', scope)
    save('community-members.json', {str(cid): [{'id': n, 'label': graph.nodes[n].get('label'), 'source_file': graph.nodes[n].get('source_file')} for n in members] for cid, members in communities.items()})
    print(json.dumps({'nodes': graph.number_of_nodes(), 'edges': graph.number_of_edges(), 'extractionEdges': len(extraction['edges']), 'communities': len(communities), 'manifestFiles': sum(len(v) for v in stamped.values())}))
    portable()


def portable():
    """Match tracked eol=lf so fresh clones preserve artifact byte hashes."""
    for name in ('graph.json', 'graph.html', 'GRAPH_REPORT.md', 'manifest.json', 'scope.json', 'semantic-review.json'):
        path = OUT / name
        if path.exists():
            path.write_text(path.read_text(encoding='utf-8'), encoding='utf-8', newline='\n')


if __name__ == '__main__':
    command = sys.argv[1]
    {'scan': scan, 'ast': ast, 'seal': seal, 'build': build, 'portable': portable}[command]()
