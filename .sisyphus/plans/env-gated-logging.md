# Env-gated logging: dev=verbose, prod=minimal

## TL;DR
> Summary: Add a single logger wrapper (src/logger.ts) that centralizes file + UI logging, respects LOG_LEVEL and NODE_ENV, and defaults to verbose in development and minimal in production. Implement non-destructive refactors in src/index.ts (route existing debugLog & UI log through wrapper), add unit + integration tests that verify gating and secret redaction, and open a PR from branch prune/logger-{date}.
> Deliverables: src/logger.ts (wrapper), refactor changes in src/index.ts, logger unit tests, integration test, README update, PR with verification artifacts.
> Effort: Short — touches 3 files + tests.
> Parallel: YES - tests and docs can be done in parallel with small wiring tasks.
> Critical Path: Add wrapper → refactor src/index.ts → run tests & CI → PR review/merge.

## Context
### Original Request
- "untuk log sendiri, apakah bisa di set jika dev ada log nya jika prod disable log? dan jangan sampai mengilangkan fungsi utamanya"

### Interview Summary / Exploration Findings
- Repo currently uses ad-hoc logging in src/index.ts: debugLog() writes JSON entries to MASTER_DEBUG_LOG under user config dir and client.app.log pushes UI-visible logs. No logging library found. No existing logger wrapper. No NODE_ENV/LOG_LEVEL gating in code. (Explore results: src/index.ts, src/account-manager.ts, src/storage.ts, src/rate-limiter.ts, package.json)
- Default override preference selected: use LOG_LEVEL environment variable.

### Metis Review
- Attempted Metis consults returned no actionable output (Metis unavailable). To compensate, plan includes conservative security guardrails (mandatory redaction of sensitive fields) and stricter acceptance tests. Metis items are embedded as MUST-HAVE checks in Acceptance Criteria.

## Work Objectives
### Core Objective
- Provide configurable logging: verbose logs in development, minimal (errors only) in production, with an explicit LOG_LEVEL override. Preserve all runtime behavior except reducing or silencing logs; no functional logic must be changed as a result of logging gating.

### Deliverables
- src/logger.ts — decision-complete wrapper implementation instructions
- Source edits in src/index.ts wiring to logger API (no behavior change besides log gating)
- Unit tests for logger behavior (level filtering, file backend, UI backend, redaction)
- Integration test that toggles NODE_ENV/LOG_LEVEL and verifies emitted logs
- README section documenting LOG_LEVEL usage
- PR draft & commit messages

### Definition of Done
- Wrapper file created at src/logger.ts and exported API used in src/index.ts (no other behavior changes).  
- All unit tests pass locally (command: npm test).  
- Integration test that simulates NODE_ENV=production and NODE_ENV=development demonstrates differing outputs.  
- CI job (same as local) green.  
- PR created with clear rollback instructions.  

### Must Have
- Secret redaction: logger MUST NEVER write raw values for keys ['access','refresh','token','api_key','apiKey','secret','password'] to logs. Instead log redacted placeholders (e.g., <REDACTED>[access]).  (MUST)
- Non-destructive: all changes must be reversible by reverting the single PR. (MUST)

### Must NOT Have
- Do NOT remove existing debug file writes until wrapper is in place and tested.  
- Do NOT change business logic or remove side-effects that affect account rotation, persistence, or UI behaviors.  

## Verification Strategy
- Test decision: tests-after (add unit + integration tests). Use repository's existing test pattern (tsx --test src/**/*.test.ts or npm test).  
- QA policy: Every code-change task below includes agent-executable QA scenarios.  
- Evidence: .sisyphus/evidence/task-{N}-{slug}.log (tests, captured stdout/stderr, and examined log files)

Run commands (explicit):
- Run unit tests: npm test
- Run integration test (dev mode): LOG_LEVEL=debug npm test -- tests/logger.integration.test.ts
- Run integration test (prod mode): NODE_ENV=production LOG_LEVEL=error npm test -- tests/logger.integration.test.ts

## Execution Strategy
### Parallel Execution Waves
Wave 1 (foundation, run first)
- Create src/logger.ts skeleton and unit tests (files added, no refactors). (3 tasks)

Wave 2 (wire in entrypoint)
- Replace direct debugLog and client.app.log usage in src/index.ts with logger calls (single-file refactor) and run unit tests. (2 tasks)

Wave 3 (integration + docs)
- Add integration test, README updates, and CI check. Run full test suite. (3 tasks)

### Dependency Matrix
- Wave2 tasks depend on Wave1 (logger implementation). Wave3 depends on Wave1+Wave2.

### Agent Dispatch Summary
- Wave1: 3 tasks — create wrapper + unit tests + redaction spec
- Wave2: 2 tasks — refactor src/index.ts + run tests
- Wave3: 3 tasks — write integration test, update README, CI verification

## TODOs
- All implementation tasks include: What to do, Must NOT do, Agent Profile, Parallelization, References, Acceptance Criteria, QA Scenarios, Commit.

- [ ] 1. Add wrapper: Create src/logger.ts

  What to do: Create new TypeScript module at src/logger.ts with the exact API below. Do NOT change any other files in this task.

  API (exact exports and behavior):
  - export type LogLevel = 'trace'|'debug'|'info'|'warn'|'error'|'silent'
  - export function setLevel(level: LogLevel): void
  - export function getLevel(): LogLevel
  - export function debug(msg: string, meta?: Record<string, unknown>): void
  - export function info(msg: string, meta?: Record<string, unknown>): void
  - export function warn(msg: string, meta?: Record<string, unknown>): void
  - export function error(msg: string, meta?: Record<string, unknown>): void

  Implementation details (decision-complete):
  - Behavior: On each call, wrapper computes numeric level and discards messages whose level < current level. Level resolution order (decisions made):
    1. If process.env.LOG_LEVEL set → use it (case-insensitive). Allowed values: trace, debug, info, warn, error, silent. Invalid values default to 'info'.
    2. Else if process.env.NODE_ENV === 'production' → default 'error'
    3. Else default 'debug'
  - Backends:
    - File backend: append line-delimited JSON entries to same MASTER_DEBUG_LOG path used by existing code (use storage helper from src/storage.ts: CONFIG_DIR and MASTER_DEBUG_LOG if available). If storage.ts exports CONFIG_FILE and directory variables, import them; else compute path = path.join(os.homedir(), '.config', 'opencode', 'multi-account', 'debug.log'). Each log entry JSON shape: { ts: ISO8601, level: string, msg: string, meta: object|null }
    - UI/backend: call the existing client.app.log function for info/warn/error levels. To avoid circular imports, accept an optional registerUI(client) function exported by wrapper; default UI backend is a noop unless registerUI is called by src/index.ts during bootstrap.
  - Redaction: Before writing, sanitize meta object by replacing values for keys that match (case-insensitive) the list: ['access','refresh','token','api_key','apikey','apiKey','secret','password'] with '<REDACTED>' string. Also, if meta is a string that looks like JWT (two dots '.'), redact it entirely.
  - No synchronous blocking file I/O on hot paths: use fs.appendFile (async) and do not await it (fire-and-forget). For tests, provide an optional syncFlush() helper that flushes pending writes for determinism in CI.

  Must NOT do: Never perform network calls, never print full secrets to console/file, never mutate passed meta objects in-place (clone before redaction).

  Recommended Agent Profile:
  - Category: unspecified-high — Reason: multi-file TypeScript and tests plus nuanced behavior.
  - Skills: ['typescript', 'node-fs']

  Parallelization: Can run in parallel with writing unit tests (Wave1), but file must be present before refactor (Wave2).

  References:
  - Pattern: src/index.ts: uses debugLog and client.app.log — replace calls to route through logger
  - API/Type: src/types.ts contains schema notes about accounts.json and markers — no logger types to import

  Acceptance Criteria:
  - [ ] src/logger.ts exists and exports the API above (verify via ts-node or tsc compile)
  - [ ] Unit tests assert that setLevel/getLevel behave for all legal values

  QA Scenarios:
  Scenario: Unit tests for level filtering
    Tool: Bash
    Steps:
      - Run: npm test -- tests/logger.unit.test.ts
    Expected: All assertions pass; evidence saved to .sisyphus/evidence/task-1-logger-unit.log

  Commit: YES | Message: feat(logger): add env-gated logger wrapper | Files: src/logger.ts, tests/logger.unit.test.ts

- [ ] 2. Wire wrapper into src/index.ts (replace debugLog & UI log)

  What to do: Edit src/index.ts exactly at the locations where debugLog(...) and client.app.log(...) are used. Replace:
    - debugLog(...args) → logger.debug(...argsSanitized)
    - client.app.log(...) → logger.info(...) (for informational) or logger.warn/error accordingly
  Steps (decision-complete):
    1. At top of src/index.ts add: import * as logger from './logger'
    2. Where code currently calls existing debugLog function, keep the function body until refactor verification passes, but call logger.debug first. Do not remove old debugLog until tests pass. Example pattern:
       // new: logger.debug('msg', {...});
       // old: debugLog('msg', {...}); // keep until CI green
    3. At bootstrap, register UI client: logger.registerUI && logger.registerUI(client) — optional registerUI export must be implemented in src/logger.ts

  Must NOT do: Do not delete debugLog until step 4 (verification) completes.

  Acceptance Criteria:
  - [ ] src/index.ts compiles (tsc --noEmit)
  - [ ] Behavior unchanged: run unit tests (npm test) and relevant integration tests; no failing tests introduced.

  QA Scenarios:
  Scenario: Verify no behavior change and gating
    Tool: Bash
    Steps:
      - Run: npm test
      - Run integration test: LOG_LEVEL=debug node -e "require('./dist/index').main && console.log('ok')" (or run equivalent test script)
    Expected: All tests pass; logger writes are present in debug mode, suppressed in production simulation. Evidence: .sisyphus/evidence/task-2-refactor.log

  Commit: YES | Message: chore(logger): wire logger into src/index.ts (keep old debugLog until verified) | Files: src/index.ts

- [ ] 3. Add integration test and README updates

  What to do: Create tests/logger.integration.test.ts that:
  - Runs a small portion of app startup with NODE_ENV=development and LOG_LEVEL=debug and asserts that file backend receives entries and registerUI was invoked.
  - Runs with NODE_ENV=production and LOG_LEVEL unset and asserts that only error-level entries are written.

  Acceptance Criteria:
  - [ ] Integration test passes locally
  - [ ] README.md updated with LOG_LEVEL docs and example usage

  QA Scenarios:
  Scenario: Integration checks
    Tool: Bash
    Steps:
      - Run: LOG_LEVEL=debug npm test -- tests/logger.integration.test.ts
      - Run: NODE_ENV=production npm test -- tests/logger.integration.test.ts
    Expected: First run produces expected debug entries; second run produces only error-level entries. Evidence: .sisyphus/evidence/task-3-integration.log

  Commit: YES | Message: docs(logger): document LOG_LEVEL and examples + tests | Files: tests/logger.integration.test.ts, README.md

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> Run these 4 checks in PARALLEL. All must PASS. Present consolidated results to reviewers before merging.

- [ ] F1. Plan Compliance Audit — verify every code change matches this plan (oracle)
- [ ] F2. Code Quality Review — run TS compile, lint (if configured), and static checks
- [ ] F3. Real QA — run unit + integration tests; run quick manual smoke: start app in dev/prod toggles and inspect logs
- [ ] F4. Secrets Audit — scan generated logs from tests for accidental secrets (any 64-char base64-looking strings or JSON fields named access/refresh/token present verbatim) — FAIL if found

## Commit Strategy
- Single-feature branch: branch name: feat/logger/env-gated-YYYYMMDD
- Commits: one commit per task (wrapper, wire, tests/docs) with messages listed above. Squash into a single PR if requested by maintainers.

## Success Criteria
- All automated checks pass and reviewers confirm no functional regressions.
- Log outputs differ between dev and prod as per LOG_LEVEL/NODE_ENV rules.
- No secrets appear in logs (Secrets Audit pass).
