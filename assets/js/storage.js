/**
 * NineRate — storage.js
 *
 * SATU-SATUNYA modul yang boleh mengakses window.localStorage secara langsung.
 * Semua modul lain harus memakai API di bawah, bukan localStorage langsung.
 *
 * Catatan keamanan: data demo ini hanya simulasi lokal di browser.
 * LocalStorage dapat dibaca/diubah pengguna melalui DevTools, sehingga
 * ini BUKAN mekanisme autentikasi yang aman untuk penggunaan nyata.
 */

export const STORAGE_KEYS = {
  users: 'ninerate_users_v1',
  teacherProfiles: 'ninerate_teacher_profiles_v1',
  feedback: 'ninerate_feedback_v1',
  reports: 'ninerate_reports_v1',
  moderationLogs: 'ninerate_moderation_logs_v1',
  session: 'ninerate_session_v1',
  meta: 'ninerate_meta_v1',
};

/** Lokasi logo sekolah yang ditemukan saat audit (dipakai oleh seed/app). */
export const SCHOOL_LOGO_PATH = 'assets/Logo_SMKN_9-removebg-preview.png';

export const SCHEMA_VERSION = 2;

/** Versi skema sebelum model kritik/saran + status approved/rejected diperkenalkan. */
export const LEGACY_SCHEMA_VERSION = 1;

export const ROLES = ['admin', 'teacher', 'student'];

export const FEEDBACK_STATUSES = ['pending', 'approved', 'rejected', 'hidden'];

/** Status yang masih aktif (belum selesai ditinjau admin). */
export const ACTIVE_REPORT_STATUSES = ['open', 'in_review'];

export const REPORT_STATUSES = ['open', 'in_review', 'resolved'];

export const MODERATION_ACTIONS = ['submit', 'approve', 'reject', 'hide', 'restore', 'report', 'note'];

/** Batas panjang field domain (divalidasi lagi di modul feedback.js). */
export const LIMITS = {
  kritik: 500,
  saran: 500,
  reportReason: 120,
  reportDetail: 300,
  ratingMin: 1,
  ratingMax: 5,
  /* Field yang dikelola Admin */
  fullName: 120,
  username: 60,
  password: 120,
  moderationNote: 300,
  subject: 80,
  className: 40,
  nip: 40,
  bio: 400,
  reportNote: 300,
};

/* ------------------------------------------------------------------ */
/* Primitive helpers                                                   */
/* ------------------------------------------------------------------ */

let memoryFallback = null;

function getStore() {
  try {
    const probe = '__ninerate_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch (error) {
    // Private mode / storage diblokir: aplikasi tetap jalan di memori saja.
    if (!memoryFallback) memoryFallback = new Map();
    return {
      getItem: (key) => (memoryFallback.has(key) ? memoryFallback.get(key) : null),
      setItem: (key, value) => memoryFallback.set(key, value),
      removeItem: (key) => memoryFallback.delete(key),
    };
  }
}

function readRaw(key) {
  try {
    return getStore().getItem(key);
  } catch (error) {
    return null;
  }
}

function writeRaw(key, value) {
  try {
    getStore().setItem(key, value);
    return true;
  } catch (error) {
    return false;
  }
}

function removeRaw(key) {
  try {
    getStore().removeItem(key);
    return true;
  } catch (error) {
    return false;
  }
}

function parseJson(raw, fallback) {
  if (typeof raw !== 'string' || raw.trim() === '') return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed === null || parsed === undefined ? fallback : parsed;
  } catch (error) {
    console.warn(`[NineRate] Data pada key rusak dan diabaikan: ${raw.slice(0, 80)}`);
    return fallback;
  }
}

/** True bila key sudah pernah tersimpan (dipakai seed agar data tidak ditimpa). */
export function hasKey(key) {
  return readRaw(key) !== null;
}

export function readList(key) {
  const value = parseJson(readRaw(key), []);
  return Array.isArray(value) ? value : [];
}

export function writeList(key, items) {
  const safeItems = Array.isArray(items) ? items : [];
  return writeRaw(key, JSON.stringify(safeItems));
}

/* ------------------------------------------------------------------ */
/* Sanitizer — validasi struktur data yang dibaca dari LocalStorage     */
/* ------------------------------------------------------------------ */

function str(value, maxLength = 2000) {
  return typeof value === 'string' ? value.slice(0, maxLength) : '';
}

function id(value) {
  return str(value, 80).trim();
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizeUser(raw) {
  if (!isPlainObject(raw)) return null;
  const userId = id(raw.id);
  const username = str(raw.username, 60).trim();
  const role = ROLES.includes(raw.role) ? raw.role : null;
  if (!userId || !username || !role) return null;

  return {
    id: userId,
    username,
    // Plaintext HANYA untuk prototype lokal. Lihat catatan di atas.
    password: str(raw.password, 120),
    role,
    fullName: str(raw.fullName, 120),
    /* Kelas hanya relevan untuk Murid; Guru menyimpan kelas di teacher profile. */
    className: str(raw.className, 40),
    active: typeof raw.active === 'boolean' ? raw.active : true,
    createdAt: str(raw.createdAt, 40),
    lastLoginAt: str(raw.lastLoginAt, 40),
  };
}

function sanitizeTeacherProfile(raw) {
  if (!isPlainObject(raw)) return null;
  const profileId = id(raw.id);
  const userId = id(raw.userId);
  if (!profileId || !userId) return null;

  return {
    id: profileId,
    userId,
    nip: str(raw.nip, 40),
    subject: str(raw.subject, 80),
    className: str(raw.className, 80),
    bio: str(raw.bio, 400),
    updatedAt: str(raw.updatedAt, 40),
  };
}

function sanitizeFeedback(raw) {
  if (!isPlainObject(raw)) return null;
  const feedbackId = id(raw.id);
  const teacherId = id(raw.teacherId);
  const studentId = id(raw.studentId);
  const status = FEEDBACK_STATUSES.includes(raw.status) ? raw.status : 'pending';
  if (!feedbackId || !teacherId || !studentId) return null;

  const ratingNumber = Number(raw.rating);
  const rating = Number.isFinite(ratingNumber) ? Math.round(ratingNumber) : 3;
  const createdAt = str(raw.createdAt, 40);

  return {
    id: feedbackId,
    teacherId,
    studentId,
    status,
    rating: Math.min(LIMITS.ratingMax, Math.max(LIMITS.ratingMin, rating)),
    kritik: str(raw.kritik, LIMITS.kritik),
    saran: str(raw.saran, LIMITS.saran),
    createdAt,
    updatedAt: str(raw.updatedAt, 40) || createdAt,
    submittedAt: str(raw.submittedAt, 40) || createdAt,
    /** Keputusan moderasi TERAKHIR yang berlaku untuk status saat ini. */
    moderationStatus: FEEDBACK_STATUSES.includes(raw.moderationStatus)
      ? raw.moderationStatus
      : status,
    moderatedBy: str(raw.moderatedBy, 80),
    moderatedAt: str(raw.moderatedAt, 40),
    moderationNote: str(raw.moderationNote, 300),
    /** Riwayat keputusan sebelumnya; tidak pernah dihapus. */
    moderationHistory: Array.isArray(raw.moderationHistory)
      ? raw.moderationHistory
          .map((entry) => sanitizeHistoryEntry(entry))
          .filter(Boolean)
          .slice(-20)
      : [],
  };
}

function sanitizeHistoryEntry(raw) {
  if (!isPlainObject(raw)) return null;
  return {
    status: FEEDBACK_STATUSES.includes(raw.status) ? raw.status : 'pending',
    note: str(raw.note, 300),
    by: str(raw.by, 80),
    at: str(raw.at, 40),
  };
}

function sanitizeReport(raw) {
  if (!isPlainObject(raw)) return null;
  const reportId = id(raw.id);
  const createdAt = str(raw.createdAt, 40);
  if (!reportId || !id(raw.feedbackId) || !id(raw.reporterId)) return null;

  return {
    id: reportId,
    feedbackId: id(raw.feedbackId),
    reporterId: id(raw.reporterId),
    reason: str(raw.reason, LIMITS.reportReason),
    detail: str(raw.detail, LIMITS.reportDetail),
    status: REPORT_STATUSES.includes(raw.status) ? raw.status : 'open',
    createdAt,
    updatedAt: str(raw.updatedAt, 40) || createdAt,
    handledBy: str(raw.handledBy, 80) || str(raw.reviewedBy, 80),
    handledAt: str(raw.handledAt, 40) || str(raw.reviewedAt, 40),
    /* Catatan penyelesaian tidak hilang saat laporan dibuka kembali. */
    resolutionNote: str(raw.resolutionNote, LIMITS.reportNote),
    reopenedFrom: str(raw.reopenedFrom, 40),
  };
}

function sanitizeModerationLog(raw) {
  if (!isPlainObject(raw)) return null;
  const logId = id(raw.id);
  if (!logId || !id(raw.feedbackId) || !id(raw.actorId)) return null;

  return {
    id: logId,
    feedbackId: id(raw.feedbackId),
    actorId: id(raw.actorId),
    action: MODERATION_ACTIONS.includes(raw.action) ? raw.action : 'note',
    note: str(raw.note, 300),
    createdAt: str(raw.createdAt, 40),
  };
}

function sanitizeSession(raw) {
  if (!isPlainObject(raw)) return null;
  const userId = id(raw.userId);
  if (!userId) return null;

  return {
    userId,
    loginAt: str(raw.loginAt, 40),
  };
}

function sanitizeMeta(raw) {
  if (!isPlainObject(raw)) return null;

  return {
    schemaVersion: Number.isFinite(Number(raw.schemaVersion))
      ? Number(raw.schemaVersion)
      : SCHEMA_VERSION,
    appName: str(raw.appName, 60) || 'NineRate',
    tagline: str(raw.tagline, 120),
    seededAt: str(raw.seededAt, 40),
    lastMigrationAt: str(raw.lastMigrationAt, 40),
  };
}

function readSanitized(key, sanitizer) {
  return readList(key)
    .map(sanitizer)
    .filter((item) => item !== null);
}

/* ------------------------------------------------------------------ */
/* Public API                                                           */
/* ------------------------------------------------------------------ */

export const storage = {
  /* Users */
  getUsers() {
    return readSanitized(STORAGE_KEYS.users, sanitizeUser);
  },
  saveUsers(users) {
    return writeList(
      STORAGE_KEYS.users,
      users.map(sanitizeUser).filter(Boolean),
    );
  },
  findUserByUsername(username) {
    const target = str(username, 60).trim().toLowerCase();
    return this.getUsers().find((user) => user.username.toLowerCase() === target) || null;
  },
  findUserById(userId) {
    const target = id(userId);
    return this.getUsers().find((user) => user.id === target) || null;
  },
  updateUser(userId, patch) {
    const users = this.getUsers();
    const index = users.findIndex((user) => user.id === id(userId));
    if (index === -1) return null;
    users[index] = sanitizeUser({ ...users[index], ...patch });
    this.saveUsers(users);
    return users[index];
  },

  /* Teacher profiles */
  getTeacherProfiles() {
    return readSanitized(STORAGE_KEYS.teacherProfiles, sanitizeTeacherProfile);
  },
  saveTeacherProfiles(profiles) {
    return writeList(
      STORAGE_KEYS.teacherProfiles,
      profiles.map(sanitizeTeacherProfile).filter(Boolean),
    );
  },
  getTeacherProfileByUserId(userId) {
    const target = id(userId);
    return this.getTeacherProfiles().find((profile) => profile.userId === target) || null;
  },
  getTeacherProfileById(profileId) {
    const target = id(profileId);
    return this.getTeacherProfiles().find((profile) => profile.id === target) || null;
  },

  /* Feedback */
  getFeedback() {
    return readSanitized(STORAGE_KEYS.feedback, sanitizeFeedback);
  },
  saveFeedback(items) {
    return writeList(
      STORAGE_KEYS.feedback,
      items.map(sanitizeFeedback).filter(Boolean),
    );
  },
  getFeedbackById(feedbackId) {
    const target = id(feedbackId);
    return this.getFeedback().find((item) => item.id === target) || null;
  },
  getFeedbackByStudent(studentId) {
    const target = id(studentId);
    return this.getFeedback().filter((item) => item.studentId === target);
  },
  getFeedbackByTeacher(teacherId) {
    const target = id(teacherId);
    return this.getFeedback().filter((item) => item.teacherId === target);
  },

  /* Reports */
  getReports() {
    return readSanitized(STORAGE_KEYS.reports, sanitizeReport);
  },
  saveReports(items) {
    return writeList(
      STORAGE_KEYS.reports,
      items.map(sanitizeReport).filter(Boolean),
    );
  },

  /* Moderation logs */
  getModerationLogs() {
    return readSanitized(STORAGE_KEYS.moderationLogs, sanitizeModerationLog);
  },
  saveModerationLogs(items) {
    return writeList(
      STORAGE_KEYS.moderationLogs,
      items.map(sanitizeModerationLog).filter(Boolean),
    );
  },

  /* Session: hanya userId + waktu login, BUKAN salinan record pengguna. */
  getSession() {
    return sanitizeSession(parseJson(readRaw(STORAGE_KEYS.session), null));
  },
  saveSession(session) {
    const safe = sanitizeSession(session);
    if (!safe) return false;
    return writeRaw(STORAGE_KEYS.session, JSON.stringify(safe));
  },
  clearSession() {
    return removeRaw(STORAGE_KEYS.session);
  },

  /* Meta / versi skema */
  getMeta() {
    return sanitizeMeta(parseJson(readRaw(STORAGE_KEYS.meta), null));
  },
  saveMeta(meta) {
    const safe = sanitizeMeta(meta);
    if (!safe) return false;
    return writeRaw(STORAGE_KEYS.meta, JSON.stringify(safe));
  },

  /* Utilitas debugging manual (tidak dipanggil otomatis) */
  removeKey(key) {
    return removeRaw(key);
  },
};

export { sanitizeUser, sanitizeTeacherProfile, sanitizeFeedback, str as sanitizeString };