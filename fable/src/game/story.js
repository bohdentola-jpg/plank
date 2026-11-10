// Chapter 1 — "Find five people willing to play" — plus the townsfolk chatter
// for Huddle Hollow and Backyard Borough. Every function takes the World (w).
import { G } from '../core/game.js';
import { flag, setFlag, recruit, startQuest, setQuestStage, finishQuest, questStage, questDone, addCoins, addParts, addItem, addDecor, unlockPlay, restAll, save } from './state.js';
import { displayName } from '../data/cast.js';

const S = () => G.S;
const say = (w, who, text, o) => w.say(who, text, o);
const narr = (text) => G.ui.say(null, text);
const cap = () => S().captain.name;

/** How many of the five recruits you have. */
export const recruits = () => ['hollow', 'pip', 'zip', 'waffle', 'june'].filter((id) => S().roster.includes(id)).length;

function afterRecruit(w) {
  w.refreshParty(true);
  const n = recruits();
  // dusk falls once the daytime recruits are in; that's when June shows up
  if (n >= 4 && !S().roster.includes('june') && S().tod === 'day') {
    S().tod = 'dusk';
    setFlag('dusk_fell');
  }
  save();
}

async function duskNotice(w) {
  if (flag('dusk_fell') && !flag('dusk_told')) {
    setFlag('dusk_told');
    await narr('The afternoon has gotten away from you. The streetlights flicker on, one at a time, all the way down Main Street.');
    await say(w, 'hollow', 'Four. One short. ...Huh. Porch light\'s on at the clubhouse. I didn\'t leave it on. I can\'t work switches.');
    w.rebuild();
  }
}

// ================================================================ arrival
export async function arrival(w) {
  G.ui.cine(true);
  await w.wait(0.5);
  await say(w, 'gus', 'End of the line, kid. *Huddle Hollow.* Population: depends who\'s counting.');
  await say(w, 'gus', 'You\'re the one who got the letter, huh? Thought you\'d be taller. They\'re always taller in the letters.');
  await say(w, 'gus', 'Clubhouse is *west down Main Street*. Can\'t miss it. It\'s the one that looks like it lost a fight.');
  G.ui.cine(false);
  startQuest('five');
  G.ui.toast(`${G.ui.key('move')} move · hold ${G.ui.key('b')} to run · ${G.ui.key('a')} to talk`, 6000);
  save();
}

export async function gus(w) {
  if (S().chapter < 1 || !flag('bus_open')) {
    const lines = [
      'Bus only runs when somebody needs it to. Right now nobody needs it to. Trust me, I asked it.',
      'Used to drive the whole team to away games. Loud bunch. I miss the loud.',
      'You want to go somewhere? Get yourself a team first. I don\'t do solo fares. Company policy. I\'m the company.',
    ];
    await say(w, 'gus', lines[(S().seen.gus = ((S().seen.gus || 0) + 1)) % lines.length]);
    return;
  }
  if (G.hooks.travel) await G.hooks.travel(w);
}

// ================================================================ clubhouse + Coach Hollow
export async function clubhouseIntro(w) {
  G.ui.cine(true);
  await w.wait(0.6);
  await narr('Dust. Folding chairs. A trophy case with exactly one trophy in it, facing the wall.');
  G.audio.sfx('whistle');
  await w.wait(0.7);
  const a = w.named.hollow;
  if (a) { a.ch.root.visible = true; w.fx.sparkle({ x: a.x, y: 1.4, z: a.z }, 0xbfeee0, 14); G.audio.sfx('ghost'); a.ch.play('flinch'); }
  await say(w, 'hollow', '*FIFTY PUSH-UPS!* ...Oh. You\'re not the Tuesday squad.');
  await say(w, 'hollow', 'Coach Hollow. Kicker, special teams, and — technically — deceased. Don\'t make it weird.');
  await say(w, 'hollow', 'You\'ve got the brass key, so you\'re the Captain. That\'s how the contract works. I\'ve checked. I have had a great many evenings.');
  const pick = await G.ui.choose('hollow', 'Well? Say something captain-y.', ['I\'ve never played football.', 'What team?', 'You\'re a ghost.']);
  if (pick === 0) await say(w, 'hollow', 'Neither had half the legends on that wall. The other half were worse. You\'ll fit right in.');
  else if (pick === 1) await say(w, 'hollow', 'Exactly the problem! The *Huddle Hollow Lanterns* haven\'t fielded a team since... a while.');
  else await say(w, 'hollow', 'And you\'re a fox in a doorway. We all have things going on. Focus.');
  await say(w, 'hollow', 'Rules say a team needs five. I count as one. Legally. So: *find five people willing to play.* That\'s the whole job.');
  await say(w, 'hollow', 'There\'s a possum in *Backyard Borough* with a cannon for an arm. A rabbit who outran the mail truck. And the *diner* cook — do not let him cook you.');
  await say(w, 'hollow', 'Here. Every Captain gets one.');
  setFlag('has_ball');
  G.audio.sfx('item');
  await narr(`You got the *Captain's Football*.  Press ${G.input.glyph('x')} to throw it at things. Politely.`);
  await say(w, 'hollow', 'I\'ll float along. I\'m under contract. Lead the way, Captain.');
  w.removeActor('hollow');
  recruit('hollow');
  setFlag('met_hollow');
  setQuestStage('five', 1);
  G.ui.cine(false);
  afterRecruit(w);
}

// ================================================================ Pip (Backyard Borough rooftop)
export async function quill(w) {
  if (!S().roster.includes('pip')) {
    await say(w, 'quill', 'Oh thank goodness, a helmet. That\'s *Pip* on my roof. He threw his football onto it, climbed up after it, looked down, and... well.');
    await say(w, 'quill', 'He\'s been "dead" for an hour. The ladder\'s hooked up under the eave. I can\'t reach the catch.');
    if (!flag('pip_ladder')) await narr(`Face the red-and-white *target* by the ladder and press ${G.input.glyph('x')} to throw.`);
  } else {
    await say(w, 'quill', 'He\'s a sweet boy. Nervous. My gutters have never been cleaner — he clings to them.');
  }
}

export async function pipLadder(w) {
  G.ui.cine(true);
  await w.focus(21.5, 13, 0.8, 0.6);
  G.audio.sfx('thud');
  w.fx.shake(0.15, 0.25);
  await w.wait(0.4);
  await narr('The catch pops. The ladder swings down and thunks into the lawn.');
  w.rebuild();
  w.camOverride = { x: 21.5, z: 13, zoom: 0.8 };
  const pip = w.named.pip;
  if (pip) {
    pip.ch.setBase('move'); pip.ch.setExpr('wide', 1.5); pip.ch.play('flinch');
    w.emote(pip, '!', 'big');
    await say(w, 'pip', 'I\'m alive! I\'m— is the dog gone? There was no dog? There was *definitely* a dog.');
    // climb down
    await w.tween(1.1, (k) => { pip.y = 5.25 * (1 - k); pip.x = 23.2 + k * 0.4; pip.z = 11.2 + k * 3.2; pip.ch.setPos(pip.x, pip.z, pip.y); pip.ch.face(Math.PI); });
    pip.ch.play('hop');
    w.fx.dust(pip.x, pip.z);
    await say(w, 'pip', 'I was practicing my deep ball. It went... up. Mostly up.');
    await say(w, 'hollow', 'Son, that ball cleared a two-story house from the far lawn. I\'m putting you at *quarterback* before you can faint again.');
    await say(w, 'pip', 'Quarterback?! People *chase* the quarterback!');
    await say(w, 'hollow', 'And when they do, you do that thing you do.');
    await say(w, 'pip', '...Play dead?');
    await say(w, 'hollow', 'Play dead.');
    w.removeActor('pip', false);
  }
  recruit('pip');
  G.ui.cine(false);
  w.release();
  afterRecruit(w);
  await duskNotice(w);
}

// ================================================================ Zip (block party race)
export async function bleat(w) {
  await say(w, 'bleat', 'Step right up! *Lawn Dash!* Beat the Borough\'s fastest feet and win a prize! Nobody has! That\'s what makes it a good business!');
}

export async function zip(w) {
  if (!flag('zip_met')) {
    setFlag('zip_met');
    await say(w, 'zip', 'Hi! Hi. You\'re new. I\'m *Zip*. I\'m fast. Like — really fast. Did you know the mail truck has a top speed? I do. I beat it. Twice.');
    await say(w, 'zip', 'You want to race? You look like you want to race. Everyone wants to race until they race.');
  }
  const tries = S().seen.zipRaces || 0;
  const pick = await G.ui.choose('zip', tries ? 'Again? Again! I can do this all day. I *have* done this all day.' : 'Lawn Dash. You and me. First to the far fence.', ['Race!', 'Not yet.'], { cancel: 1 });
  if (pick !== 0) { await say(w, 'zip', 'Okay! I\'ll be here. Vibrating.'); return; }
  const res = await G.hooks.minigame('dash', { rival: 'zip', ease: Math.min(3, tries) });
  S().seen.zipRaces = tries + 1;
  if (res && res.won) {
    await say(w, 'zip', 'Okay. *Okay.* Nobody\'s done that. Did you see me stumble? I didn\'t stumble. The lawn stumbled.');
    await say(w, 'hollow', 'Ever thought about football? You\'d be running past people.');
    await say(w, 'zip', 'Past people? While they\'re mad about it? I\'m in. I\'ve *been* in. I was in before you asked. What\'s a route? Never mind, I\'ll run all of them.');
    w.removeActor('zip', false);
    recruit('zip');
    afterRecruit(w);
    await duskNotice(w);
  } else {
    await say(w, 'zip', 'Ha! Good race! You were close. Ish. Close-ish. Come back when your legs stop being sad.');
  }
}

// ================================================================ Waffle (diner)
export async function waffle(w) {
  if (!flag('waffle_met')) {
    setFlag('waffle_met');
    await say(w, 'waffle', 'Kitchen\'s closed. Has been since the stove lost an argument with the fuse box.');
    await say(w, 'waffle', '...You\'re the new Captain. Hm. The old team came in every game day. A stack for each. Double for the line.');
  }
  if (!S().roster.includes('pip') || !S().roster.includes('zip')) {
    await say(w, 'waffle', 'You want a lineman? Come back with *somebody to throw* and *somebody to catch*. A lineman without a team is just a large man in a doorway.');
    return;
  }
  const pick = await G.ui.choose('waffle', 'I\'ll block for you. One condition: show me you can actually run a play. My dish crew will line up against you out back.', ['Line up! (Offense tutorial)', 'Not yet.'], { cancel: 1 });
  if (pick !== 0) { await say(w, 'waffle', 'Mm. Pancakes keep. Sort of.'); return; }
  const res = await G.hooks.battle({ team: 'dishpit', kind: 'drive', side: 'off', venue: 'practice', tutorial: 'offense', start: 20, guest: 'waffle', noLoss: true });
  if (res && res.won) {
    await say(w, 'waffle', 'Huh. You didn\'t fall down. Much.');
    await say(w, 'waffle', 'All right, Captain. *Nobody gets through me.* That\'s not a promise. It\'s just what happens.');
    w.removeActor('waffle', false);
    recruit('waffle');
    setFlag('waffle_drill');
    await say(w, 'hollow', 'He can *shove* things, too. Dumpsters, crates, bad ideas. Walk him up to anything heavy.');
    afterRecruit(w);
    w.rebuild();
    await duskNotice(w);
  } else {
    await say(w, 'waffle', 'Dish crew\'s tougher than they look. Shake it off and line up again.');
  }
}

export async function maple(w) {
  if (!S().town.diner) {
    await say(w, 'maple', 'Uncle Waffle says I\'m in charge now! I can\'t reach the stove. Or fix it. But I\'m in charge!');
    await say(w, 'maple', 'If somebody fixed the diner at the *notice board* I could make *game-day meals*. I know all the recipes. I\'ve licked all the bowls.');
    return;
  }
  if (G.hooks.diner) await G.hooks.diner(w);
}

// ================================================================ June (clubhouse porch light, at dusk)
export async function june(w) {
  const a = w.named.june;
  G.ui.cine(true);
  await say(w, 'june', '... ... *light.*');
  await say(w, 'hollow', 'That\'s *June*. Best safety this town never had. Shows up when the lights come on, leaves when they go off.');
  await say(w, 'june', 'You\'re loud. Quarterbacks are louder. I hear the ball leave their hand.');
  await say(w, 'june', 'I\'ll play. *Night games only.*');
  await say(w, 'hollow', 'They\'re all night games if you start late enough. Let\'s see it. Scout team — line up!');
  G.ui.cine(false);
  const res = await G.hooks.battle({ team: 'dishpit', kind: 'drive', side: 'def', venue: 'practice', tutorial: 'defense', start: 22, guest: 'june', noLoss: true, tod: 'dusk' });
  if (res && res.won) {
    await say(w, 'june', 'Good. You watch the ball too.');
    if (a) w.removeActor('june');
    recruit('june');
    afterRecruit(w);
    await fiveFound(w);
  } else {
    await say(w, 'june', 'Again. The light\'s still on.');
  }
}

async function fiveFound(w) {
  G.ui.cine(true);
  await say(w, 'hollow', 'Five. *FIVE!* Plus you. That\'s a team. That is a legally binding team!');
  await say(w, 'pip', 'Is it too late to be un-found?');
  await say(w, 'zip', 'Yes! It\'s so late! We\'re a team! What are we called? Are there snacks? Is there a bus?');
  await say(w, 'hollow', 'There\'s a field in the Borough, painted across four lawns and one very upset flowerbed. The *Cul-de-Sac Gnomes* play there.');
  await say(w, 'hollow', 'They have never lost at home. Mostly because nobody\'s ever shown up. Tonight, somebody shows up.');
  G.ui.cine(false);
  finishQuest('five');
  startQuest('first_match');
  S().chapter = 1;
  setFlag('board_open');
  unlockPlay('hollow_dive', true);
  await narr('Open the *menu* any time to set your two squads, check the playbook and use snacks. Benches refill everyone\'s stamina.');
  w.rebuild();
  save();
}

// ================================================================ the first match
export async function terracotta(w) {
  if (S().wins.gnomes) {
    const pick = await G.ui.choose('terracotta', 'Field\'s yours on game days. You want a rematch? Gerald\'s been restless.', ['Rematch!', 'Just visiting.'], { cancel: 1 });
    if (pick === 0) await G.hooks.battle({ team: 'gnomes', kind: 'match', venue: 'backyard', drives: 2, rematch: true });
    return;
  }
  if (S().chapter < 1) {
    await say(w, 'terracotta', 'Lawn\'s closed, tall-folk. This is a *regulation* field. You need a *regulation* team. Count your helmets and come back.');
    return;
  }
  if (!flag('gnomes_met')) {
    setFlag('gnomes_met');
    await say(w, 'terracotta', 'Well, well. A captain. With a *team*. Thought the Lanterns were a bedtime story.');
    await say(w, 'terracotta', 'Gnome rules: no mowing during play, no stepping on *Gerald*, and the sprinklers stay ON.');
    await say(w, 'pip', 'Who\'s Gerald?');
    await say(w, 'terracotta', 'You\'ll know.');
  }
  const pick = await G.ui.choose('terracotta', 'Two possessions each. Most points takes the lawn. You ready, Captain?', ['Kick it off!', 'Give me a minute.'], { cancel: 1 });
  if (pick !== 0) { await say(w, 'terracotta', 'Take your time. We\'ve got centuries.'); return; }
  setQuestStage('first_match', 1);
  const res = await G.hooks.battle({ team: 'gnomes', kind: 'match', venue: 'backyard', drives: 2, story: 'first_match' });
  if (res && res.won) {
    S().wins.gnomes = (S().wins.gnomes || 0) + 1;
    await say(w, 'terracotta', 'Hmph. *Hmph.* Field\'s yours on game days. Gerald likes you. I can tell because he hasn\'t moved.');
    addCoins(60); addParts(2); addDecor('trophy_borough'); addDecor('gnome', true);
    await say(w, 'zip', 'We won! We won? We won! Did everybody see the scoreboard thing? Across town? I saw a scoreboard thing.');
    await say(w, 'hollow', '...Yeah. I saw it too. Let\'s go home, Captain.');
    S().tod = 'night';
    S().chapter = Math.max(S().chapter, 2);
    setQuestStage('first_match', 2);
    restAll();
    w.rebuild();
    save();
  } else {
    await say(w, 'terracotta', 'Ha! The lawn provides. Come back when you\'ve rested, tall-folk.');
  }
}

// ================================================================ the scoreboard
export function scoreboardLines() {
  if (flag('bowl_won')) return [{ t: 'FINAL', c: '#9be8ff' }, 'THANK YOU,', 'CAPTAIN.'];
  return ['WELCOME BACK,', 'CAPTAIN.'];
}

/** Shown during the first match, right after your first touchdown. */
export async function firstTouchdownCut() {
  setFlag('scoreboard_on');
  if (G.hooks.cutscene) await G.hooks.cutscene('scoreboard');
}

export async function stadiumApproach(w) {
  if (!flag('scoreboard_on')) {
    await say(w, 'hollow', 'The old stadium. Lights went out a long time ago and nobody\'s found the right fuse since.');
    await say(w, 'hollow', 'Sometimes you hear things under the bleachers. Raccoons, probably. Ambitious ones.');
    return;
  }
  if (flag('seen_scoreboard')) return;
  setFlag('seen_scoreboard');
  G.ui.cine(true);
  await w.focus(39, 9, 1.05, 1.2);
  await narr('The scoreboard is on. Nobody turned it on.');
  await narr('It reads: *WELCOME BACK, CAPTAIN.*');
  await narr('You have never been here before.');
  await say(w, 'pip', 'Is it talking to you? It\'s talking to you. I\'d like to go home and I live in a hedge.');
  await say(w, 'hollow', 'That board\'s been dark since the last *Midnight Bowl*. The one we never finished.');
  await say(w, 'hollow', 'Championship of everything past the streetlights. The stadium only shows itself after sunset, and only to teams that have earned it.');
  await say(w, 'hollow', '*Four regions. Four rivals.* Beat them all and that gate opens. You\'ve got one.');
  const pick = await G.ui.choose('hollow', '...', ['Why does it say "welcome back"?', 'What happened at the last one?']);
  if (pick === 0) await say(w, 'hollow', 'That\'s the part I can\'t answer, Captain. Literally can\'t. It\'s in the contract.');
  else await say(w, 'hollow', 'Halftime. Lights went out. When they came back on, there was no other team, no crowd, and — as it turned out — no me. Details are fuzzy.');
  await say(w, 'hollow', 'Talk to *Gus* about the bus. And the Mayor\'s been waving a clipboard at the *notice board* all evening.');
  G.ui.cine(false);
  w.release();
  finishQuest('first_match');
  startQuest('welcome_back', 2);
  startQuest('rebuild');
  setFlag('bus_open');
  setFlag('bus_fair');
  S().chapter = Math.max(S().chapter, 2);
  save();
}

export async function stadiumGate(w) {
  if (G.hooks.stadiumGate) return G.hooks.stadiumGate(w);
  await narr('A heavy chain. Through the bars: rows of empty bleachers, and a field somebody has kept suspiciously tidy.');
}

export async function fuseBox(w) {
  if (G.hooks.fuseBox) return G.hooks.fuseBox(w);
  await narr('A fuse box, rusted shut. Something inside it is humming a fight song.');
}

// ================================================================ townsfolk
export async function plaque(w) {
  await narr('"THE HUDDLE HOLLOW LANTERNS — WE LEAVE A LIGHT ON."');
  await narr('Underneath, scratched in later: "...for whoever comes back."');
}
export async function marigold(w) {
  if (!flag('board_open')) {
    await say(w, 'marigold', 'Welcome to Huddle Hollow! As Mayor, I am delighted, and as Treasurer, I am broke.');
    await say(w, 'marigold', 'This town used to run on game days. Diner full, arcade loud, stadium lit. Get a team on a field and we\'ll talk about *rebuilding*.');
    return;
  }
  if (!flag('marigold_board')) {
    setFlag('marigold_board');
    await say(w, 'marigold', 'A team! An actual team! I\'ve dusted off the *notice board*. Pin your *coins* and *spare parts* to a project and the town does the rest.');
    await say(w, 'marigold', 'Fix the *diner* for game-day meals. Reopen the *arcade* for, ahem, "training". The *practice field* for new plays. And the *stadium*...');
    await say(w, 'marigold', 'Well. Let\'s start with the diner.');
    return;
  }
  const t = S().town;
  const n = t.diner + t.arcade + t.field + t.stadium;
  await say(w, 'marigold', n >= 5 ? 'Look at this place! I may have to hire a second Treasurer. I\'ll interview myself.' : 'Every project you finish, somebody new moves in. I\'m running out of welcome baskets. It\'s wonderful.');
}
export async function noticeBoard(w) {
  setFlag('board_seen');
  if (!flag('board_open')) { await narr('A corkboard with one faded flyer: "GAME TONIGHT — BRING A FRIEND." The date has been rained off.'); return; }
  if (G.hooks.board) await G.hooks.board(w);
}
export async function dot(w) {
  if (S().town.arcade) { await say(w, 'dot', 'The machines are singing again! Go on in. High scores win prizes. Low scores win my sympathy.'); return; }
  await say(w, 'dot', 'I ran the best arcade in three counties. Then the stadium went dark and the kids stopped coming and the *Mascot Mayhem* cabinet started turning itself on at night.');
  await say(w, 'dot', 'If the town ever fixes the place up, I\'ve got *minigames* in there that\'ll make a real athlete out of you. Or at least a tired one.');
}
export async function croaker(w) {
  if (!flag('has_rod')) {
    await say(w, 'croaker', 'Mmmrp. Fishin\'s like football. Mostly waitin\', then everything happens at once, then somebody\'s wet.');
    await say(w, 'croaker', 'Take my spare rod. Dock\'s right there. Sell what you catch to Nan — or feed your bear.');
    setFlag('has_rod');
    G.audio.sfx('item');
    G.ui.toast('Got the 🎣 <b>Spare Rod</b>');
    return;
  }
  const n = Object.values(S().fish).reduce((a, b) => a + b, 0);
  await say(w, 'croaker', n > 8 ? 'You\'ve got the patience for it. There\'s somethin\' big in there that only bites after dark. Glows a little.' : 'Wait for the bob. Then *hook it* quick. Then don\'t yank — reel when the line\'s slack.');
}
export async function fish(w) {
  if (G.hooks.fish) await G.hooks.fish(w);
}
export async function hamm(w) {
  const lines = [
    'I mow that lawn every morning and every evening the leaves come back. I respect them. They\'re committed.',
    'I played guard for the Lanterns, you know. Third string. I guarded the oranges.',
    'You hear that hum from the stadium at night? My wife says it\'s the wind. Wind doesn\'t know the fight song.',
  ];
  await say(w, 'hamm', lines[(S().seen.hamm = ((S().seen.hamm || 0) + 1)) % lines.length]);
}
export async function mittens(w) {
  const lines = [
    'A new Captain. They always arrive on the afternoon bus. I\'ve seen... well. I\'ve only seen the one. But it *felt* like always.',
    'If you see a garden gnome and then you look away and look back — count them. That\'s all I\'ll say.',
    'The bus goes four places besides here. Gus says it used to go to a fifth. He won\'t say where.',
  ];
  await say(w, 'mittens', lines[(S().seen.mittens = ((S().seen.mittens || 0) + 1)) % lines.length]);
}
export async function nan(w) {
  if (G.hooks.shop) { await G.hooks.shop(w); return; }
  await say(w, 'nan', 'Oranges, sports drinks, smelling salts. Everything a team needs and nothing it wants.');
}
export async function practiceField(w) {
  if (!S().town.field) { await narr('The practice field. Somebody painted lines here once. The dandelions have been running their own routes since.'); return; }
  if (G.hooks.practice) await G.hooks.practice(w);
}

// ================================================================ Backyard Borough chatter
export async function nutmeg(w) {
  if (G.hooks.blitzTwins) return G.hooks.blitzTwins(w);
  await say(w, 'nutmeg', 'We\'re the Acorn twins! We play *Backyard Blitz*! Two on two, sprinklers on, no crying!');
}
export async function clove(w) {
  await say(w, 'clove', 'Nutmeg does the talking. I do the tackling. She also does the tackling.');
}
export async function biscuit(w) {
  const lines = [
    'Those gnomes weren\'t there yesterday. I mean — they were. But not *there*.',
    'Mr. Hamm from town says the sprinklers are on a timer. The timer says otherwise. The timer says a lot of things.',
    'If you bonk a gnome with a football it sees stars. Then you can tap it on the shoulder before it knows what\'s what.',
  ];
  await say(w, 'biscuit', lines[(S().seen.biscuit = ((S().seen.biscuit || 0) + 1)) % lines.length]);
}
export async function boroughSign(w, text) { await narr(text); }

export { cap, displayName, questStage, questDone, addItem };
