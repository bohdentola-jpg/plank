// Write a calaverita: a funny rhyme where La Flaca (Death) comes for a
// *living* person and gets outwitted. Teasing is about quirks, with love.
import { t, getLang } from '../i18n.js';
import { icon } from '../icons.js';

const OPENINGS = [
  { en: ['La Flaca came to town one night', 'to take {name} out of sight —'], es: ['La Muerte, muy elegante,', 'buscaba a {name} al instante,'] },
  { en: ['Death came strolling, dressed so fine,', 'looking for {name} in the line —'], es: ['Llegó la Flaca bailando,', 'a {name} venía buscando,'] },
  { en: ['The Skinny Lady knocked: "Hello!', 'Is {name} home? It\'s time to go!"'], es: ['Con su sombrero de flores', 'buscó a {name} entre tambores,'] },
];

export const TARGETS = {
  ramon: {
    name: { en: 'Don Ramón', es: 'Don Ramón' }, who: 'ramon',
    endings: [
      { en: ['but he gave her pan so sweet,', 'she forgot and stayed to eat!'], es: ['pero le dio pan dulcito', 'y se quedó otro ratito.'] },
      { en: ['but she slipped on flour on the floor', 'and rolled right out the bakery door!'], es: ['pero resbaló en la harina', 'y rodó hasta la cocina.'] },
      { en: ['but his first batch was burnt so black,', 'she ran away and won\'t come back!'], es: ['pero el pan se le quemó', '¡y la Flaca se espantó!'] },
    ],
  },
  chispa: {
    name: { en: 'Chispa the Xolo', es: 'Chispa, la Xolo' }, who: 'chispa',
    endings: [
      { en: ['but Chispa stole her fancy hat,', 'and Death went home — and that was that!'], es: ['pero Chispa le ladró', 'y su sombrero se llevó.'] },
      { en: ['but Chispa licked her bony face,', 'and Death ran giggling from the place!'], es: ['pero Chispa la lamió', 'y la Muerte se rió.'] },
      { en: ['but Chispa hid beneath the chair,', 'and Death just found a chew-toy there!'], es: ['pero la Xolo, ¡qué lista!,', 'se escondió y perdió la pista.'] },
    ],
  },
  mateo: {
    name: { en: 'Mateo', es: 'Mateo' }, who: 'mateo',
    endings: [
      { en: ['but Mateo kicked his soccer ball —', 'GOAL! And Death ran down the hall!'], es: ['pero Mateo, con su balón,', '¡le metió gol de campeón!'] },
      { en: ['but Mateo had a tamal to share,', 'so Death sat down and pulled a chair!'], es: ['pero estaba comiendo un tamal', 'y lo compartió, ¡qué tal!'] },
      { en: ['but Mateo started singing loud,', 'and Death danced off into the crowd!'], es: ['pero Mateo empezó a cantar', 'y la Flaca se puso a bailar.'] },
    ],
  },
  erendira: {
    name: { en: 'Maestra Eréndira', es: 'Maestra Eréndira' }, who: 'erendira',
    endings: [
      { en: ['but the Maestra gave her homework too,', 'and Death cried, "What am I to do?"'], es: ['pero le dejó de tarea', 'escribir una epopeya.'] },
      { en: ['but she began a history class,', 'and Death is still there — she won\'t pass!'], es: ['pero le dio clase de historia', 'y se quedó sin memoria.'] },
      { en: ['but she said, "Raise your hand to speak!"', 'and Death\'s been waiting since last week!'], es: ['pero dijo: "¡Alcen la mano!",', 'y la Flaca esperó en vano.'] },
    ],
  },
  lucia: {
    name: { en: 'Tía Lucía', es: 'Tía Lucía' }, who: 'lucia',
    endings: [
      { en: ['but Tía cut papel so fast,', 'Death\'s cape had holes when she walked past!'], es: ['pero Tía cortó su capa', 'con el cincel… ¡y quedó guapa!'] },
      { en: ['but Tía talked and talked all day,', 'and Death got bored and went away!'], es: ['pero Tía habló y habló', '¡y la Flaca se durmió!'] },
      { en: ['but Tía\'s mallet went tac-tac-tac,', 'and Death ran off and won\'t come back!'], es: ['pero el mazo sonó ¡tac, tac!,', 'y la Flaca huyó sin su frac.'] },
    ],
  },
  me: {
    name: { en: 'Me!', es: '¡Yo!' }, who: null,
    endings: [
      { en: ['but {name} was playing Lotería', 'and won Death\'s hat — ¡qué alegría!'], es: ['pero {name} jugaba Lotería', 'y le ganó, ¡qué alegría!'] },
      { en: ['but {name} was hiding under the bed', 'with a sugar skull and bread instead!'], es: ['pero {name} se escondió en la cama', 'con pan dulce y su piyama.'] },
      { en: ['but {name} had a tamal to share,', 'and now they\'re friends — a funny pair!'], es: ['pero {name} le invitó un tamal', 'y se hicieron amigos, ¡qué tal!'] },
    ],
  },
};

// a small kindness filter for typed lines
const UNKIND = /\b(stupid|dumb|idiot|ugly|fat|hate|kill|shut up|loser|tonto|tonta|estúpid|estupid|idiota|fe[oa]|gord[oa]|odio|cállate|callate|menso|mensa|pendej|perr[ao] (vieja|viejo))\b/i;
export function isKind(text) { return !UNKIND.test(text); }

export function poemLines(p) {
  const L = getLang();
  const o = OPENINGS[p.opening][L];
  const e = TARGETS[p.target].endings[p.ending][L];
  const name = p.target === 'me' ? (p.myName || (L === 'es' ? 'yo' : 'I')) : t(TARGETS[p.target].name);
  const fill = (s) => s.replace(/\{name\}/g, name);
  const lines = [...o, ...e].map(fill);
  if (p.custom?.length) return [...o.map(fill), ...p.custom];
  return lines;
}

export function openPoem(game) {
  return new Promise((resolve) => {
    const p = { target: 'ramon', opening: 0, ending: 0, myName: game.state.playerName || '', custom: null };
    const body = document.createElement('div');
    body.className = 'mg';
    const m = game.ui.modal({ title: { en: 'Write a calaverita', es: 'Escribe una calaverita' }, ico: 'pencil', body, closable: false });
    const render = () => {
      const lines = poemLines(p);
      body.innerHTML = `
        <p style="font-weight:700;margin:0">${t({ en: 'A calaverita imagines Death — "La Flaca" — coming for someone who is <b>alive</b>, and getting outwitted. Tease their habits, with love!', es: 'Una calaverita imagina que la Muerte —"la Flaca"— viene por alguien que está <b>vivo</b> y sale burlada. ¡Bromea sobre sus costumbres, con cariño!' })}</p>
        <div><b>${t({ en: '1. Who is it about?', es: '1. ¿Para quién es?' })}</b>
          <div class="swatches" style="margin-top:6px">${Object.entries(TARGETS).map(([id, x]) => `<button type="button" class="tool${p.target === id ? ' on' : ''}" data-t="${id}" style="width:auto;padding:8px 12px">${t(x.name)}</button>`).join('')}</div>
          ${p.target === 'me' ? `<input class="inp" style="margin-top:8px;max-width:280px" maxlength="16" placeholder="${t({ en: 'Your name', es: 'Tu nombre' })}" value="${p.myName.replace(/"/g, '')}">` : ''}
        </div>
        <div><b>${t({ en: '2. How does it start?', es: '2. ¿Cómo empieza?' })}</b> <button type="button" class="btn cream small" data-a="o">${icon('rotate')} ${t({ en: 'Try another', es: 'Otra' })}</button></div>
        <div><b>${t({ en: '3. How do they escape?', es: '3. ¿Cómo se escapa?' })}</b> <button type="button" class="btn cream small" data-a="e">${icon('rotate')} ${t({ en: 'Try another', es: 'Otra' })}</button>
          <button type="button" class="btn cream small" data-a="w">${icon('pencil')} ${t({ en: 'Write my own ending', es: 'Escribir mi final' })}</button></div>
        ${p.custom ? `<div class="row"><input class="inp" data-c="0" maxlength="48" value="${(p.custom[0] || '').replace(/"/g, '')}"><input class="inp" data-c="1" maxlength="48" value="${(p.custom[1] || '').replace(/"/g, '')}"></div>` : ''}
        <div class="poem">${lines.map((l) => `<div>${l.replace(/</g, '&lt;')}</div>`).join('')}</div>
        <div class="row" style="justify-content:flex-end"><button type="button" class="btn rosa" data-a="done">${icon('check')} ${t({ en: 'Pin it on the contest board!', es: '¡A pegarla en el concurso!' })}</button></div>`;
      body.querySelectorAll('[data-t]').forEach((b) => { b.onclick = () => { p.target = b.dataset.t; p.ending = 0; game.sfx('tap'); render(); }; });
      const inp = body.querySelector('input.inp:not([data-c])');
      if (inp) inp.oninput = () => { p.myName = inp.value.trim(); body.querySelector('.poem').innerHTML = poemLines(p).map((l) => `<div>${l.replace(/</g, '&lt;')}</div>`).join(''); };
      body.querySelectorAll('[data-c]').forEach((ci) => { ci.oninput = () => { p.custom[+ci.dataset.c] = ci.value; }; ci.onchange = render; });
      body.querySelector('[data-a=o]').onclick = () => { p.opening = (p.opening + 1) % OPENINGS.length; game.sfx('page'); render(); };
      body.querySelector('[data-a=e]').onclick = () => { p.custom = null; p.ending = (p.ending + 1) % TARGETS[p.target].endings.length; game.sfx('page'); render(); };
      body.querySelector('[data-a=w]').onclick = () => {
        const e = TARGETS[p.target].endings[p.ending][getLang()];
        p.custom = p.custom ? null : [e[0].replace(/\{name\}/g, p.myName || ''), e[1].replace(/\{name\}/g, p.myName || '')];
        render();
      };
      body.querySelector('[data-a=done]').onclick = () => {
        const all = poemLines(p).join(' ');
        if (!isKind(all) || (p.myName && !isKind(p.myName))) {
          game.sfx('oops');
          game.ui.toast(t({ en: 'Calaveritas tease with love — let\'s keep it kind!', es: 'Las calaveritas bromean con cariño. ¡Que sea amable!' }), { ico: 'heart', ms: 3500 });
          return;
        }
        if (p.target === 'me' && p.myName) game.state.playerName = p.myName;
        m.close();
        resolve({ ...p, lines: poemLines(p), lang: getLang() });
      };
    };
    render();
  });
}
