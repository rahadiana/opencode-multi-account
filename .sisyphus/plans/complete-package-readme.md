# Complete Package and README Update

## TL;DR
> **Summary**: Update `README.md` with troubleshooting and sync installation instructions with `package.json` fields; modify `package.json` to automate builds and follow npm naming conventions.
> **Deliverables**: Updated `README.md` and `package.json` with verification steps implemented.
> **Effort**: Quick.
> **Parallel**: NO.
> **Critical Path**: README → `package.json` updates → Verification

## Context
### Original Request
- Update README to include prerequisites, GitHub installation steps, verification methods, and troubleshooting.
- Update `package.json` with `main: dist/index.js`, a `prepublishOnly` script, and a scoped `name`.
- Verify changes for npm compliance.

### Key Progress So Far
- Added "Prerequisites" and "GitHub Installation" sections to `README.md`.
- Outlined changes for `package.json` in `.sisyphus/plans/package-json-update.md`.

## Work Objectives
### Core Objective
Integrate reliable documentation and configuration changes for smooth user onboarding, publishing, and troubleshooting.

### Deliverables
1. Finalized `README.md` with troubleshooting and aligned installation/prerequisite documentation.
2. Updated `package.json` to include scoped naming, `main: dist/index.js`, and build automation.
3. Verification of all changes for adherence to npm requirements.

### Definition of Done
- Documentation clarity: All sections added (prerequisites, installation, troubleshooting).
- Updated `package.json` validates for npm usage via `npm pack`.

### Must Have
- Verify correctness of `dist/index.js` path post-build.
- End-to-end test of verified steps in `README.md`.

### Must NOT Have
- Changes breaking backward compatibility.
- Material alterations to unrelated `package.json` fields.

## Verification Strategy
- **Test Decision**: Post-implementation testing via `npm pack` for packaging verifications.
- **QA Policy**: Full manual validation of all instructions provided in `README.md`.

## Execution Strategy
### Parallel Execution Waves
Wave 1: Finalize README documentation updates.
Wave 2: Implement `package.json` updates.
Wave 3: Validate updates (npm compliance).

### Dependency Matrix
- Wave Dependency: README → `package.json` updates → Full Validation
- Content Dependence: README will sync with `package.json` changes.

## TODOs
### Wave 1: Finalize README Documentation Updates
- [ ] **Add troubleshooting steps:**
  - Common error scenarios for users (build failure/missing dependencies).
  - Diagnostic commands for troubleshooting.
- [ ] **Sync new `prepublishOnly` step:**
  - Reference build automation added to `package.json`.

### Wave 2: Update `package.json`
- [ ] **Update `main` field to `dist/index.js`:**
  - Modify the `package.json` `main` field to reflect the correct path.
- [ ] **Add `prepublishOnly` script:**
  - Automate build process prior to publishing (`npm run build`).
- [ ] **Scope `name`:**
  - Update `name` to `@rahadiana/opencode-multi-account`.

### Wave 3: Verification Tasks
- [ ] **Verify `package.json` structure meets npm requirements:**
  - Use `npm pack` to test package file layouts.
- [ ] **Integrate README with post-update validation:**
  - Ensure steps work correctly with the package.

## Commit Strategy
- Commit in 1-2 waves (README task completion first, then `package.json` changes).
- Message example: `docs(README): Add troubleshooting and improve installation instructions`.

## Final Verification
- [ ] F1. Documentation compliance — aligned sections.
- [ ] F2. Packaging compliance — Run `npm pack` verification.
- [ ] F3. Scope Fidelity Check — Ensure no unintended scope changes in `package.json`.
