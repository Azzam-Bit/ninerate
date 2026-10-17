/**
 * NineRate — router.js
 *
 * Hash routing + guard role.
 *
 * Guard role di sini bersifat nyata (bukan sekadar menyembunyikan menu):
 * setiap rute divalidasi terhadap peran pengguna yang tersimpan di sesi.
 */

import { currentUser, homeRouteFor, hasRoleAccess } from './auth.js';
import { closeModal, toast } from './ui.js';
import {
  renderAdminAccounts,
  renderAdminDashboard,
  renderAdminModeration,
  renderAdminReports,
  renderAdminTeachers,
  renderLogin,
  renderNotFound,
  renderStudentDashboard,
  renderStudentMyFeedback,
  renderStudentTeacherDetail,
  renderStudentTeacherFeedbackForm,
  renderStudentTeachers,
  renderTeacherDashboard,
  renderTeacherFeedback,
  renderTeacherProfile,
} from './pages.js';

export const LOGIN_ROUTE = '#/login';

/** Definisi rute tunggal yang dipakai sidebar, header, dan guard. */
export const ROUTES = [
  {
    id: 'login',
    path: '#/login',
    title: 'Masuk',
    roles: ['guest'],
    icon: 'user-check',
    render: renderLogin,
    nav: false,
  },

  /* Admin */
  {
    id: 'admin.dashboard',
    path: '#/admin/dashboard',
    title: 'Dashboard Admin',
    subtitle: 'Ringkasan sekolah',
    roles: ['admin'],
    icon: 'grid',
    nav: true,
    render: renderAdminDashboard,
  },
  {
    id: 'admin.moderation',
    path: '#/admin/moderation',
    title: 'Moderasi',
    subtitle: 'Antrean umpan balik',
    roles: ['admin'],
    icon: 'shield',
    nav: true,
    render: renderAdminModeration,
  },
  {
    id: 'admin.reports',
    path: '#/admin/reports',
    title: 'Laporan',
    subtitle: 'Laporan murid',
    roles: ['admin'],
    icon: 'flag',
    nav: true,
    render: renderAdminReports,
  },
  {
    id: 'admin.accounts',
    path: '#/admin/accounts',
    title: 'Akun Pengguna',
    subtitle: 'Kelola akun demo',
    roles: ['admin'],
    icon: 'users',
    nav: true,
    render: renderAdminAccounts,
  },
  {
    id: 'admin.teachers',
    path: '#/admin/teachers',
    title: 'Data Guru',
    subtitle: 'Profil guru',
    roles: ['admin'],
    icon: 'book-open',
    nav: true,
    render: renderAdminTeachers,
  },

  /* Guru */
  {
    id: 'teacher.dashboard',
    path: '#/teacher/dashboard',
    title: 'Dashboard Guru',
    subtitle: 'Ringkasan umpan balik',
    roles: ['teacher'],
    icon: 'grid',
    nav: true,
    render: renderTeacherDashboard,
  },
  {
    id: 'teacher.profile',
    path: '#/teacher/profile',
    title: 'Profil Saya',
    subtitle: 'Data akun guru',
    roles: ['teacher'],
    icon: 'user-check',
    nav: true,
    render: renderTeacherProfile,
  },
  {
    id: 'teacher.feedback',
    path: '#/teacher/feedback',
    title: 'Umpan Balik',
    subtitle: 'Feedback murid',
    roles: ['teacher'],
    icon: 'message',
    nav: true,
    render: renderTeacherFeedback,
  },

  /* Murid */
  {
    id: 'student.dashboard',
    path: '#/student/dashboard',
    title: 'Dashboard Murid',
    subtitle: 'Ringkasan umpan balik saya',
    roles: ['student'],
    icon: 'grid',
    nav: true,
    render: renderStudentDashboard,
  },
  {
    id: 'student.teachers',
    path: '#/student/teachers',
    title: 'Daftar Guru',
    subtitle: 'Pilih guru',
    roles: ['student'],
    icon: 'book-open',
    nav: true,
    render: renderStudentTeachers,
  },
  {
    id: 'student.teacher.detail',
    path: '#/student/teachers/:id',
    title: 'Profil Guru',
    subtitle: 'Detail guru',
    roles: ['student'],
    icon: 'user-check',
    nav: false,
    render: renderStudentTeacherDetail,
  },
  {
    id: 'student.teacher.feedback',
    path: '#/student/teachers/:id/feedback',
    title: 'Beri Umpan Balik',
    subtitle: 'Form umpan balik',
    roles: ['student'],
    icon: 'message',
    nav: false,
    render: renderStudentTeacherFeedbackForm,
  },
  {
    id: 'student.my-feedback',
    path: '#/student/my-feedback',
    title: 'Feedback Saya',
    subtitle: 'Riwayat umpan balik',
    roles: ['student'],
    icon: 'inbox',
    nav: true,
    render: renderStudentMyFeedback,
  },
];

const ROLE_SECTION_LABELS = {
  admin: 'Administrasi',
  teacher: 'Guru',
  student: 'Murid',
};

/** Rute navigasi sidebar untuk sebuah role. */
export function navRoutesFor(role) {
  return ROUTES.filter((route) => route.nav && route.roles.includes(role));
}

export function sectionLabelFor(role) {
  return ROLE_SECTION_LABELS[role] || 'Navigasi';
}

/* ------------------------------------------------------------------ */
/* Pencocokan rute                                                     */
/* ------------------------------------------------------------------ */

export function normalizeHash(hash) {
  const raw = typeof hash === 'string' && hash.startsWith('#') ? hash : `#${hash || ''}`;
  if (raw === '#' || raw === '#/' || raw === '#!/') return '#/';
  return raw.replace(/\/+$/, '') || '#/';
}

function splitSegments(hash) {
  return normalizeHash(hash)
    .slice(2)
    .split('/')
    .filter((segment) => segment !== '');
}

/**
 * Cocokkan hash dengan tabel rute, termasuk segmen dinamis (:id).
 * @returns {{route: object, params: object}|null}
 */
export function matchRoute(hash) {
  const segments = splitSegments(hash);

  for (const route of ROUTES) {
    const pattern = splitSegments(route.path);
    if (pattern.length !== segments.length) continue;

    const params = {};
    let matched = true;
    for (let index = 0; index < pattern.length; index += 1) {
      const patternSegment = pattern[index];
      const currentSegment = segments[index];
      if (patternSegment.startsWith(':')) {
        params[patternSegment.slice(1)] = decodeURIComponent(currentSegment);
      } else if (patternSegment !== currentSegment) {
        matched = false;
        break;
      }
    }

    if (matched) return { route, params };
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* Router                                                              */
/* ------------------------------------------------------------------ */

let handleNavigate = () => {};
let redirecting = false;

/** Navigasi programatik (dipakai tombol di halaman). */
export function navigate(hash, { replace = false } = {}) {
  const target = normalizeHash(hash);
  if (normalizeHash(window.location.hash) === target) {
    handleCurrentLocation();
    return;
  }
  if (replace) {
    window.history.replaceState(null, '', target);
    handleCurrentLocation();
    return;
  }
  window.location.hash = target;
}

function redirect(hash, message, variant) {
  if (redirecting) return;
  redirecting = true;
  if (message) toast(message, variant || 'error');
  navigate(hash, { replace: true });
  window.setTimeout(() => {
    redirecting = false;
  }, 0);
}

/**
 * Guard + render.
 * @returns null ketika permintaan dialihkan (mis. route tidak berhak dibuka).
 */
function handleCurrentLocation() {
  const hash = normalizeHash(window.location.hash);
  const session = currentUser();
  const user = session.user;

  /* Navigasi selalu menutup modal yang mungkin masih terbuka. */
  closeModal();

  if (session.invalidated) {
    const reason =
      session.reason === 'inactive'
        ? 'Akun Anda berstatus nonaktif, sesi telah diakhiri.'
        : 'Sesi tidak valid lagi, silakan masuk kembali.';
    redirect(LOGIN_ROUTE, reason, 'warning');
    return null;
  }

  /* Belum login */
  if (!user) {
    if (hash !== LOGIN_ROUTE) {
      redirect(LOGIN_ROUTE, null, 'info');
      return null;
    }
    handleNavigate({ mode: 'login', hash, user: null, route: ROUTES[0], params: {} });
    return null;
  }

  /* Sudah login, buka halaman login, atau hash kosong */
  if (hash === LOGIN_ROUTE || hash === '#/') {
    redirect(homeRouteFor(user.role), null, 'info');
    return null;
  }

  /* Rute tidak dikenal */
  const matched = matchRoute(hash);
  if (!matched) {
    handleNavigate({ mode: 'not-found', hash, user, route: null, params: {} });
    return null;
  }

  /* Guard role */
  if (!hasRoleAccess(user, matched.route.roles)) {
    redirect(homeRouteFor(user.role), 'Akses ditolak. Halaman tersebut tidak tersedia untuk peran Anda.');
    return null;
  }

  handleNavigate({
    mode: 'page',
    hash,
    user,
    route: matched.route,
    params: matched.params,
  });
  return null;
}

export function initRouter(handler) {
  handleNavigate = handler;
  window.addEventListener('hashchange', handleCurrentLocation);

  if (!window.location.hash) {
    const session = currentUser();
    const target = session.user ? homeRouteFor(session.user.role) : LOGIN_ROUTE;
    window.history.replaceState(null, '', target);
  }

  handleCurrentLocation();
}

/** Dipakai app.js untuk akses cepat ke rute berparameter. */
export function teacherDetailPath(profileId) {
  return `#/student/teachers/${encodeURIComponent(profileId)}`;
}