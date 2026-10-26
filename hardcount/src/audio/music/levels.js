// Per-theme mix overrides: layer bus gains + overall trim (applied after
// compose()). Trims come from the offline loudness measurements
// (tools/audiocheck.mjs): menu stations and anthems sit near −16.5 LUFS
// integrated, the low-key beds (play call, the bedroom) a couple of dB under.
export const LEVELS = {
  hud_glory: { trim: 0.59 },
  hud_free: { trim: 0.48 },
  hud_practice: { trim: 0.58 },
  hud_book: { trim: 0.84 },
  hud_hof: { trim: 1.24 },
  hud_options: { trim: 0.7 },
  playcall: { trim: 0.43 },
  pregame: { trim: 0.25 },
  halftime: { trim: 0.5 },
  postgame_win: { trim: 0.36 },
  postgame_loss: { trim: 1.06 },
  career_hub: { trim: 0.44 },
  draft: { trim: 1.03 },
  band_cadence: { trim: 0.72 },
  band_fight: { trim: 0.7 },
  band_charge: { trim: 0.72 },
};
