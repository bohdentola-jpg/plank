// Inline SVG icons (no icon fonts, no emoji-rendering differences between
// computers). Every icon is drawn on a 32×32 grid and uses currentColor.
const S = (body, vb = '0 0 32 32') => `<svg viewBox="${vb}" aria-hidden="true" focusable="false">${body}</svg>`;

export const ICONS = {
  bag: S(`<path d="M9 11c0-4 3-7 7-7s7 3 7 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
    <rect x="5" y="10" width="22" height="18" rx="6" fill="currentColor"/>
    <rect x="10" y="17" width="12" height="7" rx="2.5" fill="#fff" opacity=".85"/>
    <circle cx="16" cy="20.5" r="1.6" fill="currentColor"/>`),
  book: S(`<path d="M4 7c4-2 8-2 12 1v19c-4-3-8-3-12-1z" fill="currentColor"/>
    <path d="M28 7c-4-2-8-2-12 1v19c4-3 8-3 12-1z" fill="currentColor" opacity=".75"/>
    <path d="M7 11c2-.8 4-.8 6 .3M7 15c2-.8 4-.8 6 .3M19 11.3c2-1.1 4-1.1 6-.3" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".8"/>`),
  marigold: S(`<g transform="translate(16 16)">${Array.from({ length: 12 }, (_, i) => `<ellipse rx="3.6" ry="7" transform="rotate(${i * 30}) translate(0 -6.5)" fill="#ff9a0d" stroke="#c75e00" stroke-width=".8"/>`).join('')}
    ${Array.from({ length: 8 }, (_, i) => `<ellipse rx="2.6" ry="4.6" transform="rotate(${i * 45 + 22}) translate(0 -3.8)" fill="#ffc21a" stroke="#d98a00" stroke-width=".6"/>`).join('')}
    <circle r="3" fill="#f26b1d"/></g>`),
  map: S(`<path d="M3 8l8-3 10 3 8-3v19l-8 3-10-3-8 3z" fill="currentColor"/>
    <path d="M11 5v19M21 8v19" stroke="#fff" stroke-width="1.4" opacity=".55"/>
    <path d="M6 18c3-1 4-5 8-4s5 4 9 2" stroke="#ff9a0d" stroke-width="2" fill="none" stroke-dasharray="2 2.2" stroke-linecap="round"/>
    <circle cx="24.5" cy="14.5" r="2.4" fill="#e4007c"/>`),
  butterfly: S(`<path d="M16 9c-2-4-9-6-11-3s1 9 5 10c-4 1-5 6-2 8s7-2 8-6c1 4 5 8 8 6s2-7-2-8c4-1 7-7 5-10s-9-1-11 3z" fill="#ff8a14" stroke="#2a1a14" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M16 9v16" stroke="#2a1a14" stroke-width="2.2" stroke-linecap="round"/>
    <circle cx="9" cy="10" r="1.1" fill="#fff"/><circle cx="23" cy="10" r="1.1" fill="#fff"/>`),
  sound: S(`<path d="M5 12h5l7-6v20l-7-6H5z" fill="currentColor"/>
    <path d="M21 11c2 2 2 8 0 10M24.5 8c4 4 4 12 0 16" stroke="currentColor" stroke-width="2.6" fill="none" stroke-linecap="round"/>`),
  mute: S(`<path d="M5 12h5l7-6v20l-7-6H5z" fill="currentColor"/>
    <path d="M21 12l7 8M28 12l-7 8" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>`),
  menu: S(`<path d="M7 9h18M7 16h18M7 23h18" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/>`),
  close: S(`<path d="M9 9l14 14M23 9L9 23" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>`),
  star: S(`<path d="M16 3l3.8 8 8.7 1-6.5 6 1.8 8.7L16 22.4 8.2 26.7 10 18l-6.5-6 8.7-1z" fill="currentColor" stroke="#2a1a14" stroke-width="1.4" stroke-linejoin="round"/>`),
  back: S(`<path d="M19 6L9 16l10 10" stroke="currentColor" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`),
  next: S(`<path d="M12 6l10 10-10 10" stroke="currentColor" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`),
  check: S(`<path d="M6 17l6 6L26 9" stroke="currentColor" stroke-width="4.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`),
  lock: S(`<rect x="7" y="14" width="18" height="14" rx="3.5" fill="currentColor"/><path d="M11 14v-3a5 5 0 0110 0v3" stroke="currentColor" stroke-width="3" fill="none"/><circle cx="16" cy="21" r="2" fill="#fff"/>`),
  camera: S(`<rect x="3" y="9" width="26" height="18" rx="4" fill="currentColor"/><path d="M11 9l2-4h6l2 4" fill="currentColor"/><circle cx="16" cy="18" r="5.5" fill="#fff"/><circle cx="16" cy="18" r="3" fill="currentColor"/>`),
  speak: S(`<path d="M4 12h5l6-5v18l-6-5H4z" fill="currentColor"/><path d="M19 12c1.6 1.6 1.6 6.4 0 8M22 9c3.2 3.2 3.2 10.8 0 14" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round"/>`),
  home: S(`<path d="M4 15L16 5l12 10" stroke="currentColor" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 14v13h6v-7h4v7h6V14" fill="currentColor"/>`),
  heart: S(`<path d="M16 27S4 19.5 4 11.5A6 6 0 0116 8a6 6 0 0112 3.5C28 19.5 16 27 16 27z" fill="currentColor"/>`),
  paw: S(`<ellipse cx="16" cy="21" rx="6.5" ry="5.5" fill="currentColor"/><circle cx="8" cy="13" r="3" fill="currentColor"/><circle cx="13" cy="8.5" r="3" fill="currentColor"/><circle cx="19" cy="8.5" r="3" fill="currentColor"/><circle cx="24" cy="13" r="3" fill="currentColor"/>`),
  candle: S(`<rect x="11" y="13" width="10" height="15" rx="2" fill="currentColor"/><path d="M16 3c3 4 3 7 0 8-3-1-3-4 0-8z" fill="#ff9a0d"/>`),
  question: S(`<path d="M11 11a5 5 0 1110 0c0 4-5 4-5 8" stroke="currentColor" stroke-width="3.6" fill="none" stroke-linecap="round"/><circle cx="16" cy="25.5" r="2.4" fill="currentColor"/>`),
  trash: S(`<path d="M6 9h20M13 9V6h6v3M8 9l1.5 18h13L24 9" stroke="currentColor" stroke-width="2.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`),
  rotate: S(`<path d="M25 12a10 10 0 10.5 7" stroke="currentColor" stroke-width="3.2" fill="none" stroke-linecap="round"/><path d="M26 5v8h-8" stroke="currentColor" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`),
  undo: S(`<path d="M10 12H20a6 6 0 010 12h-6" stroke="currentColor" stroke-width="3.2" fill="none" stroke-linecap="round"/><path d="M14 6l-6 6 6 6" stroke="currentColor" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`),
  download: S(`<path d="M16 4v15M9 13l7 7 7-7" stroke="currentColor" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 22v5h22v-5" stroke="currentColor" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`),
  print: S(`<rect x="8" y="4" width="16" height="8" fill="currentColor"/><rect x="4" y="11" width="24" height="11" rx="3" fill="currentColor"/><rect x="9" y="18" width="14" height="10" fill="#fff" stroke="currentColor" stroke-width="2"/>`),
  pencil: S(`<path d="M6 26l2-7L21 6l5 5-13 13z" fill="currentColor"/><path d="M6 26l2-7 5 5z" fill="#ffc21a"/>`),
  eraser: S(`<path d="M5 21l11-11 9 9-7 7H11z" fill="currentColor"/><path d="M11 26h16" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>`),
  globe: S(`<circle cx="16" cy="16" r="12" fill="none" stroke="currentColor" stroke-width="2.8"/><path d="M4 16h24M16 4c5 4 5 20 0 24M16 4c-5 4-5 20 0 24" stroke="currentColor" stroke-width="2.2" fill="none"/>`),
  cards: S(`<rect x="4" y="6" width="14" height="20" rx="2.5" fill="currentColor" opacity=".55" transform="rotate(-10 11 16)"/><rect x="13" y="5" width="15" height="21" rx="2.5" fill="currentColor"/><path d="M17 11h7M17 15h7M17 19h5" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>`),
  info: S(`<circle cx="16" cy="16" r="12.5" fill="currentColor"/><circle cx="16" cy="9.5" r="2.2" fill="#fff"/><rect x="14" y="13.5" width="4" height="11" rx="2" fill="#fff"/>`),
  play: S(`<path d="M10 6l16 10-16 10z" fill="currentColor"/>`),
  sparkle: S(`<path d="M16 3l2.5 10.5L29 16l-10.5 2.5L16 29l-2.5-10.5L3 16l10.5-2.5z" fill="currentColor"/>`),
  gear: S(`<path d="M16 10.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11z" fill="none" stroke="currentColor" stroke-width="3"/><path d="M16 3v4M16 25v4M3 16h4M25 16h4M6.8 6.8l2.8 2.8M22.4 22.4l2.8 2.8M6.8 25.2l2.8-2.8M22.4 9.6l2.8-2.8" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>`),
};

export function icon(name, cls = '') {
  return `<span class="ico ${cls}">${ICONS[name] || ''}</span>`;
}

// fill every <span class="ico" data-icon="..."> in a subtree
export function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((el) => {
    if (!el.dataset.filled) {
      el.innerHTML = ICONS[el.dataset.icon] || '';
      el.dataset.filled = '1';
    }
  });
}
