// Theme registry: id → Song subclass. COLD BOOT's own cues are the cb_* ids;
// the Midnight Frequency themes stay registered.
import { Nitro, City, Boss } from './th_dnb.js';
import { Underground, Lose } from './th_beats.js';
import { Records } from './th_garage.js';
import { Talk } from './th_jazz.js';
import { Showroom, Win } from './th_house.js';
import { Circuit, Desert, Docks } from './th_rock.js';
import { Mountain } from './th_euro.js';
import { Highway } from './th_trance.js';
import { CBTitle, CBWarehouse, CBCredits } from './th_coldboot.js';
import { CBTown, CBNight } from './th_cb_town.js';
import { CBTension, CBChase } from './th_cb_action.js';

export const THEMES = {
  // radio stations (main menu)
  nitro: Nitro,
  underground: Underground,
  records: Records,
  talk: Talk,
  showroom: Showroom,
  // races
  race_city: City,
  race_circuit: Circuit,
  race_mountain: Mountain,
  race_desert: Desert,
  race_docks: Docks,
  race_highway: Highway,
  race_boss: Boss,
  // results
  results_win: Win,
  results_lose: Lose,
  // COLD BOOT
  cb_title: CBTitle,
  cb_warehouse: CBWarehouse,
  cb_town: CBTown,
  cb_night: CBNight,
  cb_tension: CBTension,
  cb_chase: CBChase,
  cb_credits: CBCredits,
};
