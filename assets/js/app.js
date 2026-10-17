/**
 * NineRate — app.js
 * Entry point: inisialisasi data demo, application shell, dan router.
 */

import { ensureSeedData } from './seed.js';
import { logout, roleLabel } from './auth.js';
import { SCHOOL_LOGO_PATH } from './storage.js';
import { LOGIN_ROUTE, initRouter, navRoutesFor, navigate, sectionLabelFor } from './router.js';
import { renderNotFound } from './pages.js';
import { avatar, el, icon, openModal, toast } from './ui.js';

const appRoot = document.getElementById('app');

/* ------------------------------------------------------------------ */
/* Bootstrap                                                           */
/* ------------------------------------------------------------------ */

function bootstrapData() {
  const result = ensureSeedData();
  if (result.migration && result.migration.migrated) {
    console.info(
      `[NineRate] Data skema v${result.migration.from} dimigrasikan ke v${result.migration.to} (data lama dipertahankan).`,
    );
  }
  if (result.seeded) {
    console.info('[NineRate] Data demo diinisialisasi untuk pertama kali.');
  } else {
    console.info('[NineRate] Data demo sudah ada, tidak ditimpa.');
  }
}

function initShellActions() {
  const skipLink = document.getElementById('skip-link');
  if (skipLink) {
    skipLink.addEventListener('click', () => {
      const main = document.getElementById('main-content');
      window.scrollTo({ top: 0, behavior: 'auto' });
      if (main) main.focus();
    });
  }
}

/* ------------------------------------------------------------------ */
/* Sidebar                                                             */
/* ------------------------------------------------------------------ */

function renderBrandBlock() {
  return el('div', { className: 'sidebar-brand' }, [
    el('img', {
      className: 'sidebar-brand__logo',
      src: SCHOOL_LOGO_PATH,
      alt: '',
      width: 40,
      height: 40,
    }),
    el('span', { className: 'sidebar-brand__text' }, [
      el('span', { className: 'sidebar-brand__name', text: 'NineRate' }),
      el('span', { className: 'sidebar-brand__tagline', text: 'Better feedback. Better learning.' }),
    ]),
  ]);
}

function renderSidebar(user, activeRouteId) {
  const routes = navRoutesFor(user.role);

  const nav = el(
    'nav',
    { className: 'sidebar-nav', attrs: { 'aria-label': 'Navigasi utama' } },
    [
      el('p', { className: 'sidebar-section-label', text: sectionLabelFor(user.role) }),
      ...routes.map((route) =>
        el(
          'a',
          {
            className: route.id === activeRouteId ? 'nav-item is-active' : 'nav-item',
            href: route.path,
            attrs: {
              'aria-current': route.id === activeRouteId ? 'page' : null,
            },
          },
          [
            el('span', { className: 'nav-item__icon' }, [icon(route.icon, 18)]),
            el('span', { text: route.title }),
          ],
        ),
      ),
    ],
  );

  const footer = el('div', { className: 'sidebar-footer' }, [
    el('img', {
      className: 'sidebar-brand__logo',
      src: SCHOOL_LOGO_PATH,
      alt: '',
      width: 32,
      height: 32,
    }),
    el('span', { className: 'sidebar-footer__text' }, [
      el('span', { className: 'sidebar-footer__name', text: 'SMK Negeri 9 Kota Bekasi' }),
      el('span', { className: 'sidebar-footer__label', text: 'Dukungan NineRate' }),
    ]),
  ]);

  return el('aside', { className: 'sidebar', id: 'sidebar' }, [renderBrandBlock(), nav, footer]);
}

/* ------------------------------------------------------------------ */
/* Header                                                              */
/* ------------------------------------------------------------------ */

function renderHeader(user, route) {
  const titleNode = el('h1', { className: 'app-header__title', text: route.title });
  const subtitleNode = el('p', { className: 'app-header__subtitle', text: route.subtitle || 'NineRate' });

  const identity = el('div', { className: 'header-identity' }, [
    avatar(user.fullName || user.username),
    el('span', { className: 'header-identity__meta' }, [
      el('span', { className: 'header-identity__name', text: user.fullName || user.username }),
      el('span', { className: 'header-identity__role', text: roleLabel(user.role) }),
    ]),
  ]);

  return el('header', { className: 'app-header' }, [
    el('button', {
      className: 'menu-toggle',
      type: 'button',
      attrs: { 'aria-label': 'Buka menu navigasi', 'aria-controls': 'sidebar', 'aria-expanded': 'false' },
      onClick: () => toggleMobileMenu(),
    }, [icon('menu', 20)]),
    el('div', { className: 'app-header__titles' }, [titleNode, subtitleNode]),
    identity,
    el('button', {
      className: 'btn btn--secondary btn--sm',
      type: 'button',
      onClick: () => confirmLogout(user),
    }, [
      el('span', { className: 'btn__icon' }, [icon('logout', 16)]),
      el('span', { text: 'Logout' }),
    ]),
  ]);
}

/* ------------------------------------------------------------------ */
/* Mobile menu                                                         */
/* ------------------------------------------------------------------ */

function toggleMobileMenu(force) {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('nav-backdrop');
  const toggle = document.querySelector('.menu-toggle');
  if (!sidebar || !backdrop) return;

  const shouldOpen = typeof force === 'boolean' ? force : !sidebar.classList.contains('is-open');
  sidebar.classList.toggle('is-open', shouldOpen);
  backdrop.classList.toggle('is-visible', shouldOpen);
  if (toggle) toggle.setAttribute('aria-expanded', String(shouldOpen));
}

function closeMobileMenu() {
  toggleMobileMenu(false);
}

/* ------------------------------------------------------------------ */
/* Logout                                                              */
/* ------------------------------------------------------------------ */

function confirmLogout(user) {
  openModal({
    title: 'Keluar dari NineRate?',
    description: `Sesi ${user.fullName || user.username} akan dihapus dari browser ini. Data demo tetap tersimpan.`,
    confirmLabel: 'Logout',
    cancelLabel: 'Batal',
    onConfirm: () => {
      logout();
      closeMobileMenu();
      navigate(LOGIN_ROUTE, { replace: true });
      toast('Anda telah logout. Terima kasih sudah menggunakan NineRate.', 'success');
    },
  });
}

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

function buildContext({ user, hash, params }) {
  return {
    user,
    hash,
    params: params || {},
    navigate: (target, options) => navigate(target, options),
    toast: (message, variant) => toast(message, variant),
  };
}

function renderApp({ mode, hash, user, route, params }) {
  if (mode === 'login') {
    const view = route.render(buildContext({ user: null, hash, params }));
    appRoot.replaceChildren(view);
    document.title = 'Masuk — NineRate';
    return;
  }

  const context = buildContext({ user, hash, params });

  let viewNode;
  if (mode === 'not-found') {
    viewNode = renderNotFound(context);
  } else {
    viewNode = route.render(context);
  }

  const backdrop = el('button', {
    className: 'nav-backdrop',
    id: 'nav-backdrop',
    type: 'button',
    attrs: { 'aria-label': 'Tutup menu navigasi' },
    onClick: () => closeMobileMenu(),
  });

  const shell = el('div', { className: 'app-shell' }, [
    backdrop,
    renderSidebar(user, mode === 'page' ? route.id : null),
    el('div', { className: 'app-main' }, [
      mode === 'page' ? renderHeader(user, route) : null,
      el('main', { className: 'app-main-content', id: 'main-content', tabIndex: -1 }, [viewNode]),
    ]),
  ]);

  appRoot.replaceChildren(shell);
  document.title = `${mode === 'page' ? route.title : 'Halaman tidak ditemukan'} — NineRate`;
  closeMobileMenu();
  window.scrollTo({ top: 0, behavior: 'auto' });
}

/* ------------------------------------------------------------------ */
/* Start                                                               */
/* ------------------------------------------------------------------ */

function start() {
  if (!appRoot) {
    console.error('[NineRate] Elemen #app tidak ditemukan pada index.html.');
    return;
  }

  bootstrapData();

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMobileMenu();
  });

  initShellActions();
  initRouter(renderApp);
}

start();