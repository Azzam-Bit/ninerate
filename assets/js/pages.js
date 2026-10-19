/**
 * NineRate — pages.js
 *
 * View per rute. Semua fungsi mengembalikan Node DOM dan NEVER menerima
 * string HTML mentah: konten pengguna selalu melalui textContent (lihat ui.js).
 *
 * Tahap 2: halaman Murid (dashboard, direktori guru, detail profil, form
 * rating/feedback, feedback saya, pelaporan) sudah berfungsi penuh.
 * Halaman Admin/Guru masih read-only memakai placeholderCard().
 */

import {
  el,
  badge,
  button,
  linkButton,
  card,
  cardHead,
  avatar,
  alert,
  charCounter,
  closeModal,
  emptyState,
  field,
  icon,
  openModal,
  pageIntro,
  placeholderCard,
  ratingDistribution,
  ratingInputGroup,
  ratingStars,
  ratingSummary,
  statCard,
  statusBadge,
} from './ui.js';
import {
  FEEDBACK_STATUSES,
  LIMITS,
  storage,
  SCHOOL_LOGO_PATH,
} from './storage.js';
import { homeRouteFor, login, roleLabel } from './auth.js';
import {
  ACCOUNT_ROLES,
  MODERATION_ACTION_INFO,
  MODERATION_ACTIONS,
  applyModeration,
  checkModerationAllowed,
  createAccount,
  createTeacherProfile,
  moderationTimeline,
  profileCompleteness,
  setAccountActive,
  teachersWithoutProfile,
  updateAccount,
  updateReportStatus,
  updateTeacherProfile,
} from './admin.js';
import {
  REPORT_REASONS,
  REPORT_REASON_LABELS,
  REPORT_STATUS_META,
  STATUS_INFO,
  canEditFeedback,
  computeRatingStats,
  createReport,
  currentModerationNote,
  getActiveReportFor,
  getApprovedFeedback,
  getFeedbackByPair,
  getStudentFeedback,
  listRateableTeachers,
  moderationHistoryOf,
  resolveReporterScope,
  submitFeedback,
  sortFeedbackByLatest,
  validateFeedbackInput,
} from './feedback.js';

/* ------------------------------------------------------------------ */
/* Helper data                                                         */
/* ------------------------------------------------------------------ */

function teacherAccount(profile) {
  return profile ? storage.findUserById(profile.userId) : null;
}

function teacherName(profile) {
  const account = teacherAccount(profile);
  return (account && account.fullName) || 'Guru';
}

/** Urut berdasarkan waktu terbaru: updatedAt, lalu createdAt. */
function sortByNewest(items) {
  return [...items].sort((a, b) => {
    const aDate = String(a.updatedAt || a.createdAt || '');
    const bDate = String(b.updatedAt || b.createdAt || '');
    return bDate.localeCompare(aDate);
  });
}

function page(bodyChildren) {
  return el('div', { className: 'page' }, bodyChildren);
}

/** Format tanggal Indonesia; input tidak valid menjadi "-". */
function formatTanggal(isoString) {
  if (typeof isoString !== 'string' || isoString === '') return '-';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(date);
}

/** Blok kritik & saran; teks selalu lewat textContent. */
function feedbackBlocks(kritik, saran) {
  const nodes = [];
  if (kritik) {
    nodes.push(
      el('div', { className: 'feedback-block' }, [
        el('span', { className: 'feedback-block__label', text: 'Kritik' }),
        el('p', { className: 'feedback-block__text', text: kritik }),
      ]),
    );
  }
  if (saran) {
    nodes.push(
      el('div', { className: 'feedback-block' }, [
        el('span', { className: 'feedback-block__label', text: 'Saran' }),
        el('p', { className: 'feedback-block__text', text: saran }),
      ]),
    );
  }
  return nodes;
}

/* ------------------------------------------------------------------
   1. Login
   ------------------------------------------------------------------ */

export function renderLogin(ctx) {
  const usernameInput = el('input', {
    className: 'input',
    id: 'login-username',
    name: 'username',
    type: 'text',
    placeholder: 'contoh: admin',
    autocomplete: 'username',
    required: true,
  });

  const passwordInput = el('input', {
    className: 'input',
    id: 'login-password',
    name: 'password',
    type: 'password',
    placeholder: 'password demo',
    autocomplete: 'current-password',
    required: true,
  });

  const errorBox = el('div', { attrs: { 'aria-live': 'assertive' } });

  const submitButton = button({ label: 'Masuk', type: 'submit', block: true });

  const form = el(
    'form',
    {
      className: 'form-stack',
      attrs: { novalidate: false },
      onSubmit: (event) => {
        event.preventDefault();
        errorBox.replaceChildren();

        const result = login(usernameInput.value, passwordInput.value);
        if (!result.ok) {
          errorBox.append(alert(result.message, 'error', 'alert'));
          passwordInput.focus();
          return;
        }
        ctx.navigate(result.user.role === 'student' ? homeRouteFor('student') : homeRouteFor(result.user.role), {
          replace: true,
        });
        ctx.toast(result.message, 'success');
      },
    },
    [
      errorBox,
      field({ label: 'Username', input: usernameInput, hint: 'Gunakan username demo dari README.' }),
      field({ label: 'Password', input: passwordInput }),
      submitButton,
    ],
  );

  const highlights = [
    'Satu kerangka aplikasi untuk Admin, Guru, dan Murid.',
    'Data demo tersimpan lokal di browser ini saja.',
    'Umpan balik dipilah sebelum dipublikasikan.',
  ].map((text) =>
    el('span', { className: 'auth-panel__highlight' }, [
      el('span', {}, [icon('check-circle', 16)]),
      el('span', { text }),
    ]),
  );

  return el('div', { className: 'auth-layout' }, [
    el('aside', { className: 'auth-panel' }, [
      el('div', { className: 'auth-panel__brand' }, [
        el('span', { text: 'NineRate' }),
      ]),
      el('div', {}, [
        el('h1', { className: 'auth-panel__headline', text: 'Better feedback. Better learning.' }),
        el('p', {
          className: 'auth-panel__body',
          text: 'Prototipe sistem umpan balik guru untuk SMKN 9 Kota Bekasi. Fondasi ini menyiapkan login, peran pengguna, dan kerangka halaman.',
        }),
      ]),
      el('div', { className: 'auth-panel__highlights' }, highlights),
      el('p', {
        className: 'auth-panel__footer',
        text: 'Prototype lokal - autentikasi ini hanya simulasi, bukan mekanisme aman untuk penggunaan nyata.',
      }),
    ]),
    el('main', { className: 'auth-form-wrap' }, [
      el('div', { className: 'auth-card' }, [
        card(
          [
            el('div', { className: 'card__head' }, [
              el('div', {}, [
                el('h2', { text: 'Masuk ke NineRate' }),
                el('p', {
                  className: 'card__subtitle',
                  text: 'Gunakan akun demo sesuai peran Anda.',
                }),
              ]),
            ]),
            form,
          ],
          { compact: false },
        ),
        el('div', { className: 'auth-card__school' }, [
          el('img', {
            className: 'auth-card__school-logo',
            src: SCHOOL_LOGO_PATH,
            alt: 'Logo SMKN 9 Kota Bekasi',
            width: 36,
            height: 36,
          }),
          el('div', {}, [
            el('p', { className: 'auth-card__school-name', text: 'SMK Negeri 9 Kota Bekasi' }),
            el('p', {
              className: 'auth-card__school-meta',
              text: 'Logo sekolah ditampilkan sebagai elemen pendukung, bukan identitas utama NineRate.',
            }),
          ]),
        ]),
      ]),
    ]),
  ]);
}

/* ------------------------------------------------------------------
/* ------------------------------------------------------------------
   2. Admin - Tahap 4 (fitur aktif)
   ------------------------------------------------------------------ */

const FEEDBACK_FILTERS = [
  { value: '', label: 'Semua status' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'hidden', label: 'Hidden' },
];

const REPORT_FILTERS = [
  { value: '', label: 'Semua status' },
  { value: 'open', label: 'Open' },
  { value: 'in_review', label: 'In Review' },
  { value: 'resolved', label: 'Resolved' },
];

const ROLE_FILTERS = [
  { value: '', label: 'Semua role' },
  { value: 'admin', label: 'Admin' },
  { value: 'teacher', label: 'Guru' },
  { value: 'student', label: 'Murid' },
];

const ACTIVE_FILTERS = [
  { value: '', label: 'Semua status' },
  { value: 'active', label: 'Aktif' },
  { value: 'inactive', label: 'Nonaktif' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Terbaru' },
  { value: 'oldest', label: 'Terlama' },
];

const PROFILE_STATUS_META = {
  complete: { label: 'Lengkap', variant: 'approved' },
  partial: { label: 'Belum lengkap', variant: 'pending' },
  missing: { label: 'Belum ada profil', variant: 'rejected' },
};

function moderatorName(userId) {
  const account = storage.findUserById(userId);
  return (account && account.fullName) || userId || 'Tidak diketahui';
}

function studentName(studentId) {
  const account = storage.findUserById(studentId);
  return (account && account.fullName) || studentId || 'Murid tidak ditemukan';
}

function teacherLabelOf(profileId) {
  const profile = storage.getTeacherProfileById(profileId);
  return profile ? teacherName(profile) : profileId || 'Guru tidak ditemukan';
}

function selectNode({ id, label, options, value = '' }) {
  const select = el('select', { className: 'select', id }, options.map((option) =>
    el('option', { value: option.value, text: option.label, selected: option.value === value }),
  ));
  return { select, field: field({ label, input: select }) };
}

function textInput({ id, label, type = 'text', value = '', placeholder = '', hint = '', maxLength = 0 }) {
  const input = el('input', {
    className: 'input',
    id,
    type,
    placeholder,
    maxLength: maxLength > 0 ? String(maxLength) : undefined,
  });
  if (value) input.value = value;
  const wrap = field({ label, input, hint });
  if (maxLength > 0) wrap.append(charCounter(input, maxLength));
  return { input, wrap, field: wrap };
}

function textareaNode({ id, label, value = '', placeholder = '', maxLength = 0, hint = '' }) {
  const input = el('textarea', { className: 'textarea', id, placeholder, maxLength: maxLength > 0 ? String(maxLength) : undefined });
  if (value) input.value = value;
  const wrap = field({ label, input, hint });
  if (maxLength > 0) wrap.append(charCounter(input, maxLength));
  return { input, wrap };
}

function buildTable({ headers, rows, emptyMessage, emptyIcon = 'inbox' }) {
  if (rows.length === 0) return emptyState(emptyMessage, emptyIcon);
  return el('div', { className: 'table-wrap' }, [
    el('table', { className: 'table' }, [
      el('thead', {}, [el('tr', {}, headers.map((header) => el('th', { text: header })))]),
      el('tbody', {}, rows),
    ]),
  ]);
}

/* ==================================================================
   A. Dashboard Admin
   ================================================================== */

export function renderAdminDashboard(ctx) {
  const users = storage.getUsers();
  const feedback = storage.getFeedback();
  const reports = storage.getReports();
  const profiles = storage.getTeacherProfiles();
  const logs = sortByNewest(storage.getModerationLogs()).slice(0, 6);

  const activeUsers = users.filter((user) => user.active);
  const inactiveUsers = users.filter((user) => !user.active);
  const activeStudents = activeUsers.filter((user) => user.role === 'student');
  const activeTeachers = activeUsers.filter((user) => user.role === 'teacher');

  const validProfiles = profiles.filter((profile) => {
    const account = storage.findUserById(profile.userId);
    return Boolean(account && account.role === 'teacher');
  });

  const byStatus = FEEDBACK_STATUSES.reduce((acc, status) => {
    acc[status] = feedback.filter((item) => item.status === status).length;
    return acc;
  }, {});

  const reportByStatus = {
    open: reports.filter((item) => item.status === 'open').length,
    in_review: reports.filter((item) => item.status === 'in_review').length,
    resolved: reports.filter((item) => item.status === 'resolved').length,
  };
  const unresolvedReports = reportByStatus.open + reportByStatus.in_review;

  return page([
    pageIntro({
      title: `Halo, ${ctx.user.fullName || ctx.user.username}`,
      description:
        'Ringkasan operasional NineRate. Seluruh angka dihitung dari record yang tersimpan di LocalStorage browser ini.',
    }),

    el('div', { className: 'section-gap-sm' }, [
      card([
        cardHead(
          'Perlu ditindaklanjuti',
          byStatus.pending + unresolvedReports > 0
            ? `${byStatus.pending + unresolvedReports} pekerjaan membutuhkan perhatian admin.`
            : 'Tidak ada antrean moderasi atau laporan aktif saat ini.',
          byStatus.pending + unresolvedReports > 0 ? badge('Perlu perhatian', 'pending') : badge('Terkendali', 'approved'),
        ),
        byStatus.pending + unresolvedReports > 0
          ? el('div', { className: 'button-row' }, [
              byStatus.pending > 0
                ? button({
                    label: `Tinjau ${byStatus.pending} feedback pending`,
                    iconName: 'shield',
                    onClick: () => ctx.navigate('#/admin/moderation'),
                  })
                : null,
              unresolvedReports > 0
                ? button({
                    label: `Tinjau ${unresolvedReports} laporan aktif`,
                    variant: 'secondary',
                    iconName: 'flag',
                    onClick: () => ctx.navigate('#/admin/reports'),
                  })
                : null,
            ])
          : alert('Semua antrean yang perlu tindakan sudah selesai ditinjau.', 'success', 'check-circle'),
      ], { compact: true }),
    ]),

    el('div', { className: 'section-head' }, [el('h3', { text: 'Ringkasan akun' })]),
    el('div', { className: 'card-grid' }, [
      statCard({ label: 'Akun aktif', value: activeUsers.length, meta: `Dari ${users.length} total akun` }),
      statCard({ label: 'Akun nonaktif', value: inactiveUsers.length, meta: 'Tidak dapat login, histori utuh' }),
      statCard({ label: 'Murid aktif', value: activeStudents.length, meta: 'Dapat mengirim feedback' }),
      statCard({ label: 'Guru aktif', value: activeTeachers.length, meta: `${teachersWithoutProfile().length} guru tanpa profil` }),
      statCard({ label: 'Profil guru valid', value: validProfiles.length, meta: 'Terhubung ke akun Guru' }),
    ]),

    el('div', { className: 'section-head section-gap' }, [el('h3', { text: 'Ringkasan feedback' })]),
    el('div', { className: 'card-grid' }, [
      statCard({ label: 'Total feedback', value: feedback.length, meta: 'Seluruh status' }),
      statCard({ label: 'Pending', value: byStatus.pending, meta: 'Menunggu moderasi admin' }),
      statCard({ label: 'Approved', value: byStatus.approved, meta: 'Dipublikasikan & dihitung' }),
      statCard({ label: 'Rejected', value: byStatus.rejected, meta: 'Tidak dipublikasikan' }),
      statCard({ label: 'Hidden', value: byStatus.hidden, meta: 'Ditarik dari publik' }),
    ]),

    el('div', { className: 'section-head section-gap' }, [el('h3', { text: 'Ringkasan laporan' })]),
    el('div', { className: 'card-grid' }, [
      statCard({ label: 'Open', value: reportByStatus.open, meta: 'Menunggu ditinjau' }),
      statCard({ label: 'In Review', value: reportByStatus.in_review, meta: 'Sedang ditinjau admin' }),
      statCard({ label: 'Resolved', value: reportByStatus.resolved, meta: 'Sudah ditangani' }),
    ]),

    el('div', { className: 'section-head section-gap' }, [
      el('h3', { text: 'Aktivitas moderasi terbaru' }),
      button({
        label: 'Buka antrean moderasi',
        variant: 'secondary',
        size: 'sm',
        iconName: 'chevron-right',
        onClick: () => ctx.navigate('#/admin/moderation'),
      }),
    ]),
    logs.length === 0
      ? emptyState('Belum ada aktivitas moderasi tercatat.', 'clock')
      : el('div', { className: 'record-list' }, logs.map((log) => {
          const info = MODERATION_ACTION_INFO[log.action];
          return el('article', { className: 'record' }, [
            el('div', { className: 'record__body' }, [
              el('h3', {
                className: 'record__title',
                text: `${info ? info.label : log.action} - ${log.feedbackId}`,
              }),
              el('p', {
                className: 'record__meta',
                text: `${moderatorName(log.actorId)} - ${formatTanggal(log.createdAt)}`,
              }),
              log.note ? el('p', { className: 'record__text', text: log.note }) : null,
            ]),
          ]);
        })),

    el('div', { className: 'section-head section-gap' }, [el('h3', { text: 'Aksi cepat' })]),
    el('div', { className: 'card-grid' }, [
      card([
        cardHead('Antrean moderasi', `${byStatus.pending} feedback menunggu keputusan.`),
        button({ label: 'Buka moderasi', iconName: 'shield', onClick: () => ctx.navigate('#/admin/moderation') }),
      ], { compact: true }),
      card([
        cardHead('Laporan konten', `${unresolvedReports} laporan belum selesai.`),
        button({ label: 'Buka laporan', iconName: 'flag', onClick: () => ctx.navigate('#/admin/reports') }),
      ], { compact: true }),
      card([
        cardHead('Manajemen akun', `${users.length} akun terdaftar.`),
        button({ label: 'Kelola akun', iconName: 'users', onClick: () => ctx.navigate('#/admin/accounts') }),
      ], { compact: true }),
      card([
        cardHead('Manajemen profil guru', `${teachersWithoutProfile().length} guru tanpa profil.`),
        button({ label: 'Kelola profil guru', iconName: 'book-open', onClick: () => ctx.navigate('#/admin/teachers') }),
      ], { compact: true }),
    ]),
  ]);
}

/* ==================================================================
   B. Antrean moderasi + detail
   ================================================================== */

export function renderAdminModeration(ctx) {
  const search = { term: '', status: '', sort: 'newest' };

  const searchInput = el('input', {
    className: 'input',
    id: 'moderation-search',
    type: 'search',
    placeholder: 'Cari nama penulis atau guru...',
  });
  searchInput.addEventListener('input', () => {
    search.term = searchInput.value.trim().toLowerCase();
    rerender();
  });

  const statusSelect = selectNode({
    id: 'moderation-status',
    label: 'Status',
    options: FEEDBACK_FILTERS,
  }).select;
  statusSelect.addEventListener('change', () => {
    search.status = statusSelect.value;
    rerender();
  });

  const sortSelect = selectNode({ id: 'moderation-sort', label: 'Urutkan', options: SORT_OPTIONS }).select;
  sortSelect.addEventListener('change', () => {
    search.sort = sortSelect.value;
    rerender();
  });

  const countLabel = el('p', { className: 'toolbar__count' });
  const resultSlot = el('div', {});

  const allFeedback = () => storage.getFeedback();
  const pendingCount = allFeedback().filter((item) => item.status === 'pending').length;

  function applyFilters() {
    const all = allFeedback();
    const filtered = all.filter((item) => {
      const statusOk = search.status ? item.status === search.status : true;
      if (!statusOk) return false;
      if (!search.term) return true;
      return (
        studentName(item.studentId).toLowerCase().includes(search.term) ||
        teacherLabelOf(item.teacherId).toLowerCase().includes(search.term)
      );
    });

    const sorted = filtered.slice().sort((a, b) => {
      const aDate = String(a.submittedAt || a.updatedAt || a.createdAt || '');
      const bDate = String(b.submittedAt || b.updatedAt || b.createdAt || '');
      return search.sort === 'oldest' ? aDate.localeCompare(bDate) : bDate.localeCompare(aDate);
    });

    countLabel.textContent =
      sorted.length === all.length
        ? `${sorted.length} feedback (semua status).`
        : `${sorted.length} dari ${all.length} feedback cocok.`;
    return sorted;
  }

  function openFeedbackDetail(feedback) {
    openFeedbackModal(ctx, feedback.id, rerender);
  }

  function rerender() {
    const sorted = applyFilters();
    resultSlot.replaceChildren(
      buildTable({
        headers: ['Penulis', 'Guru tujuan', 'Rating', 'Ringkasan', 'Status', 'Tanggal', 'Aksi'],
        rows: sorted.map((item) =>
          el('tr', {}, [
            el('td', { text: studentName(item.studentId) }),
            el('td', { text: teacherLabelOf(item.teacherId) }),
            el('td', { text: `${item.rating}/5` }),
            el('td', { text: `${item.kritik || 'Tanpa kritik'} ${item.saran ? '| Saran: ada' : ''}`.slice(0, 70) }),
            el('td', {}, [statusBadge(item.status)]),
            el('td', { text: formatTanggal(item.submittedAt || item.createdAt) }),
            el('td', {}, [
              button({
                label: 'Detail',
                variant: 'secondary',
                size: 'sm',
                onClick: () => openFeedbackDetail(item),
              }),
            ]),
          ]),
        ),
        emptyMessage: allFeedback().length === 0
          ? 'Belum ada feedback sama sekali.'
          : 'Tidak ada feedback yang cocok dengan pencarian atau filter.',
        emptyIcon: 'inbox',
      }),
    );
  }

  rerender();

  return page([
    pageIntro({
      title: 'Antrean moderasi',
      description: `${pendingCount} feedback menunggu keputusan. Filter dan pencarian berlaku pada daftar di bawah.`,
      actionNode: button({
        label: 'Perbarui antrean',
        variant: 'secondary',
        iconName: 'clock',
        onClick: () => rerender(),
      }),
    }),
    el('div', { className: 'toolbar' }, [
      el('div', { className: 'toolbar__search' }, [field({ label: 'Cari identitas', input: searchInput })]),
      el('div', { className: 'toolbar__filter' }, [field({ label: 'Status', input: statusSelect })]),
      el('div', { className: 'toolbar__filter' }, [field({ label: 'Urutkan', input: sortSelect })]),
    ]),
    countLabel,
    el('div', { className: 'section-gap-sm' }, [resultSlot]),
  ]);
}

/* --- Modal detail + aksi moderasi -------------------------------- */

function openFeedbackModal(ctx, feedbackId, onDone) {
  const feedback = storage.getFeedbackById(feedbackId);
  if (!feedback) {
    ctx.toast('Feedback tidak ditemukan.', 'error');
    return;
  }

  const stats = computeRatingStats(feedback.teacherId);
  const timeline = moderationTimeline(feedback);
  const allowedActions = MODERATION_ACTIONS.filter((action) =>
    checkModerationAllowed(action, feedback).ok,
  );

  const infoSection = el('div', { className: 'record-list' }, [
    el('div', { className: 'note-box note-box--history' }, [
      el('span', { className: 'note-box__label', text: 'Penulis' }),
      el('p', { className: 'note-box__text', text: studentName(feedback.studentId) }),
    ]),
    el('div', { className: 'note-box note-box--history' }, [
      el('span', { className: 'note-box__label', text: 'Guru tujuan' }),
      el('p', { className: 'note-box__text', text: teacherLabelOf(feedback.teacherId) }),
    ]),
    el('div', { className: 'note-box note-box--history' }, [
      el('span', { className: 'note-box__label', text: 'Waktu' }),
      el('p', {
        className: 'note-box__text',
        text: `Dikirim ${formatTanggal(feedback.submittedAt || feedback.createdAt)} - diperbarui ${formatTanggal(feedback.updatedAt)}`,
      }),
    ]),
  ]);

  const statusLine = el('div', { className: 'row-center' }, [
    statusBadge(feedback.status),
    el('span', { className: 'card__subtitle', text: `Status moderasi: ${feedback.moderationStatus}` }),
  ]);

  const ratingLine = el('div', { className: 'row-center' }, [
    el('span', { className: 'card__subtitle', text: `Rating ${feedback.rating}/5` }),
    ratingStars(feedback.rating, { size: 14 }),
  ]);

  const currentNote = feedback.moderationNote
    ? el('div', { className: 'note-box' }, [
        el('span', { className: 'note-box__label', text: 'Catatan moderasi yang berlaku' }),
        el('p', { className: 'note-box__text', text: feedback.moderationNote }),
        el('p', {
          className: 'note-box__meta',
          text: `${moderatorName(feedback.moderatedBy)} - ${formatTanggal(feedback.moderatedAt)}`,
        }),
      ])
    : null;

  const historyList = timeline.length
    ? el('ul', { className: 'record-list' }, timeline.map((entry) =>
        el('li', { className: 'note-box note-box--history' }, [
          el('span', { className: 'note-box__label', text: `${entry.current ? 'Keputusan terbaru' : 'Riwayat'} - ${entry.status}` }),
          el('p', { className: 'note-box__meta', text: `${moderatorName(entry.by)} - ${formatTanggal(entry.at)}` }),
          entry.note ? el('p', { className: 'note-box__text', text: entry.note }) : null,
        ]),
      ))
    : emptyState('Belum ada histori moderasi.', 'clock');

  const actionRow = el('div', { className: 'button-row' }, []);

  if (allowedActions.length === 0) {
    actionRow.append(
      el('p', {
        className: 'card__subtitle',
        text: 'Tidak ada aksi moderasi yang valid untuk status saat ini.',
      }),
    );
  }

  allowedActions.forEach((action) => {
    const info = MODERATION_ACTION_INFO[action];
    actionRow.append(
      button({
        label: info.label,
        variant: action === 'reject' ? 'danger' : action === 'hide' ? 'secondary' : 'primary',
        onClick: () =>
          openModerationActionModal(
            ctx,
            feedbackId,
            action,
            () => {
              if (typeof onDone === 'function') onDone();
            },
            () => openFeedbackModal(ctx, feedbackId, onDone),
          ),
      }),
    );
  });

  const reportsOnThis = storage
    .getReports()
    .filter((report) => report.feedbackId === feedback.id);

  const reportsBlock = reportsOnThis.length
    ? el('div', { className: 'note-box' }, [
        el('span', { className: 'note-box__label', text: `Laporan masuk untuk feedback ini (${reportsOnThis.length})` }),
        ...reportsOnThis.map((report) =>
          el('p', {
            className: 'note-box__meta',
            text: `${REPORT_REASON_LABELS[report.reason] || report.reason} oleh ${studentName(report.reporterId)} - ${report.status}`,
          }),
        ),
      ])
    : null;

  openModal({
    title: `Detail feedback ${feedback.id}`,
    content: el('div', { className: 'form-stack' }, [
      statusLine,
      ratingLine,
      infoSection,
      ...feedbackBlocks(feedback.kritik, feedback.saran),
      currentNote,
      reportsBlock,
      el('div', {}, [
        el('p', { className: 'card__subtitle', text: 'Statistik guru saat ini:' }),
        ratingSummary(stats),
      ]),
      el('div', {}, [
        el('p', { className: 'card__subtitle', text: 'Histori moderasi (kronologis):' }),
        historyList,
      ]),
      actionRow,
    ]),
    confirmLabel: 'Tutup',
    cancelLabel: 'Tutup',
    onConfirm: null,
  });
}

function openModerationActionModal(ctx, feedbackId, action, onDone, reopen = null) {
  const info = MODERATION_ACTION_INFO[action];
  const feedback = storage.getFeedbackById(feedbackId);
  if (!feedback) {
    ctx.toast('Feedback tidak ditemukan.', 'error');
    return;
  }

  const allowed = checkModerationAllowed(action, feedback);
  if (!allowed.ok) {
    ctx.toast(allowed.message, 'error');
    return;
  }

  const note = textareaNode({
    id: 'moderation-note',
    label: info.reasonLabel,
    placeholder: info.reasonRequired ? 'Tuliskan alasan yang jelas dan konstruktif...' : 'Opsional.',
    maxLength: LIMITS.moderationNote,
  });

  const errorBox = el('div', {});

  openModal({
    title: `${info.label} feedback`,
    description: info.hint,
    content: el('div', { className: 'form-stack' }, [
      el('div', { className: 'note-box note-box--history' }, [
        el('span', { className: 'note-box__label', text: 'Target' }),
        el('p', {
          className: 'note-box__text',
          text: `${studentName(feedback.studentId)} untuk ${teacherLabelOf(feedback.teacherId)} - rating ${feedback.rating}/5`,
        }),
      ]),
      errorBox,
      note.wrap,
    ]),
    confirmLabel: info.label,
    onConfirm: () => {
      const result = applyModeration({
        feedbackId,
        action,
        note: note.input.value,
        actor: ctx.user,
      });

      errorBox.replaceChildren();
      if (!result.ok) {
        if (result.errors) {
          note.wrap.className = result.errors.note ? 'field field--invalid' : 'field';
          note.wrap.replaceChildren(
            el('label', { className: 'field__label', text: info.reasonLabel, attrs: { for: note.input.id } }),
            note.input,
            result.errors.note
              ? el('p', { className: 'field__error', attrs: { role: 'alert' }, text: result.errors.note })
              : charCounter(note.input, LIMITS.moderationNote),
          );
        }
        errorBox.append(alert(result.message, 'error', 'alert'));
        return false;
      }

      ctx.toast(result.message, 'success');
      if (typeof onDone === 'function') onDone();
      /* reopening ditunda satu tick agar modal aksi menutup lebih dulu;
         bila tidak, close() akan ikut menghapus modal yang baru dibuka. */
      if (typeof reopen === 'function') window.setTimeout(() => reopen(), 0);
      return true;
    },
  });
}

/* ==================================================================
   D. Antrean laporan konten
   ================================================================== */

export function renderAdminReports(ctx) {
  const filter = { term: '', status: '', reason: '' };

  const searchInput = el('input', {
    className: 'input',
    id: 'report-search',
    type: 'search',
    placeholder: 'Cari pelapor, feedback, atau guru...',
  });
  searchInput.addEventListener('input', () => {
    filter.term = searchInput.value.trim().toLowerCase();
    rerender();
  });

  const statusSelect = selectNode({ id: 'report-status', label: 'Status', options: REPORT_FILTERS }).select;
  statusSelect.addEventListener('change', () => {
    filter.status = statusSelect.value;
    rerender();
  });

  const reasonSelect = selectNode({
    id: 'report-reason-filter',
    label: 'Alasan',
    options: [{ value: '', label: 'Semua alasan' }, ...REPORT_REASONS.map((item) => ({ value: item.value, label: item.label }))],
  }).select;
  reasonSelect.addEventListener('change', () => {
    filter.reason = reasonSelect.value;
    rerender();
  });

  const countLabel = el('p', { className: 'toolbar__count' });
  const resultSlot = el('div', {});

  function applyFilters() {
    const all = storage.getReports();
    const filtered = all.filter((report) => {
      if (filter.status && report.status !== filter.status) return false;
      if (filter.reason && report.reason !== filter.reason) return false;
      if (!filter.term) return true;
      const reporter = storage.findUserById(report.reporterId);
      const reporterName = (reporter && reporter.fullName) || report.reporterId;
      const feedback = storage.getFeedbackById(report.feedbackId);
      const teacherLabel = feedback ? teacherLabelOf(feedback.teacherId) : '';
      return (
        String(reporterName).toLowerCase().includes(filter.term) ||
        String(report.feedbackId).toLowerCase().includes(filter.term) ||
        teacherLabel.toLowerCase().includes(filter.term)
      );
    });

    const sorted = filtered.slice().sort((a, b) =>
      String(b.createdAt || '').localeCompare(String(a.createdAt || '')),
    );

    countLabel.textContent =
      sorted.length === all.length
        ? `${sorted.length} laporan.`
        : `${sorted.length} dari ${all.length} laporan cocok.`;
    return sorted;
  }

  function rerender() {
    const sorted = applyFilters();
    const all = storage.getReports();

    resultSlot.replaceChildren(
      buildTable({
        headers: ['Pelapor', 'Role', 'Feedback', 'Guru', 'Alasan', 'Dibuat', 'Status', 'Aksi'],
        rows: sorted.map((report) => {
          const reporter = storage.findUserById(report.reporterId);
          const feedback = storage.getFeedbackById(report.feedbackId);
          return el('tr', {}, [
            el('td', { text: (reporter && reporter.fullName) || report.reporterId }),
            el('td', {}, [badge(roleLabel(reporter ? reporter.role : ''), 'info')]),
            el('td', { text: report.feedbackId }),
            el('td', { text: feedback ? teacherLabelOf(feedback.teacherId) : '-' }),
            el('td', { text: REPORT_REASON_LABELS[report.reason] || report.reason }),
            el('td', { text: formatTanggal(report.createdAt) }),
            el('td', {}, [statusBadge(report.status)]),
            el('td', {}, [
              button({
                label: 'Detail',
                variant: 'secondary',
                size: 'sm',
                onClick: () => openAdminReportModal(ctx, report.id, rerender),
              }),
            ]),
          ]);
        }),
        emptyMessage: all.length === 0
          ? 'Belum ada laporan konten masuk.'
          : 'Tidak ada laporan yang cocok dengan pencarian atau filter.',
        emptyIcon: 'flag',
      }),
    );
  }

  rerender();

  return page([
    pageIntro({
      title: 'Laporan konten',
      description:
        'Laporan yang dikirim murid atau guru terhadap feedback publik. Penyelesaian laporan tidak otomatis mengubah status feedback.',
    }),
    el('div', { className: 'toolbar' }, [
      el('div', { className: 'toolbar__search' }, [field({ label: 'Cari identitas', input: searchInput })]),
      el('div', { className: 'toolbar__filter' }, [field({ label: 'Status', input: statusSelect })]),
      el('div', { className: 'toolbar__filter' }, [field({ label: 'Alasan', input: reasonSelect })]),
    ]),
    countLabel,
    el('div', { className: 'section-gap-sm' }, [resultSlot]),
  ]);
}

function openAdminReportModal(ctx, reportId, onDone) {
  const report = storage.getReports().find((item) => item.id === reportId);
  if (!report) {
    ctx.toast('Laporan tidak ditemukan.', 'error');
    return;
  }

  const feedback = storage.getFeedbackById(report.feedbackId);
  const reporter = storage.findUserById(report.reporterId);

  const actions = el('div', { className: 'button-row' }, []);

  const nextStatuses = {
    open: ['in_review', 'resolved'],
    in_review: ['in_review', 'resolved'],
    resolved: ['open'],
  }[report.status] || [];

  if (nextStatuses.length === 0) {
    actions.append(el('p', { className: 'card__subtitle', text: 'Tidak ada transisi status yang tersedia.' }));
  }

  nextStatuses.forEach((status) => {
    if (status === report.status) return;
    actions.append(
      button({
        label: status === 'resolved' ? 'Tandai selesai' : status === 'in_review' ? 'Tandai ditinjau' : 'Buka kembali',
        variant: status === 'resolved' ? 'primary' : 'secondary',
        size: 'sm',
        onClick: () =>
          openAdminReportActionModal(
            ctx,
            report.id,
            status,
            () => {
              if (typeof onDone === 'function') onDone();
            },
            () => openAdminReportModal(ctx, report.id, onDone),
          ),
      }),
    );
  });

  openModal({
    title: `Laporan ${report.id}`,
    content: el('div', { className: 'form-stack' }, [
      el('div', { className: 'row-center' }, [
        statusBadge(report.status),
        el('span', { className: 'card__subtitle', text: `Dibuat ${formatTanggal(report.createdAt)}` }),
      ]),
      el('div', { className: 'note-box note-box--history' }, [
        el('span', { className: 'note-box__label', text: 'Pelapor' }),
        el('p', {
          className: 'note-box__text',
          text: `${(reporter && reporter.fullName) || report.reporterId} (${roleLabel(reporter ? reporter.role : '')})`,
        }),
      ]),
      el('div', { className: 'note-box note-box--history' }, [
        el('span', { className: 'note-box__label', text: 'Alasan' }),
        el('p', { className: 'note-box__text', text: REPORT_REASON_LABELS[report.reason] || report.reason }),
      ]),
      report.detail
        ? el('div', { className: 'note-box' }, [
            el('span', { className: 'note-box__label', text: 'Detail tambahan' }),
            el('p', { className: 'note-box__text', text: report.detail }),
          ])
        : null,
      report.handledAt
        ? el('div', { className: 'note-box note-box--history' }, [
            el('span', { className: 'note-box__label', text: 'Penanganan' }),
            el('p', {
              className: 'note-box__meta',
              text: `${moderatorName(report.handledBy)} - ${formatTanggal(report.handledAt)}`,
            }),
            report.resolutionNote
              ? el('p', { className: 'note-box__text', text: report.resolutionNote })
              : null,
          ])
        : null,
      feedback
        ? el('div', {}, [
            el('div', { className: 'section-head' }, [
              el('h3', { text: 'Feedback yang dilaporkan' }),
              button({
                label: 'Buka di moderasi',
                variant: 'secondary',
                size: 'sm',
                onClick: () => {
                  closeModal();
                  ctx.navigate('#/admin/moderation');
                  window.setTimeout(() => openFeedbackModal(ctx, feedback.id, onDone), 60);
                },
              }),
            ]),
            el('div', { className: 'note-box note-box--history' }, [
              el('span', { className: 'note-box__label', text: 'Konteks' }),
              el('p', {
                className: 'note-box__text',
                text: `${studentName(feedback.studentId)} untuk ${teacherLabelOf(feedback.teacherId)} - status ${feedback.status}`,
              }),
            ]),
            ...feedbackBlocks(feedback.kritik, feedback.saran),
          ])
        : el('p', { className: 'card__subtitle', text: 'Feedback terkait sudah tidak tersedia.' }),
      el('p', {
        className: 'card__subtitle',
        text: 'Menyelesaikan laporan tidak menyembunyikan atau menerbitkan ulang feedback secara otomatis.',
      }),
      actions,
    ]),
    confirmLabel: 'Tutup',
    cancelLabel: 'Tutup',
    onConfirm: null,
  });
}

function openAdminReportActionModal(ctx, reportId, status, onDone, reopen = null) {
  const report = storage.getReports().find((item) => item.id === reportId);
  if (!report) {
    ctx.toast('Laporan tidak ditemukan.', 'error');
    return;
  }

  const needsNote = status === 'resolved';
  const note = textareaNode({
    id: 'report-resolution',
    label: needsNote ? 'Catatan penyelesaian (disarankan)' : 'Catatan (opsional)',
    placeholder: needsNote ? 'Ringkasan tindak lanjut...' : 'Opsional.',
    maxLength: LIMITS.reportNote,
  });
  const errorBox = el('div', {});

  openModal({
    title: status === 'resolved' ? 'Tandai laporan selesai' : status === 'in_review' ? 'Tandai sedang ditinjau' : 'Buka kembali laporan',
    description:
      'Status laporan berdiri sendiri dari status feedback. Untuk mengubah visibilitas feedback, gunakan workflow moderasi.',
    content: el('div', { className: 'form-stack' }, [errorBox, note.wrap]),
    confirmLabel: 'Simpan',
    onConfirm: () => {
      const result = updateReportStatus({
        reportId,
        status,
        note: note.input.value,
        actor: ctx.user,
      });

      errorBox.replaceChildren();
      if (!result.ok) {
        errorBox.append(alert(result.message, 'error', 'alert'));
        return false;
      }

      ctx.toast(result.message, 'success');
      if (typeof onDone === 'function') onDone();
      if (typeof reopen === 'function') window.setTimeout(() => reopen(), 0);
      return true;
    },
  });
}

/* ==================================================================
   E. Manajemen akun
   ================================================================== */

export function renderAdminAccounts(ctx) {
  const filter = { term: '', role: '', active: '' };

  const searchInput = el('input', {
    className: 'input',
    id: 'account-search',
    type: 'search',
    placeholder: 'Cari nama atau username...',
  });
  searchInput.addEventListener('input', () => {
    filter.term = searchInput.value.trim().toLowerCase();
    rerender();
  });

  const roleSelect = selectNode({ id: 'account-role-filter', label: 'Role', options: ROLE_FILTERS }).select;
  roleSelect.addEventListener('change', () => {
    filter.role = roleSelect.value;
    rerender();
  });

  const activeSelect = selectNode({ id: 'account-active-filter', label: 'Status', options: ACTIVE_FILTERS }).select;
  activeSelect.addEventListener('change', () => {
    filter.active = activeSelect.value;
    rerender();
  });

  const countLabel = el('p', { className: 'toolbar__count' });
  const resultSlot = el('div', {});

  function profileOf(userId) {
    return storage.getTeacherProfileByUserId(userId);
  }

  function applyFilters() {
    const all = storage.getUsers();
    const filtered = all.filter((user) => {
      if (filter.role && user.role !== filter.role) return false;
      if (filter.active === 'active' && !user.active) return false;
      if (filter.active === 'inactive' && user.active) return false;
      if (!filter.term) return true;
      return (
        user.fullName.toLowerCase().includes(filter.term) ||
        user.username.toLowerCase().includes(filter.term)
      );
    });

    const sorted = filtered.slice().sort((a, b) => {
      const roleOrder = { admin: 0, teacher: 1, student: 2 };
      const byRole = (roleOrder[a.role] ?? 9) - (roleOrder[b.role] ?? 9);
      if (byRole !== 0) return byRole;
      return a.fullName.localeCompare(b.fullName, 'id', { sensitivity: 'base' });
    });

    countLabel.textContent =
      sorted.length === all.length ? `${sorted.length} akun.` : `${sorted.length} dari ${all.length} akun cocok.`;
    return sorted;
  }

  function rerender() {
    const sorted = applyFilters();
    const all = storage.getUsers();

    resultSlot.replaceChildren(
      buildTable({
        headers: ['Nama lengkap', 'Username', 'Role', 'Kelas', 'Kelengkapan profil', 'Status', 'Aksi'],
        rows: sorted.map((user) => {
          const profile = user.role === 'teacher' ? profileOf(user.id) : null;
          const meta = PROFILE_STATUS_META[profileCompleteness(profile)];
          return el('tr', {}, [
            el('td', { text: user.fullName }),
            el('td', { text: user.username }),
            el('td', {}, [badge(roleLabel(user.role), user.role === 'admin' ? 'brand' : 'info')]),
            el('td', { text: user.role === 'student' ? user.className || '-' : profile ? profile.className || '-' : '-' }),
            el('td', { text: user.role === 'teacher' ? meta.label : '-' }),
            el('td', {}, [user.active ? badge('Aktif', 'approved') : badge('Nonaktif', 'rejected')]),
            el('td', {}, [
              el('div', { className: 'button-row' }, [
                button({
                  label: 'Edit',
                  variant: 'secondary',
                  size: 'sm',
                  onClick: () => openAccountModal(ctx, user.id, rerender),
                }),
                button({
                  label: user.active ? 'Nonaktifkan' : 'Aktifkan',
                  size: 'sm',
                  variant: user.active ? 'danger' : 'secondary',
                  disabled: user.id === ctx.user.id,
                  title: user.id === ctx.user.id ? 'Anda tidak dapat menonaktifkan akun sendiri.' : '',
                  onClick: () => confirmSetAccountActive(ctx, user.id, !user.active, rerender),
                }),
              ]),
            ]),
          ]);
        }),
        emptyMessage: all.length === 0 ? 'Belum ada akun.' : 'Tidak ada akun yang cocok dengan filter.',
        emptyIcon: 'users',
      }),
    );
  }

  rerender();

  return page([
    pageIntro({
      title: 'Manajemen akun',
      description:
        'Membuat, memperbarui, dan menonaktifkan akun. Role tidak dapat diubah lewat edit umum agar relasi profil dan histori tetap utuh. Tidak ada penghapusan permanen.',
      actionNode: button({
        label: 'Tambah akun',
        iconName: 'users',
        onClick: () => openAccountModal(ctx, null, rerender),
      }),
    }),
    el('div', { className: 'toolbar' }, [
      el('div', { className: 'toolbar__search' }, [field({ label: 'Cari akun', input: searchInput })]),
      el('div', { className: 'toolbar__filter' }, [field({ label: 'Role', input: roleSelect })]),
      el('div', { className: 'toolbar__filter' }, [field({ label: 'Status', input: activeSelect })]),
    ]),
    countLabel,
    el('div', { className: 'section-gap-sm' }, [resultSlot]),
  ]);
}

function confirmSetAccountActive(ctx, userId, active, onDone) {
  const user = storage.findUserById(userId);
  if (!user) return;

  openModal({
    title: active ? 'Aktifkan akun?' : 'Nonaktifkan akun?',
    description: active
      ? `Akun ${user.fullName} akan dapat login kembali.`
      : `Akun ${user.fullName} tidak dapat login. Profil guru, feedback, dan histori tidak dihapus.`,
    confirmLabel: active ? 'Aktifkan' : 'Nonaktifkan',
    onConfirm: () => {
      const result = setAccountActive({ userId, active, actor: ctx.user });
      if (!result.ok) {
        ctx.toast(result.message, 'error');
        return false;
      }
      ctx.toast(result.message, 'success');
      if (typeof onDone === 'function') onDone();
      return true;
    },
  });
}

function openAccountModal(ctx, userId, onDone) {
  const existing = userId ? storage.findUserById(userId) : null;
  const isEdit = Boolean(existing);
  const role = existing ? existing.role : 'student';

  const fullNameInput = textInput({
    id: 'account-fullname',
    label: 'Nama lengkap',
    value: existing ? existing.fullName : '',
    placeholder: 'Contoh: Rizky Fauzan',
    maxLength: LIMITS.fullName,
  });

  const usernameInput = textInput({
    id: 'account-username',
    label: 'Username',
    value: existing ? existing.username : '',
    placeholder: 'contoh: murid.rizky',
    hint: 'Harus unik, tidak membedakan huruf besar/kecil.',
    maxLength: LIMITS.username,
  });

  const passwordInput = textInput({
    id: 'account-password',
    label: isEdit ? 'Password demo baru (opsional)' : 'Password demo',
    type: 'password',
    placeholder: isEdit ? 'Kosongkan bila tidak diubah' : 'Minimal 4 karakter',
    maxLength: LIMITS.password,
  });

  const classInput = textInput({
    id: 'account-class',
    label: 'Kelas (Murid)',
    value: existing && existing.role === 'student' ? existing.className : '',
    placeholder: 'Contoh: XII RPL-1',
    maxLength: LIMITS.className,
  });

  const roleSelect = selectNode({
    id: 'account-role',
    label: 'Role',
    options: ACCOUNT_ROLES.map((value) => ({ value, label: roleLabel(value) })),
    value: role,
  }).select;

  if (isEdit) {
    roleSelect.disabled = true;
    roleSelect.title = 'Role tidak dapat diubah lewat edit umum.';
  }

  const activeSelect = selectNode({
    id: 'account-active',
    label: 'Status akun',
    options: [
      { value: 'true', label: 'Aktif' },
      { value: 'false', label: 'Nonaktif' },
    ],
    value: existing ? String(existing.active) : 'true',
  }).select;

  const subjectInput = textInput({
    id: 'account-subject',
    label: 'Mata pelajaran (Guru)',
    placeholder: 'Contoh: Matematika',
    maxLength: LIMITS.subject,
  });

  const teacherClassInput = textInput({
    id: 'account-teacher-class',
    label: 'Kelas yang diampu (Guru)',
    placeholder: 'Contoh: XII RPL-1',
    maxLength: LIMITS.className,
  });

  const teacherStack = el('div', { className: 'form-stack' }, [subjectInput.wrap, teacherClassInput.wrap]);

  const classStack = el('div', {}, [classInput.wrap]);

  const syncRoleFields = () => {
    const current = isEdit ? existing.role : roleSelect.value;
    teacherStack.hidden = current !== 'teacher';
    classStack.hidden = current !== 'student';
  };
  roleSelect.addEventListener('change', syncRoleFields);
  syncRoleFields();

  const errorBox = el('div', {});

  const handleResult = (result) => {
    errorBox.replaceChildren();
    if (!result.ok) {
      const errors = result.errors || {};
      /* Menandai ulang field: pesan error ditambahkan/dipertahankan di dekat
         field yang bermasalah, dan penghitung karakter tidak ikut hilang. */
      const mark = (wrap, control, key) => {
        const input = control.input;
        const counter = wrap.querySelector('.field__counter');
        wrap.className = errors[key] ? 'field field--invalid' : 'field';
        wrap.replaceChildren(
          el('label', {
            className: 'field__label',
            text: wrap.querySelector('.field__label').textContent,
            attrs: { for: input.id },
          }),
          input,
          errors[key]
            ? el('p', { className: 'field__error', attrs: { role: 'alert' }, text: errors[key] })
            : counter || el('p', { className: 'field__hint', text: '' }),
        );
        if (errors[key]) input.setAttribute('aria-invalid', 'true');
      };

      if (errors.fullName) mark(fullNameInput.wrap, fullNameInput, 'fullName');
      if (errors.username) mark(usernameInput.wrap, usernameInput, 'username');
      if (errors.password) mark(passwordInput.wrap, passwordInput, 'password');
      if (errors.className) mark(classInput.wrap, classInput, 'className');
      errorBox.append(alert(result.message, 'error', 'alert'));
      return false;
    }
    return true;
  };

  openModal({
    title: isEdit ? `Edit akun ${existing.username}` : 'Tambah akun',
    description: isEdit
      ? 'Role tidak diubah pada MVP. Password hanya diganti bila diisi.'
      : 'Profil Guru dibuat bersamaan bila mata pelajaran diisi. Data wajib sesuai role.',
    content: el('div', { className: 'form-stack' }, [
      errorBox,
      fullNameInput.wrap,
      usernameInput.wrap,
      passwordInput.wrap,
      field({ label: 'Role', input: roleSelect }),
      classStack,
      teacherStack,
      field({ label: 'Status akun', input: activeSelect }),
      isEdit && existing.role === 'teacher'
        ? alert(
            storage.getTeacherProfileByUserId(existing.id)
              ? 'Profil guru sudah ada dan dikelola dari halaman Manajemen Profil Guru.'
              : 'Akun Guru ini belum memiliki profil. Lengkapi dari halaman Manajemen Profil Guru.',
            'info',
            'info',
          )
        : null,
    ]),
    confirmLabel: isEdit ? 'Simpan perubahan' : 'Buat akun',
    onConfirm: () => {
      const active = activeSelect.value === 'true';
      const result = isEdit
        ? updateAccount({
            userId: existing.id,
            fullName: fullNameInput.input.value,
            username: usernameInput.input.value,
            password: passwordInput.input.value,
            className: classInput.input.value,
            active,
            actor: ctx.user,
          })
        : createAccount({
            fullName: fullNameInput.input.value,
            username: usernameInput.input.value,
            password: passwordInput.input.value,
            role: roleSelect.value,
            className: classInput.input.value,
            active,
            actor: ctx.user,
            teacherProfile:
              roleSelect.value === 'teacher' && subjectInput.input.value.trim()
                ? {
                    subject: subjectInput.input.value,
                    className: teacherClassInput.input.value,
                    bio: '',
                    nip: '',
                  }
                : null,
          });

      if (!handleResult(result)) return false;

      ctx.toast(result.message, 'success');
      if (typeof onDone === 'function') onDone();
      return true;
    },
  });
}

/* ==================================================================
   F. Manajemen profil guru
   ================================================================== */

export function renderAdminTeachers(ctx) {
  const profiles = storage.getTeacherProfiles();
  const teachers = storage.getUsers().filter((user) => user.role === 'teacher');
  const missing = teachersWithoutProfile();

  return page([
    pageIntro({
      title: 'Manajemen profil guru',
      description:
        'Profil terhubung ke akun Guru melalui userId. Satu akun Guru memiliki paling banyak satu profil. Mengubah profil tidak menyentuh rating atau histori feedback.',
      actionNode: button({
        label: 'Tambah profil',
        iconName: 'book-open',
        disabled: missing.length === 0,
        title: missing.length === 0 ? 'Semua akun Guru sudah memiliki profil.' : '',
        onClick: () => openProfileModal(ctx, null, () => ctx.navigate('#/admin/teachers', { replace: true })),
      }),
    }),

    missing.length
      ? el('div', { className: 'section-gap-sm' }, [
          alert(
            `${missing.length} akun Guru aktif belum memiliki profil: ${missing.map((user) => user.fullName).join(', ')}.`,
            'warning',
            'alert',
          ),
        ])
      : null,

    el('div', { className: 'section-gap-sm' }, [
      buildTable({
        headers: ['Nama lengkap', 'Username', 'NIP', 'Mata pelajaran', 'Kelas', 'Kelengkapan', 'Status akun', 'Rating', 'Aksi'],
        rows: profiles.map((profile) => {
          const account = storage.findUserById(profile.userId);
          const stats = computeRatingStats(profile.id);
          const meta = PROFILE_STATUS_META[profileCompleteness(profile)];
          return el('tr', {}, [
            el('td', { text: (account && account.fullName) || 'Akun tidak ditemukan' }),
            el('td', { text: (account && account.username) || '-' }),
            el('td', { text: profile.nip || '-' }),
            el('td', { text: profile.subject || '-' }),
            el('td', { text: profile.className || '-' }),
            el('td', {}, [badge(meta.label, meta.variant)]),
            el('td', {}, [account && account.active ? badge('Aktif', 'approved') : badge('Nonaktif', 'rejected')]),
            el('td', { text: stats.hasRatings ? `${stats.averageLabel} (${stats.count})` : 'Belum ada penilaian' }),
            el('td', {}, [
              button({
                label: 'Edit',
                variant: 'secondary',
                size: 'sm',
                disabled: !account,
                onClick: () => openProfileModal(ctx, profile.id, () => ctx.navigate('#/admin/teachers', { replace: true })),
              }),
            ]),
          ]);
        }),
        emptyMessage: profiles.length === 0 ? 'Belum ada profil guru.' : 'Tidak ada profil.',
        emptyIcon: 'book-open',
      }),
    ]),

    el('div', { className: 'section-gap' }, [
      card([
        cardHead('Aturan relasi profil', 'Dikenakan di lapisan domain, bukan hanya UI.'),
        el('ul', { className: 'placeholder__list' }, [
          el('li', { text: 'Profil hanya dapat dihubungkan dengan akun role Guru.' }),
          el('li', { text: 'Satu akun Guru memiliki paling banyak satu profil (duplikat ditolak).' }),
          el('li', { text: 'Nama lengkap dibaca dari akun Guru, bukan salinan di profil.' }),
          el('li', { text: 'Profil akun Guru nonaktif tetap tersimpan tetapi tidak tampil di direktori Murid.' }),
          el('li', { text: 'Mengubah profil tidak mengubah rating maupun histori feedback.' }),
        ]),
      ]),
    ]),
  ]);
}

function openProfileModal(ctx, profileId, onDone) {
  const existing = profileId ? storage.getTeacherProfileById(profileId) : null;
  const isEdit = Boolean(existing);

  const teachers = storage.getUsers().filter((user) => user.role === 'teacher');
  const takenUserIds = new Set(
    storage.getTeacherProfiles().map((profile) => profile.userId).filter((uid) => !existing || uid !== existing.userId),
  );
  const available = teachers.filter((user) => !takenUserIds.has(user.id) || (existing && user.id === existing.userId));

  const accountSelect = selectNode({
    id: 'profile-user',
    label: 'Akun Guru',
    options: [
      { value: '', label: available.length ? 'Pilih akun guru' : 'Tidak ada akun guru tanpa profil' },
      ...available.map((user) => ({ value: user.id, label: `${user.fullName} (${user.username})${user.active ? '' : ' - nonaktif'}` })),
    ],
    value: existing ? existing.userId : '',
  });

  if (isEdit) {
    accountSelect.select.disabled = true;
    accountSelect.select.title = 'userId tidak diubah lewat edit profil.';
  }

  const subjectInput = textInput({
    id: 'profile-subject',
    label: 'Mata pelajaran',
    value: existing ? existing.subject : '',
    placeholder: 'Contoh: Matematika',
    maxLength: LIMITS.subject,
  });

  const nipInput = textInput({
    id: 'profile-nip',
    label: 'NIP (opsional)',
    value: existing ? existing.nip : '',
    maxLength: LIMITS.nip,
  });

  const classInput = textInput({
    id: 'profile-class',
    label: 'Kelas yang diampu (opsional)',
    value: existing ? existing.className : '',
    maxLength: LIMITS.className,
  });

  const bioInput = textareaNode({
    id: 'profile-bio',
    label: 'Deskripsi profil (opsional)',
    value: existing ? existing.bio : '',
    placeholder: 'Singkat tentang pengalaman mengajar.',
    maxLength: LIMITS.bio,
  });

  const errorBox = el('div', {});

  openModal({
    title: isEdit ? `Edit profil ${existing.subject}` : 'Tambah profil guru',
    description: 'Nama lengkap otomatis mengikuti akun Guru yang dipilih.',
    content: el('div', { className: 'form-stack' }, [
      errorBox,
      field({ label: 'Akun Guru', input: accountSelect.select }),
      subjectInput.wrap,
      nipInput.wrap,
      classInput.wrap,
      bioInput.wrap,
    ]),
    confirmLabel: isEdit ? 'Simpan profil' : 'Buat profil',
    onConfirm: () => {
      const result = isEdit
        ? updateTeacherProfile({
            profileId: existing.id,
            subject: subjectInput.input.value,
            nip: nipInput.input.value,
            className: classInput.input.value,
            bio: bioInput.input.value,
            actor: ctx.user,
          })
        : createTeacherProfile({
            userId: accountSelect.select.value,
            subject: subjectInput.input.value,
            nip: nipInput.input.value,
            className: classInput.input.value,
            bio: bioInput.input.value,
            actor: ctx.user,
          });

      errorBox.replaceChildren();
      if (!result.ok) {
        errorBox.append(alert(result.message, 'error', 'alert'));
        return false;
      }

      ctx.toast(result.message, 'success');
      if (typeof onDone === 'function') onDone();
      return true;
    },
  });
}
/* ------------------------------------------------------------------
   3. Guru - Tahap 3 (fitur aktif)
   ------------------------------------------------------------------ */

/**
 * Profil guru yang sedang login, ditentukan dari session (userId).
 * Tidak ada fallback ke profil guru lain dan tidak menerima teacherId dari UI.
 */
function currentTeacherProfile(ctx) {
  const profile = storage.getTeacherProfileByUserId(ctx.user.id);
  const account = profile ? storage.findUserById(profile.userId) : null;
  return { profile: profile || null, account: account || null };
}

/** Empty state bersama ketika relasi profil tidak valid. */
function teacherWithoutProfilePage(ctx, description) {
  return page([
    pageIntro({ title: 'Profil belum tersedia', description }),
    emptyState('Data profil guru untuk akun ini tidak ditemukan pada data lokal.', 'users'),
    el('div', { className: 'section-gap' }, [
      button({
        label: 'Kembali ke dashboard guru',
        variant: 'secondary',
        iconName: 'arrow-left',
        onClick: () => ctx.navigate('#/teacher/dashboard'),
      }),
    ]),
  ]);
}

/** Nama lengkap penulis dari akun yang terhubung dengan studentId. */
function authorNameOf(feedback) {
  const author = storage.findUserById(feedback.studentId);
  return (author && author.fullName) || 'Murid';
}

/* --- Fitur A: Dashboard Guru ------------------------------------- */

export function renderTeacherDashboard(ctx) {
  const { profile } = currentTeacherProfile(ctx);

  if (!profile) {
    return teacherWithoutProfilePage(
      ctx,
      'Akun Anda tidak terhubung ke profil guru mana pun, jadi statistik dan umpan balik tidak dapat ditampilkan.',
    );
  }

  /* Satu sumber perhitungan untuk rating, jumlah penilaian, dan distribusi. */
  const stats = computeRatingStats(profile.id);
  const approved = getApprovedFeedback(profile.id)
    .slice()
    .sort((a, b) =>
      String(b.submittedAt || b.createdAt).localeCompare(String(a.submittedAt || a.createdAt)),
    );
  const recent = approved.slice(0, 5);
  const mine = storage.getFeedbackByTeacher(profile.id);
  const pendingCount = mine.filter((item) => item.status === 'pending').length;

  return page([
    pageIntro({
      title: `Halo, ${ctx.user.fullName || ctx.user.username}`,
      description: `Profil Anda tercatat sebagai guru ${profile.subject} untuk kelas ${profile.className}.`,
      actionNode: button({
        label: 'Feedback untuk Saya',
        iconName: 'message',
        onClick: () => ctx.navigate('#/teacher/feedback'),
      }),
    }),

    stats.hasRatings
      ? el('div', { className: 'card-grid' }, [
          statCard({
            label: 'Rating rata-rata',
            value: stats.averageLabel,
            meta: 'Dari feedback approved',
          }),
          statCard({
            label: 'Jumlah penilaian',
            value: stats.count,
            meta: 'Feedback approved masuk perhitungan',
          }),
          statCard({
            label: 'Feedback publik',
            value: approved.length,
            meta: 'Disetujui dan tampil di profil',
          }),
        ])
      : card([
          cardHead('Rating belum tersedia', 'Belum ada penilaian dari feedback approved.'),
          el('p', { className: 'rating-summary__label', text: 'Belum ada penilaian' }),
          emptyState(
            'Belum ada umpan balik yang disetujui admin untuk profil Anda. Rating akan muncul setelah ada feedback approved.',
            'star',
          ),
        ]),

    el('div', { className: 'section-gap' }, [
      card([
        cardHead(
          'Distribusi rating bintang',
          'Menggunakan computeRatingStats() yang sama dengan halaman Murid.',
        ),
        ratingSummary(stats),
        el('div', { className: 'section-gap-sm' }, [ratingDistribution(stats)]),
      ]),
    ]),

    pendingCount > 0
      ? el('div', { className: 'section-gap' }, [
          alert(
            `${pendingCount} umpan balik sedang menunggu moderasi admin dan belum dihitung dalam rating.`,
            'info',
            'clock',
          ),
        ])
      : null,

    el('div', { className: 'section-gap' }, [
      card([
        cardHead(
          'Umpan balik terbaru',
          approved.length
            ? `Menampilkan ${recent.length} dari ${approved.length} feedback approved.`
            : 'Hanya feedback approved yang ditampilkan.',
        ),
        approved.length === 0
          ? emptyState('Umpan balik yang disetujui akan muncul di sini setelah proses moderasi selesai.', 'star', {
              title: 'Belum ada penilaian — ini wajar',
              actionNode: button({
                label: 'Buka profil saya',
                variant: 'secondary',
                size: 'sm',
                onClick: () => ctx.navigate('#/teacher/profile'),
              }),
            })
          : el(
              'div',
              { className: 'record-list' },
              recent.map((item) =>
                el('article', { className: 'record' }, [
                  el('div', { className: 'record__body' }, [
                    el('div', { className: 'record__side' }, [
                      el('h3', { className: 'record__title', text: authorNameOf(item) }),
                      el('span', {}, [ratingStars(item.rating, { size: 14 })]),
                    ]),
                    el('p', {
                      className: 'record__meta',
                      text: `Rating ${item.rating}/5 - dikirim ${formatTanggal(item.submittedAt || item.createdAt)}`,
                    }),
                    ...feedbackBlocks(item.kritik, item.saran),
                  ]),
                ]),
              ),
            ),
        el('div', { className: 'button-row' }, [
          button({
            label: 'Lihat semua umpan balik',
            variant: 'secondary',
            size: 'sm',
            onClick: () => ctx.navigate('#/teacher/feedback'),
          }),
        ]),
      ]),
    ]),

    el('div', { className: 'card-grid section-gap' }, [
      card(
        [
          cardHead('Profil Saya', 'Nama, mata pelajaran, dan deskripsi profil Anda.'),
          button({
            label: 'Buka profil',
            variant: 'secondary',
            onClick: () => ctx.navigate('#/teacher/profile'),
          }),
        ],
        { compact: true },
      ),
      card(
        [
          cardHead('Feedback untuk Saya', 'Semua umpan balik approved yang ditulis untuk Anda.'),
          button({
            label: 'Buka daftar umpan balik',
            onClick: () => ctx.navigate('#/teacher/feedback'),
          }),
        ],
        { compact: true },
      ),
    ]),
  ]);
}

/* --- Fitur B: Profil Saya --------------------------------------- */

export function renderTeacherProfile(ctx) {
  const { profile, account } = currentTeacherProfile(ctx);

  if (!profile) {
    return teacherWithoutProfilePage(
      ctx,
      'Profil guru untuk akun ini belum tersedia, sehingga data profil tidak dapat ditampilkan.',
    );
  }

  const stats = computeRatingStats(profile.id);

  return page([
    pageIntro({
      title: 'Profil Saya',
      description:
        'Data profil guru yang terhubung dengan akun Anda. Pada tahap ini profil bersifat read-only; pengelolaan profil tetap menjadi kewenangan Admin.',
    }),

    card([
      el('div', { className: 'row-center' }, [
        avatar((account && account.fullName) || ctx.user.username, true),
        el('div', {}, [
          el('h3', { className: 'card__title', text: (account && account.fullName) || ctx.user.username }),
          el('p', { className: 'card__subtitle', text: `${profile.subject} - ${profile.className}` }),
          el('p', { className: 'card__subtitle', text: `Username akun: ${ctx.user.username}` }),
        ]),
      ]),
      el('div', { className: 'section-gap-sm' }, [
        el('p', { text: profile.bio || 'Deskripsi profil belum diisi pada data demo.' }),
      ]),
    ]),

    el('div', { className: 'card-grid section-gap' }, [
      statCard({ label: 'Mata pelajaran', value: profile.subject || '-', meta: profile.className || '-' }),
      statCard({ label: 'NIP', value: profile.nip || '-', meta: 'Data profil guru' }),
      statCard({
        label: 'Rating rata-rata',
        value: stats.hasRatings ? stats.averageLabel : 'Belum ada penilaian',
        meta: stats.hasRatings ? `Dari ${stats.count} penilaian` : 'Belum ada feedback approved',
      }),
      statCard({
        label: 'Feedback approved',
        value: stats.count,
        meta: 'Masuk perhitungan rating',
      }),
    ]),

    el('div', { className: 'section-gap' }, [
      card([
        cardHead('Relasi akun dan profil', 'Profil ditentukan dari userId pada sesi login.'),
        el('div', { className: 'record-list' }, [
          el('div', { className: 'note-box note-box--history' }, [
            el('span', { className: 'note-box__label', text: 'userId akun' }),
            el('p', { className: 'note-box__text', text: ctx.user.id }),
          ]),
          el('div', { className: 'note-box note-box--history' }, [
            el('span', { className: 'note-box__label', text: 'ID profil guru' }),
            el('p', { className: 'note-box__text', text: profile.id }),
          ]),
          el('div', { className: 'note-box note-box--history' }, [
            el('span', { className: 'note-box__label', text: 'Terakhir diperbarui' }),
            el('p', { className: 'note-box__text', text: formatTanggal(profile.updatedAt) }),
          ]),
        ]),
      ]),
    ]),

    el('div', { className: 'card-grid section-gap' }, [
      card(
        [
          cardHead('Umpan balik Anda', 'Daftar lengkap umpan balik approved untuk profil ini.'),
          button({
            label: 'Buka Feedback untuk Saya',
            iconName: 'chevron-right',
            onClick: () => ctx.navigate('#/teacher/feedback'),
          }),
        ],
        { compact: true },
      ),
      card(
        [
          cardHead('Pengelolaan profil', 'Read-only pada tahap ini.'),
          alert(
            'Perubahan nama, mata pelajaran, dan deskripsi profil dilakukan Admin. Guru tidak memiliki form edit profil.',
            'info',
            'info',
          ),
        ],
        { compact: true },
      ),
    ]),
  ]);
}

/* --- Fitur C: Feedback untuk Saya ------------------------------- */

export function renderTeacherFeedback(ctx) {
  const { profile } = currentTeacherProfile(ctx);

  if (!profile) {
    return teacherWithoutProfilePage(
      ctx,
      'Profil guru untuk akun ini belum tersedia, sehingga umpan balik tidak dapat ditampilkan.',
    );
  }

  /* Hanya feedback approved milik profil ini; teacherId berasal dari session. */
  const approved = getApprovedFeedback(profile.id)
    .slice()
    .sort((a, b) =>
      String(b.submittedAt || b.createdAt).localeCompare(String(a.submittedAt || a.createdAt)),
    );
  const stats = computeRatingStats(profile.id);

  /* Cakupan pelaporan ditentukan dari session, bukan dari parameter UI. */
  const scope = resolveReporterScope(ctx.user, profile.id);
  const mine = storage.getFeedbackByTeacher(profile.id);
  const pendingCount = mine.filter((item) => item.status === 'pending').length;

  return page([
    pageIntro({
      title: 'Feedback untuk Saya',
      description:
        'Umpan balik murid yang sudah disetujui admin dan ditujukan untuk profil Anda. Guru tidak dapat mengubah isi, rating, atau status feedback.',
    }),

    card([
      cardHead('Ringkasan', 'Statistik dihitung dari data feedback yang sama dengan halaman Murid.'),
      ratingSummary(stats),
    ]),

    el('div', { className: 'section-gap' }, [
      cardHead(
        `Umpan balik approved (${approved.length})`,
        'Gunakan tombol Laporkan bila ada feedback yang melanggar aturan.',
      ),
    ]),

    approved.length === 0
      ? el('div', {}, [
          emptyState('Belum ada penilaian. Belum ada umpan balik approved untuk profil Anda.', 'star'),
          el('div', { className: 'button-row' }, [
            button({
              label: 'Kembali ke dashboard guru',
              variant: 'secondary',
              iconName: 'arrow-left',
              onClick: () => ctx.navigate('#/teacher/dashboard'),
            }),
          ]),
        ])
      : el('div', { className: 'record-list' }, approved.map((item) => {
          const authorName = authorNameOf(item);
          return el('article', { className: 'record' }, [
            el('div', { className: 'record__body' }, [
              el('div', { className: 'record__side' }, [
                el('h3', { className: 'record__title', text: authorName }),
                el('span', {}, [ratingStars(item.rating, { size: 14 })]),
              ]),
              el('p', {
                className: 'record__meta',
                text: `Rating ${item.rating}/5 - dikirim ${formatTanggal(item.submittedAt || item.createdAt)}`,
              }),
              ...feedbackBlocks(item.kritik, item.saran),
            ]),
            el('div', { className: 'record__side' }, [
              reportAction(ctx, item, authorName, { scope, subjectLabel: 'umpan balik' }),
            ]),
          ]);
        })),

    pendingCount > 0
      ? el('div', { className: 'section-gap' }, [
          alert(
            `${pendingCount} umpan balik masih menunggu moderasi admin dan tidak ditampilkan di halaman ini.`,
            'info',
            'clock',
          ),
        ])
      : null,
  ]);
}

/* ------------------------------------------------------------------
   4. Murid - Tahap 2 (fitur aktif)
   ------------------------------------------------------------------ */

function teacherCard(ctx, teacher) {
  const stats = computeRatingStats(teacher.profile.id);
  const mine = getFeedbackByPair(ctx.user.id, teacher.profile.id);

  return card(
    [
      el('div', { className: 'card__head' }, [
        el('div', { className: 'row-center' }, [
          avatar(teacher.fullName, true),
          el('div', {}, [
            el('h3', { className: 'card__title', text: teacher.fullName }),
            el('p', {
              className: 'card__subtitle',
              text: teacher.profile.className
                ? `${teacher.profile.subject} - ${teacher.profile.className}`
                : teacher.profile.subject,
            }),
          ]),
        ]),
      ]),
      el('div', { className: 'teacher-card__meta' }, [
        el('span', { className: 'teacher-card__subject', text: teacher.profile.subject }),
        el('span', { text: stats.hasRatings ? `${stats.averageLabel} / 5` : 'Belum ada penilaian' }),
        el('span', {
          text: `${stats.count} feedback disetujui`,
        }),
      ]),
      mine
        ? el('p', {
            className: 'card__subtitle',
            text: `Feedback Anda: ${STATUS_INFO[mine.status].label}`,
          })
        : null,
      el('div', { className: 'button-row' }, [
        button({
          label: 'Lihat profil',
          variant: 'secondary',
          size: 'sm',
          onClick: () => ctx.navigate(`#/student/teachers/${teacher.profile.id}`),
        }),
        button({
          label: mine ? 'Edit feedback' : 'Beri umpan balik',
          size: 'sm',
          onClick: () => ctx.navigate(`#/student/teachers/${teacher.profile.id}/feedback`),
        }),
      ]),
    ],
    { compact: true },
  );
}

function notAvailablePage(ctx, title, description) {
  return page([
    pageIntro({ title, description }),
    button({
      label: 'Kembali ke daftar guru',
      variant: 'secondary',
      iconName: 'arrow-left',
      onClick: () => ctx.navigate('#/student/teachers'),
    }),
  ]);
}

/** Guru yang boleh dinilai + akunnya aktif. */
function resolveRateableTeacher(teacherId) {
  return (
    listRateableTeachers().find((teacher) => teacher.profile.id === teacherId) || null
  );
}

/* --- Fitur A: Dashboard Murid ------------------------------------- */

export function renderStudentDashboard(ctx) {
  const teachers = listRateableTeachers();
  const mine = getStudentFeedback(ctx.user.id);
  const pending = mine.filter((item) => item.status === 'pending');
  const approved = mine.filter((item) => item.status === 'approved');
  const searchable = mine.filter((item) => item.status === 'approved' || item.status === 'pending');

  const searchLabel = el('p', {
    className: 'toolbar__count',
    text: teachers.length > 0 ? `Menampilkan ${teachers.length} guru yang aktif.` : '',
  });

  const searchInput = el('input', {
    className: 'input',
    id: 'dashboard-teacher-search',
    type: 'search',
    placeholder: 'Cari nama guru...',
  });

  const shortcutList = el('div', { className: 'card-grid' });

  const renderShortcuts = () => {
    const term = String(searchInput.value || '').trim().toLowerCase();
    const filtered = teachers.filter((teacher) =>
      term ? teacher.fullName.toLowerCase().includes(term) : true,
    );
    const shown = (term ? filtered : teachers).slice(0, 3);

    shortcutList.replaceChildren(
      ...(shown.length
        ? shown.map((teacher) => teacherCard(ctx, teacher))
        : [
            emptyState(
              term
                ? `Tidak ada guru dengan nama "${term}".`
                : 'Belum ada guru aktif yang dapat dinilai.',
              'users',
            ),
          ]),
    );

    searchLabel.textContent = term
      ? `${filtered.length} dari ${teachers.length} guru cocok dengan "${searchInput.value.trim()}".`
      : teachers.length > 0
        ? `Menampilkan ${teachers.length} guru aktif.`
        : '';
  };

  searchInput.addEventListener('input', renderShortcuts);
  renderShortcuts();

  return page([
    pageIntro({
      title: `Halo, ${ctx.user.fullName || ctx.user.username}`,
      description:
        'Kelola umpan balik guru Anda di SMKN 9 Kota Bekasi. Semua angka di halaman ini berasal dari data lokal browser ini.',
    }),
    el('div', { className: 'section-gap-sm' }, [
      alert(
        'Gunakan feedback untuk membantu guru berkembang: tulis pengalaman yang spesifik, sopan, dan dapat ditindaklanjuti.',
        'info',
        'info',
      ),
    ]),
    el('div', { className: 'card-grid' }, [
      statCard({
        label: 'Guru aktif',
        value: teachers.length,
        meta: 'Dapat dinilai',
      }),
      statCard({
        label: 'Feedback terkirim',
        value: mine.length,
        meta: `${searchable.length} sedang diproses atau sudah tampil`,
      }),
      statCard({
        label: 'Menunggu moderasi',
        value: pending.length,
        meta: 'Diproses admin sekolah',
      }),
      statCard({
        label: 'Disetujui',
        value: approved.length,
        meta: 'Tampil di profil guru',
      }),
    ]),

    el('div', { className: 'section-gap' }, [
      el('div', { className: 'toolbar' }, [
        el('div', { className: 'toolbar__search' }, [searchInput]),
        el('div', { className: 'toolbar__actions' }, [
          button({
            label: 'Buka direktori guru',
            iconName: 'chevron-right',
            onClick: () => ctx.navigate('#/student/teachers'),
          }),
          button({
            label: 'Feedback saya',
            variant: 'secondary',
            onClick: () => ctx.navigate('#/student/my-feedback'),
          }),
        ]),
      ]),
      searchLabel,
    ]),

    el('div', { className: 'section-gap' }, [
      el('div', { className: 'section-head' }, [
        el('div', {}, [
          el('h3', { text: 'Guru yang bisa Anda nilai' }),
          el('p', {
            className: 'card__subtitle',
            text: 'Pintasan diurutkan berdasarkan nama guru.',
          }),
        ]),
      ]),
      shortcutList,
    ]),
  ]);
}

/* --- Fitur B: Direktori Guru -------------------------------------- */

export function renderStudentTeachers(ctx) {
  const teachers = listRateableTeachers();

  const subjects = Array.from(new Set(teachers.map((teacher) => teacher.profile.subject)))
    .filter(Boolean)
    .sort((a, b) => String(a).localeCompare(String(b), 'id', { sensitivity: 'base' }));

  const searchInput = el('input', {
    className: 'input',
    id: 'teacher-search',
    type: 'search',
    placeholder: 'Cari nama guru...',
  });

  const subjectSelect = el('select', { className: 'select', id: 'teacher-subject' }, [
    el('option', { value: '', text: 'Semua mata pelajaran' }),
    ...subjects.map((subject) => el('option', { value: subject, text: subject })),
  ]);

  const countLabel = el('p', { className: 'toolbar__count' });
  const resultList = el('div', { className: 'card-grid section-gap-sm' });

  const applyFilters = () => {
    const term = String(searchInput.value || '').trim().toLowerCase();
    const subject = String(subjectSelect.value || '');

    const filtered = teachers.filter((teacher) => {
      const name = teacher.fullName.toLowerCase();
      const nameMatch = term ? name.includes(term) : true;
      const subjectMatch = subject ? teacher.profile.subject === subject : true;
      return nameMatch && subjectMatch;
    });

    countLabel.textContent =
      filtered.length === teachers.length
        ? `${filtered.length} guru aktif (urutan nama).`
        : `${filtered.length} dari ${teachers.length} guru cocok.`;

    resultList.replaceChildren(
      ...(filtered.length
        ? filtered.map((teacher) => teacherCard(ctx, teacher))
        : [
            emptyState('Tidak ada guru yang cocok dengan pencarian atau filter tersebut.', 'users', {
              title: 'Belum ada hasil',
              actionNode: button({ label: 'Reset filter', variant: 'secondary', size: 'sm', onClick: resetFilters }),
            }),
          ]),
    );
  };

  searchInput.addEventListener('input', applyFilters);
  subjectSelect.addEventListener('change', applyFilters);

  const resetFilters = () => {
    searchInput.value = '';
    subjectSelect.value = '';
    applyFilters();
    searchInput.focus();
  };

  applyFilters();

  return page([
    pageIntro({
      title: 'Daftar Guru',
      description:
        'Semua murid dapat menilai seluruh guru aktif. Pencarian nama dan filter mata pelajaran bisa dipakai bersamaan.',
    }),
    el('div', { className: 'toolbar' }, [
      el('div', { className: 'toolbar__search' }, [
        field({ label: 'Cari nama guru', input: searchInput }),
      ]),
      el('div', { className: 'toolbar__filter' }, [
        field({ label: 'Mata pelajaran', input: subjectSelect }),
      ]),
      el('div', { className: 'toolbar__actions' }, [
        button({ label: 'Reset filter', variant: 'secondary', onClick: resetFilters }),
      ]),
    ]),
    countLabel,
    resultList,
  ]);
}

/* --- Fitur G: Pelaporan feedback ---------------------------------- */

/**
 * Modal laporan konten yang dipakai bersama oleh Murid dan Guru.
 * Cakupan pelapor (terutama untuk Guru) ditentukan dari session, bukan dari
 * parameter yang bisa dimanipulasi pengguna.
 */
function openReportModal(ctx, feedback, authorName, { scope = null, subjectLabel = 'umpan balik' } = {}) {
  const reasonSelect = el('select', { className: 'select', id: 'report-reason' }, [
    el('option', { value: '', text: 'Pilih alasan laporan' }),
    ...REPORT_REASONS.map((reason) => el('option', { value: reason.value, text: reason.label })),
  ]);

  const detailInput = el('textarea', {
    className: 'textarea',
    id: 'report-detail',
    placeholder: 'Tambahkan detail singkat (opsional).',
    maxLength: String(LIMITS.reportDetail),
  });

  const reasonField = field({ label: 'Alasan laporan', input: reasonSelect });
  const detailField = field({
    label: 'Detail tambahan (opsional)',
    input: detailInput,
    hint: `Maksimal ${LIMITS.reportDetail} karakter.`,
  });
  detailField.append(charCounter(detailInput, LIMITS.reportDetail));

  const errorBox = el('div', {});

  const applyErrors = (errors = {}) => {
    const reasonFieldNode = reasonField;
    const detailFieldNode = detailField;

    reasonFieldNode.className = errors.reason ? 'field field--invalid' : 'field';
    detailFieldNode.className = errors.detail ? 'field field--invalid' : 'field';

    const reasonError = el('p', {
      className: 'field__error',
      attrs: { role: 'alert' },
      text: errors.reason || '',
    });
    const detailError = el('p', {
      className: 'field__error',
      attrs: { role: 'alert' },
      text: errors.detail || '',
    });

    reasonFieldNode.replaceChildren(
      el('label', { className: 'field__label', text: 'Alasan laporan', attrs: { for: reasonSelect.id } }),
      reasonSelect,
      errors.reason ? reasonError : null,
    );
    detailFieldNode.replaceChildren(
      el('label', {
        className: 'field__label',
        text: 'Detail tambahan (opsional)',
        attrs: { for: detailInput.id },
      }),
      detailInput,
      errors.detail ? detailError : charCounter(detailInput, LIMITS.reportDetail),
    );
  };

  openModal({
    title: 'Laporkan feedback ini',
    description: `Laporan dikirim atas nama ${ctx.user.fullName || ctx.user.username} untuk ${subjectLabel} dari ${authorName}. Laporan masuk antrean admin dan tidak langsung menyembunyikan feedback.`,
    content: el('div', { className: 'form-stack' }, [reasonField, detailField, errorBox]),
    confirmLabel: 'Kirim laporan',
    onConfirm: () => {
      const result = createReport({
        feedbackId: feedback.id,
        reporterId: ctx.user.id,
        reason: reasonSelect.value,
        detail: detailInput.value,
        scope,
      });

      errorBox.replaceChildren();
      if (!result.ok) {
        if (result.errors) applyErrors(result.errors);
        errorBox.append(alert(result.message, 'error', 'alert'));
        /* false -> modal tetap terbuka agar input tidak hilang. */
        return false;
      }

      ctx.toast(result.message, 'success');
      ctx.navigate(ctx.hash, { replace: true });
      return true;
    },
  });
}

/**
 * Aksi lapor pada feedback publik yang terlihat oleh pengguna.
 * `scope` dipakai Guru untuk membatasi laporan pada profilnya sendiri;
 * Murid tetap memakai aturan "bukan milik sendiri".
 */
function reportAction(ctx, feedback, authorName, { scope = null, subjectLabel = 'umpan balik' } = {}) {
  if (feedback.studentId === ctx.user.id) {
    return el('p', { className: 'record__meta', text: 'Ini feedback milik Anda sendiri.' });
  }

  const alreadyReported = getActiveReportFor(feedback.id, ctx.user.id);
  if (alreadyReported) {
    const reportMeta = REPORT_STATUS_META[alreadyReported.status] || {
      label: 'Sedang diproses',
    };
    return el('p', {
      className: 'record__meta',
      text: `Laporan Anda sudah terkirim dan masih ${reportMeta.label.toLowerCase()}.`,
    });
  }

  return linkButton({
    label: 'Laporkan',
    iconName: 'flag',
    title: 'Laporkan feedback ini ke admin',
    onClick: () => openReportModal(ctx, feedback, authorName, { scope, subjectLabel }),
  });
}

/* --- Fitur C: Detail Profil Guru --------------------------------- */

export function renderStudentTeacherDetail(ctx) {
  const teacher = resolveRateableTeacher(ctx.params.id);

  if (!teacher) {
    return notAvailablePage(
      ctx,
      'Profil tidak tersedia',
      'Guru yang Anda cari tidak ditemukan, atau akunnya sedang nonaktif sehingga tidak dapat dinilai.',
    );
  }

  const { profile, fullName } = teacher;
  const stats = computeRatingStats(profile.id);
  const mine = getFeedbackByPair(ctx.user.id, profile.id);
  const approved = getApprovedFeedback(profile.id)
    .slice()
    .sort((a, b) => String(b.submittedAt || b.createdAt).localeCompare(String(a.submittedAt || a.createdAt)));

  return page([
    pageIntro({
      title: fullName,
      description: `${profile.subject}${profile.className ? ` - ${profile.className}` : ''}`,
      actionNode: button({
        label: mine ? 'Edit feedback Anda' : 'Beri umpan balik',
        iconName: 'message',
        onClick: () => ctx.navigate(`#/student/teachers/${profile.id}/feedback`),
      }),
    }),

    el('div', { className: 'card-grid' }, [
      card([
        cardHead('Rating guru', 'Dihitung dari feedback yang sudah disetujui admin.'),
        ratingSummary(stats),
      ], { compact: false }),
      card([
        cardHead('Tentang guru', `Profil ${profile.id}`),
        el('p', { text: profile.bio || 'Bio guru belum diisi pada data demo.' }),
        el('p', { className: 'card__subtitle', text: `NIP ${profile.nip || '-'}` }),
      ], { compact: false }),
    ]),

    el('div', { className: 'section-gap' }, [
      card([
        cardHead('Distribusi bintang', `${stats.count} penilaian approved`),
        ratingDistribution(stats),
      ]),
    ]),

    el('div', { className: 'section-gap' }, [
      el('div', { className: 'section-head' }, [
        el('div', {}, [
          el('h3', { text: 'Feedback publik' }),
          el('p', {
            className: 'card__subtitle',
            text: 'Hanya feedback yang sudah disetujui admin. Nama lengkap penulis ditampilkan.',
          }),
        ]),
      ]),
      approved.length === 0
        ? emptyState('Belum ada feedback yang disetujui untuk guru ini.')
        : el(
            'div',
            { className: 'record-list' },
            approved.map((item) => {
              const author = storage.findUserById(item.studentId);
              const authorName = (author && author.fullName) || 'Murid';
              return el('article', { className: 'record' }, [
                el('div', { className: 'record__body' }, [
                  el('div', { className: 'record__side' }, [
                    el('h3', { className: 'record__title', text: authorName }),
                    el('span', {}, [ratingStars(item.rating, { size: 14 })]),
                  ]),
                  el('p', {
                    className: 'record__meta',
                    text: `Rating ${item.rating}/5 - dikirim ${formatTanggal(item.submittedAt || item.createdAt)}`,
                  }),
                  ...feedbackBlocks(item.kritik, item.saran),
                ]),
                el('div', { className: 'record__side' }, [reportAction(ctx, item, authorName)]),
              ]);
            }),
          ),
    ]),
  ]);
}

/* --- Fitur E: Form Rating dan Feedback ---------------------------- */

export function renderStudentTeacherFeedbackForm(ctx) {
  const teacher = resolveRateableTeacher(ctx.params.id);

  if (!teacher) {
    return notAvailablePage(
      ctx,
      'Guru tidak tersedia',
      'Profil guru tidak ditemukan atau akunnya nonaktif sehingga umpan balik belum bisa dikirim.',
    );
  }

  const { profile, fullName } = teacher;
  const existing = getFeedbackByPair(ctx.user.id, profile.id);
  const isEdit = Boolean(existing);
  const statusInfo = existing ? STATUS_INFO[existing.status] : null;

  let selectedRating = existing ? existing.rating : '';

  const ratingGroupHolder = el('div', {});
  const ratingErrorHolder = el('div', {});

  const renderRatingGroup = () => {
    ratingGroupHolder.replaceChildren(
      ratingInputGroup({
        name: 'feedback-rating',
        value: selectedRating,
        onChange: (value) => {
          selectedRating = value;
        },
      }),
    );
  };
  renderRatingGroup();

  const kritikInput = el('textarea', {
    className: 'textarea',
    id: 'feedback-kritik',
    maxLength: String(LIMITS.kritik),
    placeholder: 'Tuliskan kritik yang relevan dan spesifik.',
    value: existing ? existing.kritik : '',
  });

  const saranInput = el('textarea', {
    className: 'textarea',
    id: 'feedback-saran',
    maxLength: String(LIMITS.saran),
    placeholder: 'Tuliskan saran perbaikan (opsional jika kritik sudah diisi).',
    value: existing ? existing.saran : '',
  });

  const errors = { rating: '', kritik: '', saran: '' };

  const ratingField = el('div', { className: 'field' }, [
    el('span', { className: 'field__label', text: 'Rating keseluruhan (1-5)' }),
    ratingGroupHolder,
    ratingErrorHolder,
    existing && existing.status === 'approved'
      ? el('p', {
          className: 'field__hint',
          text:
            'Feedback yang disetujui akan ditarik dari profil publik dan perhitungan rating sampai disetujui kembali.',
        })
      : null,
  ]);

  const kritikField = field({
    label: `Kritik (maks. ${LIMITS.kritik} karakter)`,
    input: kritikInput,
  });
  kritikField.append(charCounter(kritikInput, LIMITS.kritik));

  const saranField = field({
    label: `Saran (maks. ${LIMITS.saran} karakter)`,
    input: saranInput,
  });
  saranField.append(charCounter(saranInput, LIMITS.saran));

  const applyErrors = () => {
    ratingErrorHolder.replaceChildren(
      errors.rating
        ? el('p', {
            className: 'field__error',
            attrs: { id: 'feedback-rating-error', role: 'alert' },
            text: errors.rating,
          })
        : el('p', { className: 'field__hint', text: 'Rating wajib dipilih.' }),
    );
    ratingField.className = errors.rating ? 'field field--invalid' : 'field';
    const ratingOptions = ratingGroupHolder.querySelector('.rating-options');
    if (ratingOptions) {
      ratingOptions.setAttribute('aria-invalid', errors.rating ? 'true' : 'false');
      if (errors.rating) {
        ratingOptions.setAttribute('aria-describedby', 'feedback-rating-error');
      } else {
        ratingOptions.removeAttribute('aria-describedby');
      }
    }
    kritikField.className = errors.kritik ? 'field field--invalid' : 'field';
    kritikField.replaceChildren(
      el('label', {
        className: 'field__label',
        text: `Kritik (maks. ${LIMITS.kritik} karakter)`,
        attrs: { for: kritikInput.id },
      }),
      kritikInput,
      errors.kritik
        ? el('p', {
            className: 'field__error',
            attrs: { id: `${kritikInput.id}-error`, role: 'alert' },
            text: errors.kritik,
          })
        : charCounter(kritikInput, LIMITS.kritik),
    );
    saranField.className = errors.saran ? 'field field--invalid' : 'field';
    saranField.replaceChildren(
      el('label', {
        className: 'field__label',
        text: `Saran (maks. ${LIMITS.saran} karakter)`,
        attrs: { for: saranInput.id },
      }),
      saranInput,
      errors.saran
        ? el('p', {
            className: 'field__error',
            attrs: { id: `${saranInput.id}-error`, role: 'alert' },
            text: errors.saran,
          })
        : charCounter(saranInput, LIMITS.saran),
    );
    kritikInput.setAttribute('aria-invalid', errors.kritik ? 'true' : 'false');
    saranInput.setAttribute('aria-invalid', errors.saran ? 'true' : 'false');
    if (errors.kritik) {
      kritikInput.setAttribute('aria-describedby', `${kritikInput.id}-error`);
    } else {
      kritikInput.removeAttribute('aria-describedby');
    }
    if (errors.saran) {
      saranInput.setAttribute('aria-describedby', `${saranInput.id}-error`);
    } else {
      saranInput.removeAttribute('aria-describedby');
    }
  };

  const formErrorBox = el('div', {});
  applyErrors();

  const submitButton = button({
    label: isEdit ? 'Ajukan ulang' : 'Kirim umpan balik',
    iconName: 'message',
    block: true,
  });

  const confirmSubmission = () => {
    const check = validateFeedbackInput({
      rating: selectedRating === '' ? '' : Number(selectedRating),
      kritik: kritikInput.value,
      saran: saranInput.value,
    });

    errors.rating = check.errors.rating || '';
    errors.kritik = check.errors.kritik || '';
    errors.saran = check.errors.saran || '';
    applyErrors();
    formErrorBox.replaceChildren();

    if (!check.valid) {
      /* Input tidak dikosongkan; hanya pesan error yang diperbarui. */
      formErrorBox.append(alert('Periksa kembali isian yang ditandai merah.', 'error', 'alert'));
      const firstInvalid = errors.rating
        ? ratingGroupHolder.querySelector('input[type="radio"]')
        : errors.kritik
          ? kritikInput
          : saranInput;
      if (firstInvalid && typeof firstInvalid.focus === 'function') firstInvalid.focus();
      return;
    }

    openModal({
      title: isEdit ? 'Ajukan ulang umpan balik?' : 'Kirim umpan balik?',
      description:
        'Feedback akan diperiksa oleh Admin. Jika disetujui, feedback ditampilkan kepada semua pengguna yang sudah login dan nama lengkap Anda ikut tampil. Tulis yang relevan dan konstruktif - feedback tidak dapat dikirim secara anonim.',
      confirmLabel: isEdit ? 'Ya, ajukan ulang' : 'Ya, kirim',
      onConfirm: () => {
        const result = submitFeedback({
          studentId: ctx.user.id,
          teacherId: profile.id,
          rating: check.value.rating,
          kritik: check.value.kritik,
          saran: check.value.saran,
        });

        if (!result.ok) {
          formErrorBox.replaceChildren(alert(result.message, 'error', 'alert'));
          if (result.errors) {
            errors.rating = result.errors.rating || '';
            errors.kritik = result.errors.kritik || '';
            errors.saran = result.errors.saran || '';
            applyErrors();
          }
          /* false -> modal tetap terbuka agar isian tidak hilang. */
          return false;
        }

        ctx.toast(result.message, 'success');
        ctx.navigate('#/student/my-feedback');
        return true;
      },
    });
  };

  submitButton.addEventListener('click', confirmSubmission);

  return page([
    pageIntro({
      title: `${isEdit ? 'Edit' : 'Umpan balik'} untuk ${fullName}`,
      description: isEdit
        ? 'Satu murid hanya punya satu umpan balik per guru. Setelah diedit, status kembali menjadi Menunggu moderasi.'
        : 'Isi rating serta kritik atau saran, lalu kirim untuk ditinjau admin.',
      actionNode: button({
        label: 'Kembali ke profil',
        variant: 'secondary',
        iconName: 'arrow-left',
        onClick: () => ctx.navigate(`#/student/teachers/${profile.id}`),
      }),
    }),

    isEdit && statusInfo
      ? el('div', { className: 'section-gap-sm' }, [
          card([
            el('div', { className: 'feedback-item__head' }, [
              el('div', {}, [
                el('p', { className: 'card__subtitle', text: 'Feedback Anda saat ini' }),
                el('div', { className: 'row-center' }, [
                  statusBadge(existing.status),
                  el('span', { className: 'card__subtitle', text: statusInfo.label }),
                ]),
              ]),
            ]),
            el('p', { className: 'card__subtitle', text: statusInfo.studentHint }),
          ], { compact: true }),
        ])
      : null,

    el('div', { className: 'section-gap' }, [
      card([
        cardHead(
          isEdit ? 'Perbarui umpan balik' : 'Form umpan balik',
          'Satu pasangan murid dan guru hanya boleh punya satu record feedback.',
        ),
        el('div', { className: 'form-stack' }, [
          formErrorBox,
          ratingField,
          kritikField,
          saranField,
          submitButton,
        ]),
      ]),
    ]),

    el('div', { className: 'section-gap' }, [
      card([
        cardHead('Sebelum mengirim, perhatikan hal ini', 'Kebijakan publikasi feedback NineRate.', 'brand'),
        el('ul', { className: 'placeholder__list' }, [
          el('li', { text: 'Feedback Anda diperiksa oleh Admin sekolah sebelum tampil.' }),
          el('li', { text: 'Jika disetujui, feedback tampil untuk semua pengguna yang sudah login.' }),
          el('li', { text: 'Nama lengkap Anda ikut ditampilkan - kirim tidak bersifat anonim.' }),
          el('li', { text: 'Tulis kritik dan saran yang relevan serta konstruktif.' }),
        ]),
      ], { flat: true }),
    ]),
  ]);
}

/* --- Fitur F: Feedback Saya -------------------------------------- */

export function renderStudentMyFeedback(ctx) {
  const mine = sortFeedbackByLatest(getStudentFeedback(ctx.user.id));

  return page([
    pageIntro({
      title: 'Feedback Saya',
      description:
        'Riwayat umpan balik milik akun ini saja, beserta status moderasi dan aksi yang tersedia.',
      actionNode: button({
        label: 'Beri umpan balik',
        iconName: 'message',
        onClick: () => ctx.navigate('#/student/teachers'),
      }),
    }),

    mine.length === 0
      ? emptyState('Mulai dari direktori untuk memilih guru dan menulis feedback yang konstruktif.', 'inbox', {
          title: 'Belum ada feedback',
          actionNode: button({
            label: 'Buka daftar guru',
            iconName: 'book-open',
            onClick: () => ctx.navigate('#/student/teachers'),
          }),
        })
      : el('div', { className: 'record-list' }, mine.map((item) => {
          const teacher = resolveRateableTeacher(item.teacherId);
          const teacherName = teacher ? teacher.fullName : 'Guru tidak tersedia';
          const info = STATUS_INFO[item.status] || STATUS_INFO.pending;
          const note = currentModerationNote(item);
          const history = moderationHistoryOf(item);
          const editable = canEditFeedback(item);

          return el('article', { className: 'feedback-item' }, [
            el('div', { className: 'feedback-item__head' }, [
              el('div', {}, [
                el('h3', { className: 'feedback-item__title', text: teacherName }),
                el('p', {
                  className: 'feedback-item__meta',
                  text: `Dikirim ${formatTanggal(item.submittedAt || item.createdAt)} - diperbarui ${formatTanggal(item.updatedAt)}`,
                }),
              ]),
              el('div', { className: 'record__side' }, [
                statusBadge(item.status),
                el('span', { className: 'card__subtitle', text: info.label }),
              ]),
            ]),
            el('div', { className: 'row-center' }, [
              ratingStars(item.rating, { size: 16 }),
              el('span', {
                className: 'card__subtitle',
                text: `Rating ${item.rating}/5`,
              }),
            ]),
            ...feedbackBlocks(item.kritik, item.saran),
            el('p', { className: 'feedback-item__meta', text: info.studentHint }),
            note
              ? el('div', { className: 'note-box' }, [
                  el('span', { className: 'note-box__label', text: `Catatan admin (${info.label.toLowerCase()})` }),
                  el('p', { className: 'note-box__text', text: note }),
                ])
              : null,
            history.length
              ? el('div', { className: 'note-box note-box--history' }, [
                  el('span', { className: 'note-box__label', text: `Riwayat keputusan sebelumnya (${history.length})` }),
                  ...history.map((entry) =>
                    el('p', {
                      className: 'note-box__meta',
                      text: `${STATUS_INFO[entry.status] ? STATUS_INFO[entry.status].label : entry.status} - ${formatTanggal(entry.at)}${entry.note ? ` - ${entry.note}` : ''}`,
                    }),
                  ),
                ])
              : null,
            el('div', { className: 'feedback-item__actions' }, [
              editable
                ? button({
                    label: info.actionLabel,
                    size: 'sm',
                    onClick: () => ctx.navigate(`#/student/teachers/${item.teacherId}/feedback`),
                  })
                : null,
              item.status === 'approved'
                ? el('span', {
                    className: 'card__subtitle',
                    text: 'Jika diedit, feedback kembali menjadi Menunggu moderasi dan tidak tampil publik.',
                  })
                : null,
            ]),
          ]);
        })),
  ]);
}

/* ------------------------------------------------------------------
   5. Not found
   ------------------------------------------------------------------ */

export function renderNotFound(ctx) {
  return page([
    pageIntro({
      title: 'Halaman tidak ditemukan',
      description: `Rute ini tidak terdaftar: ${ctx.hash}`,
    }),
    button({
      label: 'Kembali ke dashboard',
      variant: 'secondary',
      iconName: 'arrow-left',
      onClick: () => ctx.navigate(homeRouteFor(ctx.user.role)),
    }),
  ]);
}
