// Official names + one-line rules for every battle mode (lobby chips, room
// settings, tower signs, intro banners). No heavy imports: safe anywhere.
export const MODE_INFO = {
  turf: { name: 'Turf Rush', desc: 'Paint the most floor in the time limit.', tag: 'Most floor painted wins' },
  zones: { name: 'Zone Clash', desc: 'Ink 70% of the marked zones to hold them. Hold long enough to run your count down from 100!', tag: 'Hold the zone, run your count to 0' },
  hoops: { name: 'Hue Hoops', desc: 'Grab the Glowball and score through the enemy hoop. Paint its pad to break the shield, then shoot for 2 or dunk for 3!', tag: 'Paint the pad open, then dunk!' },
};
export const MODE_IDS = Object.keys(MODE_INFO);
export const modeName = (id) => (MODE_INFO[id] || MODE_INFO.turf).name;
