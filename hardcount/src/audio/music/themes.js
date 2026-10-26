// Theme registry: id → Song subclass.
import { Glory, Pregame, PostWin, PostLoss, Draft } from './th_brass.js';
import { FreePlay, Playbook, HallOfFame, Options } from './th_hud.js';
import { Playcall, CareerHub } from './th_game.js';
import { Practice, Halftime, BandCadence, BandFight, BandCharge } from './th_band.js';

export const THEMES = {
  // the huddle: one station per wristband line (stadium PA)
  hud_glory: Glory,
  hud_free: FreePlay,
  hud_practice: Practice,
  hud_book: Playbook,
  hud_hof: HallOfFame,
  hud_options: Options,
  // game day
  playcall: Playcall,
  pregame: Pregame,
  halftime: Halftime,
  postgame_win: PostWin,
  postgame_loss: PostLoss,
  // career
  career_hub: CareerHub,
  draft: Draft,
  // the band in the stands (played by band.js through its own engine instance)
  band_cadence: BandCadence,
  band_fight: BandFight,
  band_charge: BandCharge,
};
