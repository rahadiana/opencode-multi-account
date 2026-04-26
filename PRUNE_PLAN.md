Prune Plan: unused and low-risk files
===================================

Summary
-------
This file documents a safe, reversible plan to remove or archive repository files identified as unused by the automated scan. No files will be deleted automatically by this plan — it is a step-by-step recipe you can follow locally or in a branch. Follow the steps below and run the verification checklist before creating/pushing a PR.

Candidates (discovered by automated scan)
-----------------------------------------
- multi-account.js (repo root)
  - Reason: standalone JS artifact; not referenced by source imports or npm scripts
  - Confidence: high

- package-lock.json (repo root)
  - Reason: lockfile present, no repo code references; may be safe to remove if you prefer maintaining yarn/pnpm or regenerating lockfile
  - Confidence: medium

- .sisyphus/notepads/auth-provider-mapping/{issues.md,decisions.md,learnings.md,problems.md}
  - Reason: tool-generated notes / internal notepads; not referenced by code
  - Confidence: high for being safe to archive

- PLAN.md
  - Reason: planning document; not referenced by code; keep if actively used, otherwise archive
  - Confidence: medium

Safe approach (recommended)
---------------------------
1) Archive rather than delete initially. Create an archive folder in the repo so changes are reversible and reviewable in a PR.

2) Create a feature branch and move files to the archive folder, commit, run verification, then open a PR for review.

Commands (Windows PowerShell / cross-platform equivalents)
---------------------------------------------------------
# 1. Start branch
git checkout -b prune/unused-files

# 2. Create archive folder
mkdir -p archived/unused-2026-04-16

# 3. Move or remove files (move recommended)
git mv "multi-account.js" archived/unused-2026-04-16/ || (cp "multi-account.js" archived/unused-2026-04-16/ && git rm "multi-account.js")
git mv "PLAN.md" archived/unused-2026-04-16/ || (cp "PLAN.md" archived/unused-2026-04-16/ && git rm "PLAN.md")
git mv ".sisyphus/notepads/auth-provider-mapping" archived/unused-2026-04-16/ || (git rm -r ".sisyphus/notepads/auth-provider-mapping" && mkdir -p archived/unused-2026-04-16/.sisyphus && cp -r .sisyphus/notepads/auth-provider-mapping archived/unused-2026-04-16/)

# Optional: remove package-lock.json if you intentionally want to stop tracking it
git rm package-lock.json

# 4. Add / commit
git add archived/unused-2026-04-16 || true
git commit -m "chore(prune): archive candidate unused files (multi-account.js, package-lock.json, docs)"

# 5. Verify: run diagnostics, tests, build
# TypeScript typecheck (if applicable)
npx tsc --noEmit || echo "tsc not configured or errors reported"

# Run project tests
npm ci && npm test || echo "tests failed or no tests configured"

# 6. Push and open PR
git push -u origin HEAD
# Use gh or GitHub UI to create PR with title and body below

PR Draft
--------
Title: chore(prune): archive unused files (multi-account.js, package-lock.json, docs)

Body:
Automated scan identified a small set of files that appear to be unused by the codebase: multi-account.js, package-lock.json, and some tool-generated markdown notes in .sisyphus. This change moves them to archived/unused-2026-04-16 for review. If maintainers confirm these files are not needed, we can permanently remove them in a follow-up. Verification steps performed: typecheck (npx tsc --noEmit), test run (npm test). Please review and comment if any of these should be retained.

Rollback
--------
If something breaks after the PR is merged, revert the PR or restore the files from archived/unused-2026-04-16. The archive folder preserves original content and history.

Notes and caveats
-----------------
- package-lock.json removal may change reproducible installs — only remove if the project intentionally uses another package manager or will regenerate a lockfile.
- multi-account.js looked like a built artifact; confirm no external consumers expect that file to be present in the repo before permanent deletion.
- PLAN.md and the .sisyphus notes may contain valuable historical context; consider archiving them to a separate docs/archive repository if you want to keep the repo root trimmed.

Next actions I will take now (automated, no commit):
- Provide this plan to you as PRUNE_PLAN.md in the repo (this file).
- Mark collection/classification step complete in the session TODOs.

If you want me to prepare the branch/patch described above (i.e., create the branch and move files) I will do so, but I will not push or create the PR without your explicit approval.
