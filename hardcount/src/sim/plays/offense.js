// The offensive playbook. Every play names its formation, what kind of play it
// is, and what each skill player does (route id from routes.js, or a block),
// plus what the QB does with his feet.
//
//   kind: 'pass' | 'run' | 'option' | 'screen' | 'trick' | 'qbrun' | 'kneel' | 'spike'
//   drop: QB footwork — 'quick' (catch and fire), 'gun3', 'gun5', 'drop3', 'drop5',
//         'drop7', 'pa' (play-action fake then 5), 'boot' (fake and bootleg away),
//         'sprint' (sprint-out to the play side)
//   routes: role → route id;  block: role → 'pass' (stay in) | 'chip' (chip then release
//           into `routes[role]`) | 'lead' (lead-block through the hole) | 'stalk' (downfield)
//   reads: the QB's progression, first to last
//   run: { carrier, give: 'hand'|'toss'|'pitch'|'direct'|'keep', hole: 'A'|'B'|'C'|'edge',
//          side: +1 (QB's right) | -1, scheme: 'zone'|'power'|'counter'|'sweep'|'draw'|'iso'|'sneak' }
//   option: { read: 'end'|'dive', pitch: role, dive: role }  — the QB reads a defender
//   script: scripted ball transfers for trick plays [{ do, from, to, at | after }]
//   tags: what situations the CPU likes it for
// Plays are drawn as if run to the right; `flip` mirrors any of them.
export const OFFENSE = [
  // ------------------------------------------------------------- GUN SPREAD
  { id: 'sp_slants', name: 'SLANTS', form: 'gun_spread', kind: 'pass', drop: 'quick', routes: { X: 'slant', Z: 'slant', RB: 'flat' }, reads: ['Z', 'X', 'RB'], tags: ['short', 'quick', '2pt'] },
  { id: 'sp_smash', name: 'SMASH', form: 'gun_spread', kind: 'pass', drop: 'gun3', routes: { X: 'hitch', Z: 'corner', RB: 'arrow' }, reads: ['Z', 'RB', 'X'], tags: ['mid'] },
  { id: 'sp_verts', name: 'FOUR VERTS', form: 'gun_spread', kind: 'pass', drop: 'gun5', routes: { X: 'go', Z: 'go', RB: 'wheel' }, reads: ['X', 'Z', 'RB'], tags: ['deep', 'hurry'] },
  { id: 'sp_curlflat', name: 'CURL FLAT', form: 'gun_spread', kind: 'pass', drop: 'gun3', routes: { X: 'curl', Z: 'curl', RB: 'flat' }, reads: ['X', 'RB', 'Z'], tags: ['mid', 'short'] },
  { id: 'sp_mesh', name: 'MESH', form: 'gun_spread', kind: 'pass', drop: 'gun3', routes: { X: 'drag', Z: 'drag', RB: 'angle' }, reads: ['Z', 'X', 'RB'], tags: ['short', '2pt'] },
  { id: 'sp_dagger', name: 'DAGGER', form: 'gun_spread', kind: 'pass', drop: 'gun5', routes: { X: 'dig', Z: 'go', RB: 'checkdown' }, reads: ['Z', 'X', 'RB'], tags: ['deep', 'mid'] },
  { id: 'sp_zone', name: 'INSIDE ZONE', form: 'gun_spread', kind: 'run', run: { carrier: 'RB', give: 'hand', hole: 'A', side: -1, scheme: 'zone' }, block: { X: 'stalk', Z: 'stalk' }, tags: ['run', 'short'] },
  { id: 'sp_draw', name: 'HB DRAW', form: 'gun_spread', kind: 'run', run: { carrier: 'RB', give: 'hand', hole: 'B', side: 1, scheme: 'draw', delay: 0.7 }, block: { X: 'stalk', Z: 'stalk' }, tags: ['run', 'long'] },
  { id: 'sp_read', name: 'ZONE READ', form: 'gun_spread', kind: 'option', option: { read: 'end', give: 'RB', keepSide: 1 }, run: { carrier: 'RB', give: 'hand', hole: 'B', side: -1, scheme: 'zone' }, block: { X: 'stalk', Z: 'stalk' }, tags: ['run', 'option'] },
  { id: 'sp_speedopt', name: 'SPEED OPTION', form: 'gun_spread', kind: 'option', option: { read: 'edge', pitch: 'RB', side: 1 }, run: { carrier: 'QB', give: 'keep', hole: 'edge', side: 1, scheme: 'sweep' }, routes: { RB: 'pitchpath' }, block: { X: 'stalk', Z: 'stalk' }, tags: ['run', 'option', 'lateral'] },
  { id: 'sp_rpo', name: 'BUBBLE RPO', form: 'gun_spread', kind: 'run', rpo: 'Z', run: { carrier: 'RB', give: 'hand', hole: 'A', side: 1, scheme: 'zone' }, routes: { Z: 'bubble' }, block: { X: 'stalk' }, tags: ['run', 'short', 'rpo'] },
  { id: 'sp_screen', name: 'HB SCREEN', form: 'gun_spread', kind: 'screen', drop: 'gun5', screen: 'RB', routes: { X: 'go', Z: 'go', RB: 'screen' }, reads: ['RB'], tags: ['screen', 'long'] },
  { id: 'sp_double', name: 'DOUBLE PASS', form: 'gun_spread', kind: 'trick', drop: 'quick', routes: { Z: 'bubble', X: 'post', RB: 'wheel' }, reads: ['Z'],
    script: [{ do: 'pass', from: 'QB', to: 'Z', at: 0.45 }, { do: 'throwFrom', from: 'Z', reads: ['X', 'RB'], after: 'catch', delay: 0.9 }], tags: ['trick', 'deep'] },
  { id: 'sp_qbdraw', name: 'QB DRAW', form: 'gun_spread', kind: 'qbrun', run: { carrier: 'QB', give: 'keep', hole: 'A', side: 1, scheme: 'draw', delay: 0.9 }, routes: { X: 'go', Z: 'go' }, block: { RB: 'lead' }, tags: ['run', 'long'] },

  // ------------------------------------------------------------- GUN TRIPS
  { id: 'tr_flood', name: 'FLOOD', form: 'gun_trips', kind: 'pass', drop: 'gun5', routes: { Z: 'go', X: 'out', SL: 'flat' }, reads: ['X', 'SL', 'Z'], tags: ['mid'] },
  { id: 'tr_ycross', name: 'Y CROSS', form: 'gun_trips', kind: 'pass', drop: 'gun5', routes: { Z: 'post', X: 'cross', SL: 'flat' }, reads: ['X', 'Z', 'SL'], tags: ['mid', 'deep'] },
  { id: 'tr_stick', name: 'STICK', form: 'gun_trips', kind: 'pass', drop: 'quick', routes: { Z: 'fade', X: 'stick', SL: 'flat' }, reads: ['X', 'SL', 'Z'], tags: ['short', '2pt', 'quick'] },
  { id: 'tr_bubble', name: 'TRIPS BUBBLE', form: 'gun_trips', kind: 'screen', drop: 'quick', screen: 'SL', routes: { SL: 'bubble', X: 'stalk', Z: 'stalk' }, reads: ['SL'], tags: ['screen', 'short'] },
  { id: 'tr_verts', name: 'TRIPS VERTS', form: 'gun_trips', kind: 'pass', drop: 'gun5', routes: { Z: 'go', X: 'seam', SL: 'seam' }, reads: ['SL', 'X', 'Z'], tags: ['deep', 'hurry'] },
  { id: 'tr_ladder', name: 'HOOK & LADDER', form: 'gun_trips', kind: 'trick', drop: 'gun3', routes: { Z: 'curl', X: 'ladder', SL: 'go' }, reads: ['Z'],
    script: [{ do: 'lateralAfterCatch', from: 'Z', to: 'X', after: 'catch', delay: 0.55 }], tags: ['trick', 'lateral', 'hurry'] },
  { id: 'tr_tunnel', name: 'TUNNEL SCREEN', form: 'gun_trips', kind: 'screen', drop: 'quick', screen: 'Z', routes: { Z: 'tunnel', X: 'stalk', SL: 'stalk' }, reads: ['Z'], tags: ['screen', 'short'] },
  { id: 'tr_jet', name: 'JET SWEEP', form: 'gun_trips', kind: 'run', motion: { role: 'SL', jet: true }, run: { carrier: 'SL', give: 'hand', hole: 'edge', side: -1, scheme: 'sweep', jet: true }, block: { X: 'stalk', Z: 'stalk' }, tags: ['run', 'edge'] },

  // ------------------------------------------------------------- GUN BUNCH / EMPTY / TWINS
  { id: 'bu_snag', name: 'SNAG', form: 'gun_bunch', kind: 'pass', drop: 'gun3', routes: { Z: 'corner', SL: 'spot', X: 'flat' }, reads: ['SL', 'X', 'Z'], tags: ['short', 'mid', '2pt'] },
  { id: 'bu_cross', name: 'BUNCH CROSS', form: 'gun_bunch', kind: 'pass', drop: 'gun5', routes: { Z: 'post', SL: 'cross', X: 'whip' }, reads: ['SL', 'Z', 'X'], tags: ['mid'] },
  { id: 'bu_wheel', name: 'BUNCH WHEEL', form: 'gun_bunch', kind: 'pass', drop: 'gun5', routes: { Z: 'out', SL: 'wheel', X: 'drag' }, reads: ['SL', 'Z', 'X'], tags: ['deep'] },
  { id: 'em_levels', name: 'LEVELS', form: 'gun_empty', kind: 'pass', drop: 'gun3', routes: { X: 'go', SL: 'in', Z: 'drag' }, reads: ['SL', 'Z', 'X'], tags: ['mid'] },
  { id: 'em_spacing', name: 'SPACING', form: 'gun_empty', kind: 'pass', drop: 'quick', routes: { X: 'hitch', SL: 'stick', Z: 'hitch' }, reads: ['SL', 'X', 'Z'], tags: ['short', 'quick'] },
  { id: 'em_hail', name: 'HAIL MARY', form: 'gun_empty', kind: 'pass', drop: 'drop7', hail: true, routes: { X: 'go', SL: 'go', Z: 'go' }, reads: ['SL', 'X', 'Z'], tags: ['hail'] },
  { id: 'tw_post', name: 'TWINS POST', form: 'gun_twins', kind: 'pass', drop: 'gun5', routes: { X: 'post', SL: 'out', RB: 'wheel' }, reads: ['X', 'SL', 'RB'], tags: ['deep'] },
  { id: 'tw_power', name: 'GUN POWER', form: 'gun_twins', kind: 'run', run: { carrier: 'RB', give: 'hand', hole: 'B', side: 1, scheme: 'power' }, block: { X: 'stalk', SL: 'stalk' }, tags: ['run', 'short'] },

  // ------------------------------------------------------------- PISTOL
  { id: 'pi_stretch', name: 'STRETCH', form: 'pistol', kind: 'run', run: { carrier: 'RB', give: 'hand', hole: 'C', side: 1, scheme: 'zone' }, block: { TE: 'block', X: 'stalk' }, tags: ['run'] },
  { id: 'pi_counter', name: 'COUNTER', form: 'pistol', kind: 'run', run: { carrier: 'RB', give: 'hand', hole: 'B', side: -1, scheme: 'counter' }, block: { TE: 'block', X: 'stalk' }, tags: ['run'] },
  { id: 'pi_boot', name: 'PA BOOT', form: 'pistol', kind: 'pass', drop: 'boot', paFake: 'RB', bootSide: 1, routes: { TE: 'flat', X: 'cross', RB: 'flat' }, reads: ['TE', 'X', 'RB'], tags: ['pa', 'mid'] },
  { id: 'pi_seam', name: 'TE SEAM', form: 'pistol', kind: 'pass', drop: 'pa', paFake: 'RB', routes: { TE: 'seam', X: 'curl', RB: 'checkdown' }, reads: ['TE', 'X', 'RB'], tags: ['pa', 'deep'] },
  { id: 'pi_inverted', name: 'INVERTED VEER', form: 'pistol', kind: 'option', option: { read: 'end', give: 'RB', keepSide: -1, inverted: true }, run: { carrier: 'RB', give: 'hand', hole: 'edge', side: 1, scheme: 'sweep' }, block: { TE: 'block', X: 'stalk' }, tags: ['run', 'option'] },

  // ------------------------------------------------------------- I-FORM / SINGLEBACK
  { id: 'i_iso', name: 'ISO', form: 'i_form', kind: 'run', run: { carrier: 'RB', give: 'hand', hole: 'A', side: 1, scheme: 'iso' }, block: { FB: 'lead', X: 'stalk' }, tags: ['run', 'short', 'goal'] },
  { id: 'i_toss', name: 'TOSS SWEEP', form: 'i_form', kind: 'run', run: { carrier: 'RB', give: 'toss', hole: 'edge', side: -1, scheme: 'sweep' }, block: { FB: 'lead', X: 'stalk' }, tags: ['run', 'edge'] },
  { id: 'i_pa', name: 'PA DEEP', form: 'i_form', kind: 'pass', drop: 'pa', paFake: 'RB', routes: { X: 'post', FB: 'flat', RB: 'checkdown' }, block: { RB: 'chip' }, reads: ['X', 'FB', 'RB'], tags: ['pa', 'deep'] },
  { id: 'i_flea', name: 'FLEA FLICKER', form: 'i_form', kind: 'trick', drop: 'flea', routes: { X: 'go', FB: 'leak', RB: 'flea' }, reads: ['X', 'FB'],
    script: [{ do: 'handoff', from: 'QB', to: 'RB', at: 0.5 }, { do: 'lateral', from: 'RB', to: 'QB', at: 1.25 }], tags: ['trick', 'deep'] },
  { id: 'i_hbpass', name: 'HALFBACK PASS', form: 'i_form', kind: 'trick', drop: 'toss', routes: { X: 'post', FB: 'leak', RB: 'hbpass' }, reads: ['X', 'FB'],
    script: [{ do: 'pitch', from: 'QB', to: 'RB', at: 0.35 }, { do: 'throwFrom', from: 'RB', reads: ['X', 'FB'], after: 'catch', delay: 1.0 }], tags: ['trick', 'deep'] },
  { id: 'i_sneak', name: 'QB SNEAK', form: 'goal_line', kind: 'qbrun', run: { carrier: 'QB', give: 'keep', hole: 'A', side: 1, scheme: 'sneak' }, block: { FB: 'lead', RB: 'lead', TE: 'block' }, tags: ['run', 'short', 'goal', 'sneak'] },
  { id: 'gl_dive', name: 'FB DIVE', form: 'goal_line', kind: 'run', run: { carrier: 'FB', give: 'hand', hole: 'A', side: -1, scheme: 'iso' }, block: { RB: 'lead', TE: 'block' }, tags: ['run', 'short', 'goal'] },
  { id: 'gl_pa', name: 'PA TE FLAT', form: 'goal_line', kind: 'pass', drop: 'boot', paFake: 'FB', bootSide: 1, routes: { TE: 'flat', FB: 'flat', RB: 'leak' }, reads: ['TE', 'RB', 'FB'], tags: ['pa', 'goal', '2pt'] },
  { id: 'ac_reverse', name: 'REVERSE', form: 'ace_twins', kind: 'trick', routes: { SL: 'reverse', X: 'stalk' }, run: { carrier: 'RB', give: 'hand', hole: 'edge', side: -1, scheme: 'sweep' },
    script: [{ do: 'handoff', from: 'QB', to: 'RB', at: 0.5 }, { do: 'handoff', from: 'RB', to: 'SL', at: 1.35 }], tags: ['trick', 'edge'] },
  { id: 'ac_statue', name: 'STATUE OF LIBERTY', form: 'ace_twins', kind: 'trick', drop: 'drop5', routes: { X: 'go', SL: 'post', RB: 'statue' }, reads: ['X'],
    script: [{ do: 'pump', from: 'QB', at: 1.05 }, { do: 'handoff', from: 'QB', to: 'RB', at: 1.25 }], tags: ['trick'] },
  { id: 'ac_slant', name: 'SLANT FLAT', form: 'ace_twins', kind: 'pass', drop: 'drop3', routes: { X: 'slant', SL: 'flat', RB: 'checkdown' }, reads: ['X', 'SL', 'RB'], tags: ['short', 'quick'] },

  // ------------------------------------------------------------- OPTION
  { id: 'fx_triple', name: 'TRIPLE OPTION', form: 'flexbone', kind: 'option', option: { read: 'dive', dive: 'RB', pitch: 'WB', side: 1 }, run: { carrier: 'RB', give: 'hand', hole: 'B', side: 1, scheme: 'zone' }, routes: { WB: 'pitchpath', HB: 'arc' }, tags: ['run', 'option', 'lateral'] },
  { id: 'fx_midline', name: 'MIDLINE', form: 'flexbone', kind: 'option', option: { read: 'end', give: 'RB', keepSide: 1 }, run: { carrier: 'RB', give: 'hand', hole: 'A', side: 1, scheme: 'zone' }, block: { HB: 'lead', WB: 'lead' }, tags: ['run', 'option'] },
  { id: 'fx_pa', name: 'OPTION PASS', form: 'flexbone', kind: 'pass', drop: 'pa', paFake: 'RB', routes: { WB: 'post', HB: 'go', RB: 'flat' }, reads: ['WB', 'HB', 'RB'], tags: ['pa', 'deep'] },
  { id: 'wb_rocket', name: 'WISHBONE PITCH', form: 'wishbone', kind: 'option', option: { read: 'edge', pitch: 'RB', side: 1 }, run: { carrier: 'QB', give: 'keep', hole: 'edge', side: 1, scheme: 'sweep' }, routes: { RB: 'pitchpath' }, block: { FB: 'lead', HB: 'lead' }, tags: ['run', 'option', 'lateral'] },
  { id: 'wb_rugby', name: 'RUGBY SWEEP', form: 'wishbone', kind: 'trick', run: { carrier: 'RB', give: 'toss', hole: 'edge', side: 1, scheme: 'sweep' }, routes: { HB: 'trail', FB: 'lead' },
    script: [{ do: 'support', from: 'HB', of: 'carrier' }, { do: 'support', from: 'QB', of: 'carrier' }], tags: ['trick', 'lateral', 'run'] },

  // ------------------------------------------------------------- WILDCAT
  { id: 'wc_power', name: 'WILDCAT POWER', form: 'wildcat', kind: 'run', run: { carrier: 'RB', give: 'direct', hole: 'B', side: 1, scheme: 'power' }, block: { HB: 'lead', X: 'stalk' }, routes: { QB: 'stalk' }, tags: ['run', 'short'] },
  { id: 'wc_jet', name: 'WILDCAT JET', form: 'wildcat', kind: 'run', run: { carrier: 'HB', give: 'hand', hole: 'edge', side: -1, scheme: 'sweep', fromDirect: true }, block: { X: 'stalk' }, routes: { QB: 'stalk' }, tags: ['run', 'edge'] },
  { id: 'wc_philly', name: 'PHILLY SPECIAL', form: 'wildcat', kind: 'trick', routes: { QB: 'leak', X: 'post', HB: 'philly' }, run: { carrier: 'RB', give: 'direct', hole: 'edge', side: 1, scheme: 'sweep' },
    script: [{ do: 'pitch', from: 'RB', to: 'HB', at: 0.55 }, { do: 'throwFrom', from: 'HB', reads: ['QB', 'X'], after: 'catch', delay: 0.85 }], tags: ['trick', 'goal', '2pt'] },

  // ------------------------------------------------------------- CLOCK
  { id: 'ck_spike', name: 'SPIKE', form: 'gun_spread', kind: 'spike', tags: ['clock'] },
  { id: 'ck_kneel', name: 'KNEEL', form: 'i_form', kind: 'kneel', tags: ['clock'] },
];

// Custom route legs used by scripted plays (paths for the AI, not real routes)
export const SCRIPT_ROUTES = {
  pitchpath: { pts: [[-2, -4.5], [-8, -3.5], [-14, -1]], speed: 0.85 },  // option pitch man: 4 yd deep, 4 wide of the QB
  arc: { pts: [[-1, 0], [-6, 2], [-10, 5]], block: true },                 // flexbone wing arcs to block the alley
  flea: { pts: [[0.5, -2.5], [0.2, -3]], speed: 0.8 },                     // RB takes the handoff, stops, pitches back
  hbpass: { pts: [[-7, -4.5], [-11, -3]], speed: 0.75 },                   // HB sweeps, pulls up to throw
  statue: { pts: [[0, -4], [-1.5, -5.5], [-8, -3]], speed: 0.6 },          // RB loops behind the QB for the hand-off
  reverse: { pts: [[4, -2], [-4, -4.5], [-14, -2]], speed: 1 },            // reverse man swings back the other way
  philly: { pts: [[4, -2.5], [-3, -3.5], [-6, -3]], speed: 0.85 },         // takes the pitch going right, pulls up
  trail: { pts: [[-2, -5], [-8, -4.5], [-14, -2]], speed: 0.9 },           // rugby trailer: stays in pitch relationship
  jet: { pts: [[-4, -1.8], [-12, -1.8]], speed: 1 },                       // jet motion across the formation
};

export const OFFENSE_BY_ID = Object.fromEntries(OFFENSE.map((p) => [p.id, p]));
