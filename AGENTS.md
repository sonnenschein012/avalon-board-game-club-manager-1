# Project instructions

## Start a new session

- Read README.md, then the relevant parts of docs/development.md and docs/operations.md. These tracked documents and source/tests/rules are authoritative. Previous conversations and local agent_docs/ are optional historical context, not prerequisites or current task instructions.
- Run `node scripts/graphify.mjs status`. Use `node scripts/graphify.mjs query "question"`, `path "A" "B"`, `explain "symbol"` or `affected "symbol"` to scope code exploration, then confirm findings in source. Do not load the whole graph for routine work.
- Work directly by default. Use agents only when requested or required by the official Graphify semantic-analysis/review workflow; at most two concurrent graph workers. The project-local official skill is installed with the pinned Graphify package; see docs/knowledge-graph.md.

## Changes and verification

- Preserve unrelated work. Keep modules cohesive and interfaces explicit. Define proportionate verification before implementation; do not weaken tests or assertions.
- Inspect affected callers, consumers, shared Firestore collections, security rules and tests. Review branch, staged, unstaged and untracked changes together. Graph neighbors are only a starting point: trace indirect storage consumers in source, including deleted symbols in the previous verified graph.
- Preserve attendee/member ID conversion, absent versus empty boardMemberIds, planning versus confirmed sessions, and legacy scheduleId semantics described in docs/development.md.
- Run checks appropriate to the changed boundary. Never use production data for testing. `npm run dev` starts Emulator Design Lab and resets synthetic local data. `npm run dev:prod` connects to production; use Scenario Lab or Emulator Design Lab for local changes.
- Update maintained docs for lasting decisions. Do not require old session records or overwrite/delete agent_docs/ with generated explanations.

## Shared knowledge graph

- Follow docs/knowledge-graph.md for pinned installation, shared bundle, freshness, update and recovery. The graph is supplementary evidence; source/tests/rules remain authoritative.
- Git commit IDs provide provenance; shared input hashes and artifact hashes determine freshness. Commit/push alone never certify a graph.
- Keep ordinary dirty work stale; refresh at a completed task or user-requested milestone. Official Graphify `update` refreshes AST structure; changed docs/rules or business meaning also require semantic extraction and review. Never commit/stash/reset work merely to satisfy an analyzer without authorization.
- Function signatures and AST topology alone do not certify unchanged meaning. Inspect source diffs, preserve the six verification cases in docs/knowledge-graph.md, and distinguish EXTRACTED, INFERRED and AMBIGUOUS relationships. Graph absence does not prove no impact.
- Share only the allowlisted graphify-out files. Installation paths, temporary outputs, caches, work memory and hooks remain local. Failed analysis must not replace the verified bundle. `.ua/` is a preserved historical bundle, not the current project graph.

## Deployment and portability

- New-computer setup is in docs/new-computer.md. No personal workflow installation or old chat history is required.
- Deployment is a separate operation following docs/operations.md. Tooling, docs and graph changes alone do not require app deployment.

## Graphify commands

- The wrapper uses the repository-local pinned runtime; a bare global `graphify` may be an older version.
- For a requested full refresh: `node scripts/graphify.mjs begin`, follow the official skill using `.graphify-work/candidate` as unpublished output, review source/graph evidence, then `accept` and `verify` as documented.
- Run `node scripts/graphify.mjs update .` only at an appropriate milestone. This may leave semantic changes pending; it cannot certify the graph without source review and matching input/artifact hashes.
- Read GRAPH_REPORT.md for broad architecture or when scoped CLI queries do not provide sufficient context. No post-commit hook, automatic watcher, Cloud upload or production database analysis is configured.
