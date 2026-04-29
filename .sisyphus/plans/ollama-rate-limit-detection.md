# Plan: Add Ollama Rate Limit Detection

## TL;DR
> **Summary**: Tambahkan pattern deteksi rate limit khusus untuk Ollama provider agar token otomatis ganti saat limit/overload.
> **Deliverables**: Updated `src/rate-limiter.ts` dengan Ollama-specific patterns
> **Effort**: Quick
> **Parallel**: NO
> **Critical Path**: Task 1 → Task 2 → Verification

## Context
### Original Request
User menggunakan Qwen dari Ollama, tapi saat rate limit token tidak ganti.

### Problem
Pattern RATE_LIMIT_PATTERNS di `src/rate-limiter.ts` tidak mencakup Ollama-specific error messages:
- `no slot available` — Ollama saat semua slot penuh
- `connection refused` / `ECONNREFUSED` — Ollama overload
- `timeout` / `ETIMEDOUT` — Request timeout saat busy
- `context cancelled` — Request dibatalkan saat overload
- `model is loading` — Model belum siap
- `queue full` — Request queue penuh

## Work Objectives
### Core Objective
Tambahkan pattern Ollama-specific agar `isRateLimitError()` return `true` untuk Ollama errors.

### Deliverables
- `src/rate-limiter.ts` updated dengan Ollama patterns
- Test verification dengan Ollama error samples

### Definition of Done
- `isRateLimitError()` detects Ollama-specific errors
- Pattern tidak trigger false positives untuk error lain
- Existing tests tetap pass

### Must Have
- Tambahkan minimal 6 Ollama patterns
- Pattern case-insensitive
- Tidak mengubah logic lain di file

### Must NOT Have
- Tidak menghapus pattern existing
- Tidak mengubah struktur file
- Tidak menambahkan dependencies

## Verification Strategy
- Test decision: tests-after
- QA policy: Test dengan Ollama error samples
- Evidence: `.sisyphus/evidence/ollama-detection-test.txt`

## Execution Strategy
### Parallel Execution Waves
Wave 1: Implementation
- [ ] T1: Tambahkan Ollama patterns ke RATE_LIMIT_PATTERNS array
- [ ] T2: Verifikasi dengan test samples

### Dependency Matrix
- T1: Blocks T2
- T2: Blocked By T1

## TODOs

- [ ] 1. Tambahkan Ollama-specific rate limit patterns

  **What to do**: Tambahkan ke `RATE_LIMIT_PATTERNS` array di `src/rate-limiter.ts`:
  ```typescript
  /no slot available/i,
  /connection refused/i,
  /econnrefused/i,
  /timeout/i,
  /etimedout/i,
  /context cancelled/i,
  /model is loading/i,
  /queue full/i,
  /concurrent request limit/i,
  /max connections/i,
  ```
  
  **Must NOT do**: 
  - Menghapus pattern existing
  - Mengubah struktur file lain

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: Simple edit
  - Skills: `[]`
  - Omitted: `oracle` - Tidak perlu analisis mendalam

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 2 | Blocked By: none

  **References**:
  - Pattern: `src/rate-limiter.ts:8-40` - RATE_LIMIT_PATTERNS array

  **Acceptance Criteria**:
  - [ ] Minimal 6 Ollama patterns ditambahkan
  - [ ] Pattern case-insensitive (flag `/i`)
  - [ ] Array syntax valid

  **QA Scenarios**:
  ```
  Scenario: Ollama error terdeteksi sebagai rate limit
    Tool: Bash
    Steps: Test isRateLimitError() dengan "no slot available" dan "connection refused"
    Expected: Return true untuk kedua error
    Evidence: .sisyphus/evidence/ollama-detection-test.txt
  ```

  **Commit**: YES | Message: `feat(rate-limiter): add Ollama-specific rate limit patterns` | Files: [`src/rate-limiter.ts`]

- [ ] 2. Verifikasi pattern tidak break existing tests

  **What to do**: Jalankan `npm test` dan pastikan semua tests pass
  
  **Must NOT do**: Mengubah test files

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: Test execution only
  - Skills: `[]`
  - Omitted: `deep` - Tidak perlu analisis

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: none | Blocked By: 1

  **References**:
  - Test: `src/rate-limiter.test.ts` - Existing rate limit tests

  **Acceptance Criteria**:
  - [ ] `npm test` exits with code 0
  - [ ] 16/16 tests pass

  **QA Scenarios**:
  ```
  Scenario: All tests pass
    Tool: Bash
    Steps: npm test
    Expected: ℹ pass 16, ℹ fail 0
    Evidence: .sisyphus/evidence/test-pass.txt
  ```

  **Commit**: NO | Message: `n/a` | Files: []

## Final Verification Wave
- [ ] F1. Plan Compliance Audit — oracle
- [ ] F2. Code Quality Review — unspecified-high
- [ ] F3. Real Manual QA — unspecified-high
- [ ] F4. Scope Fidelity Check — deep

## Commit Strategy
- Single commit after all tasks complete
- Message: `feat(rate-limiter): add Ollama-specific rate limit detection patterns`

## Success Criteria
- Ollama errors trigger account rotation
- No false positives on unrelated errors
- Existing functionality unchanged
