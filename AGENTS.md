# Project instructions

## Start a new session

- Read README.md, then the relevant parts of docs/development.md and docs/operations.md. These tracked documents and source/tests/rules are authoritative. Previous conversations and local agent_docs/ are optional historical context, not prerequisites or current task instructions.
- Run `node scripts/knowledge-graph.mjs status`. Use scoped queries of .ua/knowledge-graph.json or the optional Understand-Anything chat/explain skills; do not load the entire graph for routine work.
- Work directly by default. Use agents only when requested or required by the official Understand-Anything analysis/review workflow; at most two concurrent UA workers.

## Changes and verification

- Preserve unrelated work. Keep modules cohesive and interfaces explicit. Define proportionate verification before implementation; do not weaken tests or assertions.
- Inspect affected callers, consumers, shared Firestore collections, security rules and tests. Review branch, staged, unstaged and untracked changes together. Graph neighbors are only a starting point: trace indirect storage consumers in source, including deleted symbols in the previous verified graph.
- Preserve attendee/member ID conversion, absent versus empty boardMemberIds, planning versus confirmed sessions, and legacy scheduleId semantics described in docs/development.md.
- Run checks appropriate to the changed boundary. Never use production data for testing. `npm run dev` connects to production; prefer Scenario Lab or Emulator Design Lab for local changes.
- Update maintained docs for lasting decisions. Do not require old session records or overwrite/delete agent_docs/ with generated explanations.

## Shared knowledge graph

- Follow docs/knowledge-graph.md for pinned installation, shared bundle, freshness, update and recovery. The graph is supplementary evidence; source/tests/rules remain authoritative.
- Git commit IDs provide provenance; shared input hashes and artifact hashes determine freshness. Commit/push alone never certify a graph.
- Keep ordinary dirty work stale; do not analyze after every edit. Use official incremental analysis from a clean verified baseline, and full analysis for initial setup, major contracts/security changes or an agreed milestone. Never commit/stash/reset work merely to satisfy an analyzer without authorization.
- Inspect every cosmeticFiles diff for unchanged meaning before approval. Refresh domain flows when contracts change. Reuse completed analysis only after checking content hashes, and preserve the six verification cases in docs/knowledge-graph.md.
- Share only the allowlisted .ua files. Installation paths, temporary analysis outputs and caches remain local. Failed analysis must not replace the verified bundle.

## Deployment and portability

- New-computer setup is in docs/new-computer.md. No personal workflow installation or old chat history is required.
- Deployment is a separate operation following docs/operations.md. Tooling, docs and graph changes alone do not require app deployment.
