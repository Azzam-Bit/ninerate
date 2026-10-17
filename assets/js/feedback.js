/**
 * NineRate — feedback.js
 *
 * Modul domain untuk fitur Murid (tahap 2): validasi, pengiriman/pengeditan
 * feedback, transisi status, pelaporan, dan perhitungan statistik rating.
 *
 * Modul ini TIDAK menyentuh LocalStorage secara langsung; seluruh akses data
 * melewati storage.js. Tidak ada eval dan tidak ada string HTML dari input
 * pengguna di sini.
 */

import {
  LIMITS,
  ACTIVE_REPORT_STATUSES,
  storage,
} from './storage.js';

export const RATING_LABELS = {
  1: 'Sangat perlu perbaikan',
  2: 'Perlu perbaikan',
  3: 'Cukup',
  4: 'Baik',
  5: 'Sangat baik',
};

export const REPORT_REASONS = [
  { value: 'penghinaan-pelecenan', label: 'Penghinaan atau pelecehan' },
  { value: 'penyebaran-informasi-pribadi', label: 'Penyebaran informasi pribadi' },
  { value: 'konten-tidak-relevan', label: 'Konten tidak relevan' },
  { value: 'lainnya', label: 'Lainnya' },
];

export const REPORT_REASON_LABELS = REPORT_REASONS.reduce((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {});

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function trimText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix) {
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}

/** Guru yang boleh dinilai murid: profil valid + akun guru aktif. */
export function listRateableTeachers() {
  const users = new Map(storage.getUsers().map((user) => [user.id, user]));

  return storage
    .getTeacherProfiles()
    .map((profile) => {
      const account = users.get(profile.userId) || null;
      const accountActive = Boolean(account && account.active && account.role === 'teacher');
      const profileValid = Boolean(profile.id && profile.userId);
      return {
        profile,
        account,
        fullName: (account && account.fullName) || 'Nama guru belum tersedia',
        rateable: profileValid && accountActive,
      };
    })
    .filter((item) => item.rateable)
    .sort((a, b) => a.fullName.localeCompare(b.fullName, 'id', { sensitivity: 'base' }));
}

/* ------------------------------------------------------------------ */
/* Validasi                                                            */
/* ------------------------------------------------------------------ */

/**
 * Validasi input form rating + kritik/saran.
 * Rating harus integer 1-5; kritik atau saran minimal salah satu terisi;
 * masing-masing maksimal sesuai LIMITS.
 * @returns {{valid: boolean, errors: object, value: object}}
 */
export function validateFeedbackInput({ rating, kritik, saran }) {
  const errors = {};

  const rawRating = typeof rating === 'number' ? rating : Number(String(rating ?? '').trim());
  let parsedRating = NaN;
  if (typeof rawRating === 'number' && Number.isFinite(rawRating)) {
    if (!Number.isInteger(rawRating)) {
      errors.rating = 'Rating harus berupa bilangan bulat 1 sampai 5.';
    } else if (rawRating < LIMITS.ratingMin || rawRating > LIMITS.ratingMax) {
      errors.rating = `Rating harus antara ${LIMITS.ratingMin} sampai ${LIMITS.ratingMax}.`;
    } else {
      parsedRating = rawRating;
    }
  } else {
    errors.rating = 'Rating wajib dipilih.';
  }

  const cleanKritik = trimText(kritik);
  const cleanSaran = trimText(saran);

  if (cleanKritik.length > LIMITS.kritik) {
    errors.kritik = `Kritik maksimal ${LIMITS.kritik} karakter (sekarang ${cleanKritik.length}).`;
  }
  if (cleanSaran.length > LIMITS.saran) {
    errors.saran = `Saran maksimal ${LIMITS.saran} karakter (sekarang ${cleanSaran.length}).`;
  }
  if (!cleanKritik && !cleanSaran) {
    errors.kritik = 'Isi kritik atau saran minimal salah satu.';
    errors.saran = 'Isi kritik atau saran minimal salah satu.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    value: {
      rating: parsedRating,
      kritik: cleanKritik.slice(0, LIMITS.kritik),
      saran: cleanSaran.slice(0, LIMITS.saran),
    },
  };
}

/** Validasi form laporan. */
export function validateReportInput({ reason, detail }) {
  const errors = {};
  const cleanReason = trimText(reason);
  const cleanDetail = trimText(detail);

  const knownReason = REPORT_REASONS.some((item) => item.value === cleanReason);
  if (!cleanReason) {
    errors.reason = 'Alasan laporan wajib dipilih.';
  } else if (!knownReason) {
    errors.reason = 'Alasan laporan tidak dikenali.';
  }

  if (cleanDetail.length > LIMITS.reportDetail) {
    errors.detail = `Detail maksimal ${LIMITS.reportDetail} karakter (sekarang ${cleanDetail.length}).`;
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    value: {
      reason: cleanReason,
      detail: cleanDetail.slice(0, LIMITS.reportDetail),
    },
  };
}

/* ------------------------------------------------------------------ */
/* Pembacaan data                                                      */
/* ------------------------------------------------------------------ */

/** Satu pasangan murid + guru hanya boleh punya satu record. */
export function getFeedbackByPair(studentId, teacherId) {
  return (
    storage
      .getFeedback()
      .find((item) => item.studentId === studentId && item.teacherId === teacherId) || null
  );
}

export function getStudentFeedback(studentId) {
  return storage.getFeedbackByStudent(studentId);
}

export function sortFeedbackByLatest(items) {
  return [...items].sort((a, b) => {
    const aDate = String(a.updatedAt || a.createdAt || '');
    const bDate = String(b.updatedAt || b.createdAt || '');
    if (aDate === bDate) return String(a.id).localeCompare(String(b.id));
    return bDate.localeCompare(aDate);
  });
}

/** Hanya status approved yang boleh tampil di profil publik. */
export function getApprovedFeedback(teacherId) {
  return storage.getFeedbackByTeacher(teacherId).filter((item) => item.status === 'approved');
}

/**
 * Statistik rating dari record feedback approved milik guru.
 * Rata-rata = jumlah rating / jumlah feedback approved (1 angka desimal).
 * Tidak menyimpan rata-rata di profil guru.
 */
export function computeRatingStats(teacherId) {
  const approved = getApprovedFeedback(teacherId);
  const count = approved.length;

  const distribution = [1, 2, 3, 4, 5].map((rating) => ({
    rating,
    count: approved.filter((item) => Number(item.rating) === rating).length,
    percent: 0,
  }));

  if (count === 0) {
    return {
      count: 0,
      average: null,
      averageLabel: 'Belum ada penilaian',
      distribution,
      hasRatings: false,
    };
  }

  const total = approved.reduce((sum, item) => sum + (Number(item.rating) || 0), 0);
  const average = Math.round((total / count) * 10) / 10;

  const withPercent = distribution.map((entry) => ({
    ...entry,
    // count > 0 dijamin di cabang ini, jadi tidak ada pembagian dengan nol.
    percent: Math.round((entry.count / count) * 100),
  }));

  return {
    count,
    average,
    averageLabel: average.toFixed(1),
    distribution: withPercent,
    hasRatings: true,
  };
}

/* ------------------------------------------------------------------ */
/* Status & aksi                                                       */
/* ------------------------------------------------------------------ */

/** Label status laporan untuk pesan ringkas di UI. */
export const REPORT_STATUS_META = {
  open: { label: 'Terbuka' },
  in_review: { label: 'Ditinjau admin' },
  resolved: { label: 'Selesai ditinjau' },
};

export const STATUS_INFO = {
  pending: {
    label: 'Menunggu moderasi',
    variant: 'pending',
    studentHint: 'Feedback Anda sedang ditinjau admin dan belum tampil publik.',
    actionLabel: 'Edit & ajukan ulang',
  },
  approved: {
    label: 'Disetujui',
    variant: 'approved',
    studentHint: 'Feedback Anda sudah disetujui dan tampil di profil guru.',
    actionLabel: 'Edit',
  },
  rejected: {
    label: 'Ditolak',
    variant: 'rejected',
    studentHint: 'Feedback Anda ditolak admin. Perbaiki lalu ajukan ulang.',
    actionLabel: 'Perbaiki & ajukan ulang',
  },
  hidden: {
    label: 'Disembunyikan',
    variant: 'hidden',
    studentHint: 'Feedback Anda disembunyikan admin. Perbaiki lalu ajukan ulang.',
    actionLabel: 'Perbaiki & ajukan ulang',
  },
};

/** Semua status mengizinkan murid memperbaiki/mengirim ulang feedback-nya. */
export function canEditFeedback(feedback) {
  return Boolean(feedback && Object.keys(STATUS_INFO).includes(feedback.status));
}

/**
 * Alasan keputusan yang SEDANG berlaku saja (bukan riwayat lama).
 * Catatan lama tidak ditampilkan seolah-olah keputusan terbaru.
 */
export function currentModerationNote(feedback) {
  if (!feedback) return '';
  if (feedback.moderationStatus !== feedback.status) return '';
  if (feedback.status === 'approved') return '';
  return typeof feedback.moderationNote === 'string' ? feedback.moderationNote : '';
}

export function moderationHistoryOf(feedback) {
  if (!feedback || !Array.isArray(feedback.moderationHistory)) return [];
  return feedback.moderationHistory;
}

/* ------------------------------------------------------------------ */
/* Penyimpanan / pengiriman                                            */
/* ------------------------------------------------------------------ */

function appendLog(feedbackId, actorId, action, note) {
  const logs = storage.getModerationLogs();
  logs.push({
    id: makeId('mod'),
    feedbackId,
    actorId,
    action,
    note: note || '',
    createdAt: nowIso(),
  });
  storage.saveModerationLogs(logs);
}

/**
 * Membuat ATAU memperbarui feedback murid untuk satu pasangan murid + guru.
 * - Belum ada record  -> record baru, status pending.
 * - Sudah ada record  -> ID, studentId, teacherId, createdAt dipertahankan;
 *                        rating/kritik/saran diperbarui; status kembali pending
 *                        sehingga keluar dari daftar publik & statistik.
 * Validasi dijalankan ulang di sini (bukan hanya di UI).
 */
export function submitFeedback({ studentId, teacherId, rating, kritik, saran }) {
  if (!studentId || !teacherId) {
    return { ok: false, message: 'Data murid atau guru tidak valid.', feedback: null };
  }

  const teacher = storage.getTeacherProfileById(teacherId);
  if (!teacher) {
    return { ok: false, message: 'Profil guru tidak ditemukan.', feedback: null };
  }
  const teacherAccount = storage.findUserById(teacher.userId);
  if (!teacherAccount || !teacherAccount.active) {
    return { ok: false, message: 'Guru ini sedang nonaktif sehingga belum bisa dinilai.', feedback: null };
  }

  const result = validateFeedbackInput({ rating, kritik, saran });
  if (!result.valid) {
    return {
      ok: false,
      message: 'Periksa kembali isian yang ditandai.',
      errors: result.errors,
      feedback: null,
    };
  }

  const all = storage.getFeedback();
  const existing = all.find(
    (item) => item.studentId === studentId && item.teacherId === teacherId,
  ) || null;

  const timestamp = nowIso();
  let record;

  if (existing) {
    const history = Array.isArray(existing.moderationHistory)
      ? [...existing.moderationHistory]
      : [];

    /* Keputusan lama dipindah ke riwayat, tidak dihapus. */
    if (existing.moderationNote || existing.status !== 'pending') {
      history.push({
        status: existing.status,
        note: existing.moderationNote || '',
        by: existing.moderatedBy || '',
        at: existing.moderatedAt || existing.updatedAt || existing.createdAt,
      });
    }

    record = {
      ...existing,
      rating: result.value.rating,
      kritik: result.value.kritik,
      saran: result.value.saran,
      status: 'pending',
      updatedAt: timestamp,
      submittedAt: timestamp,
      moderationStatus: 'pending',
      moderatedBy: '',
      moderatedAt: '',
      moderationNote: '',
      moderationHistory: history.slice(-20),
    };
  } else {
    record = {
      id: makeId('fb'),
      teacherId,
      studentId,
      status: 'pending',
      rating: result.value.rating,
      kritik: result.value.kritik,
      saran: result.value.saran,
      createdAt: timestamp,
      updatedAt: timestamp,
      submittedAt: timestamp,
      moderationStatus: 'pending',
      moderatedBy: '',
      moderatedAt: '',
      moderationNote: '',
      moderationHistory: [],
    };
  }

  const nextList = existing
    ? all.map((item) => (item.id === existing.id ? record : item))
    : [...all, record];

  if (!storage.saveFeedback(nextList)) {
    return { ok: false, message: 'Gagal menyimpan feedback ke penyimpanan browser.', feedback: null };
  }

  appendLog(record.id, studentId, 'submit', existing ? 'Feedback diperbarui murid.' : 'Feedback baru dikirim murid.');

  return {
    ok: true,
    created: !existing,
    feedback: record,
    message: existing
      ? 'Feedback diperbarui dan menunggu moderasi admin.'
      : 'Feedback terkirim dan menunggu moderasi admin.',
  };
}

/* ------------------------------------------------------------------ */
/* Pelaporan                                                           */
/* ------------------------------------------------------------------ */

/** Laporan aktif = status open atau in_review. */
export function isActiveReport(report) {
  return Boolean(report) && ACTIVE_REPORT_STATUSES.includes(report.status);
}

export function getActiveReportFor(feedbackId, reporterId) {
  return (
    storage
      .getReports()
      .find(
        (report) =>
          report.feedbackId === feedbackId &&
          report.reporterId === reporterId &&
          isActiveReport(report),
      ) || null
  );
}

/**
 * Cakupan visibilitas pelapor.
 * - student: seluruh profil publik (dipakai halaman Murid).
 * - teacher: HANYA profil guru miliknya sendiri, ditentukan dari session.
 * - admin  : tidak memakai jalur ini pada tahap sekarang.
 * Tidak ada parameter teacherId dari UI; nilai ini berasal dari session.
 */
export function resolveReporterScope(user, teacherProfileId = '') {
  if (!user) return { role: '', teacherProfileId: '' };
  return {
    role: user.role,
    teacherProfileId: user.role === 'teacher' ? teacherProfileId : '',
  };
}

/**
 * Feedback yang boleh dilaporkan:
 * status approved, terlihat oleh pelapor, bukan milik pelapor sendiri, dan
 * belum ada laporan aktif dari akun yang sama.
 *
 * Scope bersifat opsional agar pemanggil lama (halaman Murid) tetap bekerja;
 * passing scope hanya menambah pembatasan, tidak pernah melonggarkan.
 */
export function checkReportable(feedback, reporterId, scope = null) {
  if (!feedback) {
    return { ok: false, code: 'missing', message: 'Feedback tidak ditemukan.' };
  }
  if (feedback.status !== 'approved') {
    return { ok: false, code: 'not-public', message: 'Hanya feedback yang sudah disetujui yang dapat dilaporkan.' };
  }
  if (feedback.studentId === reporterId) {
    return { ok: false, code: 'own', message: 'Anda tidak dapat melaporkan feedback milik sendiri.' };
  }

  /* Guru hanya boleh melaporkan feedback yang tampil di halamannya sendiri. */
  if (scope && scope.role === 'teacher') {
    if (!scope.teacherProfileId) {
      return {
        ok: false,
        code: 'no-profile',
        message: 'Profil guru tidak ditemukan pada akun ini sehingga laporan tidak dapat dikirim.',
      };
    }
    if (feedback.teacherId !== scope.teacherProfileId) {
      return {
        ok: false,
        code: 'out-of-scope',
        message: 'Anda hanya dapat melaporkan feedback yang terlihat pada halaman Feedback untuk Saya.',
      };
    }
  }

  if (getActiveReportFor(feedback.id, reporterId)) {
    return {
      ok: false,
      code: 'duplicate',
      message: 'Anda sudah melaporkan feedback ini dan laporannya masih diproses admin.',
    };
  }
  return { ok: true, code: 'ok', message: '' };
}

/**
 * Membuat record laporan baru pada ninerate_reports_v1 lewat storage.js.
 * Mengirim laporan tidak mengubah status feedback.
 * `scope` opsional (lihat resolveReporterScope) untuk membatasi cakupan Guru.
 */
export function createReport({ feedbackId, reporterId, reason, detail, scope = null }) {
  const feedback = storage.getFeedbackById(feedbackId);
  const check = checkReportable(feedback, reporterId, scope);
  if (!check.ok) {
    return { ok: false, message: check.message, code: check.code, report: null };
  }

  const result = validateReportInput({ reason, detail });
  if (!result.valid) {
    return {
      ok: false,
      message: 'Periksa kembali isian laporan yang ditandai.',
      errors: result.errors,
      report: null,
    };
  }

  const reports = storage.getReports();
  const record = {
    id: makeId('rep'),
    feedbackId: feedback.id,
    reporterId,
    reason: result.value.reason,
    detail: result.value.detail,
    status: 'open',
    createdAt: nowIso(),
    updatedAt: nowIso(),
    handledBy: '',
    handledAt: '',
  };

  if (!storage.saveReports([...reports, record])) {
    return { ok: false, message: 'Gagal menyimpan laporan ke penyimpanan browser.', report: null };
  }

  const actorLabel = scope && scope.role === 'teacher' ? 'guru' : 'murid';
  appendLog(feedback.id, reporterId, 'report', `Laporan dibuat ${actorLabel}.`);

  return {
    ok: true,
    report: record,
    message: 'Laporan terkirim dan masuk antrean admin. Feedback belum otomatis disembunyikan.',
  };
}