# Draft: Env-gated logging (dev=verbose, prod=minimal)

## Requirements (confirmed)
- User request: enable detailed logs while in development, disable or minimize logs in production, and preserve primary functionality (do not remove side-effects beyond logging).

## Context
- Background exploration task launched (bg_9ec357d6) to map existing logging usage and env conventions. Draft will be updated with concrete file references once that scan returns.

## Technical Decisions (tentative)
- Provide a single logger wrapper module (suggested path: `src/logger.ts`) that exports functions: trace/debug/info/warn/error and a `setLevel(level)` helper.
- Default runtime behavior:
  - NODE_ENV === 'production' → logger level = 'error' (or no-op for debug/info)
  - NODE_ENV !== 'production' → logger level = 'debug'
  - Optional override via environment variable `LOG_LEVEL` (levels: trace, debug, info, warn, error, silent)
- Implementation detail: if a logging library is already present in the repo (winston/pino/debug), adapt the wrapper to delegate to it; otherwise implement a tiny console-based adapter that respects levels and formats messages.

## Test strategy
- Unit tests for logger wrapper: assert that calls produce output only when level permits (use a writable stream mock or spy on console methods).
- Integration tests: run a small script that toggles NODE_ENV and verifies the expected outputs (captured by redirecting stdout/stderr).

## Open Questions (need your preference)
1. Prefer to reuse an existing logging library if present, or add minimal console-wrapper? (Recommend: reuse if present; else minimal wrapper)  
2. Which env var do you prefer for overrides? Options: (A) rely on NODE_ENV only (recommended default), (B) use LOG_LEVEL (recommended), (C) use a custom flag OPENCODE_LOG_LEVEL. (If none chosen, default to LOG_LEVEL.)  
3. Should staging behave like production (minimal) or like development (verbose)? (Options: staging=prod or staging=dev; default: staging=dev)

## Scope Boundaries
- INCLUDE: wrapper module, small refactors to replace direct console.log/console.debug usages where appropriate, unit tests for wrapper, CI check to ensure logger tests run.  
- EXCLUDE: replacing third-party library logging internals, changing log shipping/aggregation, rotating credentials or secret management.

## Next actions (after explorer returns)
1. Incorporate explorer findings (files using console.*, existing logger libs, env usage).  
2. Produce decision-complete work plan (.sisyphus/plans/env-gated-logging.md) with exact file edits, tests, QA scenarios, and commit messages.  

## Notes
- This draft is provisional. I will not change any source files until you approve the generated plan.
