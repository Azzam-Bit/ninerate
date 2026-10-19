/**
 * NineRate — ui.js
 *
 * Utilitas Rendering aman + komponen reusable (button, badge, card, modal, toast).
 *
 * KEAMANAN DOM: semua konten pengguna (nama, teks feedback, dsb.) disisipkan
 * memakai textContent, bukan innerHTML. innerHTML hanya dipakai untuk SVG statis
 * yang ditulis sendiri di dalam modul ini (tidak pernah berisi input pengguna).
 * Tidak ada eval dan tidak ada event handler inline.
 */

/* ------------------------------------------------------------------ */
/* Element helper                                                      */
/* ------------------------------------------------------------------ */

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * el('div', { class: 'card', text: 'Halo' }, [child1, child2])
 * - `text` selalu memakai textContent (aman untuk data pengguna).
 * - `html` TIDAK tersedia demi keamanan; gunakan children + text.
 */
export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  const { text, className, dataset, ...rest } = props;

  if (typeof text === 'string' || typeof text === 'number') {
    node.textContent = String(text);
  }
  if (className) node.className = className;
  if (dataset && typeof dataset === 'object') {
    Object.entries(dataset).forEach(([key, value]) => {
      node.dataset[key] = String(value);
    });
  }

  Object.entries(rest).forEach(([key, value]) => {
    if (value === null || value === undefined || value === false) return;
    if (key === 'attrs') {
      Object.entries(value).forEach(([attrName, attrValue]) => {
        if (attrValue === null || attrValue === undefined || attrValue === false) return;
        node.setAttribute(attrName, attrValue === true ? '' : String(attrValue));
      });
      return;
    }
    if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
      return;
    }
    if (key in node) {
      node[key] = value;
    } else {
      node.setAttribute(key, String(value));
    }
  });

  const childList = Array.isArray(children) ? children : [children];
  childList.flat().forEach((child) => {
    if (child === null || child === undefined || child === false) return;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  });

  return node;
}

export function clearNode(node) {
  while (node && node.firstChild) node.removeChild(node.firstChild);
  return node;
}

/* ------------------------------------------------------------------ */
/* Ikon (inline SVG, tanpa library)                                    */
/* ------------------------------------------------------------------ */

const ICON_PATHS = {
  grid: '<rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/>',
  shield: '<path d="M12 3l7.5 3v5.2c0 4.7-3.1 8.4-7.5 10.3-4.4-1.9-7.5-5.6-7.5-10.3V6z"/><path d="M9 12l2 2 4-4"/>',
  flag: '<path d="M6 3v18"/><path d="M6 4.5h12l-2.4 3.4L18 11.3H6"/>',
  users: '<circle cx="9.5" cy="8" r="3.2"/><path d="M3.8 19.5c0-3 2.6-5 5.7-5s5.7 2 5.7 5"/><circle cx="17.2" cy="9" r="2.4"/><path d="M16 14.8c2.3.2 4.2 1.9 4.2 4.2"/>',
  'user-check': '<circle cx="10" cy="8" r="3.4"/><path d="M4 20c0-3.2 2.7-5.4 6-5.4 1.2 0 2.3.3 3.2.8"/><path d="M14.5 18.5l2 2 4-4"/>',
  message: '<path d="M4 5h16v11H9.5L4 20z"/><path d="M8 9h8"/><path d="M8 12.5h5"/>',
  logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10.5 8L6.5 12l4 4"/><path d="M6.5 12H16"/>',
  menu: '<path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/>',
  close: '<path d="M6.5 6.5l11 11"/><path d="M17.5 6.5l-11 11"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5"/><path d="M12 16v.2"/>',
  'check-circle': '<circle cx="12" cy="12" r="9"/><path d="M8 12.4l2.6 2.6L16 9.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.2 2"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
  'eye-off': '<path d="M4 4l16 16"/><path d="M9.6 6.1A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3.3 4.2"/><path d="M6.4 7.9A16.7 16.7 0 0 0 2.5 12S6 18.5 12 18.5c1 0 1.9-.2 2.7-.5"/><path d="M9.9 10a2.6 2.6 0 0 0 3.6 3.7"/>',
  star: '<path d="M12 3.8l2.5 5.1 5.7.8-4.1 4 1 5.6-5.1-2.7-5.1 2.7 1-5.6-4.1-4 5.7-.8z"/>',
  'chevron-right': '<path d="M9 5.5l6.5 6.5L9 18.5"/>',
  'arrow-left': '<path d="M15 5.5L8.5 12l6.5 6.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><path d="M12 7.8v.2"/>',
  'book-open': '<path d="M12 6.5C10.5 5 8.4 4.5 4 4.5v13c4.4 0 6.5.5 8 2 1.5-1.5 3.6-2 8-2v-13c-4.4 0-6.5.5-8 2z"/><path d="M12 6.5v13"/>',
  edit: '<path d="M4 20h4l10.5-10.5a2.4 2.4 0 0 0-3.4-3.4L4.5 16.6z"/><path d="M14.5 6.5l3 3"/>',
  inbox: '<path d="M3.5 13.5h4l1.5 3h6l1.5-3h4"/><path d="M4.5 5.5h15l1 8v5H3.5v-5z"/>',
};

/**
 * Ikon SVG statis. `source` berasal dari konstanta internal modul ini saja,
 * bukan dari input pengguna.
 */
export function icon(name, size = 18) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.7');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.innerHTML = ICON_PATHS[name] || ICON_PATHS.info;
  return svg;
}

/* ------------------------------------------------------------------ */
/* Komponen                                                            */
/* ------------------------------------------------------------------ */

export function button({
  label,
  iconName = null,
  variant = 'primary',
  size = 'md',
  type = 'button',
  onClick = null,
  disabled = false,
  block = false,
  title = '',
}) {
  const classes = ['btn', `btn--${variant}`];
  if (size === 'sm') classes.push('btn--sm');
  if (block) classes.push('btn--block');

  const node = el(
    'button',
    {
      className: classes.join(' '),
      type,
      disabled,
      title: title || undefined,
      attrs: { 'aria-label': !label && iconName ? title || iconName : undefined },
      onClick: onClick ? (event) => onClick(event) : null,
    },
    [
      iconName ? el('span', { className: 'btn__icon' }, [icon(iconName, 16)]) : null,
      label ? el('span', { text: label }) : null,
    ],
  );
  return node;
}

export const STATUS_META = {
  pending: { label: 'Menunggu moderasi', variant: 'pending' },
  approved: { label: 'Disetujui', variant: 'approved' },
  rejected: { label: 'Ditolak', variant: 'rejected' },
  hidden: { label: 'Disembunyikan', variant: 'hidden' },
  open: { label: 'Terbuka', variant: 'pending' },
  in_review: { label: 'Ditinjau admin', variant: 'info' },
  resolved: { label: 'Selesai ditinjau', variant: 'approved' },
};

export function badge(text, variant = 'info', withDot = true) {
  return el('span', { className: `badge badge--${variant}` }, [
    withDot ? el('span', { className: 'badge__dot' }) : null,
    el('span', { text }),
  ]);
}

export function statusBadge(status) {
  const meta = STATUS_META[status] || { label: 'Tidak diketahui', variant: 'info' };
  return badge(meta.label, meta.variant);
}

/** Aksi sekunder yang tidak menonjol (mis. "Laporkan"). */
export function linkButton({ label, onClick = null, iconName = null, title = '' }) {
  return el(
    'button',
    {
      className: 'btn-link',
      type: 'button',
      title: title || label,
      onClick: onClick ? (event) => onClick(event) : null,
    },
    [
      iconName ? el('span', { className: 'btn-link__icon' }, [icon(iconName, 14)]) : null,
      el('span', { text: label }),
    ],
  );
}

export function card(children, { compact = false, flat = false } = {}) {
  const classes = ['card'];
  if (compact) classes.push('card--compact');
  if (flat) classes.push('card--flat');
  return el('section', { className: classes.join(' ') }, children);
}

export function cardHead(title, subtitle, actionNode = null) {
  return el('div', { className: 'card__head' }, [
    el('div', {}, [
      el('h3', { className: 'card__title', text: title }),
      subtitle ? el('p', { className: 'card__subtitle', text: subtitle }) : null,
    ]),
    actionNode,
  ]);
}

export function avatar(name, large = false) {
  const source = typeof name === 'string' ? name.trim() : '';
  const initials = source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
  return el('span', {
    className: large ? 'avatar avatar--lg' : 'avatar',
    text: initials || '?',
    attrs: { 'aria-hidden': 'true' },
  });
}

export function field({ label, input, hint = '', error = '' }) {
  const nodes = [
    el('label', { className: 'field__label', text: label, attrs: { for: input.id } }),
    input,
  ];

  if (error) {
    nodes.push(el('p', { className: 'field__error', attrs: { id: `${input.id}-error`, role: 'alert' }, text: error }));
  } else if (hint) {
    nodes.push(el('p', { className: 'field__hint', text: hint }));
  }

  if (error && input.setAttribute) input.setAttribute('aria-invalid', 'true');
  if (error && input.setAttribute) input.setAttribute('aria-describedby', `${input.id}-error`);

  return el('div', { className: error ? 'field field--invalid' : 'field' }, nodes);
}

/** Penghitung karakter untuk textarea (diperbarui oleh halaman). */
export function charCounter(input, maxLength) {
  const node = el('p', {
    className: 'field__counter',
    attrs: { 'aria-live': 'polite' },
    text: `0 / ${maxLength}`,
  });
  const update = () => {
    const length = typeof input.value === 'string' ? input.value.length : 0;
    node.textContent = `${length} / ${maxLength}`;
    node.classList.toggle('is-over', length > maxLength);
  };
  input.addEventListener('input', update);
  update();
  return node;
}

/* ------------------------------------------------------------------ */
/* Rating (bintang, ringkasan, distribusi)                            */
/* ------------------------------------------------------------------ */

/** Bintang tampilan. `rating` boleh desimal (rata-rata) atau null. */
export function ratingStars(rating, { size = 16, label = '' } = {}) {
  const value = Number(rating);
  const valid = Number.isFinite(value);
  const nodes = [];

  for (let index = 1; index <= 5; index += 1) {
    const filled = valid && index <= Math.round(value);
    const star = icon('star', size);
    star.classList.add('rating-star');
    if (filled) {
      star.classList.add('rating-star--filled');
      star.setAttribute('fill', 'currentColor');
    }
    nodes.push(star);
  }

  return el(
    'span',
    { className: 'rating', attrs: { 'aria-label': label || (valid ? `Rating ${value} dari 5` : 'Belum ada penilaian') } },
    nodes,
  );
}

/** Nilai rata-rata + jumlah penilaian, atau "Belum ada penilaian". */
export function ratingSummary(stats) {
  if (!stats || !stats.hasRatings) {
    return el('div', { className: 'rating-summary' }, [
      el('span', { className: 'rating-summary__label', text: 'Belum ada penilaian' }),
    ]);
  }

  return el('div', { className: 'rating-summary' }, [
    el('span', { className: 'rating-summary__value', text: stats.averageLabel }),
    ratingStars(stats.average),
    el('span', {
      className: 'rating-summary__count',
      text: `dari ${stats.count} ${stats.count === 1 ? 'penilaian' : 'penilaian'}`,
    }),
  ]);
}

/** Distribusi bintang 1-5. Persentase dihitung di domain, aman saat nol. */
export function ratingDistribution(stats) {
  if (!stats || !stats.hasRatings) {
    return el('p', { className: 'text-muted', text: 'Belum ada penilaian.' });
  }

  return el(
    'ul',
    { className: 'rating-distribution' },
    stats.distribution.map((entry) => {
      const fill = el('span', { className: 'rating-distribution__fill' });
      /* Lebar bar berasal dari data nyata, bukan konten pengguna. */
      fill.style.width = `${entry.percent}%`;
      return el('li', { className: 'rating-distribution__row' }, [
        el('span', { className: 'rating-distribution__label', text: `${entry.rating} bintang` }),
        el('span', { className: 'rating-distribution__bar' }, [fill]),
        el('span', { className: 'rating-distribution__value', text: `${entry.count} (${entry.percent}%)` }),
      ]);
    }),
  );
}

/** Groupradio rating 1-5 yang bisa dipakai form. */
export function ratingInputGroup({ name = 'rating', value = '', onChange = null }) {
  const labels = ['Sangat perlu perbaikan', 'Perlu perbaikan', 'Cukup', 'Baik', 'Sangat baik'];

  const group = el('div', {
    className: 'rating-options',
    attrs: { role: 'radiogroup', 'aria-label': 'Rating keseluruhan 1 sampai 5' },
  });

  labels.forEach((label, index) => {
    const rating = index + 1;
    const inputId = `${name}-${rating}`;
    const input = el('input', {
      className: 'rating-options__input',
      type: 'radio',
      name,
      value: String(rating),
      checked: String(value) === String(rating),
      attrs: { id: inputId },
      onChange: () => {
        if (onChange) onChange(rating);
      },
    });
    group.append(
      el('label', { className: 'rating-options__item', attrs: { for: inputId } }, [
        input,
        el('span', { className: 'rating-options__stars' }, [ratingStars(rating, { size: 14 })]),
        el('span', { className: 'rating-options__text' }, [
          el('strong', { text: String(rating) }),
          el('span', { text: label }),
        ]),
      ]),
    );
  });

  return group;
}

export function alert(message, variant = 'info', iconName = 'info') {
  return el('div', { className: `alert alert--${variant}`, attrs: { role: variant === 'error' ? 'alert' : 'status' } }, [
    el('span', { className: 'alert__icon' }, [icon(iconName, 16)]),
    el('p', { text: message }),
  ]);
}

/** Placeholder konsisten untuk fitur tahap berikutnya. */
export function placeholderCard({ title, description, items = [], stage = 'Tahap 2' }) {
  return card(
    [
      el('div', { className: 'placeholder' }, [
        el('div', { className: 'placeholder__head' }, [
          el('span', { className: 'empty-state__icon' }, [icon('clock', 18)]),
          el('h3', { text: title }),
          badge(stage, 'brand'),
        ]),
        el('p', { text: description }),
        items.length
          ? el('ul', { className: 'placeholder__list' }, items.map((item) => el('li', { text: item })))
          : null,
        alert(
          'Halaman ini sudah memiliki tampilan dan rute, tetapi belum ada aksi interaktif yang berfungsi.',
          'warning',
          'alert',
        ),
      ]),
    ],
    { flat: true },
  );
}

export function emptyState(message, iconName = 'inbox', { title = '', actionNode = null } = {}) {
  return el('div', { className: 'empty-state' }, [
    el('span', { className: 'empty-state__icon' }, [icon(iconName, 24)]),
    title ? el('h3', { className: 'empty-state__title', text: title }) : null,
    el('p', { text: message }),
    actionNode ? el('div', { className: 'empty-state__action' }, [actionNode]) : null,
  ]);
}

export function statCard({ label, value, meta = '' }) {
  return el('div', { className: 'card stat-card' }, [
    el('p', { className: 'stat-card__label', text: label }),
    el('p', { className: 'stat-card__value', text: String(value) }),
    meta ? el('p', { className: 'stat-card__meta', text: meta }) : null,
  ]);
}

export function pageIntro({ title, description, actionNode = null }) {
  return el('div', { className: 'page__intro' }, [
    el('div', {}, [
      el('h1', { text: title }),
      description ? el('p', { className: 'page__description', text: description }) : null,
    ]),
    actionNode,
  ]);
}

/* ------------------------------------------------------------------ */
/* Toast                                                               */
/* ------------------------------------------------------------------ */

export function toast(message, variant = 'info', duration = 3800) {
  const root = document.getElementById('toast-root');
  if (!root) return;

  const iconName = variant === 'error' ? 'alert' : variant === 'success' ? 'check-circle' : 'info';

  const node = el('div', { className: `toast toast--${variant}`, attrs: { role: 'status' } }, [
    el('span', { className: 'toast__icon' }, [icon(iconName, 16)]),
    el('p', { text: message }),
    el('button', {
      className: 'toast__close',
      type: 'button',
      attrs: { 'aria-label': 'Tutup notifikasi' },
      text: '\u00d7',
      onClick: () => node.remove(),
    }),
  ]);

  root.append(node);
  window.setTimeout(() => node.remove(), duration);
}

/* ------------------------------------------------------------------ */
/* Modal                                                               */
/* ------------------------------------------------------------------ */

let activeModalCloser = null;

/** Menutup modal yang sedang terbuka (dipakai router saat navigasi). */
export function closeModal() {
  if (typeof activeModalCloser === 'function') activeModalCloser();
}

/**
 * Modal konfirmasi sederhana.
 * - `description` (string) disisipkan dengan textContent.
 * - `content` (Node) dipakai bila modal berisi form/konten khusus.
 * onConfirm boleh async; tombol konfirmasi nonaktif selama proses berjalan.
 */
export function openModal({
  title,
  description,
  content = null,
  confirmLabel = 'Oke',
  cancelLabel = 'Batal',
  onConfirm = null,
}) {
  const root = document.getElementById('modal-root');
  if (!root) return () => {};

  clearNode(root);

  const previousFocus = document.activeElement;
  const confirmButton = button({ label: confirmLabel, onClick: () => handleConfirm() });

  const close = () => {
    clearNode(root);
    document.removeEventListener('keydown', onKeyDown);
    activeModalCloser = null;
    if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
  };

  activeModalCloser = close;

  const handleConfirm = async () => {
    if (!onConfirm) {
      close();
      return;
    }
    confirmButton.disabled = true;
    try {
      const result = await onConfirm();
      /* onConfirm mengembalikan false bila validasi gagal: modal tetap terbuka
         agar isian pengguna tidak hilang. */
      if (result !== false) close();
    } finally {
      confirmButton.disabled = false;
    }
  };

  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      close();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = Array.from(
      modal.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const modal = el('div', { className: 'modal', attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'modal-title' } }, [
    el('div', { className: 'modal__head' }, [
      el('h2', { className: 'modal__title', id: 'modal-title', text: title }),
      el('button', {
        className: 'modal__close',
        type: 'button',
        text: '\u00d7',
        attrs: { 'aria-label': 'Tutup dialog' },
        onClick: close,
      }),
    ]),
    el('div', { className: 'modal__body' }, [
      description ? el('p', { text: description }) : null,
      content,
    ]),
    el('div', { className: 'modal__actions' }, [
      button({ label: cancelLabel, variant: 'secondary', onClick: close }),
      confirmButton,
    ]),
  ]);

  const backdrop = el('div', {
    className: 'modal-backdrop',
    onClick: (event) => {
      if (event.target === backdrop) close();
    },
  }, [modal]);

  root.append(backdrop);
  document.addEventListener('keydown', onKeyDown);
  confirmButton.focus();

  return close;
}

/* ------------------------------------------------------------------ */
/* Format                                                              */
/* ------------------------------------------------------------------ */

export function formatDate(isoString) {
  if (typeof isoString !== 'string' || isoString === '') return '-';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(date);
}

export function initialsOf(name) {
  return avatar(name).textContent;
}
