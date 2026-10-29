// El Libro de los Recuerdos: chapters, the card collection, an interactive map
// of celebrations around Mexico, the glossary (with audio) and the sources.
import { t, UI as S } from './i18n.js';
import { icon, hydrateIcons } from './icons.js';
import { CHAPTERS, MEXICO_PLACES, MEXICO_OUTLINE } from './content/book.js';
import { CARDS, CARD_BY_ID, CATS } from './content/cards.js';
import { GLOSSARY } from './content/glossary.js';
import { SOURCES } from './content/sources.js';

// like rich(), but for trusted HTML: only converts [[words]] and **bold**
function richHtml(html) {
  return html
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (m, w, k) => `<button type="button" class="es" data-w="${(k || w).replace(/"/g, '&quot;')}">${w}</button>`)
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
}

export function openBook(game, tab = null) {
  const body = document.createElement('div');
  body.className = 'book';
  body.style.height = 'min(70vh, 640px)';
  const toc = document.createElement('div');
  toc.className = 'toc';
  const page = document.createElement('div');
  page.className = 'page';
  body.append(toc, page);
  const m = game.ui.modal({ title: S.book, ico: 'book', body, cls: 'wide' });
  const show = (id) => {
    const ch = CHAPTERS.find((c) => c.id === id) || CHAPTERS[0];
    toc.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.id === ch.id));
    page.scrollTop = 0;
    game.sfx('page');
    if (ch.special === 'cards') renderCards(game, page);
    else if (ch.special === 'glossary') renderGlossary(game, page);
    else if (ch.special === 'sources') renderSources(page);
    else if (ch.special === 'mexico') renderMexico(game, page);
    else if (ch.myths) renderMyths(page, ch);
    else page.innerHTML = richHtml(t(ch.html));
  };
  CHAPTERS.forEach((ch, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.id = ch.id;
    b.innerHTML = `<span class="n">${i + 1}</span>${t(ch.title)}`;
    b.onclick = () => show(ch.id);
    toc.appendChild(b);
  });
  show(tab || (game.state.cards.some((id) => !game.state.seenCards.includes(id)) ? 'tarjetas' : 'que'));
  return m;
}

async function renderCards(game, page) {
  const st = game.state;
  page.innerHTML = `<h3>${t({ en: 'Card collection', es: 'Colección de tarjetas' })}</h3>
    <p class="lead">${t(S.cardsFound, { n: st.cards.length, total: CARDS.length })} · ${icon('butterfly')} ${Object.keys(st.monarchs).length}/12</p>
    <p>${t({ en: 'Explore the town, talk to everyone and click on things to find more cards. Click a card to read it again.', es: 'Explora el pueblo, platica con todos y haz clic en las cosas para encontrar más tarjetas. Haz clic en una tarjeta para volver a leerla.' })}</p>`;
  for (const [cat, info] of Object.entries(CATS)) {
    const list = CARDS.filter((c) => c.cat === cat);
    const h = document.createElement('h4');
    h.textContent = `${t(info)} (${list.filter((c) => st.cards.includes(c.id)).length}/${list.length})`;
    page.appendChild(h);
    const grid = document.createElement('div');
    grid.className = 'card-grid';
    page.appendChild(grid);
    for (const card of list) {
      const known = st.cards.includes(card.id);
      const el = await game.ui.cardEl(card, { small: true, locked: !known, dot: known && !st.seenCards.includes(card.id) });
      if (known) el.onclick = () => {
        if (!st.seenCards.includes(card.id)) { st.seenCards.push(card.id); game.save(); el.querySelector('.dot')?.remove(); game.refreshHud(); }
        game.ui.showCard(card, { isNew: false });
      };
      grid.appendChild(el);
    }
  }
  hydrateIcons(page);
}

function renderGlossary(game, page) {
  const list = [...GLOSSARY].sort((a, b) => a.w.localeCompare(b.w, 'es'));
  page.innerHTML = `<h3>${t({ en: 'Glossary', es: 'Glosario' })}</h3>
    <p>${t({ en: 'Tap the speaker to hear each word. Capital letters show which part to stress.', es: 'Toca la bocina para escuchar cada palabra. Las mayúsculas indican la sílaba que se acentúa.' })}${game.speech.ok && !game.speech.hasSpanish() ? ` <i>${t({ en: '(Your computer doesn\'t seem to have a Spanish voice installed, so the pronunciation may sound off — follow the spelling guide!)', es: '(Tu computadora no parece tener una voz en español instalada; sigue la guía de pronunciación.)' })}</i>` : ''}</p>`;
  const grid = document.createElement('div');
  grid.className = 'gloss';
  for (const e of list) {
    const d = document.createElement('div');
    d.innerHTML = `<button type="button" aria-label="${t(S.hear)}">${icon('speak')}</button><b>${e.w}</b><div class="p">${e.say}</div><p>${richHtml(t(e.m))}</p>`;
    d.querySelector('button').onclick = () => game.speech.word(e.w, 'es');
    grid.appendChild(d);
  }
  page.appendChild(grid);
}

function renderSources(page) {
  const kinds = { gov: { en: 'Mexican government & public institutions', es: 'Gobierno e instituciones públicas de México' }, museum: { en: 'Museums', es: 'Museos' }, academic: { en: 'Scholars & academic sources', es: 'Especialistas y fuentes académicas' }, ref: { en: 'Reference works', es: 'Obras de consulta' }, news: { en: 'News & magazines', es: 'Periódicos y revistas' } };
  let html = `<h3>${t({ en: 'Sources', es: 'Fuentes' })}</h3>
    <p>${t({ en: 'These are the sources used to write the cards and this book. Wikipedia pages are listed only as secondary help. Ask a grown-up before opening links.', es: 'Estas son las fuentes que se usaron para escribir las tarjetas y este libro. Wikipedia aparece solo como ayuda secundaria. Pide permiso a un adulto antes de abrir los enlaces.' })}</p>
    <div class="note">${t({ en: 'Where historians disagree (for example, how much of the holiday is Indigenous and how much is European), the game says so instead of picking one answer. Items marked ⚑ come from general knowledge and still need to be checked against a published source.', es: 'Donde los historiadores no se ponen de acuerdo (por ejemplo, cuánto de la fiesta es indígena y cuánto europeo), el juego lo dice en vez de escoger una respuesta. Lo marcado con ⚑ viene de conocimiento general y aún hay que comprobarlo con una fuente publicada.' })}</div>`;
  for (const [k, label] of Object.entries(kinds)) {
    const list = Object.values(SOURCES).filter((s) => s.kind === k);
    if (!list.length) continue;
    html += `<h4>${t(label)}</h4><ul class="srcs">${list.map((s) => `<li>${s.check ? '⚑ ' : ''}<b>${s.t}</b> — ${s.by}${s.url ? `. <a href="${s.url}" target="_blank" rel="noopener noreferrer">${s.url}</a>` : ''}</li>`).join('')}</ul>`;
  }
  page.innerHTML = html;
}

function renderMyths(page, ch) {
  page.innerHTML = `<h3>${t(ch.title)}</h3><p class="lead">${t({ en: 'Lots of things repeated online aren\'t quite right. Here\'s what the research says.', es: 'Muchas cosas que se repiten en internet no son del todo ciertas. Esto dice la investigación.' })}</p>
    ${ch.myths.map((x) => `<div class="myth"><div class="m"><b>${t({ en: 'Myth', es: 'Mito' })}</b>${t(x.m)}</div><div class="f"><b>${t({ en: 'What\'s true', es: 'Lo cierto' })}</b>${t(x.f)}</div></div>`).join('')}`;
}

// ---------------------------------------------------------------- the Mexico map
function mapSvg() {
  const X = (lon) => (lon + 118) * 22, Y = (lat) => (33.2 - lat) * 24;
  const pts = MEXICO_OUTLINE.map(([lo, la]) => `${X(lo).toFixed(1)},${Y(la).toFixed(1)}`).join(' ');
  const pins = MEXICO_PLACES.map((p, i) => `<g class="pin" data-i="${i}" transform="translate(${X(p.lon).toFixed(1)},${Y(p.lat).toFixed(1)})"><circle r="11" fill="#e4007c" stroke="#2a1a14" stroke-width="3"/><circle r="4" fill="#ffc21a"/></g>`).join('');
  return `<svg viewBox="0 0 700 480" role="img" aria-label="Map of Mexico">
    <rect width="700" height="480" fill="#bfe6f7"/>
    <polygon points="${pts}" fill="#f6dfb0" stroke="#2a1a14" stroke-width="3" stroke-linejoin="round"/>
    <text x="210" y="180" font-family="Lilita One, sans-serif" font-size="30" fill="#c96a00" opacity=".55">MÉXICO</text>
    <text x="520" y="420" font-family="Nunito, sans-serif" font-weight="800" font-size="13" fill="#2357d1">Golfo de México</text>
    <text x="60" y="420" font-family="Nunito, sans-serif" font-weight="800" font-size="13" fill="#2357d1">Océano Pacífico</text>
    ${pins}</svg>`;
}

function renderMexico(game, page) {
  page.innerHTML = `<h3>${t({ en: 'Around Mexico', es: 'Por México' })}</h3>
    <p>${t({ en: 'Every region celebrates in its own way. Tap a pin to learn about it — some pins unlock new cards!', es: 'Cada región lo celebra a su manera. Toca un punto para aprender; ¡algunos desbloquean tarjetas nuevas!' })}</p>
    <div class="mapfig">${mapSvg()}</div><div class="mapinfo"><i>${t({ en: 'Tap a pin on the map.', es: 'Toca un punto del mapa.' })}</i></div>`;
  wireMap(game, page);
}

function wireMap(game, root) {
  const info = root.querySelector('.mapinfo');
  root.querySelectorAll('.pin').forEach((pin) => {
    pin.addEventListener('click', async () => {
      const p = MEXICO_PLACES[+pin.dataset.i];
      game.sfx('chime');
      const card = CARD_BY_ID[p.card];
      info.innerHTML = `<h5>${t(p.name)}</h5><div>${t(p.txt)}</div>${card ? `<button type="button" class="btn rosa small" style="margin-top:8px">${icon('cards')} ${game.knows(card.id) ? t({ en: 'Read the card', es: 'Leer la tarjeta' }) : t({ en: 'Get the card!', es: '¡Obtener la tarjeta!' })}</button>` : ''}`;
      const b = info.querySelector('button');
      if (b) b.onclick = () => game.learn(card.id, { force: true });
    });
  });
}

// opened from Maestra Eréndira's exhibit in the plaza
export function openMexicoMap(game) {
  const body = document.createElement('div');
  body.innerHTML = `<p style="font-weight:700;margin-top:0">${t({ en: 'Maestra Eréndira\'s map: every region celebrates in its own way. Tap the pins!', es: 'El mapa de la Maestra Eréndira: cada región lo celebra a su manera. ¡Toca los puntos!' })}</p><div class="mapfig">${mapSvg()}</div><div class="mapinfo"><i>${t({ en: 'Tap a pin on the map.', es: 'Toca un punto del mapa.' })}</i></div>`;
  const m = game.ui.modal({ title: { en: 'Celebrations around Mexico', es: 'Celebraciones en México' }, ico: 'globe', body, cls: 'wide' });
  wireMap(game, body);
  return m.done;
}
