// Where people are, hour by hour. Each entry: { t: [from, to) hours (wraps past
// midnight), at: building id | 'building.point' | {x, z, rot}, do: activity,
// away: true (not in town / indoors at home, not on stage) }.
// A schedule may be a function (day, state) → blocks, for plot changes.

export const SCHEDULES = {
  koshkin: (day, s) => (s.flags.koshkinHospital && !s.flags.koshkinBack ? [{ t: [0, 24], away: true }] : [
    { t: [8, 18.5], at: 'koshkin.clerk', do: 'stand' },
    { t: [18.5, 20], at: 'church', do: 'stand' },
    { t: [20, 8], away: true },
  ]),
  dolly: [
    { t: [6, 21], at: 'diner.waitress', do: 'stand' },
    { t: [21, 23], at: 'bar.stool2', do: 'sit' },
    { t: [23, 6], away: true },
  ],
  hank: [
    { t: [7, 18], at: 'hardware.door', do: 'arms' },
    { t: [18, 21], at: 'bar.stool1', do: 'sit' },
    { t: [21, 7], away: true },
  ],
  ruth: (day) => [
    { t: [9, 12], at: day % 7 === 0 ? 'church' : 'post', do: 'stand' },
    { t: [12, 13.5], at: 'diner.booth2', do: 'sit' },
    { t: [13.5, 17], at: 'hall', do: 'stand' },
    { t: [17, 9], away: true },
  ],
  ray: [
    { t: [6, 16], at: 'cannery', do: 'arms' },
    { t: [16, 23.5], at: 'bar.stool3', do: 'sit' },
    { t: [23.5, 6], away: true },
  ],
  lyle: [
    { t: [9, 12], at: 'cityhall', do: 'stand' },
    { t: [12, 13], at: 'northstar', do: 'stand' },
    { t: [13, 17], at: 'cityhall', do: 'stand' },
    { t: [17, 20], at: 'diner.booth1', do: 'sit' },
    { t: [20, 9], away: true },
  ],
  marta: [
    { t: [8, 18], at: 'police.chiefDesk', do: 'stand' },
    { t: [18, 22], at: { x: 4, z: -4, rot: 0 }, do: 'arms' },
    { t: [22, 8], away: true },
  ],
  gideon: [
    { t: [8, 18], at: 'cityhall.clerk', do: 'stand' },
    { t: [18, 19.5], at: 'northstar', do: 'stand' },
    { t: [19.5, 8], away: true },
  ],
  walt: [
    { t: [9, 12], at: 'cityhall.mayorDesk', do: 'stand' },
    { t: [12, 13], at: 'diner.booth3', do: 'sit' },
    { t: [13, 17], at: 'cityhall.mayorDesk', do: 'stand' },
    { t: [17, 9], away: true },
  ],
  evan: [
    { t: [0, 24], at: 'northstar.clerk', do: 'stand' },
  ],
  gabriel: [
    { t: [7, 12], at: 'church.altar', do: 'stand' },
    { t: [12, 13], at: 'diner.booth4', do: 'sit' },
    { t: [13, 21], at: 'church', do: 'stand' },
    { t: [21, 7], away: true },
  ],
  nina: [
    { t: [15, 21], at: 'radio.console', do: 'sit' },
    { t: [21, 15], away: true },
  ],
  lou: [
    { t: [15, 2], at: 'bar.bartender', do: 'stand' },
    { t: [2, 15], away: true },
  ],
  tommy: [
    { t: [9, 17], at: 'hardware', do: 'stand' },
    { t: [17, 22], at: 'bar.poolTable', do: 'stand' },
    { t: [22, 9], away: true },
  ],
  ellen: [
    { t: [8, 17], at: 'clinic', do: 'stand' },
    { t: [17, 8], away: true },
  ],
  pearl: [
    { t: [9, 17], at: 'post', do: 'stand' },
    { t: [17, 9], away: true },
  ],
  // Mr. Grey: everywhere, from day 2 (a parked car the night of the council
  // meeting). Lunch across from NORTHSTAR 24, the square in the afternoon, a
  // booth at the Midnight Sun in the evening. Never in town on the last night.
  okafor: (day) => (day < 2 ? [{ t: [0, 24], away: true }] : [
    ...(day >= 5 ? [{ t: [17, 24], away: true }] : []),
    { t: [11, 14], at: 'northstar.parking', do: 'arms' },
    { t: [14, 17], at: { x: -8, z: 6, rot: Math.PI / 2 }, do: 'stand' },
    { t: [17, 22], at: 'diner.booth5', do: 'sit' },
    { t: [22, 11], away: true },
  ]),
  wade: (day) => [
    ...(day === 1 ? [{ t: [6, 12], at: 'terminal', do: 'arms' }] : []),
    { t: [8, 16], at: 'hangar', do: 'arms' },
    { t: [16, 20], at: 'diner.booth1', do: 'sit' },
    { t: [20, 8], away: true },
  ],
};
