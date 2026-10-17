# NineRate

**Better feedback. Better learning.**

NineRate adalah prototipe (prototype) sistem umpan balik guru untuk **SMK Negeri 9 Kota Bekasi**.
Fondasi aplikasi (tahap 1) berisi design system, application shell, autentikasi demo, hash routing
dengan penjaga peran, dan data demo di LocalStorage. **Tahap 2** mengaktifkan seluruh fitur Murid:
dashboard, direktori guru, detail profil, statistik rating, pengiriman/pengeditan feedback,
riwayat "Feedback Saya", dan pelaporan feedback. **Tahap 3** mengaktifkan fitur Guru:
Dashboard Guru, Profil Saya (read-only), Feedback untuk Saya, dan pelaporan oleh Guru.
**Tahap 4** mengaktifkan fitur Admin: Dashboard Admin, antrean moderasi beserta workflow
approve/reject/hide/restore, antrean laporan konten, manajemen akun, dan manajemen profil guru.
**Tahap 5** adalah audit integrasi akhir: seluruh alur ketiga role, router, migrasi, statistik,
rendering aman, dan responsif diuji ulang; tiga bug nyata diperbaiki tanpa mengubah keputusan
produk (lihat bagian 11.4-11.6).

Fondasi memakai **HTML5, CSS3, dan Vanilla JavaScript (ES Modules)** — tanpa framework,
tanpa build step, tanpa npm, dan tanpa CDN.

---

## 1. Cara menjalankan

Aplikasi memakai ES Modules, jadi **tidak bisa** dibuka langsung dengan klik dua kali pada
`index.html` (browser akan memblokir module `file://`). Jalankan melalui server statis lokal.

### Opsi A — VS Code Live Server (paling mudah)

1. Buka folder `NineRate` di VS Code.
2. Klik kanan `index.html` → **Open with Live Server**.
3. Browser membuka `http://127.0.0.1:5500/index.html`.

### Opsi B — Server statis bawaan Python

```bash
cd NineRate
python -m http.server 8000
```

### Opsi C — Server statis dengan Node.js

```bash
cd NineRate
npx --yes serve .
```

Buka `http://localhost:8000` (atau port yang muncul di terminal).

---

## 2. Kredensial demo

Semua akun fiktif dan hanya berlaku pada data demo di browser Anda.

| Peran | Username | Password | Nama | Keterangan |
| --- | --- | --- | --- | --- |
| Admin | `admin` | `admin123` | Admin Sekolah | Lihat semua modul admin |
| Guru | `guru.andi` | `guru123` | Andi Saputra, S.Pd. | Matematika (XII RPL-1) |
| Guru | `guru.siti` | `guru123` | Siti Rahmawati, S.Pd. | Bahasa Indonesia (XI AKL-2) |
| Guru | `guru.budi` | `guru123` | Budi Hartono, S.Kom. | Informatika (X RPL-2) |
| Guru | `guru.nina` | `guru123` | Nur Aisyah, S.Pd. | **Akun nonaktif** — tidak muncul di direktori Murid |
| Murid | `murid.rizky` | `murid123` | Rizky Fauzan | Punya feedback approved + rejected |
| Murid | `murid.dewi` | `murid123` | Dewi Lestari | Punya feedback pending + hidden |
| Murid | `murid.ayub` | `murid123` | Ayub Maulana | 1 feedback pending |
| Murid | `murid.tampal` | `murid123` | Tampal | **Akun nonaktif** - login ditolak |

Catatan tahap 4: data seed di atas tetap sama, dan hanya satu akun Admin aktif
(`admin`). Menonaktifkan `admin` sendiri atau Admin aktif terakhir dicegah oleh sistem,
sehingga minimal selalu ada satu Admin aktif. Akun tambahan dapat dibuat dari
`#/admin/accounts` dan langsung bisa dipakai untuk login.

Skenario pelaporan paling mudah diuji: masuk sebagai `murid.dewi`, buka
`#/student/teachers/tprof-01`, lalu tekan **Laporkan** pada feedback milik `murid.rizky`.
Untuk menguji moderasi, masuk sebagai `admin`, buka `#/admin/moderation`, lalu pilih
feedback `fb-004` (Pending) dan coba aksi Setujui, Tolak, atau Sembunyikan.

---

## 3. Struktur proyek

```text
NineRate/
├── index.html                 # Shell HTML: memuat CSS + entry module
├── README.md
└── assets/
    ├── Logo_SMKN_9-removebg-preview.png   # Logo sekolah (file asli, tidak diubah/dipindah)
    ├── css/
    │   ├── tokens.css         # Design tokens (custom properties)
    │   ├── base.css           # Reset, tipografi dasar, helper
    │   ├── layout.css         # Application shell, sidebar, header, auth layout, responsif
    │   └── components.css     # Tombol, input, badge, kartu, tabel, alert, modal, toast, rating
    └── js/
        ├── app.js             # Bootstrap seed/migrasi, shell, render per rute, menu mobile, logout
        ├── router.js          # Hash routing, tabel rute, guard role
        ├── auth.js            # Login demo, sesi, guard role, label peran
        ├── storage.js         # SATU-SATUNYA modul yang menyentuh LocalStorage
        ├── seed.js            # Data demo + migrasi skema v1 -> v2 (satu kali, non-destruktif)
        ├── admin.js           # Domain Admin: moderasi, laporan, akun, profil guru
        ├── feedback.js        # Domain Murid: validasi, submit, status, statistik, pelaporan
        ├── ui.js              # el()/komponen reusable, ikon SVG, rating, toast, modal
        └── pages.js           # View tiap rute (Admin, Guru, Murid)
```

Penyesuaian dari struktur awal tahap 1: dua modul domain baru ditambahkan agar logika
tetap terpisah dari rendering. `assets/js/feedback.js` (tahap 2) memuat aturan Murid —
validasi, satu feedback per pasangan murid-guru, transisi status, statistik rating, dan
pelaporan. `assets/js/admin.js` (tahap 4) memuat aturan Admin — workflow moderasi, workflow
laporan, manajemen akun, dan manajemen profil guru. Keduanya hanya memakai API `storage.js`.

### Logo sekolah

Logo yang ditemukan saat audit: `assets/Logo_SMKN_9-removebg-preview.png`.
File tersebut **tidak dihapus, dipindahkan, diganti nama, ditimpa, atau diedit**.
Dipakai secara proporsional sebagai elemen pendukung (avatar di sidebar/footer sidebar dan di
bawah form login). Identitas utama aplikasi tetap NineRate.

---

## 4. Design system (ringkas)

| Token | Nilai |
| --- | --- |
| Brand blue / yellow / ivory | `#2596BE` / `#F6F023` / `#FAF9F6` |
| Primary / hover | `#1D7898` / `#185F78` |
| Surface / teks / muted / border | `#FFFFFF` / `#203747` / `#5F6F77` / `#E5E2DB` |
| Radius kartu / kontrol | `16px` / `10px` |
| Spacing | kelipatan 4px (`--space-1` … `--space-16`) |
| Transisi | 150–200ms, dinonaktifkan via `prefers-reduced-motion` |
| Font | system sans-serif stack (tanpa web font/CDN) |

Semua fitur baru memakai token dan komponen yang sudah ada; CSS khusus fitur Murid
(rating, distribusi bintang, toolbar filter, blok kritik/saran, catatan moderasi) ditambahkan
ke `components.css` dengan gaya yang sama. Tidak ada sistem desain kedua dan tidak ada
`style="..."` di markup — kecuali lebar bar distribusi bintang yang dihitung dari data
(bukan konten pengguna).

Kuning `#F6F023` hanya dipakai sebagai aksen (bintang terisi, penanda daftar),
bukan warna teks kecil.

---

## 5. Routing dan aturan akses

| Rute | Peran |
| --- | --- |
| `#/login` | Tamu |
| `#/admin/dashboard` | Admin |
| `#/admin/moderation` | Admin |
| `#/admin/reports` | Admin |
| `#/admin/accounts` | Admin |
| `#/admin/teachers` | Admin |
| `#/teacher/dashboard` | Guru |
| `#/teacher/profile` | Guru |
| `#/teacher/feedback` | Guru |
| `#/student/dashboard` | Murid |
| `#/student/teachers` | Murid |
| `#/student/teachers/:id` | Murid |
| `#/student/teachers/:id/feedback` | Murid |
| `#/student/my-feedback` | Murid |

Jumlah ini dihitung dari definisi nyata di `router.js` pada audit tahap 5: **14 rute**
(1 tamu + 5 Admin + 3 Guru + 5 Murid), dengan 2 rute berparameter (`:id`). Seluruh 14 rute
dapat diakses role yang sesuai; guard di router menolak akses lintas peran ("Akses
ditolak", dikembalikan ke dashboard peran). Rute tidak dikenal → halaman "Halaman tidak
ditemukan"; parameter yang tidak dikenal → halaman "Profil/Guru tidak tersedia" (bukan error).
Menulis hash secara langsung tidak melewati login, dan `#/login` saat sudah login
dialihkan ke dashboard.

---

## 6. Struktur data

### 6.1 Feedback (v2)

```jsonc
{
  "id": "fb-...",              // ID feedback, tetap saat diedit
  "teacherId": "tprof-01",     // relasi ke teacher profile
  "studentId": "usr-murid-01", // relasi ke akun murid
  "status": "pending",         // pending | approved | rejected | hidden
  "rating": 4,                 // integer 1-5
  "kritik": " maksimal 500 karakter",
  "saran": "maksimal 500 karakter",
  "createdAt": "2026-09-26T01:15:00.000Z",  // tidak berubah
  "updatedAt": "...",                        // berubah setiap edit
  "submittedAt": "...",                      // waktu kirim terakhir
  "moderationStatus": "pending",  // keputusan admin TERAKHIR yang berlaku
  "moderatedBy": "usr-admin-01",
  "moderatedAt": "...",
  "moderationNote": "...",      // alasan keputusan yang sedang berlaku
  "moderationHistory": [        // keputusan sebelumnya, tidak pernah dihapus
    { "status": "rejected", "note": "...", "by": "usr-admin-01", "at": "..." }
  ]
}
```

Status yang diperbolehkan: `pending`, `approved`, `rejected`, `hidden`. Hanya `approved`
yang tampil di profil publik guru dan dihitung dalam rating.

### 6.2 Laporan (v2)

```jsonc
{
  "id": "rep-...",
  "feedbackId": "fb-001",
  "reporterId": "usr-murid-02",   // bisa murid atau guru
  "reason": "konten-tidak-relevan", // penghinaan-pelecenan | penyebaran-informasi-pribadi | konten-tidak-relevan | lainnya
  "detail": "maksimal 300 karakter",
  "status": "open",               // open | in_review | resolved
  "createdAt": "...", "updatedAt": "...",
  "handledBy": "usr-admin-01",    // admin yang menangani (tahap 4)
  "handledAt": "...",
  "resolutionNote": "...",        // catatan penyelesaian, bertahan saat dibuka kembali
  "reopenedFrom": "...",          // waktu penyelesaian terakhir bila dibuka kembali
}
```

Laporan aktif = `open` atau `in_review`. `resolved` bukan laporan aktif. Mengirim laporan
tidak mengubah status feedback, dan menyelesaikan laporan juga tidak mengubahnya.

### 6.3 Key LocalStorage

`ninerate_users_v1`, `ninerate_teacher_profiles_v1`, `ninerate_feedback_v1`,
`ninerate_reports_v1`, `ninerate_moderation_logs_v1`, `ninerate_session_v1`, `ninerate_meta_v1`.

- Data demo hanya ditulis bila key belum ada (`hasKey`). Reload tidak menimpa data.
- **Migrasi skema v1 → v2** berjalan satu kali bila `meta.schemaVersion < 2`:
  `status: published` → `approved`, `text`/`category` → `kritik` (dan `saran` kosong),
  laporan `reviewed` → `resolved`, aksi log `publish` → `approve`. ID, `studentId`,
  `teacherId`, dan `createdAt` dipertahankan. `meta.seededAt` lama tidak diubah.
- Tidak ada reset otomatis. Untuk mengembalikan data demo ke kondisi semula, hapus key
  `ninerate_*` melalui DevTools → Application → Local Storage, lalu muat ulang.
- Pembacaan selalu melewati sanitizer di `storage.js`; JSON rusak diabaikan (diubah menjadi
  daftar kosong) dan tidak menjatuhkan aplikasi.
- Password plaintext **hanya karena ini prototype lokal untuk demonstrasi**.

---

## 7. Aturan fitur per peran

### 7.1 Satu feedback per pasangan murid + guru

Kombinasi `studentId + teacherId` bersifat unik; tidak ada record duplikat:

| Kondisi record | Perilaku |
| --- | --- |
| Belum ada | Record baru, status `pending` |
| `pending` | Arahkan ke record tersebut untuk diedit (bukan duplikat) |
| `approved` | Boleh diedit; setelah diajukan status kembali `pending` → keluar dari profil publik & rating |
| `rejected` | Boleh diperbaiki dan diajukan ulang → `pending` |
| `hidden` | Boleh diperbaiki dan diajukan ulang → `pending` |

Saat feedback diajukan ulang, `id`, `studentId`, `teacherId`, `createdAt` tetap; yang
diperbarui adalah rating, kritik, saran, `updatedAt`, `submittedAt`, dan status. Catatan
moderasi lama dipindahkan ke `moderationHistory` (tidak dihapus) dan tidak lagi ditampilkan
sebagai keputusan terbaru; hanya `moderationNote` yang masih berlaku untuk status saat ini
yang ditampilkan di "Feedback Saya".

### 7.2 Validasi form

- Rating wajib dipilih, harus integer 1–5.
- Kritik **atau** saran minimal salah satu terisi.
- Kritik dan saran maksimal 500 karakter masing-masing; teks di-trim sebelum disimpan.
- Pesan error tampil di dekat field yang bermasalah, input tidak dikosongkan, dan modal
  konfirmasi tetap terbuka bila validasi gagal.
- Validasi dijalankan di UI **dan** di fungsi domain `submitFeedback()`.
- Tidak ada kontrol untuk mengubah `studentId`, `teacherId`, atau status moderasi dari form.

### Pelaporan

Murid dapat melaporkan feedback `approved` milik murid lain dari halaman profil guru
(tombol kecil "Laporkan"). Feedback sendiri tidak bisa dilaporkan; laporan aktif
duplikat dari akun yang sama dicegah. Before submit ada konfirmasi modal.

### Statistik rating

`computeRatingStats(teacherId)` di `feedback.js` dipakai bersama oleh halaman Murid, Guru,
dan Admin. Rata-rata = jumlah rating approved / jumlah feedback approved, ditampilkan satu
angka desimal. Rata-rata **tidak disimpan** di profil guru — selalu dihitung dari record
feedback. Jika jumlah approved nol → teks "Belum ada penilaian" (bukan 0/5), dan bar
distribusi menampilkan 0% tanpa pembagian dengan nol.

  Satu fungsi ini dipakai bersama oleh Dashboard Murid, detail profil guru yang dilihat murid,
  Dashboard Guru, "Feedback untuk Saya", dan halaman Admin - tidak ada perhitungan kedua
  dengan aturan berbeda.

### 7.3 Pelaporan oleh Guru

Guru melaporkan **feedback publik dari penulis Murid**; Guru tidak mengubah isi, rating, atau
status moderasi feedback. Mekanismenya memakai `createReport()` yang sama dengan Murid.

Aturan akses yang ditegakkan di lapisan domain (`checkReportable`), bukan hanya di UI:

| Aturan | Perilaku |
| --- | --- |
| Hanya `approved` | `pending`, `rejected`, `hidden` ditolak (`not-public`) |
| Tidak milik pelapor | `feedback.studentId === reporterId` ditolak (`own`) |
| Cakupan Guru | `feedback.teacherId` harus sama dengan profil guru dari session (`out-of-scope`) |
| Profil Guru tidak ada | laporan ditolak (`no-profile`) |
| Duplikat aktif | `open` atau `in_review` dari reporter yang sama ditolak (`duplicate`) |
| `resolved` | bukan laporan aktif, sehingga pelaporan baru diizinkan |

`reporterId` selalu berasal dari akun Guru yang sedang login. Parameter `scope` bersifat
opsional dan hanya menambah pembatasan - seluruh proteksi Murid tetap berlaku tanpa perubahan
perilaku.

---
### 7.4 Workflow moderasi (Admin)

Status kanonis feedback: `pending`, `approved`, `rejected`, `hidden`.

**Kontrak dua field status**

- `status` adalah acuan **visibilitas publik dan perhitungan rating**. Hanya
  `status === 'approved'` yang tampil di profil guru dan dihitung `computeRatingStats()`.
- `moderationStatus` mencerminkan **keputusan admin terakhir yang berlaku**. Fitur Murid
  (`currentModerationNote()`) hanya menampilkan `moderationNote` bila
  `moderationStatus === status`, sehingga catatan lama tidak pernah tampil seolah-olah
  itu keputusan terbaru.
- Setelah setiap aksi Admin, kedua field disinkronkan ke status hasil aksi sehingga tidak
  pernah bertentangan. Semua penulisan lewat `admin.js` → `storage.js`.

**Transisi yang diizinkan**

| Aksi | Dari status | Hasil | Alasan |
| --- | --- | --- | --- |
| `approve` | `pending`, `rejected` | `approved` | opsional |
| `reject` | `pending`, `approved` | `rejected` | **wajib** |
| `hide` | `pending`, `approved` | `hidden` | **wajib** |
| `restore` | `hidden` | `approved` | opsional |

Transisi lain ditolak (`invalid-transition`). Tidak ada hard delete pada feedback.

`restore` hanya berlaku bila konten **belum diubah penulis** setelah disembunyikan. Bila
penulis mengedit (rating/kritik/saran diperbarui sehingga `updatedAt > moderatedAt`),
restore ditolak dengan `edited-after-hide` dan feedback harus ditinjau serta disetujui
melalui alur normal.

Setiap aksi yang berhasil:

1. memindahkan keputusan sebelumnya ke `moderationHistory` (tidak dihapus),
2. mengisi `moderationNote`, `moderatedBy`, `moderatedAt`, dan `updatedAt`,
3. menambahkan baris ke `ninerate_moderation_logs_v1` untuk jejak audit,
4. langsung tercermin pada statistik dan halaman publik.

Aksi yang mengubah visibilitas publik selalu melewati modal konfirmasi, dan modal tetap
terbuka bila validasi alasan gagal. Rating, kritik, saran, serta identitas penulis tidak
dapat diubah melalui UI moderasi.

### 7.5 Workflow laporan konten (Admin)

Status laporan: `open`, `in_review`, `resolved`. Status laporan berdiri sendiri dari status
feedback.

| Dari | Ke | Efek |
| --- | --- | --- |
| `open` | `in_review` | `handledBy`, `handledAt`, `updatedAt` terisi |
| `open` / `in_review` | `resolved` | sama + `resolutionNote` disimpan |
| `in_review` | `in_review` | ditolak (`unchanged`) |
| `resolved` | `open` | dibuka kembali; `resolutionNote` tetap ada, `reopenedFrom` diisi |

Menyelesaikan laporan **tidak** mengubah status feedback. Untuk menyembunyikan atau
memulihkan feedback, Admin memakai workflow moderasi pada 7.4. Laporan tidak pernah
dihapus setelah selesai.

## 8. Keamanan DOM

- Konten pengguna selalu dirender dengan `textContent` / `document.createTextNode` lewat
  `el()`. Helper `el()` tidak menyediakan opsi HTML mentah.
- `innerHTML` hanya dipakai untuk SVG ikon statis di `ui.js`.
- Tidak ada `eval`, tidak ada event handler inline pada HTML.
- Isian yang berisi `<img onerror=...>` atau `<script>` dari LocalStorage tampil sebagai teks
  biasa (terverifikasi, 0 node tersuntik).
- Sesi hanya berisi `userId` + waktu login.

---

## 9. Status fitur

Ketiga role (Murid, Guru, Admin) telah selesai dan diverifikasi end-to-end pada audit tahap 5;
laporan lengkap ada di bagian 11.4. Tidak ada fitur yang masih berupa placeholder.

Sudah berfungsi (tahap 1): design system, shell responsif (sidebar, header, menu mobile),
login/logout demo, hash routing + guard role, LocalStorage + sanitizer + migrasi, komponen
reusable.

Sudah berfungsi (tahap 4 - fitur Admin):

- Dashboard Admin: ringkasan akun (aktif, nonaktif, murid aktif, guru aktif, profil guru
  valid), ringkasan feedback per status, ringkasan laporan per status, aktivitas moderasi
  terbaru dari `ninerate_moderation_logs_v1`, dan empat aksi cepat. Semua angka dihitung
  dari record aktual.
- Antrean moderasi: tabel dengan nama penulis, guru tujuan, rating, ringkasan, status, dan
  tanggal; pencarian identitas, filter status (Semua/Pending/Approved/Rejected/Hidden), urutan
  terbaru/terlama, serta dua empty state berbeda (antrean kosong vs pencarian tanpa hasil).
- Detail feedback: modal berisi identitas penulis, guru tujuan, rating, kritik/saran lengkap,
  waktu kirim dan pembarui, status beserta `moderationStatus`, catatan yang berlaku, histori
  moderasi kronologis, statistik guru saat itu, dan aksi valid sesuai status.
- Workflow moderasi: approve, reject, hide, restore. Reject dan hide wajib alasan; aksi yang
  mengubah visibilitas publik selalu lewat modal konfirmasi; transisi tidak valid ditolak;
  rating/kritik/saran/penulis tidak dapat diubah dari UI.
- Laporan konten: daftar dengan pelapor, role, feedback, guru, alasan, tanggal, status;
  filter status, alasan, dan pencarian; detail memuat konteks feedback dan tautan ke moderasi;
  transisi open → in_review → resolved → open dengan penyimpanan `handledBy`/`handledAt` dan
  catatan penyelesaian yang tidak hilang saat dibuka kembali.
- Manajemen akun: tabel dengan nama, username, role, kelas, kelengkapan profil guru, dan
  status; pencarian, filter role, filter status; form tambah akun (ketiga role, profil Guru
  opsional dibuat bersamaan) dan form edit (role terkunci, password opsional); aksi
  nonaktifkan/aktifkan dengan konfirmasi.
- Manajemen profil guru: daftar profil (nama dari akun, username, NIP, mapel, kelas,
  kelengkapan, status akun, rating), penanda guru aktif tanpa profil, serta form buat/edit
  profil dengan validasi relasi dan pencegahan profil ganda.

Sudah berfungsi (tahap 2 - fitur Murid):
Sudah berfungsi (tahap 2 — fitur Murid):

- Dashboard Murid dengan statistik dari data aktual, pencarian guru, pintasan guru
  (urutan nama deterministik).
- Direktori guru: hanya guru aktif + profil valid, pencarian nama (case-insensitive),
  filter mata pelajaran (kombinasi), urutan alfabetis, empty state, tombol reset.
- Detail profil guru: rating, distribusi bintang 1–5, deskripsi, feedback publik approved
  saja, tombol kirim/edit, aksi laporkan.
- Statistik rating reusable (`computeRatingStats`).
- Form rating + kritik/saran: create, edit, validasi lengkap, konfirmasi modal, notifikasi
  kebijakan identitas sebelum kirim.
- "Feedback Saya": semua status, aksi sesuai status, catatan admin yang berlaku, riwayat
  keputusan sebelumnya.
- Pelaporan feedback approved yang bukan miliknya, dengan pencegahan duplikasi aktif.

Sudah berfungsi (tahap 3 - fitur Guru):

- Dashboard Guru: rating rata-rata, jumlah penilaian, jumlah feedback publik approved, dan
  distribusi bintang 1-5 dari satu sumber perhitungan (`computeRatingStats`), serta hingga
  lima umpan balik approved terbaru beserta nama penulis, kritik, saran, dan tanggal.
- "Profil Saya": read-only. Nama lengkap, mata pelajaran, deskripsi, NIP, rating, dan jumlah
  feedback approved; relasi `userId` ke `id profil` ditampilkan. Tanpa form edit.
- "Feedback untuk Saya": hanya feedback approved milik profil guru yang sedang login
  (`teacherId` selalu dari session, bukan dari parameter rute). Nama penulis diambil dari
  akun `studentId`. Tidak ada kontrol edit atau hapus.
- Pelaporan oleh Guru atas feedback publik di profilnya, memakai modal dan validasi yang
  sama dengan Murid, dengan pembatasan cakupan tambahan (lihat bagian 7.3).
- Empty state "Belum ada penilaian" tanpa nilai 0/5 ketika belum ada feedback approved.

Belum diimplementasikan (sengaja di luar scope MVP, tetap placeholder-free):

- Grafik tren dan ekspor (tetap memakai CSS tanpa library grafik).
- Pagination (jumlah data demo masih kecil; daftarmoderasi dan laporan menampilkan
  seluruh hasil yang cocok dengan filter).
- Penghapusan feedback, laporan, akun, atau profil secara permanen.
- Perubahan role akun lewat form edit umum (MVP mengunci role agar relasi profil guru
  dan histori tidak rusak).
- Notifikasi dalam aplikasi dan pencarian pada halaman "Feedback Saya".
- Leaderboard/peringkat guru.

---

## 10. Keterbatasan prototype

- **Autentikasi hanya simulasi.** Password plaintext, session bisa diubah lewat DevTools.
  Tidak ada hashing, token, atau expiry nyata.
- **Role guard hanya di browser.** Guard berjalan di sisi klien; pengguna yang paham DevTools
  dapat memalsukan data LocalStorage. Tidak ada backend yang memverifikasi apa pun.
- **Tidak ada sinkronisasi lintas perangkat.** Data hanya ada di browser yang dipakai.
- **Tidak ada server, database, atau API.** Tidak ada backup maupun audit tamper-proof;
  "riwayat" keputusan hanya data lokal.
- Karena itu aplikasi ini **belum layak** dipakai untuk data siswa/guru yang nyata.

---

## 11. Ringkasan verifikasi

Pemeriksaan yang benar-benar dijalankan pada tahap 2-4 (Node.js v24, server statis
`localhost:8123`, browser sungguhan). Laporan audit integrasi akhir (tahap 5) ada di 11.4.

- `node --check` pada 8 file JavaScript → semua lulus.
- Migrasi v1 → v2 disimulasikan dengan LocalStorage berisi data v1 (`published`/`text`/
  `reviewed`/`publish`): status, kolom kritik, ID, `studentId`, `teacherId`, `createdAt`,
  dan `seededAt` lama dipertahankan; `schemaVersion` naik ke 2; reload kedua tidak mengubah
  apa pun.
- Login Murid (3 akun), dashboard menampilkan statistik dari data aktual.
- Direktori: 3 guru aktif (guru nonaktif `guru.nina` tidak muncul); pencarian "siti"/"BUDI"
  (case-insensitive), filter mata pelajaran, kombinasi keduanya, empty state, reset filter,
  urutan nama A–Z.
- Detail profil: rating, distribusi 1–5, feedback approved saja; profil guru nonaktif /
  tidak ada → "Profil tidak tersedia" + tombol kembali.
- Form: rating kosong ditolak, kritik+saran kosong ditolak, input 520 karakter ditolak,
  input tidak dikosongkan saat gagal, modal konfirmasi memuat kebijakan nama & publikasi.
- Siklus status terverifikasi: `hidden` → edit → `pending`; `rejected` → edit → `pending`;
  `approved` → edit → `pending` dan langsung hilang dari profil publik serta rating
  ("Belum ada penilaian"); `pending` → edit → tetap satu record.
- Tidak ada duplikat: setiap pasangan `studentId+teacherId` tetap berisi 1 record setelah
  pengiriman ulang.
- Pelaporan: laporan valid tersimpan di `ninerate_reports_v1`; laporan tanpa alasan ditolak
  tanpa menutup modal; laporan aktif ganda dicegah; feedback sendiri tidak bisa dilaporkan;
  status feedback tidak berubah setelah dilaporkan.
- Visibilitas lintas akun: login sebagai murid berbeda → profil hanya menampilkan feedback
  approved milik murid lain, nama penulis dari akun, "Feedback Saya" hanya record sendiri.
- Render aman: payload `<img onerror>` / `<script>` tampil sebagai teks, 0 node tersuntik.
- Persistensi: reload mempertahankan sesi, data, dan status hasil edit.
- Guard role: akses `#/admin/*` dan `#/teacher/*` dari akun Murid ditolak.
- Halaman Admin (5) dan Guru (3) tetap render dengan field baru; statistik Guru memakai
  fungsi yang sama dengan Murid.
- Layout 420 px (iframe): rating, distribusi, dan tombol tetap terbaca.
- Konsol browser: 0 error JavaScript selama seluruh pengujian.

### 11.1 Tahap 3 - fitur Guru

- `node --check` pada 8 file JavaScript → semua lulus.
- Login `guru.andi` → masuk ke `#/teacher/dashboard`; statistik, distribusi, dan umpan balik
  terbaru sesuai data aktual (1 penilaian approved).
- Login `guru.budi` (belum ada feedback approved) → dashboard menampilkan "Belum ada penilaian"
  tanpa nilai 0/5; halaman feedback menampilkan empty state + tombol kembali.
- Relasi akun→profil terverifikasi: profil dicari via `userId` sesi, `userId akun` dan
  `ID profil guru` ditampilkan. Menghapus relasi profil (simulasi) → ketiga halaman Guru
  menampilkan "Profil belum tersedia" tanpa error dan tanpa mengambil profil guru lain.
- Pemisahan antar-Guru: `guru.siti` melihat 1 feedback approved miliknya, tidak melihat
  feedback `guru.andi`; rute berparameter di bawah `/teacher/*` menghasilkan
  "Halaman tidak ditemukan" (tidak ada pola rute yang menerima `teacherId`).
- Pelaporan Guru: laporan valid tersimpan di `ninerate_reports_v1` dengan `reporterId` akun
  Guru, toast konfirmasi muncul, dan isi/status feedback tidak berubah.
- Penolakan pelaporan terverifikasi di lapisan domain: `out-of-scope` (feedback guru lain),
  `not-public` (feedback pending), `no-profile` (profil guru tidak ada), `duplicate`.
- Status laporan: `open` dan `in_review` mencegah pelaporan ulang (UI menampilkan catatan
  "Laporan Anda sudah terkirim..."), `resolved` mengizinkan pelaporan baru.
- Konsistensi statistik terverifikasi silang: nilai domain `computeRatingStats()` untuk tiga
  guru cocok dengan yang dirender Dashboard Guru, Feedback untuk Saya, halaman profil yang
  dilihat Murid, dan kartu direktori Murid.
- Halaman `#/admin/reports` menampilkan laporan Guru bersama label alasan terlokalisasi.
- Regresi fitur Murid: pencarian + filter + reset direktori, "Feedback Saya" dengan aksi per
  status, form edit ter-prefill, dan aksi lapor Murid tetap berfungsi.
- Guard role dari akun Guru: `#/admin/*` dan `#/student/*` ditolak; reload mempertahankan
  sesi, data, dan `schemaVersion: 2`; konsol 0 error.
- Layout 420 px: dashboard Guru, distribusi bintang, kartu statistik, dan umpan balik terbaru
  menumpuk rapi dan tetap terbaca.

### 11.2 Pemeriksaan migrasi skema

- Skema aktif terverifikasi `SCHEMA_VERSION = 2` (`storage.js`) dan `meta.schemaVersion` di
  browser uji bernilai 2 setelah migrasi.
- Migrasi v1 → v2 disimulasikan ulang pada tahap ini dengan LocalStorage berisi data v1
  (`published`/`text`/`reviewed`/`publish`): `published` → `approved`, `text` → `kritik`,
  `reviewed` → `resolved`, `publish` → `approve`; `id`, `studentId`, `teacherId`,
  `createdAt`, dan `seededAt` lama dipertahankan.
- Migrasi bersifat satu kali: reload kedua menghasilkan byte identik untuk feedback, laporan,
  dan meta, serta console hanya mencatat "Data demo sudah ada, tidak ditimpa".
- Tidak ada reset data yang dijalankan; penghapusan relasi profil pada pengujian Guru hanya
  mengubah `ninerate_teacher_profiles_v1` sementara dan dipulihkan kembali.
- Catatan: laporan pengujian tahap 2 pernah menulis "v1 → v1" — itu salah ketik. Hasil uji
  sebenarnya adalah v1 → v2 seperti tercatat pada bagian 6 dan 11.1.

### 11.3 Tahap 4 - fitur Admin

Semua pemeriksaan dijalankan di browser sungguhan (Node.js v24, server statis
`http://localhost:8123`, browser desktop + viewport 420 px).

**Sintaks & integritas kode**

- `node --check` pada 9 file JavaScript (termasuk `admin.js` baru) → semua lulus.
- Tidak ada `eval`, event handler inline, atau `innerHTML` untuk konten pengguna;
  `innerHTML` hanya untuk SVG ikon statis di `ui.js`.
- `localStorage` hanya diakses di `storage.js` (pemeriksaan grep).

**Dashboard Admin**

- Kelima route Admin terbuka dan merender h1 yang benar.
- Semua kartu statistik berasal dari record aktual dan cocok dengan hitungan manual:
  akun aktif/nonaktif, murid aktif, guru aktif, profil guru valid, total feedback per
  status (pending/approved/rejected/hidden), laporan per status (open/in_review/resolved).
- Aktivitas moderasi terbaru menampilkan admin pelaku, tindakan, feedback terkait, dan waktu.
- Empat aksi cepat membuka halaman yang benar.

**Moderasi**

- Antrean menampilkan 6 feedback; filter status Pending → 2 baris; pencarian "budi"
  menyaring 1 baris; kombinasi pencarian + filter bekerja; pencarian tanpa hasil
  menampilkan empty state khusus.
- Pengurutan terbaru/terlama membalik urutan tanggal dengan benar.
- Detail memuat identitas, rating, kritik/saran, waktu, status + `moderationStatus`,
  catatan berlaku, histori kronologis, statistik guru, dan hanya aksi yang valid
  (contoh: feedback `approved` hanya menawarkan Tolak/Sembunyikan).
- Reject tanpa alasan ditolak dengan pesan kontekstual dan modal tetap terbuka; dengan
  alasan → status `rejected`, `moderationStatus` ikut `rejected`, `moderatedBy` terisi,
  rating tidak masuk statistik.
- Approve → `approved`, rating masuk statistik (rata-rata tprof-03 berubah dari
  "Belum ada penilaian" → 3.0).
- Hide tanpa alasan ditolak; dengan alasan → `hidden` dan rating langsung dikeluarkan
  ("Belum ada penilaian", count 0).
- Restore → kembali `approved` dan rating kembali dihitung (3.0).
- Histori tumbuh berurutan (`rejected` → `approved` → `hidden` → `approved`), tidak ada
  entri yang dihapus; moderation logs mencatat keempat aksi.
- Transisi tidak valid ditolak: approve pada `approved`, restore pada `approved`.
- Restore ditolak (`edited-after-hide`) bila penulis mengedit setelah hide, dan record
  tidak berubah saat penolakan tersebut.
- Aktor bukan Admin aktif ditolak (`forbidden`) untuk moderasi, buat akun, dan ubah status
  akun — diperiksa di domain, bukan hanya dengan menyembunyikan tombol.

**Laporan konten**

- Antrean menampilkan 2 laporan dengan pelapor, role, guru, alasan, tanggal, status.
- Filter status, filter alasan, dan pencarian bekerja; pencarian tanpa hasil memakai empty
  state berbeda dari antrean kosong.
- open → in_review → resolved → open terverifikasi; `handledBy` dan `handledAt` tersimpan;
  `resolutionNote` tetap ada setelah laporan dibuka kembali (`reopenedFrom` terisi).
- Laporan tidak pernah dihapus (record tetap ada setelah resolved).
- Status feedback `fb-006` tetap `hidden` sepanjang perubahan status laporan — tidak ada
  coupling diam-diam.
- Detail laporan tidak memuat password atau kredensial apa pun.

**Manajemen akun**

- Tambah akun Murid via UI berhasil; submit kosong ditolak dengan tiga pesan error.
- Username duplikat ditolak tanpa membedakan huruf besar/kecil (`MURID.NINA` vs
  `murid.nina`), dan jumlah akun tidak bertambah.
- Ketiga role berhasil dibuat lewat domain (student, teacher + profil, admin).
- Murid tanpa kelas ditolak; role di luar tiga role ditolak; password < 4 karakter ditolak.
- Pembuatan akun Guru dengan profil gagal (mapel kosong) → akun **tidak** tersimpan
  (rollback), tidak ada record parsial.
- Edit akun: nama/username/kelas/password berhasil; password kosong mempertahankan yang
  lama; username yang sama dengan akun sendiri tetap valid; username bentrok ditolak;
  role terkunci dan tidak berubah.
- Menonaktifkan diri sendiri ditolak (`self`); menonaktifkan Admin aktif terakhir ditolak
  (`last-admin`) dan akun tetap aktif; admin lain dapat dinonaktifkan dan diaktifkan kembali.
- Akun nonaktif tidak dapat login (`murid.tampal` dan `admin2`), dan akun yang dinonaktifkan
  langsung kehilangan sesi.

**Manajemen profil guru**

- Daftar menampilkan 5 profil dengan nama dari akun, username, NIP, mapel, kelengkapan,
  status akun, dan rating.
- Guru aktif tanpa profil ditandai dengan alert; tombol "Tambah profil" dinonaktifkan
  setelah semua guru punya profil.
- Profil dibuat untuk guru tanpa profil; mata pelajaran di-trim dari whitespace.
- Profil ganda untuk `userId` yang sama ditolak (`duplicate`); profil untuk akun Murid
  maupun Admin ditolak; mapel whitespace-only ditolak.
- Edit profil mengubah mapel dan tetap menyisakan rating serta histori feedback utuh
  (diverifikasi byte-identik).

**Integrasi lintas role**

- Regresi Murid: direktori (5 guru aktif, A–Z), detail profil guru (rating 5.0),
  form edit feedback ter-prefill, "Feedback Saya" (2 record).
- Regresi Guru: dashboard (3 statistik benar), Feedback untuk Saya (1 record, aksi lapor).
- Guard role ditolak dari Murid dan Guru ke route Admin maupun lintas role.
- Payload `<img onerror>` / `<b>` pada kritis di antrean admin tampil sebagai teks,
  0 node tersuntik.
- Reload mempertahankan sesi, seluruh data (byte-identik), dan `schemaVersion: 2`;
  console hanya mencatat "Data demo sudah ada, tidak ditimpa".
- Responsif: tabel panjang dapat digeser horizontal (`overflow-x: auto`, 835 px pada
  599 px viewport), fokus keyboard bergerak ke tombol tabel, modal tertutup dengan Escape,
  dan layout 420 px tetap terbaca (filter menumpuk, kartu statistik menumpuk).

### 11.4 Audit integrasi akhir (tahap 5)

Audit dilakukan pada lingkungan uji terisolasi (origin baru, `localhost:8130`) sehingga
LocalStorage yang sudah dipakai pengguna tidak diubah dan tidak di-reset.

**Statik & inventaris**

- `node --check` pada 9 file JavaScript → semua lulus.
- Route dihitung dari definisi nyata di `router.js`: **14 route** (1 tamu + 5 Admin +
  3 Guru + 5 Murid), 2 di antaranya memakai parameter (`:id`).
- Skema aktif `SCHEMA_VERSION = 2`; tidak ada kenaikan versi skema pada tahap ini.
- Tidak ada repositori Git pada folder proyek, sehingga tidak ada status versi yang
  dibandingkan; perubahan dilakukan langsung pada file yang ada.

**Skenario A-H (end-to-end di browser)**

| Skenario | Hasil |
| --- | --- |
| A Murid kirim feedback | Lulus - record `pending`, ID unik per pasangan, tetap `pending` setelah reload, tidak bocor ke murid lain/Guru |
| B Admin setujui | Lulus - `approved`, histori + log tercatat, terlihat oleh murid lain **dan** Guru dengan nama lengkap, statistik 4.5 / 2 penilaian |
| C Edit feedback approved | Lulus - ID sama, status `pending`, hilang dari publik, statistik turun ke 5.0 / 1, catatan lama pindah ke histori |
| D Reject lalu revisi | Lulus - alasan wajib, tidak tampil publik, penulis melihat alasan, record sama kembali `pending`, histori `approved`+`rejected` terjaga |
| E Hide lalu restore | Lulus - hide mengeluarkan dari statistik, restore tanpa edit berhasil, `edited-after-hide` menolak restore setelah penulis mengedit |
| F Pelaporan | Lulus - duplikat aktif ditolak, `resolved` mengizinkan lapor ulang, scope Guru membatasi pada profilnya, laporan tidak mengubah status feedback, `handledBy`/`handledAt`/catatan tersimpan |
| G Manajemen akun | Lulus - 3 role dibuat, username duplikat (case-insensitive) ditolak, rollback profil, edit, nonaktif/reactif, akun nonaktif tak bisa login, histori utuh |
| H Manajemen profil guru | Lulus - profil dibuat, akun non-Guru & duplikat ditolak, edit tidak mengubah rating/histori, guru nonaktif hilang dari direktori namun histori tersimpan |

**Statistik (`computeRatingStats`) dengan fixture manual** - semua sesuai perhitungan manual:
kosong → "Belum ada penilaian"; semua `pending` → "Belum ada penilaian"; approved 1/3/5 →
3.0 dengan count 3; campuran status → hanya approved yang dihitung; approved→pending dan
approved→hidden dikeluarkan; hidden dipulihkan → masuk lagi; rating tidak valid (9, 0, 2.6, -3)
membersihkan diri ke rentang 1-5; record tanpa `teacherId` dibuang; JSON rusak → daftar kosong
tanpa crash. Tidak ada pembagian dengan nol, tidak ada record yang dihitung dua kali, dan
tidak ada rata-rata yang disimpan sebagai salinan di profil guru.

**Router & role guard** - 13 route ber-role × 3 role (39 navigasi) tanpa kegagalan: route
yang berhak merender dengan judul dan konten, route asing dialihkan ke dashboard role,
tamu yang mengetik hash admin/guru/murid selalu mendarat di `#/login`, `#/login` saat sudah
login dialihkan, rute tak dikenal menampilkan "Halaman tidak ditemukan", parameter tidak
valid menampilkan halaman "tidak tersedia", dan tombol Back/Forward menjaga shell utuh.

**Rendering aman** - payload `<img src=x onerror>`, `<script>`, `<b>`, dan `<svg onload>`
disisipkan ke nama akun, kritik, saran, catatan moderasi, dan detail laporan. Hasil pada
13 halaman + modal: 0 elemen tersuntik, 0 atribut event, 0 URL `javascript:`, tidak ada
`window.__XSS` terpicu. Teks payload tampil apa adanya.

**Penyimpanan** - 5 jalur kegagalan (`submitFeedback`, `applyModeration`, `createReport`,
`createAccount`, `createTeacherProfile`) disimulasikan dengan membuat `save*` mengembalikan
`false`: semuanya mengembalikan `ok: false` dengan pesan jelas, tidak ada notifikasi sukses
palsu, dan tidak ada penulisan parsial. Seed tidak menimpa (7/7 key `written: false`).
Reload mempertahankan data byte-identik.

**Migrasi** - `migrateToCurrentSchema()` dijalankan berulang pada skema v2: tidak mengubah
apa pun. Fixture v1 (`published`/`text`/`reviewed`/`publish`) dipetakan ke
`approved`/`kritik`/`resolved`/`approve`; `id`, `studentId`, `teacherId`, `createdAt`, dan
`seededAt` lama dipertahankan; dijalankan kedua kali tidak mengubah data (idempoten).

**Lighthouse** (dijalankan di `#/admin/accounts`): Accessibility **0.96**, Best Practices
**1.00**, SEO **1.00**.

**Bug yang ditemukan pada tahap 5**

1. *Gejala*: saat membuat akun Murid tanpa kelas, field "Kelas" tidak ditandai invalid;
   hanya alert umum yang tampil. *Penyebab*: `handleResult()` hanya menandai `className`
   saat mode edit (`if (errors.className && isEdit)`). *Perbaikan*: penandaan kelas
   dihapus syaratnya dan `aria-invalid` dipasang. *Pengujian ulang*: field ditandai
   invalid, pesan muncul di dekat field, isian lain tidak terhapus, dan submit ulang
   setelah kelas diisi berhasil membuat akun.
2. *Gejala*: penghitung karakter hilang permanen pada field yang bermasalah.
   *Penyebab*: `mark()` membangun ulang isi field tanpa menyimpan ulang node counter.
   *Perbaikan*: counter dipertahankan dan dipulihkan ketika error sudah beres.
   *Catatan*: sebagian perilaku ini memang disengaja - ketika sebuah field bererror,
   pesan error menggantikan hint/counter, sama seperti `field()` di `ui.js`. Yang
   diperbaiki adalah counter yang hilang padahal field-nya sudah tidak lagi error.
3. *Gejala (Lighthouse)*: inisial avatar putih di atas brand blue 3.40:1 dan badge brand
   4.39:1. *Penyebab*: `--brand-blue` dan `--primary` dipakai sebagai warna teks kecil di
   atas latar terang. *Perbaikan*: memakai token yang sudah ada --
   `avatar` memakai `--primary` (5.01:1), `.badge--brand` dan `.nav-item.is-active`
   memakai `--primary-hover` (6.25:1). Tidak ada token baru dan tidak ada redesign.

### 11.5 Perbaikan kontras teks muted (tahap 6)

Temuan pada 11.4 (kontras 4.41:1 di 11 node) kemudian diperbaiki sebagai pekerjaan
terpisah. Satu-satunya perubahan: nilai token teks muted di `assets/css/tokens.css`.

| Token | Sebelum | Sesudah |
| --- | --- | --- |
| `--text-muted` | `#667780` | `#5F6F77` |

Warna brand utama (`--brand-blue #2596be`, `--brand-yellow #f6f023`,
`--brand-ivory #faf9f6`) serta token lain tidak diubah, dan tidak ada perubahan pada
layout, tipografi, komponen, router, autentikasi, maupun struktur data.

Rasio kontras yang benar-benar diverifikasi setelah perubahan (dihitung dari computed
style nyata di browser, termasuk latar efektif yang diwarisi elemen):

| Kombinasi foreground / background | Rasio | Status |
| --- | --- | --- |
| muted di ivory `#FAF9F6` (halaman, `th`, header, footer sidebar) | **4.95:1** | AA |
| muted di putih `#FFFFFF` (kartu, modal, sidebar, toast) | **5.22:1** | AA |
| muted di `neutral-soft #F1F0EC` (`.badge` dasar, `.btn-link:hover`) | **4.57:1** | AA |
| muted di `primary-soft #E8F2F7` | **4.59:1** | AA |
| muted di `brand-blue-soft #E6F2F8` | **4.57:1** | AA |
| muted di `warning/success/danger-soft` | 4.56-4.71:1 | AA |

Ketiga belas node yang sebelumnya gagal (7 `th`, `.page__description`,
`.toolbar__count`, `.header-identity__role`, `.sidebar-footer__label`) kini semuanya
**4.95:1**. Audit menyeluruh atas 13 route ketiga role menemukan **288 elemen**
berwarna muted dengan **0 kegagalan**; rasio terendah yang ditemukan 4.57:1.

Lighthouse dijalankan ulang pada halaman yang sama dengan audit sebelumnya
(`#/admin/accounts`): Accessibility **1.00** (sebelumnya 0.96), Best Practices **1.00**,
SEO **1.00**, tanpa kegagalan yang tersisa.

### 11.6 Yang belum diverifikasi

- Perilaku visual `prefers-reduced-motion` tidak dapat dipicu di lingkungan uji ini;
  hanya keberadaan aturan CSS-nya yang diperiksa (2 blok `@media (prefers-reduced-motion: reduce)`).
- Perangkat sentuh asli, browser lama/terinstall lawas, dan mode privat/inkognito.
- Perilaku lintas browser untuk `Intl.DateTimeFormat` dengan locale `id-ID` di mesin tanpa
  data locale.
- Beban data nyata (hundreds of feedback) - optimasi daftar panjang dan pagination
  memang di luar scope tahap ini.
