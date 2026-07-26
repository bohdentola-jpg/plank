// Every number the hotel runs on, in one place: room tiers, the amenity catalogue,
// the payroll, and the pace of a day. Tuning the game means editing this file.

// ------------------------------------------------------------------ time
// A day is 3.5 real minutes at 1x. The clock is minutes-since-midnight, 0..1440.
export const DAY_SECONDS = 210;
export const MIN_PER_SEC = 1440 / DAY_SECONDS; // in-game minutes per real second
export const SPEEDS = [1, 2, 4];

export const HOUR = {
  checkoutOpen: 6,
  checkoutClose: 11,
  checkinOpen: 13,
  nightFall: 22,
  dawn: 6,
  shiftEnd: 23,      // staff clock out here without a night auditor
  shiftStart: 6,
};

// ------------------------------------------------------------------ layout
export const SLOTS_PER_FLOOR = 6;
export const MAX_FLOORS = 5;
export const MAX_ROOMS = SLOTS_PER_FLOOR * MAX_FLOORS;

// ------------------------------------------------------------------ rooms
export const TIERS = [
  null,
  { id: 1, name: 'Standard', rate: 64, clean: 1.00, wear: 1.00, blurb: 'Two beds, one lamp, a Bible in the drawer.' },
  { id: 2, name: 'Deluxe', rate: 112, clean: 1.25, wear: 0.92, blurb: 'King bed, armchair, a view of the lot.' },
  { id: 3, name: 'Suite', rate: 210, clean: 1.55, wear: 0.85, blurb: 'Sitting room, wet bar, the good towels.' },
];

export function roomBuildCost(builtRooms) {
  return Math.round(440 * Math.pow(1.22, Math.max(0, builtRooms - 3)));
}
export function floorCost(floors) {
  return Math.round(2600 * Math.pow(2.0, floors - 1));
}
export const TIER_UPGRADE_COST = [0, 0, 950, 2700];

// ------------------------------------------------------------------ work
// Base seconds of real time a task takes at 1x with no upgrades.
export const TASK_SECS = { checkin: 5.5, checkout: 3.5, clean: 13, fix: 17, service: 7.5, laundry: 5 };
export const TASK_LABEL = {
  checkin: 'Check in', checkout: 'Check out', clean: 'Clean room',
  fix: 'Repair', service: 'Room request', laundry: 'Restock linen',
};
export const TASK_ICON = { checkin: '🛎', checkout: '🧾', clean: '🧹', fix: '🔧', service: '🔔', laundry: '🧺' };
// Higher sorts first when nobody is assigned.
export const TASK_PRIORITY = { checkin: 5, service: 4, checkout: 3, clean: 2, fix: 2, laundry: 6 };

export const WALK_SPEED = { you: 3.6, guest: 2.5, staff: 3.1 };
export const STAIR_SPEED = 2.2;
export const ELEVATOR_SPEED = 7.0;

// ------------------------------------------------------------------ staff
export const ROLES = [
  {
    id: 'clerk', name: 'Front Desk Clerk', icon: '🛎', hire: 420, wage: 78,
    handles: ['checkin', 'checkout'], uniform: '#1d3557',
    blurb: 'Works the desk so arrivals stop piling up in your lobby.',
  },
  {
    id: 'housekeeper', name: 'Housekeeper', icon: '🧹', hire: 320, wage: 62,
    handles: ['clean'], uniform: '#4a7c59',
    blurb: 'Strips the beds, hits the bathroom, flips rooms while you sleep.',
  },
  {
    id: 'maintenance', name: 'Maintenance Tech', icon: '🔧', hire: 540, wage: 88,
    handles: ['fix'], uniform: '#8a5a2b',
    blurb: 'The AC dies at 2am. Somebody has to be holding the wrench.',
  },
  {
    id: 'bellhop', name: 'Bellhop', icon: '🧳', hire: 300, wage: 52,
    handles: ['service'], uniform: '#7d2836',
    blurb: 'Towels, ice, wake-up calls. Also carries bags, which guests remember.',
  },
  {
    id: 'laundry', name: 'Laundry Attendant', icon: '🧺', hire: 360, wage: 54,
    handles: ['laundry'], uniform: '#5d6b8a',
    blurb: 'Keeps every cart stocked so nobody walks to the linen room again.',
  },
  {
    id: 'auditor', name: 'Night Auditor', icon: '🌙', hire: 1700, wage: 140,
    handles: [], uniform: '#2f2a44', unique: true,
    blurb: 'Runs the graveyard shift. The hotel keeps earning with the lights off — and while you are away.',
  },
  {
    id: 'manager', name: 'General Manager', icon: '📋', hire: 4200, wage: 240,
    handles: [], uniform: '#3d3b39', unique: true,
    blurb: 'Prices the rooms, drives the whole staff harder, and can hold the place together for a full day alone.',
  },
];
export const ROLE_BY_ID = Object.fromEntries(ROLES.map((r) => [r.id, r]));

export const TRAIN_MAX = 3;
export function trainCost(level) { return 340 * level; }
export function staffSpeed(member, state) {
  const gm = state.staff.some((s) => s.role === 'manager') ? 1.18 : 1;
  return (1 + 0.22 * (member.level - 1)) * gm;
}
export function staffWage(member) {
  return Math.round(ROLE_BY_ID[member.role].wage * (1 + 0.18 * (member.level - 1)));
}
export function roleCap(roleId, builtRooms) {
  if (ROLE_BY_ID[roleId].unique) return 1;
  return 1 + Math.floor(builtRooms / 5);
}

// ------------------------------------------------------------------ amenities
// draw   — pulls more travellers off the road (demand)
// mood   — flat happiness bump for everyone staying
// rate   — multiplier on what you can charge before guests balk
// rep    — one-time standing bump
// pernight — passive dollars per guest-night from the guest's incidentals
export const AMENITIES = [
  { id: 'wifi', name: 'Wi-Fi Throughout', icon: '📶', cost: 420, upkeep: 4, rep: 0.15, mood: 0.04, draw: 0.04, tier: 1, blurb: 'A router in the closet and a password on a card. In this decade, table stakes.' },
  { id: 'vending', name: 'Vending Alcove', icon: '🥤', cost: 340, upkeep: 2, pernight: 4, tier: 1, blurb: 'Ice machine, two snack rows, and the eternal hum.' },
  { id: 'carts', name: 'Housekeeping Carts', icon: '🛒', cost: 520, upkeep: 1, linens: 2, cleanSpeed: 1.14, tier: 1, blurb: 'Deeper carts. Fewer trips down to the linen room.' },
  { id: 'coffee', name: 'Lobby Coffee Bar', icon: '☕', cost: 640, upkeep: 6, mood: 0.05, draw: 0.03, tier: 1, blurb: 'Burnt at 6am, gone by 8. Guests still love it.' },
  { id: 'signneon', name: 'Big Neon Marquee', icon: '🔆', cost: 780, upkeep: 3, draw: 0.07, rep: 0.05, tier: 1, blurb: 'Visible from the off-ramp. That is the whole business plan.' },
  { id: 'laundryroom', name: 'Linen Room Expansion', icon: '🧺', cost: 950, upkeep: 5, linens: 4, instantLinen: true, tier: 1, blurb: 'Industrial washers. Carts refill on the floor instead of downstairs.' },
  { id: 'pms', name: 'Front Desk Terminal', icon: '💻', cost: 1900, upkeep: 10, checkinSpeed: 1.85, tier: 2, blurb: 'Reservations on a screen instead of a paper ledger. Check-in stops being a queue.' },
  { id: 'chandelier', name: 'Lobby Chandelier', icon: '💎', cost: 1850, upkeep: 6, rep: 0.20, mood: 0.03, tier: 2, blurb: 'Nobody books for a chandelier. Everybody mentions it in the review.' },
  { id: 'breakfast', name: 'Free Breakfast', icon: '🥐', cost: 1600, upkeep: 24, mood: 0.10, draw: 0.09, rate: 1.06, tier: 2, blurb: 'Waffle iron, sad melon, and a measurable jump in bookings.' },
  { id: 'giftshop', name: 'Gift Shop', icon: '🎁', cost: 2300, upkeep: 14, pernight: 6, draw: 0.02, tier: 2, blurb: 'Postcards, aspirin, a shelf of tiny liquor.' },
  { id: 'securitycam', name: 'Cameras & Alarms', icon: '📹', cost: 1500, upkeep: 8, wear: 0.62, tier: 2, blurb: 'Things break less when someone is theoretically watching.' },
  { id: 'elevator', name: 'Passenger Elevator', icon: '🛗', cost: 2700, upkeep: 12, elevator: true, mood: 0.04, tier: 2, blurb: 'Stairs with luggage is why people book the ground floor. Fix that.' },
  { id: 'gym', name: 'Fitness Room', icon: '🏋', cost: 2900, upkeep: 18, draw: 0.06, rate: 1.05, tier: 3, blurb: 'Two treadmills and a mirror. Counts as a fitness centre.' },
  { id: 'valet', name: 'Valet & Bell Stand', icon: '🚗', cost: 3300, upkeep: 24, mood: 0.07, draw: 0.05, tier: 3, blurb: 'Somebody takes the keys. The stay starts well.' },
  { id: 'pool', name: 'Outdoor Pool', icon: '🏊', cost: 4300, upkeep: 30, draw: 0.13, mood: 0.08, rate: 1.08, tier: 3, blurb: 'The single most-searched word on the sign.' },
  { id: 'bar', name: 'Lobby Bar', icon: '🍸', cost: 5400, upkeep: 42, pernight: 10, draw: 0.07, rate: 1.05, tier: 3, blurb: 'Where the whole margin actually lives.' },
  { id: 'conference', name: 'Conference Room', icon: '📽', cost: 7200, upkeep: 46, groups: true, rate: 1.10, draw: 0.05, tier: 4, blurb: 'Books the whole floor at once. Regional sales teams are money.' },
  { id: 'spa', name: 'Spa & Sauna', icon: '💆', cost: 9500, upkeep: 62, draw: 0.11, rate: 1.16, mood: 0.06, tier: 4, blurb: 'The rate you can charge stops being about the room.' },
];
export const AMENITY_BY_ID = Object.fromEntries(AMENITIES.map((a) => [a.id, a]));

// ------------------------------------------------------------------ guests
export const BUDGETS = [
  { id: 'thrifty', label: 'thrifty', want: 1, tolerance: 0.82, tipRate: 0.02, weight: 5 },
  { id: 'regular', label: 'regular', want: 1, tolerance: 1.00, tipRate: 0.05, weight: 6 },
  { id: 'comfort', label: 'comfort-seeking', want: 2, tolerance: 1.16, tipRate: 0.09, weight: 3 },
  { id: 'lavish', label: 'lavish', want: 3, tolerance: 1.42, tipRate: 0.16, weight: 1.4 },
];

export const START_CASH = 900;
export const START_ROOMS = 3;
export const START_REP = 2.0;
export const START_LINENS = 4;
export const BASE_LINENS = 4;

export const OFFLINE_CAP_HOURS = { base: 3, auditor: 10, manager: 24 };
// Nobody runs the place as tightly as you do; idling always trails active play.
export const OFFLINE_EFFICIENCY = { base: 0.75, manager: 0.92 };

// Stars are the shop window: they gate how many cars pull in off the road.
export function starLabel(rep) {
  const n = Math.round(rep * 2) / 2;
  return '★'.repeat(Math.floor(n)) + (n % 1 ? '½' : '') || '—';
}

export const MILESTONES = [
  { id: 'first', rooms: 0, text: 'You bought a motel. Three rooms, a bell, and a mop.' },
  { id: 'six', rooms: 6, text: 'Six rooms. The sign finally earns its electricity.' },
  { id: 'twelve', rooms: 12, text: 'Twelve rooms across two floors. People call it a hotel now.' },
  { id: 'twentyfour', rooms: 24, text: 'Twenty-four rooms. There is a rhythm to the place.' },
  { id: 'full', rooms: 30, text: 'Thirty rooms, five floors, and a name people know.' },
];
