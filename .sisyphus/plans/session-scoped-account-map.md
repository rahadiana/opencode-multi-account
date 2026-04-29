# Session-Scoped Account Map

## TL;DR
> **Summary**: Replace global `currentAccountId`/`currentState`/`lastSessionID` singleton pattern with per-session Maps to prevent cross-session interference when orchestrator runs concurrent sessions.
> **Deliverables**: Modified `account-manager.ts` with session-aware account resolution, modified `index.ts` with per-session state tracking, comprehensive isolation tests.
> **Effort**: Medium
> **Parallel**: YES — 3 waves (linear file dependency) + 1 verification wave
> **Critical Path**: T1 (AccountManager) → T2 (index.ts) → T3 (tests) → F1-F4 (verification)

## Context
### Original Request
`currentAccountId` in `state.json` changes unpredictably when orchestrator agent runs multiple concurrent sessions. Each session's hooks mutate the global singleton, causing cross-session interference.

### Interview Summary
- **Approach**: Session-Scoped Account Map (`Map<sessionId, accountId>`) — in-memory only, not persisted
- **Auth.json sync**: NOT in scope — only state.json/runtime state
- **Test strategy**: Tests-after (node:test + node:assert/strict, matching existing patterns)
- **Backward compat**: `state.json.currentAccountId` retained as default/fallback for non-session contexts

### Metis Review (gaps addressed)
- **Hidden global read paths** → Full audit completed: 13 write sites + 7 read sites for `currentAccountId`, 19 write sites for `currentState`, 4 write sites for `lastSessionID` — all catalogued and addressed
- **Ambiguous session lifecycle** → Resolved: lazy assignment on first hook call via `getOrAssignAccountForSession()`, no explicit teardown needed (Map<string,string> memory footprint is negligible)
- **Fallback becoming primary** → Fetch monkeypatch uses explicit `defaultPluginState` variable (not session fallback); clearly named to signal "non-session context"
- **Heartbeat/watchdog regressions** → `universalSyncAuthJson()` only changes default account (session map is independent field, unaffected by reload/sync); watchdog iterates all sessions individually
- **Disk/runtime divergence** → `currentAccountId` documented as default for NEW sessions only, not authoritative for active sessions
- **Scope creep into auth sync redesign** → universalSyncAuthJson needs NO guard changes (it changes default, sessions are independent)

## Architecture Design

### Session Account Resolution Rules
| Context | Resolution | Source |
|---------|-----------|--------|
| Hook with sessionId (shell.env, chat.headers, event) | `manager.getOrAssignAccountForSession(sessionId)` | Session map → lazy-assign default |
| Interceptor-prime (has sessionId from path) | Same as hooks | Session map |
| Fetch monkeypatch (NO sessionId) | `manager.getCurrentAccount()` (existing default) | `state.json.currentAccountId` |
| Tools (account_switch, etc.) | `manager.switchToAccount(id)` — updates default only | No sessionId from tool API |
| Startup/reload | `state.json.currentAccountId` as default; session map starts empty | Disk → memory |
| heartbeat/universalSyncAuthJson | Changes default (`state.json.currentAccountId`); does NOT touch session map | Default only |
| watchdog stall detection | Iterates `sessionStates` Map, rotates specific stalling session | Per-session |
| handleRateLimit | If sessionId: rotate that session's assignment + update global default; if no sessionId: rotate default only | Session-aware |

### Data Structures
```typescript
// account-manager.ts — NEW field
private sessionAccounts = new Map<string, string>();
// Maps sessionId → accountId. In-memory only. Never persisted.

// index.ts — REPLACE globals
const sessionStates = new Map<string, { state: PluginState; lastActivity: number }>();
let defaultPluginState: PluginState = PluginState.IDLE;
let defaultLastActivity: number = Date.now();
// sessionStates replaces both `currentState` and `lastSessionID`
// default* variables serve non-session contexts (fetch monkeypatch)
```

### Session Lifecycle
- **Creation**: Implicit/lazy on first hook invocation with a sessionId — `getOrAssignAccountForSession()` creates entry
- **Update**: On state transitions (IDLE→STREAMING→IDLE) via `setSessionState()`
- **Account rotation**: `handleRateLimit(accountId, sessionId)` updates only that session's map entry
- **Account removal**: `removeAccount()` clears all sessions using removed account; next hook call re-assigns
- **No explicit teardown**: Memory is negligible (string→string map). Process restart clears all.

## Work Objectives
### Core Objective
Isolate account assignments per session so concurrent sessions cannot interfere with each other's account selection.

### Deliverables
1. `src/account-manager.ts` with session-scoped account resolution methods and guarded mutation methods
2. `src/index.ts` with per-session `PluginState` tracking, refactored hooks/workers/helpers
3. `src/session-isolation.test.ts` proving concurrent session isolation

### Definition of Done (verifiable conditions with commands)
- `npx tsc --noEmit` succeeds (zero TypeScript errors)
- `npm test` passes all existing + new tests
- New tests demonstrate: 2+ concurrent sessions with different accounts remain isolated through hooks, rotation, heartbeat, watchdog, and cleanup

### Must Have
- `Map<string, string>` in AccountManager for session→account mapping
- `Map<string, {state, lastActivity}>` in index.ts for per-session PluginState
- All hooks (shell.env, chat.headers, event, interceptor-prime) use session-scoped account resolution
- Watchdog iterates all sessions for stall detection (not single global)
- `handleRateLimit()` and `switchToAccount()` accept optional `sessionId` parameter
- `removeAccount()` clears affected session entries
- Fetch monkeypatch uses explicit `defaultPluginState`/`defaultLastActivity` (non-session fallback)
- `onPossibleError()` passes sessionId to `forceRotateAndAbort()`
- All existing tests continue to pass without modification

### Must NOT Have
- Persistence of session map to disk or state.json
- Changes to `RuntimeState` type definition in `src/types.ts`
- Changes to `src/storage.ts`
- Changes to auth.json synchronization logic semantics
- File locking for `saveState()`
- New npm dependencies
- Any changes to the existing test files

## Verification Strategy
> ZERO HUMAN INTERVENTION — all verification is agent-executed.
- **Test framework**: `node:test` + `node:assert/strict` (matching `src/account-manager.test.ts` patterns)
- **QA policy**: Every task has agent-executed scenarios
- **Evidence**: `.sisyphus/evidence/task-{N}-{slug}.{ext}`

## Execution Strategy
### Parallel Execution Waves

| Wave | Tasks | Files Modified | Category |
|------|-------|---------------|----------|
| 1 | T1: AccountManager session infrastructure | `src/account-manager.ts` | deep |
| 2 | T2: index.ts full session-scoping refactoring | `src/index.ts` | deep |
| 3 | T3: Session isolation tests | `src/session-isolation.test.ts` | unspecified-high |
| 4 | F1-F4: Final Verification | — | oracle, unspecified-high ×2, deep |

> **Why linear waves**: T2 depends on T1 (calls new AccountManager methods). T3 depends on both. Only Wave 4 is fully parallel. This is inherent to the 2-file change scope — cannot be parallelized further without breaking file edit isolation.

### Dependency Matrix
| Task | Depends On | Blocks |
|------|-----------|--------|
| T1 | — | T2, T3, F1-F4 |
| T2 | T1 | T3, F1-F4 |
| T3 | T1, T2 | F1-F4 |
| F1-F4 | T1, T2, T3 | — |

### Agent Dispatch Summary
| Wave | Task Count | Categories |
|------|-----------|-----------|
| Wave 1 | 1 | deep |
| Wave 2 | 1 | deep |
| Wave 3 | 1 | unspecified-high |
| Wave 4 | 4 | oracle, unspecified-high, unspecified-high, deep |

## TODOs

<!-- TASKS START — insert tasks before Final Verification Wave -->

- [x] T1. AccountManager session infrastructure

  **What to do**: 
  - Add `private sessionAccounts = new Map<string, string>();` to `AccountManager`.
  - Add `getOrAssignAccountForSession(sessionId: string): Account | null`. (Returns session account, falls back to `this.state.currentAccountId`, lazy assigns).
  - Modify `handleRateLimit(accountId: string, sessionId?: string)`: If sessionId provided, only rotate that session's map entry (and update `this.state.currentAccountId` default). If not, just rotate default.
  - Modify `switchToAccount(accountId: string, sessionId?: string)`: Update session map if sessionId provided, always update default.
  - Modify `removeAccount()`: Iterate `sessionAccounts`, `delete` any entry mapping to the removed account ID.
  - Add `clearSession(sessionId: string)` to explicitly remove session from map.

  **Must NOT do**:
  - Do NOT persist `sessionAccounts` to `state.json`.

  **Recommended Agent Profile**:
  - Category: `deep` - Reason: Core state machine logic requiring deep understanding of mutators.
  - Skills: `[]`
  - Omitted: `[]`

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: [T2, T3] | Blocked By: []

  **References**:
  - Pattern: `src/account-manager.ts` (handleRateLimit, removeAccount)

  **Acceptance Criteria**:
  - [ ] `AccountManager` compiles cleanly with new session-aware methods.
  - [ ] `sessionAccounts` is purely in-memory.

  **QA Scenarios**:
  ```
  Scenario: Compile Check
    Tool: Bash
    Steps: npx tsc --noEmit
    Expected: Zero errors in account-manager.ts
    Evidence: .sisyphus/evidence/task-1-compile.txt
  ```

- [x] T2. index.ts full session-scoping refactoring

  **What to do**:
  - Replace `let currentState` and `let lastSessionID` with `const sessionStates = new Map<string, { state: PluginState; lastActivity: number }>();`
  - Add `let defaultPluginState = PluginState.IDLE;` and `let defaultLastActivity = Date.now();` for non-session fallbacks.
  - Add helpers: `getSessionState(sessionId)`, `setSessionState(sessionId, state)`.
  - Update all 19 `currentState` write sites and reads to use session-aware helpers.
  - Update watchdog (`setInterval` at L298) to iterate over `sessionStates.entries()`.
  - Update `shell.env`, `chat.headers`, `event`, `interceptor-prime` to use `manager.getOrAssignAccountForSession(sessionID)`.
  - Update `onPossibleError` and `forceRotateAndAbort` to accept and use `sessionId`.
  - Update `fetch` monkeypatch to use `defaultPluginState` and `manager.getCurrentAccount()`.

  **Must NOT do**:
  - Do NOT break `defaultPluginState` tracking for `fetch` monkeypatch.

  **Recommended Agent Profile**:
  - Category: `deep` - Reason: 19 write sites and complex global state replacement.
  - Skills: `[]`
  - Omitted: `[]`

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: [T3] | Blocked By: [T1]

  **References**:
  - Pattern: `src/index.ts` (currentState, shell.env)

  **Acceptance Criteria**:
  - [ ] `index.ts` compiles cleanly.
  - [ ] No remaining references to old `currentState` or `lastSessionID` variables.

  **QA Scenarios**:
  ```
  Scenario: Compile Check
    Tool: Bash
    Steps: npx tsc --noEmit
    Expected: Zero errors in index.ts
    Evidence: .sisyphus/evidence/task-2-compile.txt
  ```

- [x] T3. Session isolation tests

  **What to do**:
  - Create `src/session-isolation.test.ts` using `node:test` and `node:assert/strict`.
  - Write test: Concurrent sessions receive different accounts and do not overwrite each other.
  - Write test: Rate limiting one session only rotates that session.
  - Write test: Fetch (no session) gets default account.
  - Write test: Watchdog only rotates the stalling session.

  **Must NOT do**:
  - Do NOT modify existing tests.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: Test authoring.
  - Skills: `[]`
  - Omitted: `[]`

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: [F1-F4] | Blocked By: [T1, T2]

  **References**:
  - Pattern: `src/account-manager.test.ts` (testing setup)

  **Acceptance Criteria**:
  - [ ] All tests in `src/session-isolation.test.ts` pass.
  - [ ] Existing tests still pass.

  **QA Scenarios**:
  ```
  Scenario: Run tests
    Tool: Bash
    Steps: npm test
    Expected: All tests pass successfully.
    Evidence: .sisyphus/evidence/task-3-tests.txt
  ```

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback → fix → re-run → present again → wait for okay.

- [x] F1. Plan Compliance Audit — oracle
  - Verify ALL tasks in this plan were completed as specified
  - Check every Must Have item against actual implementation
  - Check every Must NOT Have item was respected
  - Verify no scope creep beyond plan boundaries

- [x] F2. Code Quality Review — unspecified-high
  - Review `src/account-manager.ts` changes for correctness, edge cases, naming consistency
  - Review `src/index.ts` changes for completeness (all 19 `currentState` write sites migrated, all 4 `lastSessionID` write sites removed)
  - Check no orphaned references to old global variables
  - Verify TypeScript types are correct

- [x] F3. Real Manual QA — unspecified-high
  - Run `npx tsc --noEmit` and verify zero errors
  - Run `npm test` and verify all tests pass (existing + new)
  - Evidence: `.sisyphus/evidence/f3-qa-results.txt`

- [x] F4. Scope Fidelity Check — deep
  - Verify `src/types.ts` was NOT modified
  - Verify `src/storage.ts` was NOT modified
  - Verify existing test files were NOT modified
  - Verify no new dependencies added to `package.json`
  - Verify session map is NOT persisted to disk anywhere
  - Verify auth.json sync logic semantics unchanged

## Commit Strategy
| Task | Commit | Message | Files |
|------|--------|---------|-------|
| T1 | YES | `refactor(account-manager): add session-scoped account resolution` | `src/account-manager.ts` |
| T2 | YES | `refactor(plugin): replace global state with per-session tracking` | `src/index.ts` |
| T3 | YES | `test(session): add concurrent session isolation tests` | `src/session-isolation.test.ts` |

## Success Criteria
1. Two concurrent sessions calling shell.env/chat.headers with different sessionIds receive different account credentials
2. Rate-limiting one session's account rotates only that session, not others
3. Heartbeat/universalSyncAuthJson running during active sessions does not change session assignments
4. Watchdog detects and rotates only the specific stalling session
5. removeAccount clears sessions using that account; next hook call re-assigns
6. Fetch monkeypatch (no sessionId) uses default account without errors
7. All existing tests continue to pass unchanged
8. Build succeeds without TypeScript errors
