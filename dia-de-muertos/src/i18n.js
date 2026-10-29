// Language: every piece of text in the game is { en, es }. t() picks the
// current language; rich() turns light markup into HTML:
//   [[cempasúchil]]  → a tappable Spanish word (hear it + see its meaning)
//   [[altares|altar]] → shows "altares", looked up under "altar"
//   **bold**  and  {name} placeholders
const state = { lang: 'en', listeners: [] };

export function setLang(lang) {
  state.lang = lang === 'es' ? 'es' : 'en';
  document.documentElement.lang = state.lang;
  for (const fn of state.listeners) fn(state.lang);
}

export function getLang() { return state.lang; }

export function onLang(fn) { state.listeners.push(fn); }

export function t(v, vars) {
  if (v == null) return '';
  let s = typeof v === 'string' ? v : (v[state.lang] ?? v.en ?? '');
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));
  return s;
}

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function norm(word) {
  return word.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[¿?¡!.,]/g, '').trim();
}

export function rich(v, vars) {
  let s = esc(t(v, vars));
  s = s.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (m, word, key) => `<button type="button" class="es" data-w="${esc(key ? key : word)}">${word}</button>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  s = s.replace(/\n/g, '<br>');
  return s;
}

// plain text (for speech): strip markup
export function plain(v, vars) {
  return t(v, vars).replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, '$1').replace(/\*\*/g, '');
}

// UI strings used across modules
export const UI = {
  play: { en: 'Play', es: 'Jugar' },
  continue: { en: 'Continue', es: 'Continuar' },
  newGame: { en: 'New adventure', es: 'Nueva aventura' },
  freeMode: { en: 'Make your own ofrenda', es: 'Haz tu propia ofrenda' },
  book: { en: 'Book of Memories', es: 'Libro de los Recuerdos' },
  loteria: { en: 'Lotería quiz', es: 'Lotería de preguntas' },
  bag: { en: 'Backpack', es: 'Mochila' },
  map: { en: 'Map', es: 'Mapa' },
  hint: { en: 'Show me what I can click', es: '¿Qué puedo tocar?' },
  sound: { en: 'Sound', es: 'Sonido' },
  menu: { en: 'Menu', es: 'Menú' },
  marigolds: { en: 'Marigolds earned by learning', es: 'Flores ganadas aprendiendo' },
  next: { en: 'Next', es: 'Siguiente' },
  back: { en: 'Back', es: 'Atrás' },
  close: { en: 'Close', es: 'Cerrar' },
  gotIt: { en: 'Got it!', es: '¡Entendido!' },
  newCard: { en: 'New card!', es: '¡Nueva tarjeta!' },
  addedToBag: { en: 'Added to your backpack', es: 'Lo guardaste en tu mochila' },
  emptyBag: { en: 'Your backpack is empty. Explore to find things for the ofrenda!', es: 'Tu mochila está vacía. ¡Explora para encontrar cosas para la ofrenda!' },
  hear: { en: 'Hear it', es: 'Escuchar' },
  sayIt: { en: 'Say it', es: 'Se dice' },
  didYouKnow: { en: 'Did you know?', es: '¿Sabías que…?' },
  language: { en: 'Español', es: 'English' },
  readAloud: { en: 'Read aloud', es: 'Leer en voz alta' },
  textSize: { en: 'Bigger text', es: 'Letra más grande' },
  music: { en: 'Music', es: 'Música' },
  resume: { en: 'Back to the game', es: 'Volver al juego' },
  quitTitle: { en: 'Main menu', es: 'Menú principal' },
  settings: { en: 'Settings', es: 'Ajustes' },
  locked: { en: 'Not yet — keep following the story!', es: 'Todavía no — ¡sigue la historia!' },
  youAreHere: { en: 'You are here', es: 'Estás aquí' },
  photo: { en: 'Take a picture', es: 'Tomar una foto' },
  saved: { en: 'Saved!', es: '¡Guardado!' },
  cardsFound: { en: '{n} of {total} cards found', es: '{n} de {total} tarjetas encontradas' },
  goal: { en: 'Goal', es: 'Meta' },
  done: { en: 'Done', es: 'Listo' },
  skip: { en: 'Skip', es: 'Saltar' },
  yes: { en: 'Yes', es: 'Sí' },
  no: { en: 'No', es: 'No' },
  reset: { en: 'Start over (erase progress)', es: 'Empezar de nuevo (borrar progreso)' },
  resetConfirm: { en: 'Erase all progress and start over?', es: '¿Borrar todo el progreso y empezar de nuevo?' },
  loading: { en: 'Loading…', es: 'Cargando…' },
  tapToStart: { en: 'Tap or click to start', es: 'Toca o haz clic para empezar' },
  credits: { en: 'About this game', es: 'Sobre este juego' },
};
