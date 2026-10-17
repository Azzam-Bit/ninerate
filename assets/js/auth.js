/**
 * NineRate — auth.js
 *
 * Autentikasi demo berbasis LocalStorage.
 * PENTING: ini hanya simulasi untuk prototype lokal. Password plaintext,
 * session bisa dibaca/diubah lewat DevTools, dan tidak ada sinkronisasi
 * antar perangkat. Jangan gunakan pola ini untuk aplikasi nyata.
 */

import { storage } from './storage.js';

export const HOME_ROUTES = {
  admin: '#/admin/dashboard',
  teacher: '#/teacher/dashboard',
  student: '#/student/dashboard',
};

export const ROLE_LABELS = {
  admin: 'Admin',
  teacher: 'Guru',
  student: 'Murid',
};

export function homeRouteFor(role) {
  return HOME_ROUTES[role] || '#/login';
}

/**
 * Membaca sesi aktif.
 * Mengembalikan user dari storage berdasarkan session.userId.
 * Jika user tidak ada atau nonaktif, sesi dibersihkan dan null dikembalikan.
 */
export function currentUser() {
  const session = storage.getSession();
  if (!session) return { user: null, invalidated: false, reason: '' };

  const user = storage.findUserById(session.userId);
  if (!user) {
    storage.clearSession();
    return { user: null, invalidated: true, reason: 'missing' };
  }
  if (!user.active) {
    storage.clearSession();
    return { user: null, invalidated: true, reason: 'inactive' };
  }

  return { user, invalidated: false, reason: '' };
}

/**
 * Login demo.
 * @returns {{ok: boolean, message: string, user: object|null}}
 */
export function login(username, password) {
  const inputUsername = typeof username === 'string' ? username.trim() : '';
  const inputPassword = typeof password === 'string' ? password : '';

  if (!inputUsername || !inputPassword) {
    return { ok: false, message: 'Username dan password wajib diisi.', user: null };
  }

  const user = storage.findUserByUsername(inputUsername);
  if (!user || user.password !== inputPassword) {
    return {
      ok: false,
      message: 'Username atau password salah. Gunakan kredensial demo yang tercantum di README.',
      user: null,
    };
  }

  if (!user.active) {
    return {
      ok: false,
      message: 'Akun ini berstatus nonaktif. Hubungi admin sekolah.',
      user: null,
    };
  }

  const loginAt = new Date().toISOString();
  storage.saveSession({ userId: user.id, loginAt });
  storage.updateUser(user.id, { lastLoginAt: loginAt });

  return { ok: true, message: `Selamat datang, ${user.fullName || user.username}.`, user };
}

/** Logout: menghapus sesi, bukan data demo. */
export function logout() {
  storage.clearSession();
}

/** Guard role di sisi perutean: bukan hanya menyembunyikan menu. */
export function hasRoleAccess(user, allowedRoles) {
  if (!user || !Array.isArray(allowedRoles) || allowedRoles.length === 0) return false;
  return allowedRoles.includes(user.role);
}

export function roleLabel(role) {
  return ROLE_LABELS[role] || 'Tidak diketahui';
}