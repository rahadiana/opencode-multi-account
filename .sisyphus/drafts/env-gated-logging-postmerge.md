# Draft: Env-gated logging — Post-merge Checklist

## Status (from user)
- The feature branch feat/logger/env-gated-20260416 has been merged into main by the user.

## What was merged (recap)
- Added src/logger.ts — env-gated logging wrapper (LOG_LEVEL override, NODE_ENV defaulting, redaction, async file backend, optional UI registration, syncFlush helper).
- Added unit and integration tests: tests/logger.unit.test.ts and tests/logger.integration.test.ts.
- Added planning artifacts: .sisyphus/plans/* and drafts.
- Did not remove old debugLog/code paths until verification was complete (left comments where applicable).

## Mandatory post-merge verification (run now)
Run these in order. Do NOT consider the change complete until all PASS.

1) Install & typecheck
  - npm ci
  - npx tsc --noEmit
  - Acceptance: exit 0 for both commands.

2) Unit tests
  - npm test
  - Acceptance: all unit tests pass; specifically logger.unit.test.ts must pass.

3) Integration test
  - Run the integration test that toggles LOG_LEVEL / NODE_ENV (tests/logger.integration.test.ts)
  - Acceptance: debug entries present in dev; suppressed in production simulation.

4) Secrets audit (MANDATORY)
  - After tests produce log files, scan them for raw secrets. Use regexes from the plan:
    - JSON fields named access/refresh/token/api_key/apikey/secret/password with non-'<REDACTED>' values
    - JWT-like patterns (\w+\.[\w-]+\.[\w-]+) longer than 40 chars
  - Acceptance: NO raw secrets found. If any are found, revert the merge or hotfix immediately.

5) Smoke run (manual)
  - Start the app in dev mode and exercise a small flow that produces logs; confirm UI logging visible where expected and no runtime errors.

6) CI verification
  - Ensure remote CI (GitHub Actions) passes for the merge commit. If CI is missing logger tests, add workflow updates.

## Optional cleanups (post-verification)
- Remove old debugLog code paths and commented legacy calls (only after all verifications pass and reviewers approve). Prefer a separate PR for cleanup.
- Permanently delete or move archived files (if still desired) — existing archive folder archived/unused-2026-04-16 contains previously moved files; remove after confirm no regressions.

## Rollback plan (if needed)
- Revert the merge commit on GitHub or locally:
  - git checkout main
  - git revert <merge-commit-hash>
  - git push
- Restore any archived files from archived/unused-2026-04-16 if they are needed again.

## Evidence paths (where to collect artifacts)
- .sisyphus/evidence/logger/unit.log — unit test output
- .sisyphus/evidence/logger/integration.log — integration test output + captured log files
- .sisyphus/evidence/logger/secret-scan.txt — secret-scan results

## Question / Next action
Which action should I take next? Pick one:

1) Run the full verification matrix now (install, tsc, unit tests, integration tests, secret-scan) and upload evidence.
2) Only run CI checks (query remote CI status) and report back.
3) Do nothing now — leave post-merge verification to the maintainers.

Please respond with 1, 2, or 3. If you choose 1, I will run the verification locally and report the results and evidence files.

## Update: User cancelled
- The user responded: "cancel". Post-merge verification run has been cancelled and will not be executed now. No verification commands were run and no evidence files were created.

Next options remain available:
- Re-run verification: reply with "1" to run full verification now.
- CI-only check: reply with "2" to have me check remote CI status instead.
- Keep cancelled: reply with "3" or do nothing; I will not run anything until explicitly requested.
