// DOM helpers, inline icons, and the overlay (panel) stack.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function el(tag, attrs = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    node.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return node;
}

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------------------------------------------------------------- icons

const S = (body) => `<svg viewBox="0 0 32 32" aria-hidden="true" stroke-linejoin="round" stroke-linecap="round">${body}</svg>`;
export const ICONS = {
  map: S('<path d="M4 8l7-3 10 3 7-3v19l-7 3-10-3-7 3z" fill="#3ec7b0" stroke="#140f26" stroke-width="3"/><path d="M11 5v19M21 8v19" stroke="#140f26" stroke-width="2.4" fill="none"/><circle cx="16" cy="14" r="2.6" fill="#e8456b" stroke="#140f26" stroke-width="1.6"/>'),
  shop: S('<path d="M5 12l11-8 11 8v14H5z" fill="#ffd23f" stroke="#140f26" stroke-width="3"/><path d="M5 12h22" stroke="#140f26" stroke-width="3"/><rect x="12" y="17" width="8" height="9" fill="#e8456b" stroke="#140f26" stroke-width="2.4"/>'),
  bag: S('<path d="M11 11V9a5 5 0 0110 0v2" fill="none" stroke="#140f26" stroke-width="3"/><path d="M5 11h22l-2 16H7z" fill="#ff4f9a" stroke="#140f26" stroke-width="3"/><path d="M13 18l2 2 4-5" fill="none" stroke="#fffaf0" stroke-width="2.6"/>'),
  me: S('<path d="M16 3l3.6 8 8.4.7-6.4 5.6 2 8.4L16 21.3 8.4 25.7l2-8.4L4 11.7l8.4-.7z" fill="#7b5cff" stroke="#140f26" stroke-width="3"/>'),
  soundOn: S('<path d="M5 12h5l7-6v20l-7-6H5z" fill="#3ec7b0" stroke="#140f26" stroke-width="3"/><path d="M21 11a6 6 0 010 10M24 7a11 11 0 010 18" fill="none" stroke="#140f26" stroke-width="3"/>'),
  soundOff: S('<path d="M5 12h5l7-6v20l-7-6H5z" fill="#b3a9e0" stroke="#140f26" stroke-width="3"/><path d="M21 12l7 8M28 12l-7 8" stroke="#140f26" stroke-width="3"/>'),
};

// ---------------------------------------------------------------- overlays

const stack = [];
let onChange = () => {};
export function onOverlayChange(fn) { onChange = fn; }
export const anyOverlay = () => stack.length > 0;
export const topOverlay = () => stack[stack.length - 1] || null;

// build(panel, close) fills the panel; returns optional { onClose }.
export function openOverlay(id, build, opts = {}) {
  closeOverlay(id, true);
  const root = document.getElementById('overlays');
  const overlay = el('div', { class: 'overlay', id: `ov-${id}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': opts.label || id });
  const panel = el('div', { class: `panel ${opts.panelClass || ''}` });
  overlay.append(panel);
  const entry = { id, overlay, panel, opts, prevFocus: document.activeElement, cleanup: null };
  const close = () => closeOverlay(id);
  if (opts.dismissable !== false) {
    overlay.addEventListener('pointerdown', (e) => {
      if (e.target === overlay) close();
    });
  }
  root.append(overlay);
  stack.push(entry);
  const res = build(panel, close) || {};
  entry.cleanup = res.onClose || null;
  requestAnimationFrame(() => {
    const f = panel.querySelector('[autofocus]') || panel.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (f && !opts.noFocus) f.focus({ preventScroll: true });
  });
  onChange();
  return entry;
}

export function closeOverlay(id, instant = false) {
  const i = id ? stack.findIndex((e) => e.id === id) : stack.length - 1;
  if (i < 0) return false;
  const [entry] = stack.splice(i, 1);
  if (entry.cleanup) entry.cleanup();
  if (instant) entry.overlay.remove();
  else {
    entry.overlay.classList.add('closing');
    setTimeout(() => entry.overlay.remove(), 170);
  }
  if (entry.prevFocus && entry.prevFocus.focus && document.contains(entry.prevFocus)) entry.prevFocus.focus({ preventScroll: true });
  onChange();
  return true;
}

export function closeAll() {
  while (stack.length) closeOverlay(null, true);
}

// keep Tab inside the top overlay
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Tab' || !stack.length) return;
  const panel = topOverlay().panel;
  const f = [...panel.querySelectorAll('button:not([disabled]), [href], input:not([hidden]), select, textarea, [tabindex]:not([tabindex="-1"])')].filter((n) => n.offsetParent !== null);
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});

export function panelHead(title, sub, opts = {}) {
  const head = el('div', { class: 'panel-head' });
  if (opts.portrait) head.append(opts.portrait);
  const txt = el('div', { style: { minWidth: '0' } },
    el('h2', { class: 'panel-title', style: opts.color ? { color: opts.color } : null }, title),
    sub ? (opts.speech ? el('div', { class: 'speech' }, sub) : el('p', { class: 'panel-sub' }, sub)) : null);
  head.append(txt);
  return head;
}

export function xButton(close, label = 'Close') {
  return el('button', { type: 'button', class: 'x-btn', 'aria-label': label, onclick: close }, '✕');
}
