# ARCHITECTURE.md

Last verified against codebase: 2026-08-13
*(Update this marker whenever the layer structure changes.)*

This document provides the primary architectural guidelines that AI agents and human developers MUST read before modifying this codebase.
For design rationale, see [ARCHITECTURE_RATIONALE.md](./ARCHITECTURE_RATIONALE.md).

## When to Update This Document
- If a new top-level folder under `src/` is created, this file MUST be updated in the same response/commit.
- If a layer rule is violated for a justified exception, document the exception here instead of silently bypassing ESLint (no `eslint-disable` without a written reason in this file).

## 1. Layer Overview

```text
React Components (`src/components/`)
  ↓
Custom Hooks (`src/hooks/`)
  ↓                 ↘
Domain (`src/domain/`) ❌ (Never import reverse) → Services (`src/services/`)
```

- **Core concept:** `hooks/` orchestrates the application's use cases by combining `domain/` and `services/`.
- **Core concept:** Do not heavily abstract the `services/` layer (e.g., no Repository Pattern classes). Maintain the existing approach of lightly coupling Firebase CRUD and state management directly inside custom hooks (like `useSessionsLogic`).

## 2. Layer Rules

### `src/domain/` (Pure Business Logic)
1. Do not use external I/O (Firebase, API) or import from the `services/` path. (To maximize unit testing and reusability by keeping logic pure).
2. Do not use React Hooks (`useState`, `useEffect`). (To isolate side effects by leaving state management to custom hooks).
3. Only import type definitions from `types.ts` or other domain subfolders. Cross-imports between `domain/` subfolders are allowed, but circular dependencies are strictly forbidden. Shared types/utils must go into `domain/shared/`.
4. **Code Examples:**
   - **(Allowed)** `import { Member } from '../../types';`
   - **(Allowed)** `import { calculateAge } from '../shared/dateUtils';`
   - **(Forbidden)** `import { fetchAttendees } from '../../services/attendeesService';`
   - **(Forbidden - Circular)** A imports B, and B imports A within domain subfolders.

### `src/services/` (Data I/O & APIs)
1. Only handle communication with external environments, such as Firebase, external APIs, and browser storage accesses. (To isolate side effects to a single boundary).
2. Do not write business logic (e.g., group matching algorithms, score calculations). (To delegate data processing responsibilities to `domain/`).
3. Do not introduce heavy wrapper layers like class-based Repository Patterns. (To maintain simplicity through lightweight functional CRUD helpers).
4. **Code Examples:**
   - **(Allowed)** `export async function deleteSession(id: string) { await deleteDoc(...); }`
   - **(Forbidden)** `class SessionRepository { async delete() { ... } }`

### `src/hooks/` (State Management & Orchestration)
1. Combine business logic and data I/O by importing both `domain/` and `services/` functions. (To provide cohesive data and logic to the UI components).
2. Separate code into `domain/` based on whether it contains **business rules/knowledge**, not line count. One-off mappings or simple filters can remain inside hooks regardless of length. However, any reusable business rule (e.g., determining "is inactive member") must be delegated to `domain/`.
3. **Code Examples:**
   - **(Allowed)** `const result = calcGroupAvgAttendance(await fetchAttendees());`
   - **(Allowed)** `const mapped = data.map(d => ({ ...d, uiFlags: true })); // Simple one-off UI mapping`
   - **(Forbidden)** `const inactive = members.filter(m => m.lastAttended < oneYearAgo && m.role !== 'admin'); // Business rule hidden in hook`

## 3. Decision Tree: Where to Place New Code?

Immediately decide where code should live based on these questions:

1. **Does this code deal with React State or Lifecycle?**
   - **Yes:** `src/hooks/` (or `src/components/`)
   - **No:** Go to the next question.
2. **Does this code execute external network requests, Firestore DB operations, or Browser I/O?**
   - **Yes:** `src/services/`
   - **No:** Go to the next question.
3. **Is this code a pure function that calculates, converts, or validates data based on business rules?**
   - **Yes:** `src/domain/[specific-domain-name]/`
   - **No:** Go to the next question.
4. **Is this a test file?**
   - **Yes:** Co-locate with its target (e.g. `groupCostFunction.test.ts` next to `groupCostFunction.ts`). *Exception: Firestore Rules tests go in `src/tests/` since there is no single source file to co-locate with.*

## 4. File Separation Checklist

When extracting modules into separate files, ALL 4 criteria must be met:

1. **Single Responsibility:** Does the function or module have exactly one clear business rule or purpose? (To prevent God Objects).
2. **Predictable Naming:** Can the internal inputs and outputs be 100% inferred just by looking at the file and function name? (If naming is hard, the logic is implicitly bloated).
3. **Reusability & Test Value:** Is there a potential for this code to be reused in other hooks, or does it possess logical complexity worth writing independent unit tests for? (To prevent excessive fragmentation of one-off constants/helpers).
4. **No Wrapper Layers:** Is it more than just a dummy function that merely wraps another function or DB call and returns its output? (To prevent meaningless abstraction depth that only increases the Call Stack).

## 5. Common Mistakes (❌ Strictly Forbidden)

1. **❌ Domain calling Services (Preventing Layer Inversion)**
   - **(Forbidden Example)** Calling `import { getSessions } from '../../services/db'` inside `src/domain/stats/calc.ts`
2. **❌ Over-extracting One-Off Helpers (Preventing Fragmentation)**
   - **(Forbidden Example)** Creating `src/domain/math/add.ts` (`export const add = (a, b) => a + b;`). Simple one-off helpers should remain inside the component or hook file.
3. **❌ Introducing Heavy Repository Wrappers (Preventing Over-engineering)**
   - **(Forbidden Example)** Creating an interface and singleton class in `src/services/MemberRepo.ts`, completely overturning the existing Firebase integration patterns used by custom hooks.

## 6. Enforced ESLint Rules

This codebase assumes the following ESLint rules to protect layer boundaries:

1. **Rule:** `no-restricted-imports`
2. **Violation Condition:** Attempting to import `src/services/**` or `firebase/**` paths from inside `src/domain/**` files.
3. **Error Message:** `"Domain layer must be strictly pure. Do not import services or Firebase directly into the domain."`
4. **Action Required:** When AI agents encounter this error, they MUST NOT use forced bypasses (`eslint-disable`). Instead, immediately abandon the file design and refactor to delegate the responsibility to `src/hooks/`.

## 7. Interview Management Vertical Slice

The interview feature follows the same existing layers without adding a repository or backend server:

- `src/components/Interview*.tsx`, `PublicInterviewPage.tsx`, `AvailabilityGrid.tsx`: admin and token-page UI
- `src/hooks/useInterview*.ts`, `usePublicInterviewLogic.ts`: realtime state and use-case orchestration
- `src/domain/interviews/`: pure slot generation, availability aggregation/validation, schedule impact, CSV staging, and message rendering
- `src/services/interviewsService.ts`, `publicInterviewService.ts`: Firestore and browser I/O

Slot IDs are timezone-free local values in the canonical `YYYY-MM-DD|HH:mm` form. Do not pass them directly to `new Date(...)`; parse them first. Assignments retain that `slotId`, store an absolute Asia/Seoul Firestore timestamp, and include `interviewerId`. V1 writes `interviewerId: "default"`, while the field permits later expansion to multiple individual interviewers without changing the assignment shape. `interviewAssignmentLocks` is an admin-only transaction lock keyed by round, individual interviewer, and slot; it prevents two admins from committing the same interviewer time concurrently.
