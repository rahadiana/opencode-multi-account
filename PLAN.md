Plan: Konversi auth.json (provider-object map) ke accounts.json terkelompok per penyedia

Deskripsi masalah
- Sumber data saat ini adalah auth.json yang berisi provider-object map. Maksudnya, data autentikasi berasal dari beberapa penyedia (provider) dengan objek konfigurasi autentikasi yang terkait.
- Targetnya adalah accounts.json, yang strukturnya mengelompokkan entri per nama provider. Setiap provider memiliki array yang berisi entri-entri autentikasi mentah (raw), dan setiap entri mempertahankan seluruh field persis seperti di auth.json.
- Inti tugas: membuat format konversi yang konsisten, terdefinisi dengan jelas, dan dapat diimplementasikan secara bertahap tanpa mengubah perilaku runtime saat ini.

Prioritas: tinggi

Model data saat ini vs yang diinginkan
- Saat ini (auth.json):
  {
    "providerA": { ... },
    "providerB": [ { ... }, { ... } ],
    ...
  }
- Yang diinginkan (accounts.json):
  {
    "providerA": [ { ... } ],
    "providerB": [ { ... }, { ... } ],
    ...
  }
- Perbedaan utama: semua entri harus disimpan persis seperti di auth.json, dan entri-entri provider dikumpulkan ke dalam array yang diindeks oleh nama provider.

Contoh canonical
- Input auth.json (sederhana):
  {
    "google": {"client_id": "GID123", "client_secret": "SECRET", "refresh_token": "RT"},
    "github": [ {"token": "tok1", "username": "dev1"}, {"token": "tok2", "username": "dev2"} ]
  }
- Output accounts.json:
  {
    "google": [ {"client_id": "GID123", "client_secret": "SECRET", "refresh_token": "RT"} ],
    "github": [ {"token": "tok1", "username": "dev1"}, {"token": "tok2", "username": "dev2"} ]
  }

Ruang lingkup implementasi (phased)
1) Phase 1 – Parser konversi
- Membuat parser yang membaca auth.json dari root proyek.
- Mendukung dua bentuk nilai penyedia: objek tunggal untuk provider (contoh google: { ... }) dan array entri untuk provider (contoh github: [ {…}, {…} ]).
- Hasil parser: struktur dalam memori berupa Map<string, Array<object>> yang berisi entri-entri mentah persis seperti di auth.json.
- Guard: jika provider memiliki objek tunggal, konversi ke array dengan satu entri.

2) Phase 2 – Skema penyimpanan (accounts.json)
- File accounts.json akan memiliki bentuk: { <providerName>: [ <entry1>, <entry2>, ... ] }
- Pastikan urutan entri stabil (mis. urutan input), dengan sort stable jika diperlukan untuk determinisme.
- Tambahkan validasi bahwa semua entri adalah objek JSON tanpa perubahan struktur field.

3) Phase 3 – Migrasi awal
- Jika accounts.json belum ada, buat berdasarkan auth.json.
- Jika accounts.json ada, lakukan sinkronisasi bertahap: tambahkan entri baru yang tidak ada, tanpa menghapus entri yang sudah ada (deduplikasi berjalan pada fase 4).
- Periksa perbedaan antara hasil parser dan accounts.json yang ada jika ada, lalu terapkan perubahan secara idempotent.

4) Phase 4 – Logika sinkronisasi dan deduplikasi
- Implementasikan mekanisme deduplikasi: identitas entri di-tracking berdasarkan nilai JSON mentah (deep equality). Hasilkan daftar entri unik per provider.
- Terapkan deduplikasi secara konsisten saat menjalankan migrasi maupun sinkronisasi berkala.
- Pastikan tidak ada penghapusan data yang tidak disengaja jika entri lama tetap relevan.

5) Phase 5 – Verifikasi dan validasi
- Validasi integritas: setiap entri di accounts.json persis sama dengan bagian setara di auth.json, kecuali susunan array yang bisa berubah karena deduplikasi.
- Jalankan test skala kecil dengan contoh auth.json terdefinisi untuk memastikan keluaran accounts.json sesuai ekspektasi.
- Verifikasi integritas JSON (setiap provider memiliki array, tidak ada provider kosong kecuali tidak ada entri).

6) Phase 6 – Kompatibilitas dan rollback
- Pastikan perubahan bersifat non-breaking untuk komponen yang membaca accounts.json lama (jika ada). Sediakan fallback parsing untuk object tunggal maupun array.
- Rencanakan strategi rollback bila migrasi gagal (mis. simpan backup accounts.json sebelum migrasi).

Kebijakan Rotasi per Provider (Keputusan Final)
- Rotasi harus berbasis provider asal kejadian error.
- Jika request ke provider X terkena rate limit / too many requests, rotasi hanya boleh terjadi di pool akun provider X.
- Jika seluruh akun pada provider X habis (semua rate-limited/tidak tersedia), sistem wajib berhenti dan mengirim notifikasi error.
- Dilarang melakukan fallback lintas provider (tidak boleh alihkan otomatis ke provider lain).

Langkah implementasi rinci
- Parser: baca auth.json, normalisasi menjadi Map<string, Array<object>> sesuai aturan dua bentuk nilai provider.
- Storage: accounts.json mengikuti format Map<string, Array<object>>; tambahkan utilitas untuk membaca dan menulis dengan aman.
- Migrasi: skrip migrasi yang bisa dijalankan manual atau otomatis sebagai bagian dari init proses, dengan opsi dry-run.
- Sinkronisasi: fungsi sync yang memperbarui accounts.json berdasarkan perubahan auth.json sejak run terakhir.
- Dedupe: implementasikan fungsi dedupe berbasis konten entri (deep equality) dan penyortiran deterministik untuk stable output.
- Verifikasi: skrip verifikasi yang membandingkan auth.json dan accounts.json hasil konversi.

Kebijakan non-goals dan kompatibilitas
- Bukan mengubah perilaku runtime sistem lain selain format accounts.json; fokus pada transformasi data.
- Tidak menambah dependensi baru pada proyek.
- Tidak menambah fitur UI/UX; hanya dokumentasi dan migrasi data.
- Asumsi dasar: auth.json berada di akar proyek dan dapat dibaca/ditulis dengan hak akses saat migrasi.
- Non-goal eksplisit: tidak ada fallback lintas provider saat pool provider asal habis.

Kriteria penerimaan (Acceptance Criteria)
- PLAN.md tersedia, jelas, dan dapat dijalankan sebagai peta implementasi.
- Menyediakan contoh input auth.json yang jelas dan output accounts.json yang konsisten.
- Memuat fase implementasi dengan pengarsipan edge-case, non-goals, dan kebijakan kompatibilitas.
- Dokumen dapat dipakai sebagai acuan teknis untuk tim implementasi tanpa ambigu.
- Kebijakan rotasi per provider terdokumentasi eksplisit: jika pool provider habis maka stop + notif error, tanpa fallback provider lain.

Rincian persiapan
- File input: auth.json di root repo.
- File keluaran: accounts.json di root repo (sebagai target mirip sumber data).
- Dokumentasi ini tidak mengubah kode sumber atau menambah dependensi baru.

Catatan aksi berikutnya
- Segera setelah disetujui, tim implementasi akan membuat parser, migrasi, dan skrip sinkronisasi berdasarkan panduan di PLAN.md ini.

Tanda-tangan: Tim Data Engineering
