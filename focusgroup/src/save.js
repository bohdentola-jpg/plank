// FOCUS GROUP — what the browser keeps for you.
//
// Which morning you reached, which lenses you found, where you put the gifts,
// what you ticked on the card, and which endings you have seen. Valco keeps
// rather more than this.

const KEY = 'focusgroup_v1';

const BLANK = {
  day: 1,                 // the furthest morning reached
  noticed: [],            // lens ids, in the order they were found
  giftSpots: null,        // { mug, lamp, figurine, alarm } → slot ids
  survey: null,           // answer indices
  endings: [],            // 'said' | 'declined' | 'last'
  engagement: 0,
  runs: 0,
  settings: { sens: 1, invertY: false, volSfx: 0.9, volMusic: 0.6, muted: false, hold: true },
};

function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    return {
      ...BLANK,
      ...raw,
      settings: { ...BLANK.settings, ...(raw.settings || {}) },
      noticed: Array.isArray(raw.noticed) ? raw.noticed : [],
      endings: Array.isArray(raw.endings) ? raw.endings : [],
    };
  } catch {
    return { ...BLANK, settings: { ...BLANK.settings } };
  }
}

export const store = read();

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch { /* private mode; the panel will manage without it */ }
}

/** Start a week again. Keeps settings, endings seen, and nothing else. */
export function newWeek() {
  store.day = 1;
  store.noticed = [];
  store.giftSpots = null;
  store.survey = null;
  store.engagement = 0;
  store.runs = (store.runs || 0) + 1;
  save();
}

export function markEnding(id) {
  if (!store.endings.includes(id)) store.endings.push(id);
  save();
}

export const hasEnding = (id) => store.endings.includes(id);
