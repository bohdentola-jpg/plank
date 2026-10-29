// Lotería: the caller reads a riddle, you put a bean on the matching card.
// Four in a row (or a full board) wins — then print your certificate.
import { t, UI as S, getLang } from './i18n.js';
import { icon, hydrateIcons } from './icons.js';
import { CARD_BY_ID } from './content/cards.js';
import { RIDDLES } from './content/quiz.js';

const LINES = (() => {
  const L = [];
  for (let r = 0; r < 4; r++) L.push([0, 1, 2, 3].map((c) => r * 4 + c));
  for (let c = 0; c < 4; c++) L.push([0, 1, 2, 3].map((r) => r * 4 + c));
  L.push([0, 5, 10, 15], [3, 6, 9, 12]);
  L.push([0, 3, 12, 15]); // the four corners count too ("las cuatro esquinas")
  return L;
})();

function shuffle(a) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}

export async function openLoteria(game) {
  const body = document.createElement('div');
  body.className = 'mg';
  const m = game.ui.modal({ title: { en: 'Lotería', es: 'Lotería' }, ico: 'cards', body, cls: 'wide' });
  const ids = shuffle(Object.keys(RIDDLES)).slice(0, 16);
  const order = shuffle(ids);
  const marked = new Set();
  let turn = 0, misses = 0, won = false;
  body.innerHTML = `
    <div class="row" style="align-items:stretch">
      <div class="loteria"></div>
      <div style="flex:1;min-width:260px;display:flex;flex-direction:column;gap:12px">
        <div class="caller"><div class="cc"></div><div class="riddle"></div></div>
        <div style="font-weight:700">${t({ en: 'Listen to the cantor\'s riddle and put a bean on the matching card. Get 4 in a row — or the 4 corners — and shout ¡Lotería!', es: 'Escucha el verso del cantor y pon un frijolito en la carta que le toca. Haz 4 en línea —o las 4 esquinas— y grita ¡Lotería!' })}</div>
        <div class="row"><button type="button" class="btn cream small" data-a="skip">${icon('next')} ${t({ en: 'Next card', es: 'Siguiente carta' })}</button>
        <button type="button" class="btn purple" data-a="win" disabled>${icon('star')} ¡Lotería!</button></div>
        <div class="status" style="font-weight:800;color:var(--purple-d)"></div>
      </div>
    </div>`;
  const board = body.querySelector('.loteria');
  const cells = [];
  for (const id of ids) {
    const el = await game.ui.cardEl(CARD_BY_ID[id], { small: true });
    el.dataset.id = id;
    board.appendChild(el);
    cells.push(el);
  }
  hydrateIcons(body);
  const riddleEl = body.querySelector('.riddle');
  const ccEl = body.querySelector('.cc');
  const winBtn = body.querySelector('[data-a=win]');
  const status = body.querySelector('.status');
  const call = () => {
    while (turn < order.length && marked.has(order[turn])) turn++;
    if (turn >= order.length) { riddleEl.textContent = t({ en: 'That\'s every card!', es: '¡Ya salieron todas las cartas!' }); return; }
    const id = order[turn];
    riddleEl.innerHTML = `<i>${t({ en: 'The cantor calls:', es: 'El cantor canta:' })}</i><br>“${t(RIDDLES[id])}”`;
    ccEl.innerHTML = `<div class="lcard small locked"><div class="num">?</div><div class="pic"></div><div class="name">???</div></div>`;
    if (game.speech.enabled) game.speech.line(t(RIDDLES[id]), getLang());
    game.sfx('page');
  };
  const lines = () => LINES.filter((L) => L.every((i) => marked.has(ids[i])));
  cells.forEach((el) => {
    el.onclick = () => {
      if (won) return;
      const id = el.dataset.id;
      const want = order[turn];
      if (marked.has(id)) return;
      if (id === want) {
        marked.add(id);
        const bean = document.createElement('div');
        bean.className = 'bean';
        bean.innerHTML = '<i></i>';
        el.appendChild(bean);
        game.sfx('bean');
        ccEl.innerHTML = '';
        ccEl.appendChild(el.cloneNode(true));
        status.textContent = t({ en: '¡Eso! That\'s it!', es: '¡Eso!' });
        if (!game.knows(id)) {
          game.state.cards.push(id);
          game.addPetals(1);
          game.ui.toast(`${t(S.newCard)} ${CARD_BY_ID[id].term}`, { ico: 'cards' });
        }
        turn++;
        if (lines().length) { winBtn.disabled = false; winBtn.classList.add('pulse'); status.textContent = t({ en: 'You have a line! Shout ¡Lotería!', es: '¡Tienes línea! ¡Grita Lotería!' }); }
        setTimeout(call, 900);
      } else {
        misses++;
        game.sfx('oops');
        status.textContent = misses % 3 === 0
          ? t({ en: `Hint: look for "${CARD_BY_ID[want].term}".`, es: `Pista: busca "${CARD_BY_ID[want].term}".` })
          : t({ en: 'Not that one — try again!', es: 'Esa no… ¡intenta otra vez!' });
      }
    };
  });
  body.querySelector('[data-a=skip]').onclick = () => {
    // the called card isn't on your board? (it always is here, but kids can pass)
    game.sfx('tap');
    order.push(order.splice(turn, 1)[0]);
    call();
  };
  winBtn.onclick = () => {
    won = true;
    game.sfx('loteria');
    game.state.loteriaWins = (game.state.loteriaWins || 0) + 1;
    game.addPetals(3);
    game.save();
    m.close();
    certificate(game);
  };
  call();
}

export function certificate(game) {
  const body = document.createElement('div');
  const name = game.state.playerName || '';
  body.innerHTML = `
    <div class="row" style="justify-content:center;margin-bottom:12px"><input class="inp" maxlength="28" style="max-width:340px" placeholder="${t({ en: 'Write your name', es: 'Escribe tu nombre' })}" value="${name.replace(/"/g, '')}"></div>
    <div class="cert">
      <div style="font:24px var(--display);color:var(--marigold-d)">${icon('marigold')} ${t({ en: 'The Marigold Path', es: 'El Camino de Cempasúchil' })} ${icon('marigold')}</div>
      <h1>${t({ en: 'Certificate', es: 'Certificado' })}</h1>
      <p>${t({ en: 'This certifies that', es: 'Se otorga a' })}</p>
      <div class="nm">${name || '&nbsp;'}</div>
      <p>${t({ en: 'learned about Día de Muertos with respect and won the Lotería — ¡Felicidades!', es: 'por aprender sobre el Día de Muertos con respeto y ganar la Lotería. ¡Felicidades!' })}</p>
      <p>${t({ en: 'Cards found', es: 'Tarjetas encontradas' })}: ${game.state.cards.length} · ${t({ en: 'Marigolds', es: 'Flores' })}: ${game.state.petals}</p>
      <p style="font-size:16px">${new Date().toLocaleDateString(getLang() === 'es' ? 'es-MX' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
    </div>`;
  const foot = document.createElement('div');
  foot.innerHTML = `<button type="button" class="btn turq" data-a="print">${icon('print')} ${t({ en: 'Print', es: 'Imprimir' })}</button><button type="button" class="btn purple" data-a="again">${icon('cards')} ${t({ en: 'Play again', es: 'Jugar otra vez' })}</button>`;
  const m = game.ui.modal({ title: { en: '¡Lotería!', es: '¡Lotería!' }, ico: 'star', body, foot });
  const inp = body.querySelector('input');
  inp.oninput = () => {
    body.querySelector('.nm').textContent = inp.value || ' ';
    game.state.playerName = inp.value.trim();
    game.save();
  };
  foot.querySelector('[data-a=print]').onclick = () => window.print();
  foot.querySelector('[data-a=again]').onclick = () => { m.close(); openLoteria(game); };
  hydrateIcons(body);
}
