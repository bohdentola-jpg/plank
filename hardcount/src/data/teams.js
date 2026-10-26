// The leagues. Every team is plain data: identity, colours, helmet, home and
// away uniforms, logo, playstyle and home venue. Rosters are generated from
// the team (roster.js) so a team always fields the same players. No DOM, no
// three.js: the headless sim imports this file.
//
//   TEAMS        the pro league, THE SEVENS LEAGUE: 16 teams, two conferences
//                (AC American, NC National) of two 4-team divisions each
//   COLLEGES     24 college programs in four conferences (venue 'college')
//   HS_RIVALS    the 12 high schools of the career's first act (venue 'friday')
//   makeHighSchool(seed, overrides?)  any other high school, deterministic
//                from a seed (its id 'hs-<seed>' round-trips through getTeam)
//   ALL_TEAMS, TEAM_BY_ID           pros + colleges + rivals
//   getTeam(id)                     any of the above, or a generated 'hs-<seed>'
//   kitsFor(home, away)             { home, away, homeKit, awayKit }: the visitors
//                                   wear road whites unless they'd clash
//   LEAGUE, divisionTeams(conf, div), COLLEGE_CONFERENCES, HS_PALETTES, colorDistance(a, b)
//
// SCHEMA (every field is used by the 3D kit, the menus or the sim; fields
// marked * are optional extras):
// team = {
//   id: 'pht',                      // stable key (saves, records)
//   level: 'pro' | 'college' | 'hs',
//   city: 'Port Halcyon', name: 'Tide', abbr: 'PHT',
//                                   // college: city = 'Pacifica' (the school's short name)
//                                   // hs: city = 'North Cedar Falls' (the school's short name)
//   colors: { primary, secondary, accent, dark },   // '#rrggbb'
//   logo: { emblem, fg, bg, ring,   // logos.js draws it: emblem id + colours
//           fg2*, acc*, line*,      //   second fill, accent, outline colour (default colors.dark)
//           letter*,                //   1-3 letters for letter/monogram/shield logos or an overlaid block letter
//           letterFont* },          //   'block' | 'college' | 'pro' | 'italic' | 'stencil'
//   helmet: {
//     shell, finish: 'gloss'|'matte'|'pearl'|'chrome',
//     stripe: 'none'|'single'|'double'|'triple'|'skunk'|'bolt'|'wings', stripeColors: [..],
//     facemask, logo: true (side decals), number: false (back of helmet number),
//   },
//   uniform: {
//     home: kit, away: kit, alt*: kit,   // kitsFor() picks the visitors' kit
//   },
//   kit = {
//     jersey, numbers, numberOutline (or null), numberFont: 'block'|'pro'|'college'|'italic'|'stencil',
//     sleeve: 'none'|'stripes2'|'stripes3'|'cuff'|'shoulder'|'bolt'|'yoke', sleeveColors: [..],
//     collar, sideColor (jersey side panel, null = none),
//     pants, pantStripe: 'none'|'single'|'double'|'triple'|'bolt', pantStripeColors: [..],
//     socks, sockStripes: [..] (colours of hoops near the top, may be empty),
//     shoes: 'black'|'white'|'team', gloves: '#rrggbb', nameOnBack: true,
//   },
//   style: { offense: 'spread'|'airraid'|'option'|'power'|'balanced', defense: 'blitz'|'zone'|'man'|'balanced', tempo: 0..1 },
//   strength: 0..1,                 // talent level (drives generated ratings)
//   venue: 'venueId',               // home stadium (gfx/stadium venues)
//   conference*, division*,         // pro: 'AC'|'NC' + 'North'|'South'|'Central'|'West'; college: conference name
//   stadium*,                       // the home ground's name ('Halcyon Bay Stadium')
//   venueDress*: { seats, banner, trim, endzone: 'solid'|'stripes'|'diagonal'|'checker', endzoneColor, turf: 'grass'|'turf' },
//   wordmark*: { style: 'block'|'italic'|'pro'|'college'|'stencil'|'speed'|'arch', fill, outline, outline2 },
//   founded*, school*, location*, town*, mascot*,
// }
import { makeRng, hashString } from '../core/util.js';
import { MASCOTS, townName, schoolName } from './names.js';

// ------------------------------------------------------------------ colour math (for kitsFor)

function hexRgb(hex) {
  const n = parseInt(String(hex).replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
function toLab(hex) {
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const [r, g, b] = hexRgb(hex).map(lin);
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x), fy = f(y), fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
/** Perceptual colour distance (CIE76 ΔE; ~2 = barely visible, 50+ = very different). */
export function colorDistance(a, b) {
  const A = toLab(a), B = toLab(b);
  return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
}

// ------------------------------------------------------------------ THE SEVENS LEAGUE

export const LEAGUE = {
  name: 'The Sevens League',
  abbr: 'TSL',
  conferences: [
    { id: 'AC', name: 'American Conference', divisions: ['North', 'South'] },
    { id: 'NC', name: 'National Conference', divisions: ['Central', 'West'] },
  ],
};

export const TEAMS = [
  // ============================================================ AC NORTH
  {
    id: 'bos', level: 'pro', city: 'Boston', name: 'Ironsides', abbr: 'BOS',
    conference: 'AC', division: 'North', founded: 1961, stadium: 'Constitution Field',
    colors: { primary: '#14213d', secondary: '#b3202a', accent: '#a7b0b8', dark: '#0a1122' },
    logo: { emblem: 'anchor', fg: '#c3cad1', fg2: '#b3202a', acc: '#ffffff', bg: '#14213d', ring: '#b3202a', line: '#0a1122' },
    helmet: { shell: '#b3202a', finish: 'gloss', stripe: 'triple', stripeColors: ['#14213d', '#ffffff', '#14213d'], facemask: '#14213d', logo: true, number: false },
    uniform: {
      home: {
        jersey: '#14213d', numbers: '#ffffff', numberOutline: '#b3202a', numberFont: 'block',
        sleeve: 'stripes3', sleeveColors: ['#ffffff', '#b3202a', '#ffffff'], collar: '#b3202a', sideColor: null,
        pants: '#a9b2bb', pantStripe: 'triple', pantStripeColors: ['#14213d', '#b3202a', '#14213d'],
        socks: '#14213d', sockStripes: ['#b3202a', '#ffffff'], shoes: 'black', gloves: '#14213d', nameOnBack: true,
      },
      away: {
        jersey: '#f4f5f7', numbers: '#14213d', numberOutline: '#b3202a', numberFont: 'block',
        sleeve: 'stripes3', sleeveColors: ['#14213d', '#b3202a', '#14213d'], collar: '#14213d', sideColor: null,
        pants: '#a9b2bb', pantStripe: 'triple', pantStripeColors: ['#14213d', '#b3202a', '#14213d'],
        socks: '#14213d', sockStripes: ['#b3202a'], shoes: 'black', gloves: '#b3202a', nameOnBack: true,
      },
    },
    style: { offense: 'balanced', defense: 'zone', tempo: 0.45 },
    strength: 0.74,
    venue: 'bayside',
    venueDress: { seats: '#14213d', banner: '#b3202a', trim: '#a7b0b8', endzone: 'stripes', endzoneColor: '#14213d', turf: 'grass' },
    wordmark: { style: 'block', fill: '#ffffff', outline: '#14213d', outline2: '#b3202a' },
  },
  {
    id: 'nye', level: 'pro', city: 'New York', name: 'Empire', abbr: 'NYE',
    conference: 'AC', division: 'North', founded: 1959, stadium: 'Ironbound Stadium',
    colors: { primary: '#1d3f94', secondary: '#f2b41b', accent: '#ffffff', dark: '#0c1b45' },
    logo: { emblem: 'crown', fg: '#f2b41b', fg2: '#1d3f94', acc: '#ffffff', bg: '#1d3f94', ring: '#ffffff', line: '#0c1b45' },
    helmet: { shell: '#1d3f94', finish: 'gloss', stripe: 'skunk', stripeColors: ['#f2b41b', '#ffffff'], facemask: '#ffffff', logo: true, number: false },
    uniform: {
      home: {
        jersey: '#1d3f94', numbers: '#ffffff', numberOutline: '#f2b41b', numberFont: 'pro',
        sleeve: 'yoke', sleeveColors: ['#f2b41b'], collar: '#f2b41b', sideColor: null,
        pants: '#f4f5f7', pantStripe: 'double', pantStripeColors: ['#1d3f94', '#f2b41b'],
        socks: '#1d3f94', sockStripes: ['#f2b41b', '#ffffff'], shoes: 'black', gloves: '#1d3f94', nameOnBack: true,
      },
      away: {
        jersey: '#f4f5f7', numbers: '#1d3f94', numberOutline: '#f2b41b', numberFont: 'pro',
        sleeve: 'yoke', sleeveColors: ['#1d3f94'], collar: '#1d3f94', sideColor: null,
        pants: '#f2b41b', pantStripe: 'single', pantStripeColors: ['#1d3f94'],
        socks: '#1d3f94', sockStripes: ['#f2b41b'], shoes: 'black', gloves: '#f2b41b', nameOnBack: true,
      },
    },
    style: { offense: 'balanced', defense: 'man', tempo: 0.55 },
    strength: 0.8,
    venue: 'foundry',
    venueDress: { seats: '#1d3f94', banner: '#f2b41b', trim: '#ffffff', endzone: 'solid', endzoneColor: '#1d3f94', turf: 'turf' },
    wordmark: { style: 'pro', fill: '#f2b41b', outline: '#0c1b45', outline2: '#ffffff' },
  },
  {
    id: 'det', level: 'pro', city: 'Detroit', name: 'Motormen', abbr: 'DET',
    conference: 'AC', division: 'North', founded: 1946, stadium: 'Rouge River Stadium',
    colors: { primary: '#26282b', secondary: '#f26a1b', accent: '#ffffff', dark: '#111214' },
    logo: { emblem: 'gear', fg: '#f26a1b', fg2: '#26282b', acc: '#ffffff', bg: '#26282b', ring: '#ffffff', line: '#111214', letter: 'M', letterFont: 'italic' },
    helmet: { shell: '#26282b', finish: 'matte', stripe: 'triple', stripeColors: ['#f26a1b', '#ffffff', '#f26a1b'], facemask: '#f26a1b', logo: true, number: false },
    uniform: {
      home: {
        jersey: '#f26a1b', numbers: '#26282b', numberOutline: '#ffffff', numberFont: 'stencil',
        sleeve: 'stripes3', sleeveColors: ['#26282b', '#ffffff', '#26282b'], collar: '#26282b', sideColor: null,
        pants: '#26282b', pantStripe: 'triple', pantStripeColors: ['#f26a1b', '#ffffff', '#f26a1b'],
        socks: '#26282b', sockStripes: ['#f26a1b', '#ffffff'], shoes: 'black', gloves: '#26282b', nameOnBack: true,
      },
      away: {
        jersey: '#f4f5f7', numbers: '#f26a1b', numberOutline: '#26282b', numberFont: 'stencil',
        sleeve: 'stripes3', sleeveColors: ['#26282b', '#f26a1b', '#26282b'], collar: '#f26a1b', sideColor: null,
        pants: '#26282b', pantStripe: 'triple', pantStripeColors: ['#f26a1b', '#ffffff', '#f26a1b'],
        socks: '#26282b', sockStripes: ['#f26a1b'], shoes: 'black', gloves: '#f26a1b', nameOnBack: true,
      },
      alt: {
        jersey: '#26282b', numbers: '#f26a1b', numberOutline: '#ffffff', numberFont: 'stencil',
        sleeve: 'stripes3', sleeveColors: ['#f26a1b', '#ffffff', '#f26a1b'], collar: '#f26a1b', sideColor: null,
        pants: '#26282b', pantStripe: 'triple', pantStripeColors: ['#f26a1b', '#ffffff', '#f26a1b'],
        socks: '#f26a1b', sockStripes: ['#26282b', '#ffffff'], shoes: 'black', gloves: '#f26a1b', nameOnBack: true,
      },
    },
    style: { offense: 'power', defense: 'blitz', tempo: 0.35 },
    strength: 0.72,
    venue: 'foundry',
    venueDress: { seats: '#26282b', banner: '#f26a1b', trim: '#ffffff', endzone: 'diagonal', endzoneColor: '#f26a1b', turf: 'turf' },
    wordmark: { style: 'stencil', fill: '#f26a1b', outline: '#111214', outline2: '#ffffff' },
  },
  {
    id: 'chi', level: 'pro', city: 'Chicago', name: 'Blaze', abbr: 'CHI',
    conference: 'AC', division: 'North', founded: 1971, stadium: 'Lakeshore Field',
    colors: { primary: '#c8102e', secondary: '#111111', accent: '#ffb612', dark: '#0a0a0a' },
    logo: { emblem: 'flame', fg: '#ffb612', fg2: '#c8102e', acc: '#ff6b1a', bg: '#111111', ring: '#ffffff', line: '#0a0a0a' },
    helmet: { shell: '#141414', finish: 'gloss', stripe: 'triple', stripeColors: ['#ffb612', '#c8102e', '#ffb612'], facemask: '#c8102e', logo: true, number: false },
    uniform: {
      home: {
        jersey: '#c8102e', numbers: '#ffffff', numberOutline: '#111111', numberFont: 'italic',
        sleeve: 'shoulder', sleeveColors: ['#111111', '#ffb612'], collar: '#111111', sideColor: '#111111',
        pants: '#f4f4f2', pantStripe: 'double', pantStripeColors: ['#111111', '#c8102e'],
        socks: '#141414', sockStripes: ['#c8102e', '#ffb612'], shoes: 'black', gloves: '#141414', nameOnBack: true,
      },
      away: {
        jersey: '#f4f5f7', numbers: '#c8102e', numberOutline: '#111111', numberFont: 'italic',
        sleeve: 'shoulder', sleeveColors: ['#c8102e', '#111111'], collar: '#c8102e', sideColor: '#c8102e',
        pants: '#141414', pantStripe: 'double', pantStripeColors: ['#c8102e', '#ffb612'],
        socks: '#141414', sockStripes: ['#c8102e'], shoes: 'black', gloves: '#c8102e', nameOnBack: true,
      },
      alt: {
        jersey: '#141414', numbers: '#c8102e', numberOutline: '#ffb612', numberFont: 'italic',
        sleeve: 'shoulder', sleeveColors: ['#c8102e', '#ffb612'], collar: '#c8102e', sideColor: '#c8102e',
        pants: '#141414', pantStripe: 'double', pantStripeColors: ['#c8102e', '#ffb612'],
        socks: '#141414', sockStripes: ['#c8102e', '#ffb612'], shoes: 'black', gloves: '#141414', nameOnBack: true,
      },
    },
    style: { offense: 'spread', defense: 'blitz', tempo: 0.7 },
    strength: 0.76,
    venue: 'snowbowl',
    venueDress: { seats: '#c8102e', banner: '#111111', trim: '#ffb612', endzone: 'solid', endzoneColor: '#c8102e', turf: 'grass' },
    wordmark: { style: 'speed', fill: '#ffb612', outline: '#0a0a0a', outline2: '#c8102e' },
  },
  // ============================================================ AC SOUTH
  {
    id: 'was', level: 'pro', city: 'Washington', name: 'Sentinels', abbr: 'WAS',
    conference: 'AC', division: 'South', founded: 1962, stadium: 'Potomac Yards Stadium',
    colors: { primary: '#15171a', secondary: '#c9a13b', accent: '#ffffff', dark: '#0b0c0d' },
    logo: { emblem: 'eagle', fg: '#ffffff', fg2: '#15171a', acc: '#e0ae2e', bg: '#15171a', ring: '#c9a13b', line: '#0b0c0d' },
    helmet: { shell: '#f4f4f2', finish: 'gloss', stripe: 'triple', stripeColors: ['#15171a', '#c9a13b', '#15171a'], facemask: '#15171a', logo: true, number: false },
    uniform: {
      home: {
        jersey: '#15171a', numbers: '#ffffff', numberOutline: '#c9a13b', numberFont: 'college',
        sleeve: 'stripes2', sleeveColors: ['#c9a13b', '#ffffff'], collar: '#c9a13b', sideColor: null,
        pants: '#c9a13b', pantStripe: 'triple', pantStripeColors: ['#15171a', '#ffffff', '#15171a'],
        socks: '#15171a', sockStripes: ['#c9a13b', '#ffffff'], shoes: 'black', gloves: '#15171a', nameOnBack: true,
      },
      away: {
        jersey: '#f4f5f7', numbers: '#15171a', numberOutline: '#c9a13b', numberFont: 'college',
        sleeve: 'stripes2', sleeveColors: ['#15171a', '#c9a13b'], collar: '#15171a', sideColor: null,
        pants: '#15171a', pantStripe: 'double', pantStripeColors: ['#c9a13b', '#ffffff'],
        socks: '#15171a', sockStripes: ['#c9a13b'], shoes: 'black', gloves: '#c9a13b', nameOnBack: true,
      },
    },
    style: { offense: 'balanced', defense: 'balanced', tempo: 0.5 },
    strength: 0.67,
    venue: 'bayside',
    venueDress: { seats: '#15171a', banner: '#c9a13b', trim: '#ffffff', endzone: 'stripes', endzoneColor: '#15171a', turf: 'grass' },
    wordmark: { style: 'college', fill: '#ffffff', outline: '#0b0c0d', outline2: '#c9a13b' },
  },
  {
    id: 'orl', level: 'pro', city: 'Orlando', name: 'Voltage', abbr: 'ORL',
    conference: 'AC', division: 'South', founded: 1996, stadium: 'Citrus Dome',
    colors: { primary: '#1789d6', secondary: '#cde21b', accent: '#111418', dark: '#071a2e' },
    logo: { emblem: 'bolt', fg: '#cde21b', fg2: '#1789d6', acc: '#ffffff', bg: '#111418', ring: '#1789d6', line: '#071a2e' },
    helmet: { shell: '#1789d6', finish: 'pearl', stripe: 'bolt', stripeColors: ['#cde21b', '#111418'], facemask: '#111418', logo: true, number: false },
    uniform: {
      home: {
        jersey: '#1789d6', numbers: '#ffffff', numberOutline: '#111418', numberFont: 'italic',
        sleeve: 'bolt', sleeveColors: ['#cde21b', '#111418'], collar: '#111418', sideColor: '#111418',
        pants: '#111418', pantStripe: 'bolt', pantStripeColors: ['#cde21b', '#1789d6'],
        socks: '#111418', sockStripes: ['#cde21b'], shoes: 'black', gloves: '#cde21b', nameOnBack: true,
      },
      away: {
        jersey: '#f4f5f7', numbers: '#1789d6', numberOutline: '#111418', numberFont: 'italic',
        sleeve: 'bolt', sleeveColors: ['#1789d6', '#cde21b'], collar: '#1789d6', sideColor: '#1789d6',
        pants: '#111418', pantStripe: 'bolt', pantStripeColors: ['#cde21b', '#1789d6'],
        socks: '#111418', sockStripes: ['#1789d6'], shoes: 'black', gloves: '#111418', nameOnBack: true,
      },
      alt: {
        jersey: '#111418', numbers: '#cde21b', numberOutline: '#1789d6', numberFont: 'italic',
        sleeve: 'bolt', sleeveColors: ['#1789d6', '#cde21b'], collar: '#cde21b', sideColor: '#1789d6',
        pants: '#111418', pantStripe: 'bolt', pantStripeColors: ['#cde21b', '#1789d6'],
        socks: '#111418', sockStripes: ['#cde21b', '#1789d6'], shoes: 'black', gloves: '#cde21b', nameOnBack: true,
      },
    },
    style: { offense: 'spread', defense: 'man', tempo: 0.85 },
    strength: 0.6,
    venue: 'dome',
    venueDress: { seats: '#1789d6', banner: '#cde21b', trim: '#111418', endzone: 'diagonal', endzoneColor: '#111418', turf: 'turf' },
    wordmark: { style: 'speed', fill: '#cde21b', outline: '#071a2e', outline2: '#1789d6' },
  },
  {
    id: 'atl', level: 'pro', city: 'Atlanta', name: 'Rattlers', abbr: 'ATL',
    conference: 'AC', division: 'South', founded: 1995, stadium: 'Peachtree Dome',
    colors: { primary: '#00727f', secondary: '#c26a32', accent: '#e8d5a9', dark: '#062b30' },
    logo: { emblem: 'rattlesnake', fg: '#e8d5a9', fg2: '#00727f', acc: '#c26a32', bg: '#00727f', ring: '#e8d5a9', line: '#0d1112' },
    helmet: { shell: '#b8662f', finish: 'pearl', stripe: 'double', stripeColors: ['#00727f', '#0d1112'], facemask: '#0d1112', logo: true, number: false },
    uniform: {
      home: {
        jersey: '#00727f', numbers: '#ffffff', numberOutline: '#c26a32', numberFont: 'pro',
        sleeve: 'stripes3', sleeveColors: ['#0d1112', '#c26a32', '#0d1112'], collar: '#c26a32', sideColor: '#0d1112',
        pants: '#e8d5a9', pantStripe: 'triple', pantStripeColors: ['#0d1112', '#c26a32', '#0d1112'],
        socks: '#00727f', sockStripes: ['#c26a32', '#0d1112'], shoes: 'black', gloves: '#00727f', nameOnBack: true,
      },
      away: {
        jersey: '#f4f5f7', numbers: '#00727f', numberOutline: '#c26a32', numberFont: 'pro',
        sleeve: 'stripes3', sleeveColors: ['#00727f', '#c26a32', '#00727f'], collar: '#00727f', sideColor: '#00727f',
        pants: '#0d1112', pantStripe: 'double', pantStripeColors: ['#c26a32', '#00727f'],
        socks: '#0d1112', sockStripes: ['#00727f', '#c26a32'], shoes: 'black', gloves: '#c26a32', nameOnBack: true,
      },
    },
    style: { offense: 'balanced', defense: 'blitz', tempo: 0.6 },
    strength: 0.56,
    venue: 'dome',
    venueDress: { seats: '#00727f', banner: '#c26a32', trim: '#e8d5a9', endzone: 'checker', endzoneColor: '#00727f', turf: 'turf' },
    wordmark: { style: 'italic', fill: '#c26a32', outline: '#0d1112', outline2: '#00727f' },
  },
  {
    id: 'lou', level: 'pro', city: 'Louisville', name: 'Thoroughbreds', abbr: 'LOU',
    conference: 'AC', division: 'South', founded: 1974, stadium: 'Falls City Stadium',
    colors: { primary: '#0b7a3f', secondary: '#ffffff', accent: '#d6aa3f', dark: '#053d20' },
    logo: { emblem: 'horse', fg: '#ffffff', fg2: '#0b7a3f', acc: '#d6aa3f', bg: '#0b7a3f', ring: '#d6aa3f', line: '#06321b' },
    helmet: { shell: '#0b7a3f', finish: 'gloss', stripe: 'triple', stripeColors: ['#ffffff', '#d6aa3f', '#ffffff'], facemask: '#ffffff', logo: true, number: false },
    uniform: {
      home: {
        jersey: '#0b7a3f', numbers: '#ffffff', numberOutline: '#d6aa3f', numberFont: 'college',
        sleeve: 'stripes3', sleeveColors: ['#ffffff', '#d6aa3f', '#ffffff'], collar: '#ffffff', sideColor: null,
        pants: '#f4f4f2', pantStripe: 'double', pantStripeColors: ['#0b7a3f', '#d6aa3f'],
        socks: '#0b7a3f', sockStripes: ['#ffffff', '#d6aa3f'], shoes: 'black', gloves: '#ffffff', nameOnBack: true,
      },
      away: {
        jersey: '#f4f5f7', numbers: '#0b7a3f', numberOutline: '#d6aa3f', numberFont: 'college',
        sleeve: 'stripes3', sleeveColors: ['#0b7a3f', '#d6aa3f', '#0b7a3f'], collar: '#0b7a3f', sideColor: null,
        pants: '#0b7a3f', pantStripe: 'double', pantStripeColors: ['#ffffff', '#d6aa3f'],
        socks: '#0b7a3f', sockStripes: ['#ffffff'], shoes: 'black', gloves: '#0b7a3f', nameOnBack: true,
      },
    },
    style: { offense: 'balanced', defense: 'zone', tempo: 0.45 },
    strength: 0.62,
    venue: 'bayside',
    venueDress: { seats: '#0b7a3f', banner: '#d6aa3f', trim: '#ffffff', endzone: 'solid', endzoneColor: '#0b7a3f', turf: 'grass' },
    wordmark: { style: 'arch', fill: '#ffffff', outline: '#06321b', outline2: '#d6aa3f' },
  },
  // ============================================================ NC CENTRAL
  {
    id: 'hou', level: 'pro', city: 'Houston', name: 'Wildcatters', abbr: 'HOU',
    conference: 'NC', division: 'Central', founded: 1960, stadium: 'Spindletop Dome',
    colors: { primary: '#6b1220', secondary: '#d4a43a', accent: '#f2ead8', dark: '#2a070c' },
    logo: { emblem: 'derrick', fg: '#d4a43a', fg2: '#6b1220', acc: '#f2ead8', bg: '#6b1220', ring: '#f2ead8', line: '#2a070c' },
    helmet: { shell: '#d4a43a', finish: 'gloss', stripe: 'single', stripeColors: ['#6b1220'], facemask: '#6b1220', logo: true, number: false },
    uniform: {
      home: {
        jersey: '#6b1220', numbers: '#f2ead8', numberOutline: '#d4a43a', numberFont: 'college',
        sleeve: 'cuff', sleeveColors: ['#d4a43a'], collar: '#d4a43a', sideColor: '#d4a43a',
        pants: '#d4a43a', pantStripe: 'single', pantStripeColors: ['#6b1220'],
        socks: '#6b1220', sockStripes: [], shoes: 'white', gloves: '#6b1220', nameOnBack: true,
      },
      away: {
        jersey: '#f2ead8', numbers: '#6b1220', numberOutline: '#d4a43a', numberFont: 'college',
        sleeve: 'cuff', sleeveColors: ['#6b1220'], collar: '#6b1220', sideColor: '#6b1220',
        pants: '#d4a43a', pantStripe: 'single', pantStripeColors: ['#6b1220'],
        socks: '#6b1220', sockStripes: [], shoes: 'white', gloves: '#d4a43a', nameOnBack: true,
      },
      alt: {
        jersey: '#d4a43a', numbers: '#6b1220', numberOutline: '#f2ead8', numberFont: 'college',
        sleeve: 'cuff', sleeveColors: ['#6b1220'], collar: '#6b1220', sideColor: '#6b1220',
        pants: '#6b1220', pantStripe: 'single', pantStripeColors: ['#d4a43a'],
        socks: '#6b1220', sockStripes: ['#d4a43a'], shoes: 'white', gloves: '#6b1220', nameOnBack: true,
      },
    },
    style: { offense: 'airraid', defense: 'man', tempo: 0.8 },
    strength: 0.7,
    venue: 'dome',
    venueDress: { seats: '#6b1220', banner: '#d4a43a', trim: '#f2ead8', endzone: 'stripes', endzoneColor: '#6b1220', turf: 'turf' },
    wordmark: { style: 'college', fill: '#d4a43a', outline: '#2a070c', outline2: '#f2ead8' },
  },
  {
    id: 'okc', level: 'pro', city: 'Oklahoma City', name: 'Twisters', abbr: 'OKC',
    conference: 'NC', division: 'Central', founded: 1984, stadium: 'Bricktown Stadium',
    colors: { primary: '#44287a', secondary: '#b8c0c8', accent: '#121014', dark: '#1d0f38' },
    logo: { emblem: 'tornado', fg: '#c9d0d7', fg2: '#44287a', acc: '#ffffff', bg: '#44287a', ring: '#b8c0c8', line: '#120a24' },
    helmet: { shell: '#b8c0c8', finish: 'pearl', stripe: 'triple', stripeColors: ['#44287a', '#121014', '#44287a'], facemask: '#44287a', logo: true, number: false },
    uniform: {
      home: {
        jersey: '#44287a', numbers: '#ffffff', numberOutline: '#121014', numberFont: 'pro',
        sleeve: 'stripes2', sleeveColors: ['#b8c0c8', '#121014'], collar: '#121014', sideColor: '#b8c0c8',
        pants: '#b8c0c8', pantStripe: 'double', pantStripeColors: ['#44287a', '#121014'],
        socks: '#44287a', sockStripes: ['#b8c0c8', '#121014'], shoes: 'black', gloves: '#44287a', nameOnBack: true,
      },
      away: {
        jersey: '#f4f5f7', numbers: '#44287a', numberOutline: '#121014', numberFont: 'pro',
        sleeve: 'stripes2', sleeveColors: ['#44287a', '#121014'], collar: '#44287a', sideColor: '#44287a',
        pants: '#b8c0c8', pantStripe: 'double', pantStripeColors: ['#44287a', '#121014'],
        socks: '#44287a', sockStripes: ['#121014'], shoes: 'black', gloves: '#121014', nameOnBack: true,
      },
      alt: {
        jersey: '#121014', numbers: '#b8c0c8', numberOutline: '#44287a', numberFont: 'pro',
        sleeve: 'stripes2', sleeveColors: ['#44287a', '#b8c0c8'], collar: '#44287a', sideColor: '#44287a',
        pants: '#121014', pantStripe: 'double', pantStripeColors: ['#44287a', '#b8c0c8'],
        socks: '#121014', sockStripes: ['#44287a', '#b8c0c8'], shoes: 'black', gloves: '#44287a', nameOnBack: true,
      },
    },
    style: { offense: 'option', defense: 'blitz', tempo: 0.65 },
    strength: 0.64,
    venue: 'foundry',
    venueDress: { seats: '#44287a', banner: '#b8c0c8', trim: '#121014', endzone: 'diagonal', endzoneColor: '#44287a', turf: 'turf' },
    wordmark: { style: 'italic', fill: '#c9d0d7', outline: '#120a24', outline2: '#44287a' },
  },
  {
    id: 'kc', level: 'pro', city: 'Kansas City', name: 'Stampede', abbr: 'KC',
    conference: 'NC', division: 'Central', founded: 1966, stadium: 'Union Yards Stadium',
    colors: { primary: '#f0b323', secondary: '#4b2e1a', accent: '#ffffff', dark: '#24150b' },
    logo: { emblem: 'bison', fg: '#a8774a', fg2: '#f0b323', acc: '#f6e7c8', bg: '#4b2e1a', ring: '#f0b323', line: '#1c1008' },
    helmet: { shell: '#4b2e1a', finish: 'gloss', stripe: 'double', stripeColors: ['#f0b323', '#ffffff'], facemask: '#f0b323', logo: true, number: false },
    uniform: {
      home: {
        jersey: '#f0b323', numbers: '#4b2e1a', numberOutline: '#ffffff', numberFont: 'college',
        sleeve: 'stripes2', sleeveColors: ['#4b2e1a', '#ffffff'], collar: '#4b2e1a', sideColor: null,
        pants: '#f4f4f2', pantStripe: 'double', pantStripeColors: ['#4b2e1a', '#f0b323'],
        socks: '#4b2e1a', sockStripes: ['#f0b323', '#ffffff'], shoes: 'black', gloves: '#4b2e1a', nameOnBack: true,
      },
      away: {
        jersey: '#f4f5f7', numbers: '#4b2e1a', numberOutline: '#f0b323', numberFont: 'college',
        sleeve: 'stripes2', sleeveColors: ['#4b2e1a', '#f0b323'], collar: '#4b2e1a', sideColor: null,
        pants: '#4b2e1a', pantStripe: 'double', pantStripeColors: ['#f0b323', '#ffffff'],
        socks: '#4b2e1a', sockStripes: ['#f0b323'], shoes: 'black', gloves: '#f0b323', nameOnBack: true,
      },
      alt: {
        jersey: '#4b2e1a', numbers: '#f0b323', numberOutline: '#ffffff', numberFont: 'college',
        sleeve: 'stripes2', sleeveColors: ['#f0b323', '#ffffff'], collar: '#f0b323', sideColor: null,
        pants: '#f0b323', pantStripe: 'double', pantStripeColors: ['#4b2e1a', '#ffffff'],
        socks: '#4b2e1a', sockStripes: ['#f0b323', '#ffffff'], shoes: 'black', gloves: '#4b2e1a', nameOnBack: true,
      },
    },
    style: { offense: 'power', defense: 'balanced', tempo: 0.4 },
    strength: 0.69,
    venue: 'foundry',
    venueDress: { seats: '#4b2e1a', banner: '#f0b323', trim: '#ffffff', endzone: 'stripes', endzoneColor: '#4b2e1a', turf: 'grass' },
    wordmark: { style: 'block', fill: '#f0b323', outline: '#24150b', outline2: '#ffffff' },
  },
  {
    id: 'ftw', level: 'pro', city: 'Fort Worth', name: 'Cattlemen', abbr: 'FTW',
    conference: 'NC', division: 'Central', founded: 1968, stadium: 'Trinity River Dome',
    colors: { primary: '#5b3a1f', secondary: '#efe5cf', accent: '#2bb3a6', dark: '#2b1a0c' },
    logo: { emblem: 'longhorn', fg: '#efe5cf', fg2: '#5b3a1f', acc: '#2bb3a6', bg: '#5b3a1f', ring: '#2bb3a6', line: '#24150a' },
    helmet: { shell: '#efe5cf', finish: 'gloss', stripe: 'double', stripeColors: ['#5b3a1f', '#2bb3a6'], facemask: '#5b3a1f', logo: true, number: true },
    uniform: {
      home: {
        jersey: '#5b3a1f', numbers: '#efe5cf', numberOutline: '#2bb3a6', numberFont: 'pro',
        sleeve: 'yoke', sleeveColors: ['#efe5cf'], collar: '#efe5cf', sideColor: null,
        pants: '#efe5cf', pantStripe: 'double', pantStripeColors: ['#5b3a1f', '#2bb3a6'],
        socks: '#5b3a1f', sockStripes: ['#2bb3a6', '#efe5cf'], shoes: 'black', gloves: '#5b3a1f', nameOnBack: true,
      },
      away: {
        jersey: '#f6f1e6', numbers: '#5b3a1f', numberOutline: '#2bb3a6', numberFont: 'pro',
        sleeve: 'yoke', sleeveColors: ['#5b3a1f'], collar: '#5b3a1f', sideColor: null,
        pants: '#5b3a1f', pantStripe: 'double', pantStripeColors: ['#efe5cf', '#2bb3a6'],
        socks: '#5b3a1f', sockStripes: ['#2bb3a6'], shoes: 'black', gloves: '#2bb3a6', nameOnBack: true,
      },
    },
    style: { offense: 'power', defense: 'zone', tempo: 0.4 },
    strength: 0.71,
    venue: 'dome',
    venueDress: { seats: '#5b3a1f', banner: '#2bb3a6', trim: '#efe5cf', endzone: 'solid', endzoneColor: '#5b3a1f', turf: 'turf' },
    wordmark: { style: 'college', fill: '#efe5cf', outline: '#24150a', outline2: '#2bb3a6' },
  },
  // ============================================================ NC WEST
  {
    id: 'pht', level: 'pro', city: 'Port Halcyon', name: 'Tide', abbr: 'PHT',
    conference: 'NC', division: 'West', founded: 1965, stadium: 'Halcyon Bay Stadium',
    colors: { primary: '#0d2a52', secondary: '#1fb5b0', accent: '#c9d2dc', dark: '#06142a' },
    logo: { emblem: 'wave', fg: '#1fb5b0', fg2: '#0d2a52', acc: '#ffffff', bg: '#0d2a52', ring: '#c9d2dc', line: '#06142a' },
    helmet: { shell: '#0d2a52', finish: 'pearl', stripe: 'double', stripeColors: ['#1fb5b0', '#c9d2dc'], facemask: '#c9d2dc', logo: true, number: false },
    uniform: {
      home: {
        jersey: '#0d2a52', numbers: '#ffffff', numberOutline: '#1fb5b0', numberFont: 'pro',
        sleeve: 'stripes2', sleeveColors: ['#1fb5b0', '#ffffff'], collar: '#1fb5b0', sideColor: null,
        pants: '#c9d2dc', pantStripe: 'double', pantStripeColors: ['#0d2a52', '#1fb5b0'],
        socks: '#0d2a52', sockStripes: ['#1fb5b0'], shoes: 'black', gloves: '#0d2a52', nameOnBack: true,
      },
      away: {
        jersey: '#f4f6f8', numbers: '#0d2a52', numberOutline: '#1fb5b0', numberFont: 'pro',
        sleeve: 'stripes2', sleeveColors: ['#0d2a52', '#1fb5b0'], collar: '#0d2a52', sideColor: null,
        pants: '#0d2a52', pantStripe: 'double', pantStripeColors: ['#1fb5b0', '#c9d2dc'],
        socks: '#0d2a52', sockStripes: ['#1fb5b0'], shoes: 'black', gloves: '#1fb5b0', nameOnBack: true,
      },
      alt: {
        jersey: '#1fb5b0', numbers: '#0d2a52', numberOutline: '#ffffff', numberFont: 'pro',
        sleeve: 'stripes2', sleeveColors: ['#0d2a52', '#ffffff'], collar: '#0d2a52', sideColor: null,
        pants: '#0d2a52', pantStripe: 'double', pantStripeColors: ['#1fb5b0', '#c9d2dc'],
        socks: '#0d2a52', sockStripes: ['#1fb5b0', '#ffffff'], shoes: 'black', gloves: '#0d2a52', nameOnBack: true,
      },
    },
    style: { offense: 'spread', defense: 'zone', tempo: 0.6 },
    strength: 0.78,
    venue: 'bayside',
    venueDress: { seats: '#0d2a52', banner: '#1fb5b0', trim: '#c9d2dc', endzone: 'stripes', endzoneColor: '#0d2a52', turf: 'grass' },
    wordmark: { style: 'italic', fill: '#1fb5b0', outline: '#06142a', outline2: '#c9d2dc' },
  },
  {
    id: 'slc', level: 'pro', city: 'Salt Lake', name: 'Summit', abbr: 'SLC',
    conference: 'NC', division: 'West', founded: 1981, stadium: 'Wasatch Bowl',
    colors: { primary: '#bfe3f5', secondary: '#13294b', accent: '#ffffff', dark: '#0a1830' },
    logo: { emblem: 'mountain', fg: '#ffffff', fg2: '#13294b', acc: '#bfe3f5', bg: '#13294b', ring: '#bfe3f5', line: '#0a1830' },
    helmet: { shell: '#ffffff', finish: 'gloss', stripe: 'wings', stripeColors: ['#13294b', '#bfe3f5'], facemask: '#13294b', logo: true, number: true },
    uniform: {
      home: {
        jersey: '#13294b', numbers: '#bfe3f5', numberOutline: '#ffffff', numberFont: 'italic',
        sleeve: 'shoulder', sleeveColors: ['#bfe3f5', '#ffffff'], collar: '#bfe3f5', sideColor: '#bfe3f5',
        pants: '#ffffff', pantStripe: 'double', pantStripeColors: ['#13294b', '#bfe3f5'],
        socks: '#13294b', sockStripes: ['#bfe3f5', '#ffffff'], shoes: 'black', gloves: '#13294b', nameOnBack: true,
      },
      away: {
        jersey: '#ffffff', numbers: '#13294b', numberOutline: '#bfe3f5', numberFont: 'italic',
        sleeve: 'shoulder', sleeveColors: ['#13294b', '#bfe3f5'], collar: '#13294b', sideColor: '#13294b',
        pants: '#13294b', pantStripe: 'double', pantStripeColors: ['#bfe3f5', '#ffffff'],
        socks: '#13294b', sockStripes: ['#bfe3f5'], shoes: 'white', gloves: '#bfe3f5', nameOnBack: true,
      },
      alt: {
        jersey: '#9fd0ee', numbers: '#13294b', numberOutline: '#ffffff', numberFont: 'italic',
        sleeve: 'shoulder', sleeveColors: ['#13294b', '#ffffff'], collar: '#13294b', sideColor: '#13294b',
        pants: '#ffffff', pantStripe: 'double', pantStripeColors: ['#13294b', '#9fd0ee'],
        socks: '#13294b', sockStripes: ['#9fd0ee', '#ffffff'], shoes: 'black', gloves: '#13294b', nameOnBack: true,
      },
    },
    style: { offense: 'option', defense: 'balanced', tempo: 0.5 },
    strength: 0.66,
    venue: 'snowbowl',
    venueDress: { seats: '#13294b', banner: '#bfe3f5', trim: '#ffffff', endzone: 'solid', endzoneColor: '#13294b', turf: 'grass' },
    wordmark: { style: 'italic', fill: '#ffffff', outline: '#0a1830', outline2: '#9fd0ee' },
  },
  {
    id: 'por', level: 'pro', city: 'Portland', name: 'Axemen', abbr: 'POR',
    conference: 'NC', division: 'West', founded: 1977, stadium: 'Willamette Field',
    colors: { primary: '#1c4a30', secondary: '#e8dfc8', accent: '#101410', dark: '#0b1f14' },
    logo: { emblem: 'axe', fg: '#cfd5d8', fg2: '#1c4a30', acc: '#c99b5c', bg: '#1c4a30', ring: '#e8dfc8', line: '#0b130e' },
    helmet: { shell: '#1c4a30', finish: 'matte', stripe: 'skunk', stripeColors: ['#101410', '#e8dfc8'], facemask: '#101410', logo: true, number: false },
    uniform: {
      home: {
        jersey: '#1c4a30', numbers: '#e8dfc8', numberOutline: '#101410', numberFont: 'block',
        sleeve: 'cuff', sleeveColors: ['#101410'], collar: '#101410', sideColor: '#101410',
        pants: '#e8dfc8', pantStripe: 'single', pantStripeColors: ['#1c4a30'],
        socks: '#101410', sockStripes: ['#1c4a30', '#e8dfc8'], shoes: 'black', gloves: '#101410', nameOnBack: true,
      },
      away: {
        jersey: '#f4f2ea', numbers: '#1c4a30', numberOutline: '#101410', numberFont: 'block',
        sleeve: 'cuff', sleeveColors: ['#1c4a30'], collar: '#1c4a30', sideColor: '#1c4a30',
        pants: '#1c4a30', pantStripe: 'single', pantStripeColors: ['#e8dfc8'],
        socks: '#1c4a30', sockStripes: ['#e8dfc8'], shoes: 'black', gloves: '#1c4a30', nameOnBack: true,
      },
    },
    style: { offense: 'power', defense: 'zone', tempo: 0.4 },
    strength: 0.58,
    venue: 'snowbowl',
    venueDress: { seats: '#1c4a30', banner: '#e8dfc8', trim: '#101410', endzone: 'checker', endzoneColor: '#1c4a30', turf: 'grass' },
    wordmark: { style: 'stencil', fill: '#e8dfc8', outline: '#0b130e', outline2: '#1c4a30' },
  },
  {
    id: 'den', level: 'pro', city: 'Denver', name: 'Wolves', abbr: 'DEN',
    conference: 'NC', division: 'West', founded: 1960, stadium: 'Front Range Stadium',
    colors: { primary: '#5a6670', secondary: '#141618', accent: '#f2a51a', dark: '#0c0d0e' },
    logo: { emblem: 'wolf', fg: '#9aa6b0', fg2: '#5a6670', acc: '#f2a51a', bg: '#141618', ring: '#9aa6b0', line: '#0c0d0e' },
    helmet: { shell: '#17191b', finish: 'gloss', stripe: 'double', stripeColors: ['#f2a51a', '#7d8a95'], facemask: '#7d8a95', logo: true, number: false },
    uniform: {
      home: {
        jersey: '#5a6670', numbers: '#ffffff', numberOutline: '#141618', numberFont: 'block',
        sleeve: 'stripes2', sleeveColors: ['#141618', '#f2a51a'], collar: '#141618', sideColor: '#141618',
        pants: '#17191b', pantStripe: 'double', pantStripeColors: ['#f2a51a', '#7d8a95'],
        socks: '#17191b', sockStripes: ['#f2a51a', '#7d8a95'], shoes: 'black', gloves: '#17191b', nameOnBack: true,
      },
      away: {
        jersey: '#f4f5f7', numbers: '#141618', numberOutline: '#f2a51a', numberFont: 'block',
        sleeve: 'stripes2', sleeveColors: ['#5a6670', '#f2a51a'], collar: '#141618', sideColor: '#5a6670',
        pants: '#5a6670', pantStripe: 'double', pantStripeColors: ['#141618', '#f2a51a'],
        socks: '#17191b', sockStripes: ['#5a6670'], shoes: 'black', gloves: '#5a6670', nameOnBack: true,
      },
      alt: {
        jersey: '#17191b', numbers: '#9aa6b0', numberOutline: '#f2a51a', numberFont: 'block',
        sleeve: 'stripes2', sleeveColors: ['#5a6670', '#f2a51a'], collar: '#f2a51a', sideColor: '#5a6670',
        pants: '#17191b', pantStripe: 'double', pantStripeColors: ['#f2a51a', '#7d8a95'],
        socks: '#17191b', sockStripes: ['#f2a51a'], shoes: 'black', gloves: '#17191b', nameOnBack: true,
      },
    },
    style: { offense: 'airraid', defense: 'man', tempo: 0.7 },
    strength: 0.84,
    venue: 'snowbowl',
    venueDress: { seats: '#17191b', banner: '#5a6670', trim: '#f2a51a', endzone: 'solid', endzoneColor: '#17191b', turf: 'grass' },
    wordmark: { style: 'pro', fill: '#9aa6b0', outline: '#0c0d0e', outline2: '#f2a51a' },
  },
];

// The founding four keep the first slots (older code, saves and demos index
// TEAMS[0] / TEAMS[1]); the rest follow in division order.
const FOUNDERS = ['pht', 'det', 'hou', 'slc'];
TEAMS.sort((a, b) => {
  const ia = FOUNDERS.indexOf(a.id), ib = FOUNDERS.indexOf(b.id);
  return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
});

/** Teams of one division, in table order. */
export function divisionTeams(conference, division) {
  return TEAMS.filter((t) => t.conference === conference && t.division === division);
}

// ------------------------------------------------------------------ COLLEGES

// Compact specs → full team objects. c = [primary, secondary, accent, dark].
// look: helmet { shell, finish, stripe, stripeColors, facemask, number },
//       font, sleeve [+colors], pants home/away, pant stripe, socks hoops,
//       side panels, 'whiteHome' (wears white at home, the old Southern way).
const W = '#f4f5f7';

function collegeKits(c, L) {
  const [p, s] = c;
  const home = {
    jersey: L.homeJersey || p, numbers: L.homeNumbers || (L.numbersSecondary ? s : '#ffffff'), numberOutline: L.homeOutline ?? (L.outline ? s : null),
    numberFont: L.font || 'block',
    sleeve: L.sleeve || 'none', sleeveColors: L.sleeveHome || [s, '#ffffff'].slice(0, L.sleeve === 'cuff' || L.sleeve === 'yoke' ? 1 : 2),
    collar: L.collarHome || s, sideColor: L.side ? (L.sideHome || s) : null,
    pants: L.pantsHome || W, pantStripe: L.pantStripe || 'single', pantStripeColors: L.pantStripeHome || [p, s].slice(0, L.pantStripe === 'double' ? 2 : 1),
    socks: L.socksHome || p, sockStripes: L.hoopsHome || [s], shoes: L.shoes || 'black', gloves: L.glovesHome || p, nameOnBack: !L.noNames,
  };
  const away = {
    jersey: W, numbers: L.awayNumbers || p, numberOutline: L.awayOutline ?? (L.outline ? s : null), numberFont: L.font || 'block',
    sleeve: L.sleeve || 'none', sleeveColors: L.sleeveAway || [p, s].slice(0, L.sleeve === 'cuff' || L.sleeve === 'yoke' ? 1 : 2),
    collar: p, sideColor: L.side ? p : null,
    pants: L.pantsAway || L.pantsHome || W, pantStripe: L.pantStripe || 'single', pantStripeColors: L.pantStripeAway || L.pantStripeHome || [p, s].slice(0, L.pantStripe === 'double' ? 2 : 1),
    socks: L.socksAway || p, sockStripes: L.hoopsAway || [s], shoes: L.shoes || 'black', gloves: L.glovesAway || s, nameOnBack: !L.noNames,
  };
  if (L.whiteHome) return { home: away, away: home };
  return { home, away };
}

function college(id, city, name, abbr, school, location, conference, strength, c, logo, look, style) {
  const [p, s, a, d] = c;
  const t = {
    id, level: 'college', city, name, abbr, school, location, conference,
    colors: { primary: p, secondary: s, accent: a, dark: d },
    logo: { fg: s, fg2: p, acc: a, bg: p, ring: s, line: d, ...logo },
    helmet: { finish: 'gloss', stripe: 'single', stripeColors: [s], facemask: d, logo: true, number: false, ...look.helmet },
    uniform: collegeKits(c, look),
    style,
    strength,
    venue: 'college',
    stadium: look.stadium,
    venueDress: { seats: p, banner: s, trim: a, endzone: look.endzone || 'stripes', endzoneColor: p, turf: look.turf || 'grass' },
    wordmark: { style: look.wordmark || 'arch', fill: look.wmFill || s, outline: d, outline2: look.wmOutline2 || (s.toLowerCase() === '#ffffff' ? p : '#ffffff') },
  };
  return t;
}

export const COLLEGE_CONFERENCES = ['Keystone', 'Magnolia', 'Frontier', 'Sunset'];

export const COLLEGES = [
  // ------------------------------------------------ Keystone (Northeast / Great Lakes)
  college('alst', 'Alleghany State', 'Ironmen', 'ALST', 'Alleghany State University', 'Ridgeview, PA', 'Keystone', 0.86,
    ['#13284c', '#ffffff', '#8d99a6', '#081530'],
    { emblem: 'anvil', fg: '#8d99a6', fg2: '#13284c', acc: '#ffffff', letter: 'A', letterFont: 'college' },
    { helmet: { shell: '#e9ecef', stripe: 'single', stripeColors: ['#13284c'], facemask: '#13284c' }, font: 'block', sleeve: 'none', pantsHome: W, pantStripe: 'none', hoopsHome: [], hoopsAway: [], glovesAway: '#13284c', noNames: true, stadium: 'Beaver Run Stadium', wordmark: 'block', wmFill: '#ffffff', wmOutline2: '#8d99a6' },
    { offense: 'power', defense: 'zone', tempo: 0.35 }),
  college('sbu', "St. Brendan's", 'Navigators', 'SBU', "St. Brendan's University", 'South Bend Falls, IN', 'Keystone', 0.82,
    ['#00703c', '#c99700', '#ffffff', '#003a1f'],
    { emblem: 'monogram', letter: 'SB', fg: '#c99700', fg2: '#00703c', acc: '#ffffff', letterFont: 'college' },
    { helmet: { shell: '#c9a227', finish: 'pearl', stripe: 'none', stripeColors: [], facemask: '#003a1f', logo: false }, font: 'block', numbersSecondary: true, homeOutline: '#ffffff', sleeve: 'none', pantsHome: '#c9a227', pantsAway: '#c9a227', pantStripe: 'none', hoopsHome: [], socksHome: '#00703c', stadium: 'Brendan Field', wordmark: 'college', wmFill: '#c99700' },
    { offense: 'balanced', defense: 'zone', tempo: 0.45 }),
  college('ohv', 'Ohio Valley', 'Owls', 'OVU', 'Ohio Valley University', 'Marietta Landing, OH', 'Keystone', 0.64,
    ['#141414', '#f26722', '#ffffff', '#0a0a0a'],
    { emblem: 'owl', fg: '#ffffff', fg2: '#f26722', acc: '#ffc72c' },
    { helmet: { shell: '#141414', stripe: 'double', stripeColors: ['#f26722', '#ffffff'], facemask: '#f26722' }, font: 'pro', outline: true, homeNumbers: '#f26722', homeOutline: '#ffffff', sleeve: 'stripes3', sleeveHome: ['#f26722', '#ffffff', '#f26722'], sleeveAway: ['#141414', '#f26722', '#141414'], pantsHome: W, pantStripe: 'double', stadium: 'Riverbend Stadium', wordmark: 'italic', wmFill: '#f26722' },
    { offense: 'spread', defense: 'zone', tempo: 0.65 }),
  college('glt', 'Great Lakes Tech', 'Beacons', 'GLT', 'Great Lakes Technological University', 'Port Huron Shores, MI', 'Keystone', 0.54,
    ['#0047ab', '#ffd100', '#ffffff', '#00244f'],
    { emblem: 'lighthouse', fg: '#ffffff', fg2: '#0047ab', acc: '#ffd100' },
    { helmet: { shell: '#0047ab', stripe: 'wings', stripeColors: ['#ffd100', '#ffffff'], facemask: '#ffd100' }, font: 'college', numbersSecondary: true, sleeve: 'stripes2', sleeveHome: ['#ffd100', '#ffffff'], pantsHome: '#ffd100', pantsAway: '#0047ab', pantStripeHome: ['#0047ab'], pantStripeAway: ['#ffd100'], stadium: 'Harbor Light Field', wordmark: 'college', wmFill: '#ffd100' },
    { offense: 'airraid', defense: 'man', tempo: 0.75 }),
  college('nwst', 'Northwoods State', 'Timberjacks', 'NWS', 'Northwoods State University', 'Iron Falls, WI', 'Keystone', 0.58,
    ['#7a0019', '#ffcc33', '#ffffff', '#3d000c'],
    { emblem: 'pine', fg: '#2f6b3a', fg2: '#7a0019', acc: '#ffcc33', letter: 'N', letterFont: 'block' },
    { helmet: { shell: '#7a0019', stripe: 'double', stripeColors: ['#ffcc33', '#ffffff'], facemask: '#ffcc33' }, font: 'block', numbersSecondary: true, homeOutline: '#ffffff', sleeve: 'stripes3', sleeveHome: ['#ffcc33', '#ffffff', '#ffcc33'], sleeveAway: ['#7a0019', '#ffcc33', '#7a0019'], pantsHome: '#ffcc33', pantsAway: '#ffcc33', pantStripeHome: ['#7a0019'], stadium: 'Northwoods Bowl', wordmark: 'block', wmFill: '#ffcc33' },
    { offense: 'power', defense: 'balanced', tempo: 0.4 }),
  college('chesu', 'Chesapeake', 'Admirals', 'CHES', 'Chesapeake University', 'Severn Point, MD', 'Keystone', 0.6,
    ['#13274f', '#c5a14a', '#ffffff', '#081530'],
    { emblem: 'wheel', fg: '#c5a14a', fg2: '#13274f', acc: '#ffffff' },
    { helmet: { shell: '#13274f', finish: 'gloss', stripe: 'single', stripeColors: ['#c5a14a'], facemask: '#c5a14a' }, font: 'college', outline: true, homeNumbers: '#ffffff', homeOutline: '#c5a14a', sleeve: 'stripes2', sleeveHome: ['#c5a14a', '#ffffff'], pantsHome: '#c5a14a', pantsAway: '#c5a14a', pantStripeHome: ['#13274f'], stadium: 'Bay Memorial Stadium', wordmark: 'college', wmFill: '#c5a14a' },
    { offense: 'option', defense: 'zone', tempo: 0.3 }),
  // ------------------------------------------------ Magnolia (South / Southeast)
  college('gcu', 'Gulf Coast', 'Hurricanes', 'GCU', 'Gulf Coast University', 'Port St. Clair, FL', 'Magnolia', 0.84,
    ['#00694b', '#f47a20', '#ffffff', '#00301f'],
    { emblem: 'hurricane', fg: '#f47a20', fg2: '#00694b', acc: '#ffffff' },
    { helmet: { shell: '#ffffff', stripe: 'double', stripeColors: ['#f47a20', '#00694b'], facemask: '#00694b' }, font: 'pro', homeNumbers: '#ffffff', homeOutline: '#f47a20', awayOutline: '#f47a20', sleeve: 'shoulder', sleeveHome: ['#f47a20', '#ffffff'], sleeveAway: ['#00694b', '#f47a20'], pantsHome: W, pantStripe: 'double', hoopsHome: ['#f47a20', '#ffffff'], side: true, sideHome: '#f47a20', stadium: 'Orange Grove Stadium', wordmark: 'speed', wmFill: '#f47a20' },
    { offense: 'spread', defense: 'man', tempo: 0.8 }),
  college('magst', 'Magnolia State', 'Monarchs', 'MAG', 'Magnolia State University', 'Natchez Bluff, MS', 'Magnolia', 0.81,
    ['#4a2582', '#f5c518', '#ffffff', '#240f45'],
    { emblem: 'crown', fg: '#f5c518', fg2: '#4a2582', acc: '#ffffff' },
    { helmet: { shell: '#f5c518', stripe: 'triple', stripeColors: ['#4a2582', '#ffffff', '#4a2582'], facemask: '#4a2582' }, font: 'block', numbersSecondary: true, homeOutline: '#ffffff', awayOutline: '#f5c518', sleeve: 'stripes2', sleeveHome: ['#f5c518', '#ffffff'], sleeveAway: ['#4a2582', '#f5c518'], pantsHome: '#f5c518', pantStripeHome: ['#4a2582'], whiteHome: true, stadium: 'Bayou Royale', wordmark: 'arch', wmFill: '#f5c518' },
    { offense: 'power', defense: 'blitz', tempo: 0.5 }),
  college('cumb', 'Cumberland State', 'Bulldogs', 'CSU', 'Cumberland State University', 'Rocky Top Gap, TN', 'Magnolia', 0.72,
    ['#f47b20', '#ffffff', '#58595b', '#3d1d05'],
    { emblem: 'bulldog', fg: '#a9a9a9', fg2: '#f47b20', acc: '#ffffff', line: '#1e1e1e' },
    { helmet: { shell: '#ffffff', stripe: 'single', stripeColors: ['#f47b20'], facemask: '#f47b20' }, font: 'college', sleeve: 'cuff', sleeveHome: ['#ffffff'], sleeveAway: ['#f47b20'], pantsHome: W, pantStripe: 'single', pantStripeHome: ['#f47b20'], hoopsHome: ['#ffffff'], stadium: 'Smoky Mountain Stadium', wordmark: 'college', wmFill: '#f47b20', wmOutline2: '#ffffff' },
    { offense: 'balanced', defense: 'blitz', tempo: 0.55 }),
  college('ozst', 'Ozark State', 'Hillcats', 'OZK', 'Ozark State University', 'Boston Mountain, AR', 'Magnolia', 0.66,
    ['#9d2235', '#ffffff', '#141414', '#4a0f19'],
    { emblem: 'paw', fg: '#ffffff', fg2: '#9d2235', acc: '#ffffff', line: '#141414' },
    { helmet: { shell: '#9d2235', stripe: 'double', stripeColors: ['#ffffff', '#141414'], facemask: '#ffffff' }, font: 'pro', outline: true, homeOutline: '#141414', awayOutline: '#141414', sleeve: 'stripes2', sleeveHome: ['#ffffff', '#141414'], sleeveAway: ['#9d2235', '#141414'], pantsHome: W, pantStripe: 'double', pantStripeHome: ['#9d2235', '#141414'], stadium: 'Razorback Ridge Field', wordmark: 'italic', wmFill: '#ffffff' },
    { offense: 'option', defense: 'balanced', tempo: 0.55 }),
  college('pdmt', 'Piedmont State', 'Knights', 'PSU', 'Piedmont State University', 'Chapel Crossing, NC', 'Magnolia', 0.65,
    ['#7bafd4', '#0a2240', '#ffffff', '#061528'],
    { emblem: 'knight', fg: '#c7d0d8', fg2: '#7bafd4', acc: '#0a2240' },
    { helmet: { shell: '#7bafd4', stripe: 'double', stripeColors: ['#0a2240', '#ffffff'], facemask: '#0a2240' }, font: 'college', homeNumbers: '#0a2240', homeOutline: '#ffffff', awayNumbers: '#0a2240', awayOutline: '#7bafd4', sleeve: 'stripes3', sleeveHome: ['#0a2240', '#ffffff', '#0a2240'], sleeveAway: ['#7bafd4', '#0a2240', '#7bafd4'], collarHome: '#0a2240', pantsHome: W, pantStripe: 'double', pantStripeHome: ['#0a2240', '#7bafd4'], socksHome: '#0a2240', hoopsHome: ['#7bafd4'], glovesHome: '#0a2240', stadium: 'Kenan Pines Stadium', wordmark: 'arch', wmFill: '#7bafd4' },
    { offense: 'airraid', defense: 'zone', tempo: 0.7 }),
  college('bgam', 'Bluegrass A&M', 'Thoroughbreds', 'BAM', 'Bluegrass Agricultural & Mechanical', 'Paris Pike, KY', 'Magnolia', 0.68,
    ['#0033a0', '#ffffff', '#c8c8c8', '#001a52'],
    { emblem: 'horseshoe', fg: '#c8c8c8', fg2: '#0033a0', acc: '#ffffff', letter: 'B', letterFont: 'college' },
    { helmet: { shell: '#0033a0', stripe: 'single', stripeColors: ['#ffffff'], facemask: '#ffffff' }, font: 'block', sleeve: 'stripes2', sleeveHome: ['#ffffff', '#ffffff'], sleeveAway: ['#0033a0', '#0033a0'], pantsHome: W, pantStripe: 'single', pantStripeHome: ['#0033a0'], hoopsHome: ['#ffffff'], stadium: 'Commonwealth Field', wordmark: 'college', wmFill: '#ffffff', wmOutline2: '#0033a0' },
    { offense: 'balanced', defense: 'man', tempo: 0.5 }),
  // ------------------------------------------------ Frontier (Plains / Texas)
  college('gpu', 'Great Plains', 'Bison', 'GPU', 'University of the Great Plains', 'Platte City, NE', 'Frontier', 0.85,
    ['#c8102e', '#f5f1e7', '#141414', '#5c0714'],
    { emblem: 'bison', fg: '#6a4428', fg2: '#f5f1e7', acc: '#f5f1e7', line: '#5c0714' },
    { helmet: { shell: '#f4f4f2', stripe: 'single', stripeColors: ['#c8102e'], facemask: '#c8102e' }, font: 'block', homeNumbers: '#ffffff', sleeve: 'stripes2', sleeveHome: ['#ffffff', '#141414'], sleeveAway: ['#c8102e', '#141414'], pantsHome: W, pantStripe: 'single', pantStripeHome: ['#c8102e'], hoopsHome: ['#ffffff'], stadium: 'Sod House Stadium', wordmark: 'block', wmFill: '#c8102e', wmOutline2: '#f5f1e7' },
    { offense: 'option', defense: 'blitz', tempo: 0.35 }),
  college('lsam', 'Lone Star A&M', 'Aggies', 'LSAM', 'Lone Star Agricultural & Mechanical', 'Brazos Station, TX', 'Frontier', 0.79,
    ['#500000', '#ffffff', '#8c8c8c', '#260000'],
    { emblem: 'star', fg: '#ffffff', fg2: '#500000', acc: '#8c8c8c', letter: 'A', letterFont: 'college' },
    { helmet: { shell: '#ffffff', stripe: 'double', stripeColors: ['#500000', '#500000'], facemask: '#500000' }, font: 'college', sleeve: 'stripes2', sleeveHome: ['#ffffff', '#ffffff'], sleeveAway: ['#500000', '#500000'], pantsHome: W, pantStripe: 'double', pantStripeHome: ['#500000', '#500000'], hoopsHome: ['#ffffff'], stadium: 'Kyle Station Field', wordmark: 'college', wmFill: '#ffffff', wmOutline2: '#500000' },
    { offense: 'power', defense: 'zone', tempo: 0.4 }),
  college('fhst', 'Flint Hills State', 'Cyclones', 'FHS', 'Flint Hills State University', 'Council Grove, KS', 'Frontier', 0.74,
    ['#512888', '#c0c0c0', '#ffffff', '#260f45'],
    { emblem: 'tornado', fg: '#d5d5dc', fg2: '#512888', acc: '#ffffff' },
    { helmet: { shell: '#ffffff', stripe: 'triple', stripeColors: ['#512888', '#c0c0c0', '#512888'], facemask: '#512888' }, font: 'pro', homeNumbers: '#ffffff', homeOutline: '#c0c0c0', awayOutline: '#c0c0c0', sleeve: 'shoulder', sleeveHome: ['#c0c0c0', '#ffffff'], sleeveAway: ['#512888', '#c0c0c0'], pantsHome: '#c0c0c0', pantsAway: '#512888', pantStripeHome: ['#512888'], pantStripeAway: ['#c0c0c0'], stadium: 'Prairie Fire Stadium', wordmark: 'italic', wmFill: '#d5d5dc' },
    { offense: 'option', defense: 'balanced', tempo: 0.6 }),
  college('twru', 'Twin Rivers', 'Rams', 'TRU', 'Twin Rivers University', 'Hermann Ferry, MO', 'Frontier', 0.7,
    ['#141414', '#b3995d', '#ffffff', '#0a0a0a'],
    { emblem: 'ram', fg: '#b3995d', fg2: '#e8e1d0', acc: '#ffffff' },
    { helmet: { shell: '#141414', stripe: 'triple', stripeColors: ['#b3995d', '#ffffff', '#b3995d'], facemask: '#b3995d' }, font: 'pro', numbersSecondary: true, homeOutline: '#ffffff', awayOutline: '#b3995d', awayNumbers: '#141414', sleeve: 'stripes2', sleeveHome: ['#b3995d', '#ffffff'], pantsHome: '#b3995d', pantsAway: '#b3995d', pantStripeHome: ['#141414'], stadium: 'Confluence Field', wordmark: 'pro', wmFill: '#b3995d' },
    { offense: 'balanced', defense: 'blitz', tempo: 0.55 }),
  college('sabst', 'Sabine State', 'Pirates', 'SAB', 'Sabine State University', 'Orange Bayou, TX', 'Frontier', 0.67,
    ['#141414', '#cc1f2f', '#ffffff', '#0a0a0a'],
    { emblem: 'swords', fg: '#d9dde1', fg2: '#cc1f2f', acc: '#e0b13a' },
    { helmet: { shell: '#cc1f2f', stripe: 'double', stripeColors: ['#141414', '#ffffff'], facemask: '#141414' }, font: 'italic', homeNumbers: '#cc1f2f', homeOutline: '#ffffff', awayOutline: '#141414', awayNumbers: '#cc1f2f', sleeve: 'shoulder', sleeveHome: ['#cc1f2f', '#ffffff'], sleeveAway: ['#141414', '#cc1f2f'], pantsHome: '#cc1f2f', pantsAway: '#141414', pantStripeHome: ['#141414'], pantStripeAway: ['#cc1f2f'], socksHome: '#141414', hoopsHome: ['#cc1f2f'], stadium: 'Lafitte Field', wordmark: 'speed', wmFill: '#cc1f2f' },
    { offense: 'airraid', defense: 'blitz', tempo: 0.85 }),
  college('pham', 'Panhandle A&M', 'Steers', 'PAM', 'Panhandle Agricultural & Mechanical', 'Canyon Draw, TX', 'Frontier', 0.52,
    ['#00853e', '#ffffff', '#141414', '#003d1c'],
    { emblem: 'longhorn', fg: '#ffffff', fg2: '#6b4423', acc: '#00853e', line: '#003d1c' },
    { helmet: { shell: '#00853e', stripe: 'single', stripeColors: ['#ffffff'], facemask: '#ffffff' }, font: 'block', sleeve: 'stripes3', sleeveHome: ['#ffffff', '#141414', '#ffffff'], sleeveAway: ['#00853e', '#141414', '#00853e'], pantsHome: W, pantStripe: 'single', pantStripeHome: ['#00853e'], stadium: 'Caprock Stadium', wordmark: 'block', wmFill: '#ffffff', wmOutline2: '#00853e' },
    { offense: 'spread', defense: 'balanced', tempo: 0.6 }),
  // ------------------------------------------------ Sunset (West)
  college('pacu', 'Pacifica', 'Titans', 'PAC', 'Pacifica University', 'San Marino Hills, CA', 'Sunset', 0.88,
    ['#8c1d1d', '#f4b41a', '#ffffff', '#3d0a0a'],
    { emblem: 'spartan', fg: '#f4b41a', fg2: '#8c1d1d', acc: '#ffffff' },
    { helmet: { shell: '#8c1d1d', stripe: 'single', stripeColors: ['#f4b41a'], facemask: '#9aa0a6' }, font: 'block', numbersSecondary: true, sleeve: 'none', pantsHome: '#f4b41a', pantsAway: '#f4b41a', pantStripeHome: ['#8c1d1d'], hoopsHome: [], hoopsAway: [], socksHome: '#8c1d1d', stadium: 'The Coliseum at Arroyo Seco', wordmark: 'college', wmFill: '#f4b41a' },
    { offense: 'balanced', defense: 'man', tempo: 0.6 }),
  college('casc', 'Cascade State', 'Grizzlies', 'CAS', 'Cascade State University', 'McKenzie Bridge, OR', 'Sunset', 0.76,
    ['#0f5132', '#fee123', '#141414', '#062716'],
    { emblem: 'bear', fg: '#5b3a24', fg2: '#fee123', acc: '#ffffff', line: '#141414' },
    { helmet: { shell: '#0f5132', finish: 'chrome', stripe: 'wings', stripeColors: ['#fee123', '#141414'], facemask: '#141414' }, font: 'italic', homeNumbers: '#fee123', homeOutline: '#141414', awayNumbers: '#0f5132', awayOutline: '#fee123', sleeve: 'bolt', sleeveHome: ['#fee123', '#141414'], sleeveAway: ['#0f5132', '#fee123'], side: true, sideHome: '#141414', pantsHome: '#fee123', pantsAway: '#0f5132', pantStripe: 'bolt', pantStripeHome: ['#0f5132', '#141414'], pantStripeAway: ['#fee123', '#141414'], socksHome: '#0f5132', hoopsHome: ['#fee123'], glovesHome: '#fee123', stadium: 'Old Growth Stadium', wordmark: 'speed', wmFill: '#fee123' },
    { offense: 'spread', defense: 'blitz', tempo: 0.9 }),
  college('sonst', 'Sonoran State', 'Sidewinders', 'SON', 'Sonoran State University', 'Saguaro Wells, AZ', 'Sunset', 0.62,
    ['#d4572a', '#141414', '#e8d3a5', '#5a1e08'],
    { emblem: 'rattlesnake', fg: '#e8d3a5', fg2: '#d4572a', acc: '#141414', line: '#141414' },
    { helmet: { shell: '#141414', stripe: 'double', stripeColors: ['#d4572a', '#e8d3a5'], facemask: '#d4572a' }, font: 'italic', homeNumbers: '#ffffff', homeOutline: '#141414', awayNumbers: '#d4572a', awayOutline: '#141414', sleeve: 'stripes3', sleeveHome: ['#141414', '#e8d3a5', '#141414'], sleeveAway: ['#d4572a', '#141414', '#d4572a'], pantsHome: '#e8d3a5', pantsAway: '#141414', pantStripe: 'double', pantStripeHome: ['#d4572a', '#141414'], pantStripeAway: ['#d4572a', '#e8d3a5'], socksHome: '#141414', hoopsHome: ['#d4572a'], glovesHome: '#141414', stadium: 'Sun Bowl at Saguaro Wells', wordmark: 'italic', wmFill: '#d4572a', wmOutline2: '#e8d3a5' },
    { offense: 'airraid', defense: 'man', tempo: 0.8 }),
  college('rgst', 'Rio Grande State', 'Coyotes', 'RGS', 'Rio Grande State University', 'Socorro Flats, NM', 'Sunset', 0.63,
    ['#1a9e9a', '#141414', '#d8c39a', '#073c3a'],
    { emblem: 'wolf', fg: '#d8c39a', fg2: '#9a7b52', acc: '#1a9e9a', line: '#141414' },
    { helmet: { shell: '#1a9e9a', finish: 'pearl', stripe: 'double', stripeColors: ['#d8c39a', '#141414'], facemask: '#141414' }, font: 'pro', homeNumbers: '#ffffff', homeOutline: '#141414', awayNumbers: '#1a9e9a', awayOutline: '#141414', sleeve: 'yoke', sleeveHome: ['#141414'], sleeveAway: ['#1a9e9a'], pantsHome: '#d8c39a', pantsAway: '#d8c39a', pantStripeHome: ['#141414'], socksHome: '#141414', hoopsHome: ['#1a9e9a'], stadium: 'Mesa del Sol Field', wordmark: 'pro', wmFill: '#1a9e9a', wmOutline2: '#d8c39a' },
    { offense: 'option', defense: 'zone', tempo: 0.6 }),
  college('bsky', 'Big Sky', 'Broncs', 'BSU', 'Big Sky University', 'Absaroka, WY', 'Sunset', 0.6,
    ['#492f24', '#ffc425', '#ffffff', '#24160f'],
    { emblem: 'horse', fg: '#ffc425', fg2: '#492f24', acc: '#ffffff' },
    { helmet: { shell: '#ffc425', stripe: 'single', stripeColors: ['#492f24'], facemask: '#492f24' }, font: 'college', numbersSecondary: true, homeOutline: '#ffffff', sleeve: 'stripes2', sleeveHome: ['#ffc425', '#ffffff'], pantsHome: '#ffc425', pantsAway: '#492f24', pantStripeHome: ['#492f24'], pantStripeAway: ['#ffc425'], stadium: 'War Memorial Field', wordmark: 'college', wmFill: '#ffc425' },
    { offense: 'power', defense: 'zone', tempo: 0.4 }),
  college('ctech', 'Copper Range Tech', 'Miners', 'CRT', 'Copper Range Institute of Technology', 'Copper Ridge, MT', 'Sunset', 0.56,
    ['#b87333', '#1b2a45', '#ffffff', '#3d230d'],
    { emblem: 'pickaxe', fg: '#c9cfd4', fg2: '#1b2a45', acc: '#e9b949', letter: 'M', letterFont: 'block' },
    { helmet: { shell: '#b87333', finish: 'pearl', stripe: 'double', stripeColors: ['#1b2a45', '#ffffff'], facemask: '#1b2a45' }, font: 'stencil', homeNumbers: '#ffffff', homeOutline: '#1b2a45', awayNumbers: '#b87333', awayOutline: '#1b2a45', sleeve: 'stripes2', sleeveHome: ['#1b2a45', '#ffffff'], sleeveAway: ['#b87333', '#1b2a45'], pantsHome: '#1b2a45', pantsAway: '#1b2a45', pantStripeHome: ['#b87333'], socksHome: '#1b2a45', hoopsHome: ['#b87333'], stadium: 'Headframe Stadium', wordmark: 'stencil', wmFill: '#b87333', wmOutline2: '#ffffff' },
    { offense: 'power', defense: 'balanced', tempo: 0.45 }),
];

// ------------------------------------------------------------------ HIGH SCHOOLS

// Classic high-school colour pairs: [primary, secondary, accent, dark].
export const HS_PALETTES = [
  ['#14306e', '#f2b705', '#ffffff', '#0a1a3d'],   // navy & gold
  ['#8f1d2c', '#ffffff', '#141414', '#4a0e16'],   // cardinal & white
  ['#1d4d2b', '#d9b310', '#ffffff', '#0e2615'],   // forest & vegas gold
  ['#1f4fd8', '#ffffff', '#c7ccd4', '#0f2a75'],   // royal & white
  ['#17181c', '#7db9e8', '#ffffff', '#0a0a0c'],   // black & columbia
  ['#46245e', '#e8b923', '#ffffff', '#231030'],   // purple & gold
  ['#d35f12', '#1c1c1e', '#ffffff', '#5e2a08'],   // orange & black
  ['#5e1f2e', '#9aa0a6', '#ffffff', '#2e0f17'],   // maroon & gray
  ['#1e7a3c', '#ffffff', '#f2b705', '#0d3d1d'],   // kelly & white
  ['#c0273a', '#1b2a52', '#ffffff', '#5e131c'],   // red & navy
  ['#141414', '#f2b705', '#ffffff', '#080808'],   // black & gold
  ['#1f4fd8', '#f2b705', '#ffffff', '#0f2a75'],   // royal & gold
  ['#c8102e', '#141414', '#ffffff', '#5c0714'],   // red & black
  ['#0a2a5c', '#c8102e', '#ffffff', '#051530'],   // navy & red
  ['#5c2d91', '#ffffff', '#141414', '#2d1648'],   // purple & white
  ['#6e1a2c', '#e0b13a', '#ffffff', '#370d16'],   // maroon & gold
  ['#0a2240', '#f47b20', '#ffffff', '#051120'],   // navy & orange
  ['#7bafd4', '#0a2240', '#ffffff', '#061528'],   // columbia & navy
  ['#4b3621', '#e3a72f', '#ffffff', '#251b10'],   // brown & gold
  ['#bb0000', '#9da3a8', '#ffffff', '#5c0000'],   // scarlet & gray
  ['#007b84', '#141414', '#ffffff', '#003d42'],   // teal & black
  ['#141414', '#b5bdc4', '#c8102e', '#080808'],   // black & silver
  ['#9e1b32', '#f1e6cf', '#141414', '#4d0d18'],   // crimson & cream
  ['#2e7d32', '#141414', '#ffffff', '#163d18'],   // green & black
];

const HS_FONTS = ['block', 'block', 'college', 'pro', 'italic'];
const HS_SLEEVES = ['stripes2', 'stripes2', 'stripes3', 'cuff', 'none', 'shoulder', 'stripes2'];
const HS_PANTS = ['single', 'double', 'double', 'triple', 'single', 'none'];
const HS_HELMET_STRIPES = ['single', 'single', 'double', 'triple', 'none', 'skunk'];
const HS_OFFENSE = ['spread', 'option', 'power', 'balanced', 'power', 'option'];
const HS_DEFENSE = ['blitz', 'zone', 'man', 'balanced'];
const HS_VENUE_NAMES = ['Memorial Stadium', 'Field', 'Stadium', 'Bowl', 'Veterans Field', 'Booster Field'];
// emblems whose biggest area is drawn in fg2 (logos.js), and those whose block letter is fg2
const MAIN_IS_FG2 = new Set(['ram', 'owl', 'longhorn', 'flame']);
const LETTER_IN_FG2 = new Set(['anvil', 'pickaxe', 'swords', 'horseshoe', 'star']);

// 'North Cedar Falls High' → 'North Cedar Falls'; 'Copperville Regional' → 'Copperville'
function hsShortName(school) {
  return school.replace(/ (Senior High|High|Regional|Consolidated)$/, '');
}
// the name without its compass point / saint / bishop: what the letter and abbreviation use
function hsCore(name) {
  return name.replace(/^(North|South|East|West|St\.|Bishop)\s+/, '');
}
function hsAbbr(name) {
  const words = hsCore(name).replace(/[^A-Za-z ]/g, '').split(/\s+/).filter(Boolean);
  if (words.length > 1) return (words[0][0] + words[1].slice(0, 2)).toUpperCase();
  return (words[0] || 'HSX').slice(0, 3).toUpperCase();
}

/**
 * Build a high school. Deterministic from `seed`; `o` overrides any part
 * (town, school, mascot {name, emblem}, palette [p, s, a, d], strength, id,
 * logoMode 'letter'|'mascot'|'both', letter).
 */
export function makeHighSchool(seed, o = {}) {
  const rng = makeRng(hashString('hs:' + seed));
  const town = o.town || townName(rng);
  const school = o.school || schoolName(rng, town);
  const mascot = o.mascot || rng.pick(MASCOTS);
  const [p, s, a, d] = o.palette || rng.pick(HS_PALETTES);
  const lightPrimary = colorDistance(p, '#ffffff') < 40;
  const font = o.font || rng.pick(HS_FONTS);
  const sleeve = o.sleeve || rng.pick(HS_SLEEVES);
  const pantStripe = o.pantStripe || rng.pick(HS_PANTS);
  const helmetStripe = o.helmetStripe || rng.pick(HS_HELMET_STRIPES);
  const nStripe = { none: 0, single: 1, double: 2, triple: 3, bolt: 2, skunk: 2 };
  const stripeCols = (n, c1, c2) => [c1, c2, c1].slice(0, n);
  const pantsHome = o.pantsHome || rng.pick([W, W, s, p === '#141414' ? W : s]);
  const pantsAway = o.pantsAway || rng.pick([pantsHome, p, W]);
  const shell = o.shell || rng.pick([p, p, p, W, s]);
  const shellColor = shell === W ? '#f2f2f0' : shell;
  const hsOutline = rng() < 0.55;
  const numberHome = lightPrimary ? d : (rng() < 0.7 ? '#ffffff' : s);
  const homeKit = {
    jersey: p, numbers: numberHome, numberOutline: hsOutline ? (numberHome === s ? '#ffffff' : s === numberHome ? d : s) : null, numberFont: font,
    sleeve, sleeveColors: stripeCols(sleeve === 'stripes3' ? 3 : sleeve === 'cuff' ? 1 : 2, s, '#ffffff'),
    collar: s, sideColor: rng() < 0.15 ? s : null,
    pants: pantsHome, pantStripe, pantStripeColors: stripeCols(nStripe[pantStripe] || 0, pantsHome === p ? s : p, pantsHome === s ? p : s),
    socks: rng() < 0.75 ? p : s, sockStripes: rng() < 0.6 ? [s, '#ffffff'].slice(0, rng.int(1, 2)) : [],
    shoes: rng() < 0.75 ? 'black' : 'white', gloves: rng() < 0.6 ? p : s, nameOnBack: rng() < 0.35,
  };
  const awayKit = {
    jersey: W, numbers: lightPrimary ? d : p, numberOutline: hsOutline && colorDistance(s, W) > 25 ? s : null, numberFont: font,
    sleeve, sleeveColors: stripeCols(sleeve === 'stripes3' ? 3 : sleeve === 'cuff' ? 1 : 2, p, s),
    collar: p, sideColor: homeKit.sideColor ? p : null,
    pants: pantsAway, pantStripe, pantStripeColors: stripeCols(nStripe[pantStripe] || 0, pantsAway === p ? s : p, pantsAway === s ? p : s),
    socks: homeKit.socks, sockStripes: homeKit.sockStripes.length ? [s] : [],
    shoes: homeKit.shoes, gloves: homeKit.gloves === p ? s : p, nameOnBack: homeKit.nameOnBack,
  };
  // the logo: most schools wear a block letter, some the mascot, some both
  const short = hsShortName(school);
  const letter = o.letter || (hsCore(short)[0] || 'H').toUpperCase();
  const r = rng();
  const mode = o.logoMode || (r < 0.42 ? 'letter' : r < 0.78 ? 'mascot' : 'both');
  const emblem = mode === 'letter' || !mascot.emblem || mascot.emblem === 'letter' ? 'letter' : mascot.emblem;
  const logo = {
    emblem, fg: shellColor === s ? p : s, fg2: p, acc: '#ffffff', bg: p, ring: s, line: d,
    letter: emblem === 'letter' || mode === 'both' ? letter : undefined,
    letterFont: rng.pick(['college', 'block', 'block', 'pro']),
  };
  if (emblem === 'letter') { logo.fg = shellColor === p ? s : p; logo.fg2 = shellColor === s ? p : s; }
  // a few animals keep their natural colours; the school's go to the trim
  const NATURAL = { longhorn: ['#efe6d2', '#6b4423'], eagle: ['#ffffff', p], bison: ['#5e3b22', '#efe6d2'] };
  if (NATURAL[emblem]) { [logo.fg, logo.fg2] = NATURAL[emblem]; logo.acc = emblem === 'eagle' ? '#e8b33a' : s; }
  // the decal has to show on the shell: if the emblem's main colour (or its
  // letter's) sits on the helmet colour, swap to the other school colour or white
  const near = (c) => colorDistance(c, shellColor) < 26;
  const contrast = () => (near('#ffffff') ? d : '#ffffff');
  if (!NATURAL[emblem]) {
    const mainKey = MAIN_IS_FG2.has(emblem) ? 'fg2' : emblem === 'shield' ? 'bg' : 'fg';
    if (near(logo[mainKey])) {
      if (mainKey === 'bg') {
        logo.bg = contrast();
        if (colorDistance(logo.fg, logo.bg) < 26) logo.fg = p;
      } else {
        const other = mainKey === 'fg' ? 'fg2' : 'fg';
        if (!near(logo[other])) [logo.fg, logo.fg2] = [logo.fg2, logo.fg];
        else logo[mainKey] = contrast();
      }
    }
  }
  if (logo.letter && LETTER_IN_FG2.has(emblem) && near(logo.fg2)) logo.fg2 = near(s) ? contrast() : s;
  const strength = o.strength ?? Math.round((0.42 + rng() * 0.36) * 100) / 100;
  return {
    id: o.id || `hs-${seed}`,
    level: 'hs',
    city: short,
    name: mascot.name,
    abbr: o.abbr || hsAbbr(short),
    school: /High|Academy|Christian|Memorial|Regional|Consolidated|County|Central/.test(school) || school.startsWith('St.') || school.startsWith('Bishop') ? school : school + ' High',
    town,
    mascot: mascot.name,
    colors: { primary: p, secondary: s, accent: a, dark: d },
    logo,
    helmet: {
      shell: shellColor, finish: rng() < 0.85 ? 'gloss' : 'matte',
      stripe: helmetStripe, stripeColors: stripeCols(nStripe[helmetStripe] || 0, shellColor === s ? p : s, '#ffffff'),
      facemask: rng() < 0.4 ? '#8d939a' : rng() < 0.5 ? d : s, logo: true, number: rng() < 0.3,
    },
    uniform: { home: homeKit, away: awayKit },
    style: { offense: rng.pick(HS_OFFENSE), defense: rng.pick(HS_DEFENSE), tempo: Math.round(rng.range(0.3, 0.8) * 100) / 100 },
    strength,
    venue: 'friday',
    stadium: `${town} ${rng.pick(HS_VENUE_NAMES)}`,
    venueDress: { seats: p, banner: s, trim: '#ffffff', endzone: rng.pick(['solid', 'stripes', 'solid']), endzoneColor: p, turf: rng() < 0.2 ? 'turf' : 'grass' },
    wordmark: { style: rng.pick(['arch', 'block', 'college', 'italic']), fill: s === '#ffffff' ? s : s, outline: d, outline2: s === '#ffffff' ? p : '#ffffff' },
  };
}

// The district: twelve schools the career's first act plays through.
const RIVAL_SPECS = [
  { id: 'hs-millbrook', town: 'Millbrook', school: 'Millbrook High', mascot: { name: 'Panthers', emblem: 'paw' }, palette: HS_PALETTES[10], strength: 0.62, logoMode: 'mascot' },
  { id: 'hs-cedar-ridge', town: 'Cedar Ridge', school: 'Cedar Ridge High', mascot: { name: 'Eagles', emblem: 'eagle' }, palette: HS_PALETTES[3], strength: 0.58, logoMode: 'mascot' },
  { id: 'hs-harmon-county', town: 'Harmon', school: 'Harmon County High', mascot: { name: 'Bulldogs', emblem: 'bulldog' }, palette: HS_PALETTES[19], strength: 0.72, logoMode: 'mascot', abbr: 'HCO' },
  { id: 'hs-copper-creek', town: 'Copper Creek', school: 'Copper Creek High', mascot: { name: 'Miners', emblem: 'pickaxe' }, palette: HS_PALETTES[6], strength: 0.47, logoMode: 'both', letter: 'C' },
  { id: 'hs-eastlake', town: 'Eastlake', school: 'Eastlake High', mascot: { name: 'Vikings', emblem: 'viking' }, palette: HS_PALETTES[5], strength: 0.66, logoMode: 'mascot' },
  { id: 'hs-stony-point', town: 'Stony Point', school: 'Stony Point High', mascot: { name: 'Rams', emblem: 'ram' }, palette: HS_PALETTES[2], strength: 0.55, logoMode: 'mascot' },
  { id: 'hs-bayou-vista', town: 'Bayou Vista', school: 'Bayou Vista High', mascot: { name: 'Pirates', emblem: 'swords' }, palette: HS_PALETTES[12], strength: 0.6, logoMode: 'both', letter: 'B' },
  { id: 'hs-prairie-hill', town: 'Prairie Hill', school: 'Prairie Hill Consolidated', mascot: { name: 'Tornadoes', emblem: 'tornado' }, palette: HS_PALETTES[15], strength: 0.52, logoMode: 'mascot' },
  { id: 'hs-iron-city', town: 'Iron City', school: 'Iron City High', mascot: { name: 'Ironmen', emblem: 'anvil' }, palette: HS_PALETTES[16], strength: 0.64, logoMode: 'both', letter: 'I' },
  { id: 'hs-fairmont', town: 'Fairmont', school: 'Fairmont Central', mascot: { name: 'Spartans', emblem: 'spartan' }, palette: HS_PALETTES[17], strength: 0.5, logoMode: 'mascot' },
  { id: 'hs-oak-valley', town: 'Oak Valley', school: 'Oak Valley High', mascot: { name: 'Grizzlies', emblem: 'bear' }, palette: HS_PALETTES[18], strength: 0.45, logoMode: 'mascot' },
  { id: 'hs-st-xavier', town: 'Westbury', school: 'St. Xavier', mascot: { name: 'Crusaders', emblem: 'shield' }, palette: HS_PALETTES[13], strength: 0.78, logoMode: 'both', letter: 'X', abbr: 'SXA' },
];

export const HS_RIVALS = RIVAL_SPECS.map((o) => makeHighSchool(o.id, o));

// ------------------------------------------------------------------ lookup

export const ALL_TEAMS = [...TEAMS, ...COLLEGES, ...HS_RIVALS];
export const TEAM_BY_ID = Object.fromEntries(ALL_TEAMS.map((t) => [t.id, t]));
const hsCache = new Map();

/**
 * Any team by id: pro, college, rival high school, or a generated high
 * school ('hs-<seed>', rebuilt from the seed). Unknown ids fall back to the
 * first pro team.
 */
export function getTeam(id) {
  if (TEAM_BY_ID[id]) return TEAM_BY_ID[id];
  const m = /^hs-(.+)$/.exec(String(id));
  if (m) {
    if (!hsCache.has(id)) hsCache.set(id, makeHighSchool(/^\d+$/.test(m[1]) ? Number(m[1]) : m[1]));
    return hsCache.get(id);
  }
  return TEAMS[0];
}

/**
 * Pick the uniforms for a game. The home team wears its home kit; the
 * visitors wear their away kit unless it's too close to the home colours
 * (jersey first, pants second), then whichever of their kits contrasts best.
 * Returns { home, away, homeKit: 'home', awayKit: 'away'|'alt'|'home' }.
 */
export function kitsFor(home, away) {
  const hk = home.uniform.home;
  // jersey contrast is what the eye reads; pants break ties. The road kit is
  // preferred, then the home kit, then an alternate.
  const score = (k) => colorDistance(hk.jersey, k.jersey) + 0.15 * colorDistance(hk.pants, k.pants);
  let awayKit = 'away';
  if (colorDistance(hk.jersey, away.uniform.away.jersey) < 45) {
    let best = score(away.uniform.away);
    for (const [k, penalty] of [['home', 6], ['alt', 12]]) {
      const kit = away.uniform[k];
      if (!kit) continue;
      const sc = score(kit) - penalty;
      if (sc > best) { best = sc; awayKit = k; }
    }
  }
  return { home: hk, away: away.uniform[awayKit], homeKit: 'home', awayKit };
}
