/**
 * NineRate — seed.js
 *
 * Data awal demo yang fiktif dan netral, plus migrasi skema non-destruktif.
 *
 * Aturan penting:
 * 1. Setiap key hanya ditulis bila key tersebut BELUM ADA. Tidak ada reset otomatis.
 * 2. Migrasi v1 -> v2 berjalan SATU KALI, hanya bila meta menyatakan schemaVersion < 2.
 *    Data lama dipetakan ke model baru tanpa menghapus record.
 */

import {
  STORAGE_KEYS,
  SCHEMA_VERSION,
  LEGACY_SCHEMA_VERSION,
  LIMITS,
  storage,
  hasKey,
  readList,
  writeList,
} from './storage.js';

function isoDate(daysAgo, hour = 8) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, 15, 0, 0);
  return date.toISOString();
}

function nowIso() {
  return new Date().toISOString();
}

function str(value, maxLength) {
  return typeof value === 'string' ? value.slice(0, maxLength) : '';
}

/** Hanya menulis satu key bila key itu memang belum pernah tersimpan. */
function seedKeyIfMissing(key, items, writer) {
  if (hasKey(key)) return false;
  writer(items);
  return true;
}

/* ------------------------------------------------------------------ */
/* Migrasi skema v1 -> v2 (non-destruktif, satu kali)                  */
/* ------------------------------------------------------------------ */

/** Memeta status lama ke model status tahap 2. */
function migrateFeedbackStatus(status) {
  if (status === 'published') return 'approved';
  if (status === 'hidden') return 'hidden';
  if (status === 'approved' || status === 'rejected' || status === 'pending') return status;
  return 'pending';
}

function migrateReportStatus(status) {
  if (status === 'reviewed') return 'resolved';
  if (status === 'in_review' || status === 'open' || status === 'resolved') return status;
  return 'open';
}

/**
 * Memindahkan data v1 (status published, field text/category) ke model v2
 * (status approved, kolom kritik/saran). ID, studentId, teacherId, createdAt
 * tetap dipertahankan.
 */
export function migrateToCurrentSchema() {
  const meta = storage.getMeta();
  if (!meta) return { migrated: false, reason: 'meta belum ada (data belum di-seed)' };
  if (Number(meta.schemaVersion) >= SCHEMA_VERSION) {
    return { migrated: false, reason: 'skema sudah versi saat ini' };
  }

  /* Feedback */
  const rawFeedback = readList(STORAGE_KEYS.feedback);
  if (rawFeedback.length > 0) {
    const migrated = rawFeedback
      .map((item) => {
        if (typeof item !== 'object' || item === null) return null;
        const status = migrateFeedbackStatus(item.status);
        const createdAt = str(item.createdAt, 40);
        const moderatedAt = str(item.moderatedAt, 40) || createdAt;

        const history = Array.isArray(item.moderationHistory)
          ? item.moderationHistory
          : [];
        const legacyNote = str(item.moderationNote, 300);
        const previousNote =
          status !== item.status && legacyNote
            ? [
                {
                  status: migrateFeedbackStatus(item.status),
                  note: legacyNote,
                  by: str(item.moderatedBy, 80),
                  at: moderatedAt,
                },
              ]
            : history;

        return {
          id: str(item.id, 80),
          teacherId: str(item.teacherId, 80),
          studentId: str(item.studentId, 80),
          status,
          rating: item.rating,
          kritik: str(item.kritik, LIMITS.kritik) || str(item.text, LIMITS.kritik),
          saran: str(item.saran, LIMITS.saran),
          createdAt,
          updatedAt: str(item.updatedAt, 40) || moderatedAt,
          submittedAt: str(item.submittedAt, 40) || createdAt,
          moderationStatus: status,
          moderatedBy: str(item.moderatedBy, 80),
          moderatedAt,
          moderationNote: status === item.status ? legacyNote : '',
          moderationHistory: previousNote,
        };
      })
      .filter((item) => item && item.id && item.teacherId && item.studentId);
    writeList(STORAGE_KEYS.feedback, migrated);
  }

  /* Bios data v1 yang pernah menyimpan salah ketik seed lama.
     Hanya string persis tersebut yang dikoreksi; bio lain dibiarkan. */
  const LEGACY_BIOS = {
    'Mengajar Matematika,Wirasawanah, dan Matematika Terapan sejak 2011.':
      'Mengajar Matematika dan Matematika Terapan sejak 2011.',
  };
  const rawProfiles = readList(STORAGE_KEYS.teacherProfiles);
  if (rawProfiles.length > 0) {
    writeList(
      STORAGE_KEYS.teacherProfiles,
      rawProfiles.map((item) => {
        if (typeof item !== 'object' || item === null) return item;
        const fixedBio = LEGACY_BIOS[item.bio];
        return fixedBio ? { ...item, bio: fixedBio } : item;
      }),
    );
  }

  /* Laporan */
  const rawReports = readList(STORAGE_KEYS.reports);
  if (rawReports.length > 0) {
    writeList(
      STORAGE_KEYS.reports,
      rawReports
        .map((item) => {
          if (typeof item !== 'object' || item === null) return null;
          const createdAt = str(item.createdAt, 40);
          return {
            id: str(item.id, 80),
            feedbackId: str(item.feedbackId, 80),
            reporterId: str(item.reporterId, 80),
            reason: str(item.reason, LIMITS.reportReason),
            detail: str(item.detail, LIMITS.reportDetail),
            status: migrateReportStatus(item.status),
            createdAt,
            updatedAt: str(item.updatedAt, 40) || createdAt,
            handledBy: str(item.handledBy, 80) || str(item.reviewedBy, 80),
            handledAt: str(item.handledAt, 40) || str(item.reviewedAt, 40) || '',
          };
        })
        .filter((item) => item && item.id && item.feedbackId && item.reporterId),
    );
  }

  /* Log moderasi: aksi 'publish' (v1) menjadi 'approve' (v2). */
  const rawLogs = readList(STORAGE_KEYS.moderationLogs);
  if (rawLogs.length > 0) {
    writeList(
      STORAGE_KEYS.moderationLogs,
      rawLogs.map((item) => {
        if (typeof item !== 'object' || item === null) return null;
        return {
          id: str(item.id, 80),
          feedbackId: str(item.feedbackId, 80),
          actorId: str(item.actorId, 80),
          action: item.action === 'publish' ? 'approve' : item.action,
          note: str(item.note, 300),
          createdAt: str(item.createdAt, 40),
        };
      }),
    );
  }

  storage.saveMeta({
    ...meta,
    schemaVersion: SCHEMA_VERSION,
    lastMigrationAt: nowIso(),
  });

  return { migrated: true, from: Number(meta.schemaVersion) || LEGACY_SCHEMA_VERSION, to: SCHEMA_VERSION };
}

/* ------------------------------------------------------------------ */
/* Data demo                                                           */
/* ------------------------------------------------------------------ */

export function seedUsers() {
  const users = [
    {
      id: 'usr-admin-01',
      username: 'admin',
      password: 'admin123',
      role: 'admin',
      fullName: 'Admin Sekolah',
      active: true,
      createdAt: isoDate(120),
      lastLoginAt: '',
    },
    {
      id: 'usr-guru-01',
      username: 'guru.andi',
      password: 'guru123',
      role: 'teacher',
      fullName: 'Andi Saputra, S.Pd.',
      active: true,
      createdAt: isoDate(110),
      lastLoginAt: '',
    },
    {
      id: 'usr-guru-02',
      username: 'guru.siti',
      password: 'guru123',
      role: 'teacher',
      fullName: 'Siti Rahmawati, S.Pd.',
      active: true,
      createdAt: isoDate(105),
      lastLoginAt: '',
    },
    {
      id: 'usr-guru-03',
      username: 'guru.budi',
      password: 'guru123',
      role: 'teacher',
      fullName: 'Budi Hartono, S.Kom.',
      active: true,
      createdAt: isoDate(98),
      lastLoginAt: '',
    },
    {
      id: 'usr-guru-04',
      username: 'guru.nina',
      password: 'guru123',
      role: 'teacher',
      fullName: 'Nur Aisyah, S.Pd.',
      active: false,
      createdAt: isoDate(80),
      lastLoginAt: '',
    },
    {
      id: 'usr-murid-01',
      username: 'murid.rizky',
      password: 'murid123',
      role: 'student',
      fullName: 'Rizky Fauzan',
      active: true,
      createdAt: isoDate(90),
      lastLoginAt: '',
    },
    {
      id: 'usr-murid-02',
      username: 'murid.dewi',
      password: 'murid123',
      role: 'student',
      fullName: 'Dewi Lestari',
      active: true,
      createdAt: isoDate(90),
      lastLoginAt: '',
    },
    {
      id: 'usr-murid-03',
      username: 'murid.ayub',
      password: 'murid123',
      role: 'student',
      fullName: 'Ayub Maulana',
      active: true,
      createdAt: isoDate(75),
      lastLoginAt: '',
    },
    {
      id: 'usr-murid-04',
      username: 'murid.tampal',
      password: 'murid123',
      role: 'student',
      fullName: 'Tampal (Akun Nonaktif)',
      active: false,
      createdAt: isoDate(70),
      lastLoginAt: '',
    },
  ];
  return seedKeyIfMissing(STORAGE_KEYS.users, users, (list) => storage.saveUsers(list));
}

export function seedTeacherProfiles() {
  const profiles = [
    {
      id: 'tprof-01',
      userId: 'usr-guru-01',
      nip: '198705122011011004',
      subject: 'Matematika',
      className: 'XII RPL-1',
      bio: 'Mengajar Matematika dan Matematika Terapan sejak 2011.',
      updatedAt: isoDate(20),
    },
    {
      id: 'tprof-02',
      userId: 'usr-guru-02',
      nip: '199003182015032002',
      subject: 'Bahasa Indonesia',
      className: 'XI AKL-2',
      bio: 'Fokus pada menulis dan literasi digital untuk siswa SMK.',
      updatedAt: isoDate(14),
    },
    {
      id: 'tprof-03',
      userId: 'usr-guru-03',
      nip: '199205072019031003',
      subject: 'Informatika',
      className: 'X RPL-2',
      bio: 'Mengajar dasar-dasar pemrograman dan jaringan komputer.',
      updatedAt: isoDate(9),
    },
    {
      id: 'tprof-04',
      userId: 'usr-guru-04',
      nip: '199410102020012004',
      subject: 'Seni Budaya',
      className: 'XI RPL-1',
      bio: 'Guru seni budaya (akun nonaktif, hanya untuk menguji filter direktori).',
      updatedAt: isoDate(30),
    },
  ];
  return seedKeyIfMissing(
    STORAGE_KEYS.teacherProfiles,
    profiles,
    (list) => storage.saveTeacherProfiles(list),
  );
}

export function seedFeedback() {
  const feedback = [
    {
      id: 'fb-001',
      teacherId: 'tprof-01',
      studentId: 'usr-murid-01',
      status: 'approved',
      rating: 5,
      kritik: 'Penjelasan soal cerita terasa runtut dan mudah dipahami.',
      saran: 'Bisa ditambah satu contoh soal cerita dari situation kelas.',
      createdAt: isoDate(21),
      updatedAt: isoDate(20),
      submittedAt: isoDate(21),
      moderationStatus: 'approved',
      moderatedBy: 'usr-admin-01',
      moderatedAt: isoDate(20),
      moderationNote: 'Feedback konstruktif, disetujui admin.',
      moderationHistory: [],
    },
    {
      id: 'fb-002',
      teacherId: 'tprof-01',
      studentId: 'usr-murid-02',
      status: 'pending',
      rating: 4,
      kritik: 'Contoh soal yang digunakan selalu sama sehingga kurang variatif.',
      saran: '',
      createdAt: isoDate(6),
      updatedAt: isoDate(6),
      submittedAt: isoDate(6),
      moderationStatus: 'pending',
      moderatedBy: '',
      moderatedAt: '',
      moderationNote: '',
      moderationHistory: [],
    },
    {
      id: 'fb-003',
      teacherId: 'tprof-02',
      studentId: 'usr-murid-01',
      status: 'approved',
      rating: 4,
      kritik: 'Umpan balik soal tugas sangat membantu saat memperbaiki draft.',
      saran: 'Contoh tulisan siswa bisa ditampilkan di depan kelas.',
      createdAt: isoDate(15),
      updatedAt: isoDate(14),
      submittedAt: isoDate(15),
      moderationStatus: 'approved',
      moderatedBy: 'usr-admin-01',
      moderatedAt: isoDate(14),
      moderationNote: 'Disetujui admin.',
      moderationHistory: [],
    },
    {
      id: 'fb-004',
      teacherId: 'tprof-03',
      studentId: 'usr-murid-03',
      status: 'pending',
      rating: 3,
      kritik: 'Materi pemrograman cukup sulit diikuti karena contoh kode belum pernah dijelaskan.',
      saran: 'Praktikum singkat di kelas akan membantu.',
      createdAt: isoDate(3),
      updatedAt: isoDate(3),
      submittedAt: isoDate(3),
      moderationStatus: 'pending',
      moderatedBy: '',
      moderatedAt: '',
      moderationNote: '',
      moderationHistory: [],
    },
    {
      id: 'fb-005',
      teacherId: 'tprof-03',
      studentId: 'usr-murid-02',
      status: 'rejected',
      rating: 2,
      kritik: 'Kelas terasa terlalu cepat sehingga sulit diikuti.',
      saran: 'Mohon pelan-pelan saat menjelaskan materi baru.',
      createdAt: isoDate(9),
      updatedAt: isoDate(8),
      submittedAt: isoDate(9),
      moderationStatus: 'rejected',
      moderatedBy: 'usr-admin-01',
      moderatedAt: isoDate(8),
      moderationNote: 'Kritik kurang spesifik. Tuliskan contoh konkret yang dimaksud.',
      moderationHistory: [],
    },
    {
      id: 'fb-006',
      teacherId: 'tprof-02',
      studentId: 'usr-murid-03',
      status: 'hidden',
      rating: 3,
      kritik: 'Umpan balik ini sedang diverifikasi karena kurang relevan.',
      saran: '',
      createdAt: isoDate(11),
      updatedAt: isoDate(10),
      submittedAt: isoDate(11),
      moderationStatus: 'hidden',
      moderatedBy: 'usr-admin-01',
      moderatedAt: isoDate(10),
      moderationNote: 'Disembunyikan sementara sambil diverifikasi.',
      moderationHistory: [],
    },
  ];
  return seedKeyIfMissing(STORAGE_KEYS.feedback, feedback, (list) => storage.saveFeedback(list));
}

export function seedReports() {
  const reports = [
    {
      id: 'rep-001',
      feedbackId: 'fb-006',
      reporterId: 'usr-murid-01',
      reason: 'penyebaran-informasi-pribadi',
      detail: 'Isi menyebut informasi pribadi yang tidak relevan.',
      status: 'open',
      createdAt: isoDate(7),
      updatedAt: isoDate(7),
      handledBy: '',
      handledAt: '',
    },
    {
      id: 'rep-002',
      feedbackId: 'fb-003',
      reporterId: 'usr-murid-02',
      reason: 'konten-tidak-relevan',
      detail: 'Perlu memastikan apakah kutipan ini milik akun yang benar.',
      status: 'resolved',
      createdAt: isoDate(13),
      updatedAt: isoDate(12),
      handledBy: 'usr-admin-01',
      handledAt: isoDate(12),
    },
  ];
  return seedKeyIfMissing(STORAGE_KEYS.reports, reports, (list) => storage.saveReports(list));
}

export function seedModerationLogs() {
  const logs = [
    {
      id: 'mod-001',
      feedbackId: 'fb-006',
      actorId: 'usr-admin-01',
      action: 'hide',
      note: 'Disembunyikan sementara sambil diverifikasi.',
      createdAt: isoDate(10),
    },
    {
      id: 'mod-002',
      feedbackId: 'fb-003',
      actorId: 'usr-admin-01',
      action: 'approve',
      note: 'Diterbitkan tanpa perubahan.',
      createdAt: isoDate(14),
    },
  ];
  return seedKeyIfMissing(
    STORAGE_KEYS.moderationLogs,
    logs,
    (list) => storage.saveModerationLogs(list),
  );
}

export function seedMeta() {
  if (hasKey(STORAGE_KEYS.meta)) return false;
  storage.saveMeta({
    schemaVersion: SCHEMA_VERSION,
    appName: 'NineRate',
    tagline: 'Better feedback. Better learning.',
    seededAt: nowIso(),
    lastMigrationAt: '',
  });
  return true;
}

/**
 * Inisialisasi data demo hanya bila belum tersedia, lalu jalankan migrasi
 * skema bila perlu. Tidak ada penimpaan maupun reset otomatis.
 */
export function ensureSeedData() {
  const written = {
    users: seedUsers(),
    teacherProfiles: seedTeacherProfiles(),
    feedback: seedFeedback(),
    reports: seedReports(),
    moderationLogs: seedModerationLogs(),
    meta: seedMeta(),
  };

  const migration = migrateToCurrentSchema();

  return {
    seeded: Object.values(written).some(Boolean),
    written,
    migration,
  };
}