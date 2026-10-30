// Calendar helpers. Everything "daily" is keyed by the local date, and every
// daily roll (deals, missions, floor tokens, claw prizes) is seeded from it,
// so everyone sees the same deals on the same day.
import { mulberry32, hashStr } from '../ink.js';
import { devParams } from '../dev.js';

// QA (local only, see dev.js): ?day=+1 (or -2, or 2026-12-25) shifts "today".
let offsetDays = 0;
try {
  // a '+' in a URL arrives as a space, so '?day=+1' reads as ' 1'
  const q = (devParams.get('day') || '').trim();
  if (q && /^[+-]?\d+$/.test(q)) offsetDays = parseInt(q, 10);
  else if (q && /^\d{4}-\d{2}-\d{2}$/.test(q)) {
    const [y, m, d] = q.split('-').map(Number);
    offsetDays = Math.round((new Date(y, m - 1, d) - startOfDay(new Date())) / 864e5);
  }
} catch { /* no location in tests */ }

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function now() {
  return new Date(Date.now() + offsetDays * 864e5);
}

export function shiftDays(n) { offsetDays += n; }

export function dayKey(d = now()) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function keyToDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function daysBetween(a, b) {
  return Math.round((keyToDate(b) - keyToDate(a)) / 864e5);
}

export function addDays(key, n) {
  const d = keyToDate(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

export function msToMidnight() {
  const n = now();
  const next = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1);
  return next - n;
}

export function fmtCountdown(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

// weeks since 2024-01-01 (a Monday), Monday-based
export function weekIndex(d = now()) {
  const base = new Date(2024, 0, 1);
  return Math.floor((startOfDay(d) - base) / (7 * 864e5));
}

export function dayRng(salt = '', key = dayKey()) {
  return mulberry32(hashStr(`${key}:${salt}`));
}

export function isMidnightHour() {
  return now().getHours() === 0;
}

export function weekdayName(key) {
  return ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][keyToDate(key).getDay()];
}
