# Rencana Update README Instalasi Plugin

## TL;DR
> **Summary**: Perbarui README agar alur instalasi plugin dari GitHub menjadi jelas, terverifikasi, dan minim gagal setup tanpa mengubah source code plugin.
> **Deliverables**:
> - Section Prasyarat yang eksplisit
> - Section Instalasi GitHub dengan urutan command end-to-end
> - Section Verifikasi Pasca-Instalasi berbasis command
> - Section Troubleshooting dengan error umum + solusi
> - Klarifikasi entrypoint (`src/index.ts` vs artefak build `dist`)
> **Effort**: Short
> **Parallel**: YES - 2 waves
> **Critical Path**: Task 1 → Task 2 → Task 3 → Task 4 → Task 6

## Context
### Original Request
User meminta review cara penginstalan plugin (plugin sudah bisa digunakan, distribusi saat ini dari GitHub), lalu menyetujui untuk dikerjakan menjadi versi final yang siap diterapkan.

### Interview Summary
- Fokus hanya pada **cara instalasi**.
- Perubahan harus berada di README/documentation, bukan implementasi kode plugin.
- User sudah menyetujui pembuatan versi final siap tempel dan meminta eksekusi lanjutan.

### Metis Review (gaps addressed)
- Wajib hindari scope creep ke perubahan source code.
- Wajib tambah acceptance criteria yang bisa dijalankan agent (bukan penilaian visual manusia).
- Wajib klarifikasi kebingungan entrypoint terkait `main: src/index.ts` vs output `dist/`.
- Wajib sertakan troubleshooting praktis dan langkah verifikasi pasca-instalasi.

## Work Objectives
### Core Objective
Menghasilkan README instalasi yang decision-complete untuk pengguna GitHub: dari prasyarat, install, build, verifikasi, sampai troubleshooting.

### Deliverables
- README.md terbarui di section instalasi.
- Struktur section baru: Prasyarat, Install GitHub, Verifikasi, Troubleshooting, Entrypoint Note.
- Daftar command verifikasi yang deterministik.

### Definition of Done (verifiable conditions with commands)
- `README.md` memiliki heading yang ditargetkan.
- Command install/build di README konsisten dengan script `package.json`.
- README memuat minimum Node.js yang eksplisit.
- README memuat verifikasi sukses instalasi berbasis command.
- README memuat minimal 4 troubleshooting cases dengan solusi.

Contoh command verifikasi DoD:
```bash
python - <<'PY'
from pathlib import Path
t = Path('README.md').read_text(encoding='utf-8')
required = [
  '## 📦 Instalasi',
  '### Prasyarat',
  '### Cara 1: Install dari GitHub (Direkomendasikan)',
  '### Verifikasi Instalasi (Wajib)',
  '### Troubleshooting'
]
missing = [h for h in required if h not in t]
print('OK' if not missing else 'MISSING: ' + ', '.join(missing))
PY
```

### Must Have
- Tetap gunakan bahasa Indonesia konsisten dengan README saat ini.
- Node.js minimum ditulis eksplisit: **v18+**.
- Command utama mencakup: `git clone`, `npm ci`, `npm run typecheck`, `npm run build`.
- Tetap pertahankan bagian konfigurasi akun yang sudah ada.
- Tambahkan catatan entrypoint tanpa memaksakan perubahan kode.

### Must NOT Have (guardrails, AI slop patterns, scope boundaries)
- Tidak mengubah file selain README untuk eksekusi plan ini.
- Tidak mengubah kode TypeScript/plugin runtime.
- Tidak menambahkan klaim yang tidak terverifikasi dari repo.
- Tidak menulis acceptance criteria berbasis “terlihat bagus”.

## Verification Strategy
> ZERO HUMAN INTERVENTION - all verification is agent-executed.
- Test decision: tests-after + command-based documentation checks
- QA policy: Every task mencakup skenario happy + failure/edge
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`

## Execution Strategy
### Parallel Execution Waves
> Target: 5-8 tasks per wave. <3 per wave (except final) = under-splitting.
> Extract shared dependencies as Wave-1 tasks for max parallelism.

Wave 1: fondasi konten & struktur (Tasks 1-4)
- [x] T1 (writing): Audit baseline README install scope
- [x] T2 (writing): Finalkan section Prasyarat + Install GitHub end-to-end
- [x] T3 (writing): Finalkan section Verifikasi Instalasi
- [x] T4 (writing): Finalkan section Troubleshooting + Entrypoint note

Wave 2: integrasi & validasi akhir (Tasks 5-8)
- T5 (quick): Sinkronkan command README vs `package.json`
- T6 (quick): Validasi heading/keyword wajib secara otomatis
- T7 (writing): Rapikan wording tanpa ubah makna teknis
- T8 (unspecified-low): Buat ringkasan perubahan siap kirim ke user

### Dependency Matrix (full, all tasks)
- T1: Blocked By: none | Blocks: T2,T3,T4
- T2: Blocked By: T1 | Blocks: T5,T7
- T3: Blocked By: T1 | Blocks: T6,T7
- T4: Blocked By: T1 | Blocks: T7
- T5: Blocked By: T2 | Blocks: T8
- T6: Blocked By: T3 | Blocks: T8
- T7: Blocked By: T2,T3,T4 | Blocks: T8
- T8: Blocked By: T5,T6,T7 | Blocks: Final Verification

### Agent Dispatch Summary (wave → task count → categories)
- Wave 1 → 4 tasks → writing
- Wave 2 → 4 tasks → quick, writing, unspecified-low

## TODOs
> Implementation + Test = ONE task. Never separate.
> EVERY task MUST have: Agent Profile + Parallelization + QA Scenarios.

- [ ] 1. Audit baseline README install scope

  **What to do**: Tandai batas section instalasi saat ini dan tentukan blok yang diganti/ditambah tanpa menyentuh section konfigurasi akun.
  **Must NOT do**: Mengubah isi teknis konfigurasi akun.

  **Recommended Agent Profile**:
  - Category: `writing` - Reason: audit struktur dokumen.
  - Skills: `[]` - Tidak ada skill tambahan wajib.
  - Omitted: `playwright` - Tidak relevan untuk dokumen markdown.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 2,3,4 | Blocked By: none

  **References**:
  - Pattern: `README.md:14-60` - Area instalasi lama.
  - Pattern: `README.md:61-160` - Area konfigurasi akun yang harus dipertahankan.

  **Acceptance Criteria**:
  - [ ] Batas edit terdokumentasi dalam catatan kerja internal executor.
  - [ ] Tidak ada rencana edit di luar section instalasi.

  **QA Scenarios**:
  ```
  Scenario: Baseline scope terpetakan
    Tool: Bash
    Steps: Jalankan pencarian heading instalasi dan konfigurasi pada README
    Expected: Heading instalasi dan konfigurasi ditemukan sebagai boundary yang jelas
    Evidence: .sisyphus/evidence/task-1-audit-baseline.txt

  Scenario: Edge - heading berubah
    Tool: Bash
    Steps: Jika heading tidak persis sama, identifikasi heading terdekat berbasis emoji/nama section
    Expected: Boundary alternatif tercatat tanpa memperluas scope
    Evidence: .sisyphus/evidence/task-1-audit-baseline-error.txt
  ```

  **Commit**: NO | Message: `docs(readme): n/a` | Files: [README.md]

- [ ] 2. Tambahkan Prasyarat + Install GitHub end-to-end

  **What to do**: Sisipkan subsection `Prasyarat` dan `Cara 1: Install dari GitHub (Direkomendasikan)` dengan command final: clone, masuk folder repo, `npm ci`, `npm run typecheck`, `npm run build`.
  **Must NOT do**: Menambahkan command yang tidak ada padanan script/tooling di repo.

  **Recommended Agent Profile**:
  - Category: `writing` - Reason: menyusun instruksi copy-ready.
  - Skills: `[]` - Tidak perlu skill khusus.
  - Omitted: `oracle` - Tidak diperlukan untuk perubahan dokumen sederhana.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 5,7 | Blocked By: 1

  **References**:
  - API/Type: `package.json:14-18` - Script valid (`typecheck`, `build`, `test`).
  - Pattern: `README.md:24-49` - Pola install project/global sebelumnya.
  - External: `https://github.com/rahadiana/opencode-multi-account.git` - URL clone resmi.

  **Acceptance Criteria**:
  - [ ] `Prasyarat` menyebut Node.js v18+.
  - [ ] Blok command install GitHub end-to-end tercantum lengkap.
  - [ ] Tidak ada command fiktif di luar repo.

  **QA Scenarios**:
  ```
  Scenario: Happy path konten install lengkap
    Tool: Bash
    Steps: Cari substring `npm ci`, `npm run typecheck`, `npm run build` di README
    Expected: Ketiga command ditemukan tepat sekali di section instalasi utama
    Evidence: .sisyphus/evidence/task-2-install-flow.txt

  Scenario: Failure - command hilang
    Tool: Bash
    Steps: Jalankan cek otomatis daftar command wajib
    Expected: Check gagal dengan daftar command yang hilang
    Evidence: .sisyphus/evidence/task-2-install-flow-error.txt
  ```

  **Commit**: NO | Message: `docs(readme): clarify github install flow` | Files: [README.md]

- [ ] 3. Tambahkan Verifikasi Instalasi (Wajib)

  **What to do**: Tambahkan subsection verifikasi pasca install dengan langkah deterministik (startup tanpa error, tool `account_status` dapat dipanggil, config terbaca).
  **Must NOT do**: Menulis verifikasi yang membutuhkan interpretasi subjektif.

  **Recommended Agent Profile**:
  - Category: `writing` - Reason: penulisan prosedur verifikasi.
  - Skills: `[]` - Tidak wajib.
  - Omitted: `playwright` - Tidak perlu browser automation.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 6,7 | Blocked By: 1

  **References**:
  - Pattern: `README.md:191-213` - Daftar tools plugin (`account_status` dll).
  - Pattern: `README.md:61-133` - Alur konfigurasi `accounts.json` yang dirujuk verifikasi.

  **Acceptance Criteria**:
  - [ ] Section verifikasi berisi 3 langkah dengan expected outcome biner.
  - [ ] Minimal satu langkah memakai tool `account_status`.

  **QA Scenarios**:
  ```
  Scenario: Happy path verifikasi tersedia
    Tool: Bash
    Steps: Cari heading `Verifikasi Instalasi` dan kata kunci `account_status`
    Expected: Keduanya ada dalam section yang sama
    Evidence: .sisyphus/evidence/task-3-verification.txt

  Scenario: Edge - verifikasi tidak actionable
    Tool: Bash
    Steps: Deteksi kalimat non-deterministik seperti "pastikan terlihat"
    Expected: Tidak ditemukan frasa non-deterministik pada section verifikasi
    Evidence: .sisyphus/evidence/task-3-verification-error.txt
  ```

  **Commit**: NO | Message: `docs(readme): add post-install verification` | Files: [README.md]

- [ ] 4. Tambahkan Troubleshooting + Entrypoint Note

  **What to do**: Tambahkan troubleshooting minimal 4 kasus: Node versi, build gagal, plugin tidak terbaca, config akun tidak terbaca. Tambahkan catatan bahwa dokumentasi instalasi memakai alur build aman terkait perbedaan `main` dan artefak `dist`.
  **Must NOT do**: Mengubah `package.json` atau mengklaim perilaku runtime yang tidak didukung repo.

  **Recommended Agent Profile**:
  - Category: `writing` - Reason: penyusunan error catalog.
  - Skills: `[]` - Tidak wajib.
  - Omitted: `deep` - Tidak perlu analisis arsitektur.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 7 | Blocked By: 1

  **References**:
  - API/Type: `package.json:5` - `main: "src/index.ts"`.
  - API/Type: `package.json:15-16` - Build via TypeScript.
  - Pattern: `README.md:51-59` - Existing npm-install mention.

  **Acceptance Criteria**:
  - [ ] Troubleshooting berisi >=4 kasus dengan langkah fix.
  - [ ] Catatan entrypoint tercantum jelas tanpa instruksi perubahan kode.

  **QA Scenarios**:
  ```
  Scenario: Happy path troubleshooting lengkap
    Tool: Bash
    Steps: Hitung jumlah item bernomor pada subsection Troubleshooting
    Expected: Jumlah item >= 4
    Evidence: .sisyphus/evidence/task-4-troubleshooting.txt

  Scenario: Failure - catatan entrypoint tidak ada
    Tool: Bash
    Steps: Cari keyword `src/index.ts` dan `dist`
    Expected: Jika salah satu hilang, skenario gagal
    Evidence: .sisyphus/evidence/task-4-troubleshooting-error.txt
  ```

  **Commit**: NO | Message: `docs(readme): add troubleshooting and entrypoint note` | Files: [README.md]

- [ ] 5. Sinkronkan command README dengan script package

  **What to do**: Cocokkan command di README terhadap script yang tersedia di `package.json`, pastikan tidak ada perintah non-eksisten.
  **Must NOT do**: Menambah script baru pada package.json.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: validasi string command.
  - Skills: `[]` - Tidak wajib.
  - Omitted: `writing` - Fokus cek konsistensi, bukan redaksi utama.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 8 | Blocked By: 2

  **References**:
  - API/Type: `package.json:14-18` - Sumber tunggal command npm.
  - Pattern: `README.md` - Semua blok command instalasi.

  **Acceptance Criteria**:
  - [ ] Semua `npm run ...` di README valid terhadap `package.json`.
  - [ ] Tidak ada command npm fiktif.

  **QA Scenarios**:
  ```
  Scenario: Happy path command valid
    Tool: Bash
    Steps: Parse `npm run <script>` dari README lalu cocokkan dengan scripts package.json
    Expected: Semua script ditemukan
    Evidence: .sisyphus/evidence/task-5-command-sync.txt

  Scenario: Failure - script tidak ada
    Tool: Bash
    Steps: Deteksi script README yang tidak ada di package.json
    Expected: Laporan mismatch non-empty dan task dianggap gagal
    Evidence: .sisyphus/evidence/task-5-command-sync-error.txt
  ```

  **Commit**: NO | Message: `docs(readme): align commands with package scripts` | Files: [README.md]

- [ ] 6. Validasi heading dan keyword wajib otomatis

  **What to do**: Jalankan cek otomatis untuk heading wajib dan keyword minimum (Node v18+, command utama, `account_status`).
  **Must NOT do**: Menutup task jika ada heading/keyword wajib yang hilang.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: scripted validation.
  - Skills: `[]` - Tidak wajib.
  - Omitted: `unspecified-high` - Overkill untuk cek keyword.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 8 | Blocked By: 3

  **References**:
  - Pattern: `README.md` - target validasi.

  **Acceptance Criteria**:
  - [ ] Semua heading wajib terdeteksi.
  - [ ] Keyword wajib terdeteksi (Node v18+, `npm ci`, `npm run build`, `account_status`).

  **QA Scenarios**:
  ```
  Scenario: Happy path semua keyword ada
    Tool: Bash
    Steps: Jalankan skrip pencocokan daftar heading+keyword
    Expected: Output `OK`
    Evidence: .sisyphus/evidence/task-6-keyword-check.txt

  Scenario: Edge - typo heading
    Tool: Bash
    Steps: Simulasikan cek terhadap variasi heading
    Expected: Cek gagal untuk heading yang tidak exact-match
    Evidence: .sisyphus/evidence/task-6-keyword-check-error.txt
  ```

  **Commit**: NO | Message: `docs(readme): validate required headings and keywords` | Files: [README.md]

- [ ] 7. Polishing redaksi tanpa ubah makna teknis

  **What to do**: Rapikan konsistensi istilah, ejaan, dan format markdown agar section baru selaras dengan gaya README existing.
  **Must NOT do**: Mengubah requirement teknis yang telah disepakati.

  **Recommended Agent Profile**:
  - Category: `writing` - Reason: editorial consistency.
  - Skills: `[]` - Tidak wajib.
  - Omitted: `oracle` - Tidak diperlukan.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 8 | Blocked By: 2,3,4

  **References**:
  - Pattern: `README.md:1-13` - Tone/style baseline.
  - Pattern: `README.md` - Seluruh gaya heading/emoji.

  **Acceptance Criteria**:
  - [ ] Istilah teknis konsisten (Instalasi, Verifikasi, Troubleshooting, Konfigurasi).
  - [ ] Tidak ada perubahan makna teknis dari task 2-4.

  **QA Scenarios**:
  ```
  Scenario: Happy path konsistensi istilah
    Tool: Bash
    Steps: Cek kemunculan istilah utama dan heading format
    Expected: Konsisten tanpa duplikasi istilah kontradiktif
    Evidence: .sisyphus/evidence/task-7-polish.txt

  Scenario: Failure - makna teknis berubah
    Tool: Bash
    Steps: Diff semantic terhadap blok command/requirement
    Expected: Tidak ada command requirement yang hilang
    Evidence: .sisyphus/evidence/task-7-polish-error.txt
  ```

  **Commit**: NO | Message: `docs(readme): polish wording consistency` | Files: [README.md]

- [ ] 8. Siapkan ringkasan perubahan untuk user

  **What to do**: Buat ringkasan akhir yang menyebut apa yang ditambah/diubah di README, risiko yang diturunkan, dan instruksi validasi cepat.
  **Must NOT do**: Menyatakan hasil verifikasi lulus jika evidence belum lengkap.

  **Recommended Agent Profile**:
  - Category: `unspecified-low` - Reason: wrap-up terstruktur.
  - Skills: `[]` - Tidak wajib.
  - Omitted: `deep` - Tidak perlu.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: Final Verification | Blocked By: 5,6,7

  **References**:
  - Pattern: `README.md` - hasil akhir dokumen.
  - Test: `.sisyphus/evidence/task-*.txt` - bukti QA tasks.

  **Acceptance Criteria**:
  - [ ] Ringkasan memuat daftar section baru.
  - [ ] Ringkasan memuat 1-langkah validasi cepat.

  **QA Scenarios**:
  ```
  Scenario: Happy path ringkasan lengkap
    Tool: Bash
    Steps: Validasi ringkasan memuat section + validasi cepat
    Expected: Kedua elemen ada
    Evidence: .sisyphus/evidence/task-8-summary.txt

  Scenario: Failure - klaim tanpa bukti
    Tool: Bash
    Steps: Cocokkan klaim ringkasan terhadap file evidence
    Expected: Tidak ada klaim yang tidak didukung evidence
    Evidence: .sisyphus/evidence/task-8-summary-error.txt
  ```

  **Commit**: NO | Message: `docs(readme): summarize installation doc improvements` | Files: [README.md]

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.
- [ ] F1. Plan Compliance Audit — oracle
- [ ] F2. Code Quality Review — unspecified-high
- [ ] F3. Real Manual QA — unspecified-high (+ playwright if UI)
- [ ] F4. Scope Fidelity Check — deep

## Commit Strategy
- Satu commit dokumentasi setelah seluruh QA lulus:
  - `docs(readme): clarify github installation, verification, and troubleshooting`
- File target commit: `README.md` saja.

## Success Criteria
- Pengguna baru bisa mengikuti instalasi GitHub tanpa asumsi tersembunyi.
- Semua command instalasi sesuai kondisi repo saat ini.
- Ada prosedur verifikasi pasca-instalasi yang deterministik.
- Troubleshooting dasar mencakup error paling umum.
- Tidak ada perubahan source code plugin.
