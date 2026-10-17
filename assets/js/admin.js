/**
 * NineRate — admin.js
 *
 * Domain layer untuk fitur Admin: workflow moderasi, workflow laporan,
 * manajemen akun, dan manajemen profil guru.
 *
 * Aturan yang berlaku untuk modul ini:
 * - TIDAK menyentuh LocalStorage langsung; semua lewat storage.js.
 * - Setiap aksi sensitif memverifikasi role AKTOR dan status akun dari storage,
 *   bukan sekadar menyembunyikan tombol di UI.
 * - Tidak ada hard delete pada feedback, laporan, akun, atau profil.
 * - Password tidak pernah dikembalikan ke UI.
 */

import {
  FEEDBACK_STATUSES,
  LIMITS,
  REPORT_STATUSES,
  ROLES,
  storage,
} from './storage.js';

export const MODERATION_ACTIONS = ['approve', 'reject', 'hide', 'restore'];

/** Keterangan aksi moderasi: label UI, alasan wajib?, dan peran status asal. */
export const MODERATION_ACTION_INFO = {
  approve: {
    label: 'Setujui',
    variant: 'approved',
    reasonRequired: false,
    reasonLabel: 'Catatan (opsional)',
    hint: 'Feedback dipublikasikan dan rating masuk perhitungan statistik guru.',
    targetStatus: 'approved',
  },
  reject: {
    label: 'Tolak',
    variant: 'rejected',
    reasonRequired: true,
    reasonLabel: 'Alasan penolakan (wajib)',
    hint: 'Feedback tidak dipublikasikan dan rating tidak dihitung. Alasan tampil kepada penulis.',
    targetStatus: 'rejected',
  },
  hide: {
    label: 'Sembunyikan',
    variant: 'hidden',
    reasonRequired: true,
    reasonLabel: 'Alasan penyembunyian (wajib)',
    hint: 'Feedback ditarik dari profil publik dan langsung dikeluarkan dari statistik.',
    targetStatus: 'hidden',
  },
  restore: {
    label: 'Pulihkan',
    variant: 'approved',
    reasonRequired: false,
    reasonLabel: 'Catatan (opsional)',
    hint: 'Mengembalikan feedback tersembunyi ke Approved bila belum diubah penulis.',
    targetStatus: 'approved',
  },
};

function trimText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function isActiveAdmin(actor) {
  return Boolean(actor && actor.role === 'admin' && actor.active);
}

/** Penyimpanan log moderasi (jejak audit internal). */
function appendModerationLog(feedbackId, actorId, action, note) {
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

/* ------------------------------------------------------------------ */
/* Workflow moderasi                                                   */
/* ------------------------------------------------------------------ */

/**
 * Transisi status yang diizinkan.
 * Kontrak model data tahap 2: `status` adalah acuan visibilitas publik dan
 * perhitungan rating. `moderationStatus` mencerminkan keputusan admin TERAKHIR
 * yang berlaku. Keduanya tidak boleh berbeda setelah aksi Admin; keduanya
 * disinkronkan di applyModeration().
 */
export const ALLOWED_TRANSITIONS = {
  approve: ['pending', 'rejected'],
  reject: ['pending', 'approved'],
  hide: ['pending', 'approved'],
  restore: ['hidden'],
};

/**
 * Apakah aksi tertentu valid untuk feedback saat ini.
 * @returns {{ok: boolean, code?: string, message?: string}}
 */
export function checkModerationAllowed(action, feedback) {
  if (!MODERATION_ACTIONS.includes(action)) {
    return { ok: false, code: 'unknown-action', message: 'Aksi moderasi tidak dikenal.' };
  }
  if (!feedback) {
    return { ok: false, code: 'missing', message: 'Feedback tidak ditemukan.' };
  }
  if (!FEEDBACK_STATUSES.includes(feedback.status)) {
    return { ok: false, code: 'invalid-status', message: 'Status feedback tidak dikenali.' };
  }
  if (!ALLOWED_TRANSITIONS[action].includes(feedback.status)) {
    return { ok: false, code: 'invalid-transition', message: `Aksi ${action} tidak berlaku untuk status ${feedback.status}.` };
  }

  if (action === 'restore') {
    /* Restore hanya untuk feedback yang belum diubah penulis setelah disembunyikan.
       Bila penulis mengedit (updatedAt > moderatedAt) => status kembali pending,
       sehingga harus lewat approve biasa. */
    const moderatedAt = Date.parse(feedback.moderatedAt || '') || 0;
    const updatedAt = Date.parse(feedback.updatedAt || '') || 0;
    const editedAfterHide = updatedAt > moderatedAt && feedback.moderationStatus === 'hidden';
    if (editedAfterHide) {
      return {
        ok: false,
        code: 'edited-after-hide',
        message:
          'Konten feedback sudah diubah penulis setelah disembunyikan. Tinjau ulang dan gunakan Setujui bila layak.',
      };
    }
  }

  return { ok: true };
}

/** Validasi input aksi moderasi (termasuk alasan wajib). */
export function validateModerationInput({ action, note }) {
  const errors = {};
  const info = MODERATION_ACTION_INFO[action];

  if (!info) {
    errors.action = 'Aksi moderasi tidak dikenal.';
    return { valid: false, errors, note: '' };
  }

  const cleanNote = trimText(note);
  if (info.reasonRequired && !cleanNote) {
    errors.note = `${info.reasonLabel.replace(' (wajib)', '')} wajib diisi.`;
  }
  if (cleanNote.length > LIMITS.moderationNote) {
    errors.note = `Catatan maksimal ${LIMITS.moderationNote} karakter (sekarang ${cleanNote.length}).`;
  }

  return { valid: Object.keys(errors).length === 0, errors, note: cleanNote.slice(0, LIMITS.moderationNote) };
}

/**
 * Menerapkan satu tindakan moderasi.
 * Tidak mengubah rating, kritik, saran, studentId, atau teacherId.
 * Histori lama tidak dihapus; keputusan sebelumnya dipindahkan ke moderationHistory.
 */
export function applyModeration({ feedbackId, action, note, actor }) {
  if (!isActiveAdmin(actor)) {
    return { ok: false, code: 'forbidden', message: 'Hanya Admin aktif yang dapat melakukan moderasi.', feedback: null };
  }

  const all = storage.getFeedback();
  const existing = all.find((item) => item.id === feedbackId);
  if (!existing) {
    return { ok: false, code: 'missing', message: 'Feedback tidak ditemukan.', feedback: null };
  }

  const allowed = checkModerationAllowed(action, existing);
  if (!allowed.ok) {
    return { ok: false, code: allowed.code, message: allowed.message, feedback: null };
  }

  const validation = validateModerationInput({ action, note });
  if (!validation.valid) {
    return {
      ok: false,
      code: 'invalid-input',
      message: 'Periksa kembali isian yang ditandai.',
      errors: validation.errors,
      feedback: null,
    };
  }

  const info = MODERATION_ACTION_INFO[action];
  const timestamp = nowIso();
  const history = Array.isArray(existing.moderationHistory) ? [...existing.moderationHistory] : [];

  /* Keputusan yang sedang berlaku dipindahkan ke histori, tidak dihapus. */
  if (existing.status !== 'pending' || existing.moderationNote) {
    history.push({
      status: existing.status,
      note: existing.moderationNote || '',
      by: existing.moderatedBy || '',
      at: existing.moderatedAt || existing.updatedAt || existing.createdAt,
    });
  }

  const record = {
    ...existing,
    status: info.targetStatus,
    moderationStatus: info.targetStatus,
    moderationNote: validation.note,
    moderatedBy: actor.id,
    moderatedAt: timestamp,
    updatedAt: timestamp,
    moderationHistory: history.slice(-20),
  };

  if (!storage.saveFeedback(all.map((item) => (item.id === existing.id ? record : item)))) {
    return { ok: false, code: 'save-failed', message: 'Gagal menyimpan perubahan ke penyimpanan browser.', feedback: null };
  }

  appendModerationLog(record.id, actor.id, action, validation.note);

  const messages = {
    approve: 'Feedback disetujui dan dipublikasikan.',
    reject: 'Feedback ditolak. Alasan dikirim kepada penulis.',
    hide: 'Feedback disembunyikan dan ditarik dari statistik.',
    restore: 'Feedback dipulihkan menjadi Approved.',
  };

  return { ok: true, feedback: record, message: messages[action] || 'Moderasi tersimpan.' };
}

/** Histori kronologis (terlama -> terbaru) untuk tampilan detail. */
export function moderationTimeline(feedback) {
  if (!feedback) return [];
  const entries = Array.isArray(feedback.moderationHistory) ? feedback.moderationHistory : [];

  const timeline = entries.map((entry) => ({
    status: entry.status,
    note: entry.note || '',
    by: entry.by || '',
    at: entry.at || '',
    current: false,
  }));

  if (feedback.status !== 'pending' || feedback.moderationNote) {
    timeline.push({
      status: feedback.status,
      note: feedback.moderationNote || '',
      by: feedback.moderatedBy || '',
      at: feedback.moderatedAt || feedback.updatedAt || '',
      current: true,
    });
  }

  return timeline.sort((a, b) => String(a.at).localeCompare(String(b.at)));
}

/* ------------------------------------------------------------------ */
/* Workflow laporan konten                                            */
/* ------------------------------------------------------------------ */

export const REPORT_TRANSITIONS = {
  open: ['in_review', 'resolved'],
  in_review: ['in_review', 'resolved'],
  resolved: ['open'],
};

export function checkReportTransitionAllowed(status, report) {
  if (!REPORT_STATUSES.includes(status)) {
    return { ok: false, code: 'unknown-status', message: 'Status laporan tidak dikenal.' };
  }
  if (!report) {
    return { ok: false, code: 'missing', message: 'Laporan tidak ditemukan.' };
  }
  if (report.status === status) {
    return { ok: true, alreadySame: true };
  }
  if (!REPORT_TRANSITIONS[report.status].includes(status)) {
    return {
      ok: false,
      code: 'invalid-transition',
      message: `Laporan ${report.status} tidak dapat dipindahkan ke ${status}.`,
    };
  }
  return { ok: true };
}

/**
 * Mengubah status laporan. Resolve menyimpan handledBy/handledAt.
 * T emphatically TIDAK mengubah status feedback.
 */
export function updateReportStatus({ reportId, status, note = '', actor }) {
  if (!isActiveAdmin(actor)) {
    return { ok: false, code: 'forbidden', message: 'Hanya Admin aktif yang dapat menangani laporan.', report: null };
  }

  const reports = storage.getReports();
  const existing = reports.find((item) => item.id === reportId);
  if (!existing) {
    return { ok: false, code: 'missing', message: 'Laporan tidak ditemukan.', report: null };
  }

  const allowed = checkReportTransitionAllowed(status, existing);
  if (!allowed.ok) {
    return { ok: false, code: allowed.code, message: allowed.message, report: null };
  }

  const cleanNote = trimText(note).slice(0, LIMITS.reportNote);
  if (existing.status === status) {
    return { ok: false, code: 'unchanged', message: `Laporan sudah berstatus ${status}.`, report: existing };
  }

  const timestamp = nowIso();
  const record = {
    ...existing,
    status,
    updatedAt: timestamp,
    handledBy: actor.id,
    handledAt: timestamp,
    /* Catatan penyelesaian disimpan tanpa menghapus catatan sebelumnya. */
    resolutionNote: cleanNote || existing.resolutionNote || '',
    reopenedFrom: existing.status === 'resolved' ? existing.handledAt || existing.updatedAt : existing.reopenedFrom || '',
  };

  if (!storage.saveReports(reports.map((item) => (item.id === existing.id ? record : item)))) {
    return { ok: false, code: 'save-failed', message: 'Gagal menyimpan laporan ke penyimpanan browser.', report: null };
  }

  const messages = {
    open: 'Laporan dibuka kembali untuk ditinjau.',
    in_review: 'Laporan ditandai sedang ditinjau.',
    resolved: 'Laporan ditandai selesai ditangani.',
  };

  return { ok: true, report: record, message: messages[status] };
}

/* ------------------------------------------------------------------ */
/* Manajemen akun                                                     */
/* ------------------------------------------------------------------ */

export const ACCOUNT_ROLES = ['admin', 'teacher', 'student'];

/** Role yang boleh diubah role-nya pada MVP (default: tidak ada). */
export function canChangeRole(user) {
  return false;
}

/** Jumlah akun Admin yang masih aktif. */
export function countActiveAdmins() {
  return storage.getUsers().filter((user) => user.role === 'admin' && user.active).length;
}

function validateUsernameUnique(username, exceptUserId = '') {
  const found = storage
    .getUsers()
    .find(
      (user) =>
        user.username.toLowerCase() === String(username).toLowerCase() &&
        user.id !== exceptUserId,
    );
  return found ? 'Username sudah dipakai akun lain.' : '';
}

/**
 * Validasi input akun (create & edit).
 * Password hanya wajib saat pembuatan; pada edit dikosongkan berarti tidak diubah.
 */
export function validateAccountInput({ mode, userId = '', fullName, username, password, role, className, active }) {
  const errors = {};
  const exceptUserId = mode === 'edit' ? arguments[0].userId || '' : '';
  const cleanName = trimText(fullName).slice(0, LIMITS.fullName);
  const cleanUsername = trimText(username).toLowerCase().slice(0, LIMITS.username);
  const cleanPassword = typeof password === 'string' ? password : '';
  const cleanClass = trimText(className).slice(0, LIMITS.className);

  if (!cleanName) errors.fullName = 'Nama lengkap wajib diisi.';
  if (!cleanUsername) errors.username = 'Username wajib diisi.';
  else {
    const duplicate = validateUsernameUnique(cleanUsername, exceptUserId);
    if (duplicate) errors.username = duplicate;
  }

  if (mode === 'create' && !cleanPassword) errors.password = 'Password wajib diisi untuk akun baru.';
  if (cleanPassword && cleanPassword.length < 4) errors.password = 'Password minimal 4 karakter.';
  if (cleanPassword.length > LIMITS.password) errors.password = `Password maksimal ${LIMITS.password} karakter.`;

  if (!ACCOUNT_ROLES.includes(role)) errors.role = 'Role harus Admin, Guru, atau Murid.';
  if (role === 'student' && !cleanClass) errors.className = 'Kelas wajib diisi untuk akun Murid.';

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    value: {
      fullName: cleanName,
      username: cleanUsername,
      password: cleanPassword.slice(0, LIMITS.password),
      role,
      className: role === 'student' ? cleanClass : '',
      active: typeof active === 'boolean' ? active : true,
    },
  };
}

/**
 * Membuat akun baru. Untuk role Guru, profil dibuat bersamaan bila
 * `teacherProfile` diisi dan userId-nya belum punya profil.
 * Tidak menyimpan akun parsial bila pembuatan profil gagal.
 */
export function createAccount({ fullName, username, password, role, className, active, actor, teacherProfile = null }) {
  if (!isActiveAdmin(actor)) {
    return { ok: false, code: 'forbidden', message: 'Hanya Admin aktif yang dapat membuat akun.', user: null };
  }

  const validation = validateAccountInput({ mode: 'create', fullName, username, password, role, className, active });
  if (!validation.valid) {
    return { ok: false, code: 'invalid-input', message: 'Periksa kembali isian akun.', errors: validation.errors, user: null };
  }

  const user = {
    id: makeId('usr'),
    username: validation.value.username,
    password: validation.value.password,
    role: validation.value.role,
    fullName: validation.value.fullName,
    className: validation.value.className,
    active: validation.value.active,
    createdAt: nowIso(),
    lastLoginAt: '',
  };

  const users = storage.getUsers();

  /* Akun disimpan lebih dulu agar validasi profil (yang memverifikasi
     akun role Guru) bisa menemukan akunnya. Bila pembuatan profil gagal,
     akun dikembalikan ke daftar semula sehingga tidak ada record parsial. */
  if (!storage.saveUsers([...users, user])) {
    return { ok: false, code: 'save-failed', message: 'Gagal menyimpan akun ke penyimpanan browser.', user: null };
  }

  let profileId = '';
  if (role === 'teacher' && teacherProfile) {
    const created = createTeacherProfile({ ...teacherProfile, userId: user.id, actor });
    if (!created.ok) {
      storage.saveUsers(users);
      return {
        ok: false,
        code: 'profile-failed',
        message: `Akun Guru tidak disimpan karena profil gagal: ${created.message}`,
        errors: created.errors || {},
        user: null,
      };
    }
    profileId = created.profile.id;
  }

  return {
    ok: true,
    user,
    profileId,
    message: profileId
      ? `Akun Guru ${user.fullName} dan profilnya berhasil dibuat.`
      : `Akun ${user.fullName} (${user.username}) berhasil dibuat.`,
  };
}

/**
 * Memperbarui akun. Role tidak diubah pada MVP untuk menjaga relasi profil
 * dan histori. Password hanya diganti bila field baru tidak kosong.
 */
export function updateAccount({ userId, fullName, username, password, className, active, actor }) {
  if (!isActiveAdmin(actor)) {
    return { ok: false, code: 'forbidden', message: 'Hanya Admin aktif yang dapat mengubah akun.', user: null };
  }

  const existing = storage.findUserById(userId);
  if (!existing) {
    return { ok: false, code: 'missing', message: 'Akun tidak ditemukan.', user: null };
  }

  const validation = validateAccountInput({
    mode: 'edit',
    userId,
    fullName,
    username,
    password,
    role: existing.role,
    className: existing.role === 'student' ? className : '',
    active: typeof active === 'boolean' ? active : existing.active,
  });
  if (!validation.valid) {
    return { ok: false, code: 'invalid-input', message: 'Periksa kembali isian akun.', errors: validation.errors, user: null };
  }

  const patch = {
    fullName: validation.value.fullName,
    username: validation.value.username,
    className: existing.role === 'student' ? validation.value.className : '',
    active: validation.value.active,
  };
  if (validation.value.password) patch.password = validation.value.password;

  const updated = storage.updateUser(existing.id, patch);
  if (!updated) {
    return { ok: false, code: 'save-failed', message: 'Gagal menyimpan perubahan akun.', user: null };
  }

  /* Sesi akun yang dinonaktifkan langsung dibersihkan. */
  if (!updated.active) {
    const session = storage.getSession();
    if (session && session.userId === updated.id) storage.clearSession();
  }

  return {
    ok: true,
    user: updated,
    message: updated.active
      ? `Akun ${updated.fullName} diperbarui.`
      : `Akun ${updated.fullName} dinonaktifkan. Histori tetap disimpan.`,
  };
}

/**
 * Mengaktifkan/menonaktifkan akun.
 * Melindungi dua kondisi berbahaya: menonaktifkan diri sendiri, dan
 * menonaktifkan Admin aktif terakhir yang tersisa.
 */
export function setAccountActive({ userId, active, actor }) {
  if (!isActiveAdmin(actor)) {
    return { ok: false, code: 'forbidden', message: 'Hanya Admin aktif yang dapat mengubah status akun.', user: null };
  }

  const target = storage.findUserById(userId);
  if (!target) {
    return { ok: false, code: 'missing', message: 'Akun tidak ditemukan.', user: null };
  }

  if (target.id === actor.id) {
    return {
      ok: false,
      code: 'self',
      message: 'Anda tidak dapat menonaktifkan akun yang sedang digunakan.',
      user: null,
    };
  }

  if (target.active === active) {
    return {
      ok: false,
      code: 'unchanged',
      message: `Akun ${target.fullName} sudah ${active ? 'aktif' : 'nonaktif'}.`,
      user: target,
    };
  }

  if (!active && target.role === 'admin' && countActiveAdmins() <= 1) {
    return {
      ok: false,
      code: 'last-admin',
      message: 'Tidak dapat menonaktifkan Admin aktif terakhir. Aplikasi membutuhkan minimal satu Admin aktif.',
      user: null,
    };
  }

  const updated = storage.updateUser(target.id, { active });
  if (!updated) {
    return { ok: false, code: 'save-failed', message: 'Gagal menyimpan status akun.', user: null };
  }

  if (!active) {
    const session = storage.getSession();
    if (session && session.userId === updated.id) storage.clearSession();
  }

  return {
    ok: true,
    user: updated,
    message: active
      ? `Akun ${updated.fullName} diaktifkan kembali.`
      : `Akun ${updated.fullName} dinonaktifkan. Profil dan histori tidak dihapus.`,
  };
}

/* ------------------------------------------------------------------ */
/* Manajemen profil guru                                              */
/* ------------------------------------------------------------------ */

export function validateProfileInput({ userId, subject, nip, className, bio }) {
  const errors = {};

  const cleanUserId = trimText(userId);
  const cleanSubject = trimText(subject).slice(0, LIMITS.subject);
  const cleanNip = trimText(nip).slice(0, LIMITS.nip);
  const cleanClass = trimText(className).slice(0, LIMITS.className);
  const cleanBio = trimText(bio).slice(0, LIMITS.bio);

  if (!cleanUserId) {
    errors.userId = 'Akun guru wajib dipilih.';
  } else {
    const account = storage.findUserById(cleanUserId);
    if (!account) errors.userId = 'Akun guru tidak ditemukan.';
    else if (account.role !== 'teacher') errors.userId = 'Profil hanya dapat dihubungkan dengan akun role Guru.';
  }

  if (!cleanSubject) errors.subject = 'Mata pelajaran wajib diisi.';

  if (cleanBio.length > LIMITS.bio) errors.bio = `Deskripsi maksimal ${LIMITS.bio} karakter.`;

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    value: { userId: cleanUserId, subject: cleanSubject, nip: cleanNip, className: cleanClass, bio: cleanBio },
  };
}

export function createTeacherProfile({ userId, subject, nip, className, bio, actor }) {
  if (!isActiveAdmin(actor)) {
    return { ok: false, code: 'forbidden', message: 'Hanya Admin aktif yang dapat mengelola profil guru.', profile: null };
  }

  const validation = validateProfileInput({ userId, subject, nip, className, bio });
  if (!validation.valid) {
    return { ok: false, code: 'invalid-input', message: 'Periksa kembali isian profil.', errors: validation.errors, profile: null };
  }

  const existing = storage.getTeacherProfileByUserId(validation.value.userId);
  if (existing) {
    return {
      ok: false,
      code: 'duplicate',
      message: 'Akun Guru ini sudah memiliki profil. Gunakan aksi Edit.',
      profile: null,
    };
  }

  const profiles = storage.getTeacherProfiles();
  const record = {
    id: makeId('tprof'),
    userId: validation.value.userId,
    nip: validation.value.nip,
    subject: validation.value.subject,
    className: validation.value.className,
    bio: validation.value.bio,
    updatedAt: nowIso(),
  };

  if (!storage.saveTeacherProfiles([...profiles, record])) {
    return { ok: false, code: 'save-failed', message: 'Gagal menyimpan profil guru.', profile: null };
  }

  return { ok: true, profile: record, message: `Profil guru ${validation.value.subject} berhasil dibuat.` };
}

export function updateTeacherProfile({ profileId, subject, nip, className, bio, actor }) {
  if (!isActiveAdmin(actor)) {
    return { ok: false, code: 'forbidden', message: 'Hanya Admin aktif yang dapat mengelola profil guru.', profile: null };
  }

  const existing = storage.getTeacherProfileById(profileId);
  if (!existing) {
    return { ok: false, code: 'missing', message: 'Profil guru tidak ditemukan.', profile: null };
  }

  const validation = validateProfileInput({
    userId: existing.userId,
    subject,
    nip,
    className,
    bio,
  });
  if (!validation.valid) {
    return { ok: false, code: 'invalid-input', message: 'Periksa kembali isian profil.', errors: validation.errors, profile: null };
  }

  /* Rating & histori feedback tidak tersentuh; hanya field profil yang diubah. */
  const record = {
    ...existing,
    subject: validation.value.subject,
    nip: validation.value.nip,
    className: validation.value.className,
    bio: validation.value.bio,
    updatedAt: nowIso(),
  };

  const profiles = storage.getTeacherProfiles();
  if (!storage.saveTeacherProfiles(profiles.map((item) => (item.id === existing.id ? record : item)))) {
    return { ok: false, code: 'save-failed', message: 'Gagal menyimpan profil guru.', profile: null };
  }

  return { ok: true, profile: record, message: 'Profil guru berhasil diperbarui.' };
}

/** Guru aktif yang belum memiliki profil. */
export function teachersWithoutProfile() {
  const users = storage.getUsers().filter((user) => user.role === 'teacher');
  const profiles = storage.getTeacherProfiles();
  return users.filter(
    (user) => !profiles.some((profile) => profile.userId === user.id),
  );
}

/** Kelengkapan profil guru + rating aktual (via fungsi statistik bersama). */
export function profileCompleteness(profile) {
  if (!profile) return 'missing';
  const complete = Boolean(trimText(profile.subject)) && Boolean(trimText(profile.bio));
  return complete ? 'complete' : 'partial';
}
