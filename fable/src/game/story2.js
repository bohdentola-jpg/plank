// Chapters 2–4 and the finale: Harvest Fairgrounds, Frostbite Falls, Neon
// Boardwalk, exhibition games, and the Midnight Bowl.
import { G } from '../core/game.js';
import { flag, setFlag, recruit, startQuest, setQuestStage, finishQuest, questActive, addCoins, addParts, addItem, addDecor, addGear, restAll, save } from './state.js';
import { TEAMS } from '../data/teams.js';

const S = () => G.S;
const say = (w, who, text) => w.say(who, text);
const narr = (t) => G.ui.say(null, t);
const cyc = (key, lines) => lines[(S().seen[key] = ((S().seen[key] || 0) + 1)) % lines.length];
export const rivalsBeaten = () => ['gnomes', 'haymakers', 'flurries', 'buzzers'].filter((k) => S().wins[k]).length;

async function afterRival(w, id, o) {
  S().wins[id] = (S().wins[id] || 0) + 1;
  S().meal = null;
  addCoins(o.coins); addParts(o.parts); addDecor(o.trophy);
  if (o.defPlay && !S().defPlays.includes(o.defPlay)) { S().defPlays.push(o.defPlay); G.ui.toast('🛡️ New coverage learned!'); }
  S().chapter = Math.max(S().chapter, o.chapter);
  restAll();
  if (o.bus) setFlag(o.bus);
  finishQuest(o.quest);
  if (rivalsBeaten() >= 4 && !S().quests.bowl) { startQuest('bowl', S().town.stadium >= 2 ? 1 : 0); }
  save();
}

/** Bus stop sign in the regions (Gus is somewhere behind the wheel). */
export async function busStop(w) { if (G.hooks.travel) await G.hooks.travel(w); }

// ================================================================ Harvest Fairgrounds
export async function fairArrive(w) {
  setFlag('fair_seen');
  await say(w, 'ringmaster', 'Welcome, welcome, to the *Harvest Fairgrounds!* Rides! Games! A corn maze with a perfect safety record, if you don\'t count Tuesdays!');
  await say(w, 'ringmaster', 'You\'ll be wanting the *Haymakers*. Their field is on the far side of the maze. They only play teams that can find it.');
  await say(w, 'hollow', 'Hay bales. I remember these. Heavy, itchy, and always exactly where you need to be. Waffle — you\'re on bale duty.');
}
export async function rind(w) {
  const best = S().best.mascot;
  const p = await G.ui.choose('ringmaster', best ? 'Back for more *Mascot Mayhem*? The crowd adores a repeat offender!' : '*Mascot Mayhem!* Climb into an oversized costume, climb onto my stage, and try not to be swept off it. Last mascot standing!', ['Suit up!', 'HARD mode', 'Maybe later'], { cancel: 2 });
  if (p === 2) return;
  if (p === 1 && !((best || {}).medal >= 2)) { await say(w, 'ringmaster', 'The hard show is for silver medalists and above. Insurance reasons. Mine.'); return; }
  setFlag('mg_found_mascot');
  const had = S().roster.includes('cheese');
  const res = await G.hooks.minigame('mascot', { hard: p === 1 });
  if (!had && S().roster.includes('cheese')) {
    await say(w, 'cheese', 'You outlasted me. Nobody outlasts me. I\'ve been the last wedge standing for six seasons.');
    await say(w, 'cheese', 'I heard you\'ve got a real team. With a field. I\'m in. The costume stays on. That\'s non-negotiable.');
    w.refreshParty(true); w.rebuild();
  } else if (res && !res.quit && !res.medal) await say(w, 'ringmaster', 'A noble splat! The stage is always open.');
  save();
}
export async function bigCheese(w) {
  await say(w, 'cheese', cyc('cheese', ['Six-time Mascot Mayhem champion. The wedge is undefeated. Suit up at the stage if you think otherwise.', 'I don\'t take the costume off. I don\'t take questions about the costume.', 'Beat me on that stage — silver or better — and maybe we talk football.']));
}
export async function par(w) {
  const best = S().best.golf;
  const p = await G.ui.choose('par', best ? `Another round of *Field Goal Golf*? Course record's still mine. Yours is ${best.normal ?? '—'}.` : '*Field Goal Golf.* Kick it through the uprights in as few boots as you can. Mind the bales, the pond, and the wind. Especially the wind.', ['Tee it up', 'HARD course', 'Not now'], { cancel: 2 });
  if (p === 2) return;
  if (p === 1 && !((best || {}).medal >= 2)) { await say(w, 'par', 'Back nine\'s for silver medalists. It has a windmill. You\'re not ready for the windmill.'); return; }
  setFlag('mg_found_golf');
  await G.hooks.minigame('golf', { hard: p === 1 });
  save();
}
export async function ciderStand(w) {
  if (S().coins < 15) { await narr('Hot cider, 15 coins. The steam alone is almost worth it.'); return; }
  const p = await G.ui.choose(null, 'Hot cider — 15 coins. Start a play *Hyped*.', ['Buy one', 'No thanks'], { cancel: 1 });
  if (p === 0) { S().coins -= 15; addItem('cider'); }
}
export async function corvina(w) {
  if (S().wins.haymakers) { await say(w, 'crowe', 'You beat Stitch. Do you know how long I\'ve wanted somebody to beat Stitch? I\'m on his team and I\'m thrilled.'); return; }
  await say(w, 'crowe', cyc('crowe', ['Caw. The maze changes its mind about people. It\'s made up its mind about you: "probably not."', 'Hint, since you look lost already: bales move if you\'ve got the shoulders for it. And small things fit through small gaps.', 'Old Stitch has been captain since before the corn was planted. He planted the corn. For privacy.']));
}
export async function stitch(w) {
  if (S().wins.haymakers) {
    const p = await G.ui.choose('stitch', 'The field remembers you. Care to make it remember you again?', ['Rematch', 'Just passing through'], { cancel: 1 });
    if (p === 0) await G.hooks.battle({ team: 'haymakers', bonus: 1, kind: 'match', venue: 'fair', drives: 3 });
    return;
  }
  if (!flag('stitch_met')) {
    setFlag('stitch_met');
    setQuestStage('fair', 1);
    await say(w, 'stitch', 'Somebody found the field. It\'s been... a few harvests.');
    await say(w, 'stitch', 'We\'re the *Haymakers.* We hit like a barn door and we never, ever fumble. Straw hands. Good grip.');
    await say(w, 'zip', 'Is that a real pumpkin? Is your head a real pumpkin? Do you get a new one every year? Does it hurt? What happens in November?');
    await say(w, 'stitch', '...Three possessions each. Mind the bales. They mind you.');
  }
  const p = await G.ui.choose('stitch', 'Ready to reap?', ['Kick it off!', 'One minute.'], { cancel: 1 });
  if (p !== 0) return;
  const res = await G.hooks.battle({ team: 'haymakers', kind: 'match', venue: 'fair', drives: 3 });
  if (res && res.won) {
    await say(w, 'stitch', 'Well harvested. Take the ribbon. And take this — a *coverage* my grandfather drew in the dirt with a stick.');
    await afterRival(w, 'haymakers', { coins: 110, parts: 3, trophy: 'trophy_fair', defPlay: 'fence_line', chapter: 3, bus: 'bus_frost', quest: 'fair' });
    await say(w, 'hollow', 'Two down. Gus says the bus can make it up the mountain now. *Frostbite Falls.* Pack a scarf. I\'ll be fine; I\'m room temperature.');
    w.rebuild();
  } else await say(w, 'stitch', 'The field keeps what it takes. Rest. Try again.');
}

// ================================================================ Frostbite Falls
export async function frostArrive(w) {
  setFlag('frost_seen');
  await say(w, 'ranger', 'Ranger Tamarack. Welcome to *Frostbite Falls*. River\'s frozen solid from here to the lodge, which makes it a road, a rink, and a hazard.');
  await say(w, 'ranger', 'On the ice you don\'t walk. You *go*. Pick a direction and you\'ll slide till something stops you. The rocks are your friends. Plan a route.');
  await say(w, 'ranger', 'The *Flurries* play on the pond past the far bank. Nobody\'s crossed since they started charging a toll.');
}
export async function ranger(w) {
  await say(w, 'ranger', cyc('ranger', ['Stuck? Start from the little dock. North, then bounce off the rocks. Every slide ends somewhere useful if you squint.', 'There\'s a signal bell on the far bank. Ring it and the old log bridge drops. Saves you sliding every time.', 'That penguin\'s been stuck on a floe since Thursday. Says he\'s "fine." He\'s been saying it louder.']));
}
export async function cocoa(w) {
  const best = S().best.snack;
  const p = await G.ui.choose('cocoa', best ? 'Halftime\'s coming again! Help me at the stand? Pleeease?' : 'It\'s *halftime* at the pond and EVERYONE wants cocoa and hot dogs and I have two hooves! Help me run the *snack shack?*', ['Tie on an apron', 'HARD rush', 'Sorry, later'], { cancel: 2 });
  if (p === 2) return;
  if (p === 1 && !((best || {}).medal >= 2)) { await say(w, 'cocoa', 'The playoff crowd would eat you alive. Get a silver on a normal day first!'); return; }
  setFlag('mg_found_snack');
  const res = await G.hooks.minigame('snack', { hard: p === 1 });
  if (res && res.medal) await say(w, 'cocoa', 'You\'re hired! Not for money. For recipes. Take them to your diner!');
  save();
}
export async function bridgeBell(w) {
  setFlag('frost_bridge');
  await narr('The bell clangs. Somewhere downstream, a log bridge drops across the river with a thump.');
  w.rebuild();
}
export async function slushRescue(w) {
  setFlag('slush_free');
  G.ui.cine(true);
  await narr('The buoy bell rings. The ice floe drifts in and bumps the bank.');
  w.rebuild();
  await say(w, 'slush', 'I was FINE. I was doing a *long-term float.* ...Thanks.');
  await say(w, 'slush', 'The Flurries iced me out. Said I slide "too much" for a team that plays on ice. Too much! On ICE!');
  await say(w, 'hollow', 'Son, how do you feel about sliding too much for a team that plays on grass?');
  await say(w, 'slush', 'Is there cocoa? ...I\'m in either way. But is there cocoa.');
  G.ui.cine(false);
  w.removeActor('slush', false);
  recruit('slush');
  w.refreshParty(true);
  save();
}
export async function avalanche(w) {
  if (S().wins.flurries) {
    const p = await G.ui.choose('flurry', 'Brr. You again. Want another go on the pond?', ['Rematch', 'Just visiting'], { cancel: 1 });
    if (p === 0) await G.hooks.battle({ team: 'flurries', bonus: 1, kind: 'match', venue: 'frost', drives: 3 });
    return;
  }
  if (!flag('flurry_met')) {
    setFlag('flurry_met');
    setQuestStage('frost', 1);
    await say(w, 'flurry', 'Ooh, visitors! Did you pay the toll? You didn\'t pay the toll. Avalanche, they didn\'t pay the toll.');
    await say(w, 'avalanche', '...TOLL.');
    await say(w, 'flurry', 'The toll is: you lose to us. Three possessions each. The ice patches are *regulation*, I checked, I wrote the regulations.');
    await say(w, 'pip', 'The big one hasn\'t blinked. Does it blink? I don\'t think it blinks.');
  }
  const p = await G.ui.choose('flurry', 'Skates on?', ['Kick it off!', 'Not yet.'], { cancel: 1 });
  if (p !== 0) return;
  const res = await G.hooks.battle({ team: 'flurries', kind: 'match', venue: 'frost', drives: 3 });
  if (res && res.won) {
    await say(w, 'flurry', 'You — on OUR ice — okay. Okay! Toll\'s waived. Forever. Avalanche, give them the icicle.');
    await say(w, 'avalanche', '...GOOD GAME.');
    await afterRival(w, 'flurries', { coins: 140, parts: 4, trophy: 'trophy_frost', defPlay: 'double_trouble', chapter: 4, bus: 'bus_neon', quest: 'frost' });
    await say(w, 'hollow', 'Three. One left: the *Boardwalk Buzzers*. They play indoors, under a dome nobody\'s paid the electric bill on in years. Bus is waiting.');
    w.rebuild();
  } else await say(w, 'flurry', 'Toll collected! Come back when you\'ve thawed.');
}

// ================================================================ Neon Boardwalk
export async function neonArrive(w) {
  setFlag('neon_seen');
  await say(w, 'skipper', 'Ahoy. *Neon Boardwalk.* Rides are shut, shops are shut, sign says "OPEN." Sign\'s the only honest thing on the pier — it\'s broken.');
  await say(w, 'skipper', 'The *Buzzer Dome* went dark when the breakers tripped. Three of \'em, scattered about. Flip all three and those doors open themselves.');
  await say(w, 'skipper', 'And watch your pockets. There\'s a gull about who takes things. Not me. A different gull.');
}
export async function skipper(w) {
  await say(w, 'skipper', cyc('skipper', ['One breaker\'s out at the end of the pier — you\'d need an arm to reach it. One\'s locked in the utility cage; only way in is the vent. One\'s behind a busted arcade cabinet somebody very strong should move.', 'Fries? Had some. They walked off. Flew off. Same thing.', 'The Buzzers aren\'t bad sorts. They just keep score of *everything*. I once said "good morning" and lost points.']));
}
export async function tokens(w) {
  const games = ['blitz', 'snack', 'golf', 'mascot', 'lights'];
  const names = { blitz: 'Backyard Blitz', snack: 'Snack Shack Rush', golf: 'Field Goal Golf', mascot: 'Mascot Mayhem', lights: 'Midnight Maintenance' };
  const opts = games.map((g) => `${names[g]}${(S().best[g] || {}).normal !== undefined ? ` (best ${S().best[g].normal})` : ''}`);
  opts.push('Nothing right now');
  const p = await G.ui.choose('tokens', 'Tokens\' Arcade. Every machine on the boardwalk still runs — I rewired them to the lighthouse. Pick your poison.', opts, { cancel: opts.length - 1 });
  if (p === opts.length - 1) return;
  if (G.hooks.arcadeGame) await G.hooks.arcadeGame(w, games[p]);
}
export async function breaker(w, n, text) {
  if (flag(`neon_b${n}`)) return;
  setFlag(`neon_b${n}`);
  G.audio.sfx('power');
  const on = [1, 2, 3].filter((i) => flag(`neon_b${i}`)).length;
  await narr(`${text} (${on}/3 breakers)`);
  if (on >= 3) { G.audio.sfx('lightOn'); await narr('Down the boardwalk, the *Buzzer Dome* shudders, hums, and lights up like a jukebox.'); setQuestStage('neon', 1); }
  if (w.solo) await w.regroup();
  w.rebuild();
  save();
}
export async function sal(w, stage) {
  if (stage === 0) {
    await say(w, 'sal', 'Nice football. *Was* a nice football. Mine now.');
    setFlag('sal_1'); S().flags.has_ball = false;
    await narr('Sal took your football and flapped off down the boardwalk!');
  } else if (stage === 1) {
    await say(w, 'sal', 'You followed me. Nobody follows me. They just sigh and buy a new one.');
    setFlag('sal_2');
    await narr('He\'s off again — toward the pier.');
  } else {
    await say(w, 'sal', 'End of the pier. Nowhere left to redistribute to. ...Here. It\'s a good ball. Somebody\'s looked after it.');
    S().flags.has_ball = true;
    await say(w, 'hollow', 'Quick hands. Good eyes. Zero respect for property. Son, have you ever considered *defense?*');
    await say(w, 'sal', 'Taking the ball from people. On purpose. With a crowd cheering? ...You\'re telling me that\'s *legal?*');
    setFlag('sal_3');
    recruit('sal');
    w.refreshParty(true);
  }
  w.rebuild();
  save();
}
export async function dome(w) {
  const on = [1, 2, 3].filter((i) => flag(`neon_b${i}`)).length;
  if (on < 3) { await narr(`The Buzzer Dome's doors are dead. A panel reads: POWER ${on}/3. Find the breakers along the boardwalk.`); return; }
  if (S().wins.buzzers) {
    const p = await G.ui.choose('highscore', 'CHALLENGER RETURNS. CONTINUE?', ['Rematch', 'Exit'], { cancel: 1 });
    if (p === 0) await G.hooks.battle({ team: 'buzzers', bonus: 1, kind: 'match', venue: 'neon', drives: 3 });
    return;
  }
  if (!flag('buzz_met')) {
    setFlag('buzz_met');
    await say(w, 'highscore', 'NEW CHALLENGER. SCANNING... TEAM: LANTERNS. LAST RECORDED GAME: [DATE OVERFLOW].');
    await say(w, 'highscore', 'WE ARE THE *BUZZERS*. WE HAVE NOT LOST SINCE THE POWER WENT OUT. WE HAVE NOT PLAYED SINCE THE POWER WENT OUT. BOTH STATEMENTS ARE TRUE.');
    await say(w, 'june', '...The lights in there flicker. I\'ll still see the ball. Will you?');
    await say(w, 'highscore', 'THREE POSSESSIONS EACH. INSERT COURAGE TO CONTINUE.');
  }
  const p = await G.ui.choose('highscore', 'READY PLAYER ONE?', ['Kick it off!', 'Not yet.'], { cancel: 1 });
  if (p !== 0) return;
  const res = await G.hooks.battle({ team: 'buzzers', kind: 'match', venue: 'neon', drives: 3 });
  if (res && res.won) {
    await say(w, 'highscore', 'GAME OVER. NEW HIGH SCORE: *LANTERNS*. ENTER YOUR INITIALS. ...WE HAVE BEEN WAITING A LONG TIME TO SAY THAT.');
    await afterRival(w, 'buzzers', { coins: 180, parts: 5, trophy: 'trophy_neon', chapter: 5, quest: 'neon' });
    await say(w, 'hollow', 'Four regions. Four rivals. That\'s all of them, Captain.');
    await say(w, 'hollow', 'The gate will open now — if there\'s a stadium fit to host it. Finish restoring it at the notice board. Then come by *after sunset.* It only shows itself after sunset.');
    w.rebuild();
  } else await say(w, 'highscore', 'CONTINUE? 9... 8... 7... TAKE YOUR TIME. WE HAVE NOTHING BUT TIME.');
}

// ================================================================ stadium: exhibitions, snack shack, the Midnight Bowl
export async function exhibition(w) {
  const beaten = [['gnomes', 'backyard'], ['haymakers', 'fair'], ['flurries', 'frost'], ['buzzers', 'neon']].filter(([k]) => S().wins[k]);
  if (!beaten.length) { await narr('The schedule board is blank. Teams you\'ve beaten will come to visit.'); return; }
  const opts = beaten.map(([k]) => `${TEAMS[k].name} (tougher, +${40 + (S().wins[k] || 1) * 20} coins)`);
  opts.push('Not today');
  const p = await G.ui.choose(null, 'Visiting teams are happy to travel now that there\'s a stadium to travel to. Who do you invite?', opts, { cancel: opts.length - 1 });
  if (p === opts.length - 1) return;
  const [k] = beaten[p];
  const bonus = 1 + Math.min(4, S().wins[k] || 1);
  const res = await G.hooks.battle({ team: k, bonus, kind: 'match', venue: 'stadium', drives: 2, boardLines: ['LANTERNS', 'vs', TEAMS[k].short] });
  if (res && res.won) { S().wins[k] = (S().wins[k] || 0) + 1; addCoins(40 + (S().wins[k] - 1) * 20); if (Math.random() < 0.6) addParts(1); }
  S().meal = null;
  save();
}
export async function snackShack(w) {
  const p = await G.ui.choose(null, 'The stadium snack shack. Game days are back, and so is the halftime rush.', ['Work the rush (Snack Shack Rush)', 'HARD rush', 'Walk away'], { cancel: 2 });
  if (p === 2) return;
  if (p === 1 && !((S().best.snack || {}).medal >= 2)) { await narr('Hard mode unlocks with a silver medal.'); return; }
  setFlag('mg_found_snack');
  await G.hooks.minigame('snack', { hard: p === 1 });
  save();
}

export function bowlReady() { return rivalsBeaten() >= 4 && S().town.stadium >= 2 && !flag('bowl_won'); }

export function stadiumExtras(w) {
  if (!bowlReady() || S().tod !== 'night') return;
  // the visitors are already on the field
  import('../data/npcs.js').then(() => {});
  w.npc('wick', 30, 19.5, { spec: { kind: 'wick', scale: 1.2, acc: ['key'] }, name: 'Wick', face: 0, mark: '!', r: 2.6, talk: () => midnightBowl(w) });
  for (const [x, z, n] of [[40, 20, 1], [42, 23, 80], [42, 17, 87], [44, 21, 78], [38, 24, 35]]) w.npc(`gh${n}`, x, z, { spec: { kind: 'ghost', fur: 0xc9b6f2, jersey: 0x4a2f7a, number: n, hat: 'leather', hatC: 0x3a2a4a }, face: -1.5, r: 0 });
}

export async function midnightBowl(w) {
  G.ui.cine(true);
  if (!flag('bowl_met')) {
    setFlag('bowl_met');
    setQuestStage('bowl', 2);
    await say(w, 'wick', '...tick. Lights: ON. Field: MOWED. Visitors: *still here.* Home team: ...late. Fifty-one years late.');
    await say(w, 'hollow', 'Wick. Old friend. You kept it ready this whole time.');
    await say(w, 'shade', 'We never left the field. The whistle never blew. A game that doesn\'t end can\'t let anyone go — not us, not your kicker.');
    await say(w, 'shade', 'I wrote you a letter, Captain. I signed it "G." I hoped the brass key would find someone stubborn.');
    await say(w, 'pip', 'The *other team\'s captain* wrote the letter?! I need to lie down. Tactically.');
    await say(w, 'shade', 'Not the other team. *Your* team. I was the Lanterns\' Captain the night the lights went out. Somebody had to stay and hold the score.');
    await say(w, 'shade', 'The board wasn\'t greeting *you*. It was greeting the key. But you\'ll do. Second half. Three possessions each. *Finish it.*');
  } else {
    await say(w, 'shade', 'The second half is still waiting. So are we.');
  }
  G.ui.cine(false);
  const p = await G.ui.choose('hollow', 'This is the one, Captain. Fifty-one seasons. No pressure. (Enormous pressure.)', ['Play the Midnight Bowl', 'Not yet'], { cancel: 1 });
  if (p !== 0) return;
  const res = await G.hooks.battle({ team: 'graveyard', kind: 'match', venue: 'stadium', drives: 3, tod: 'night', boardLines: ['MIDNIGHT BOWL', 'SECOND HALF'], music: 'bowl' });
  if (res && res.won) {
    setFlag('bowl_won');
    S().wins.graveyard = 1;
    S().meal = null;
    addDecor('trophy_bowl', true);
    setQuestStage('bowl', 3);
    finishQuest('bowl');
    restAll();
    save();
    if (G.hooks.cutscene) await G.hooks.cutscene('ending');
    await G.ui.panel({
      title: '🌙 The Midnight Bowl', closable: false,
      build: (body, api) => {
        const el = (t, c) => { const d = document.createElement('div'); d.innerHTML = c; d.style.cssText = t; return d; };
        body.append(
          el('text-align:center;font-weight:900;font-size:2em;color:var(--maple)', 'FOURTH &amp; FABLE'),
          el('text-align:center;font-weight:800;margin:0.4em 0 0.8em', 'Thank you for playing, Captain.'),
          el('font-weight:700;line-height:1.4', 'Huddle Hollow is still yours to wander: rematches at the stadium, hard-mode minigames, fish that only bite after dark, friendships to finish and a clubhouse to fill.'));
        const b = document.createElement('button'); b.className = 'btn focusable first'; b.textContent = 'Back to the Hollow'; b.style.marginTop = '1em'; b.onclick = () => api.close(true);
        body.append(b);
      },
    });
    S().tod = 'day';
    w.rebuild();
    save();
  } else {
    await say(w, 'shade', 'The clock doesn\'t run here. Rest. Eat something. Come back.');
  }
}

export function install() {
  G.hooks.exhibition = exhibition;
  G.hooks.snackShack = snackShack;
  G.hooks.stadiumExtras = stadiumExtras;
}

export { addGear, questActive };
