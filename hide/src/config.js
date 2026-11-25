// Platform profiles. The build defines __MOBILE__; the URL can override it
// (?mobile / ?desktop) so either file can be tested in a desktop browser.
/* global __MOBILE__ */
const q = typeof location !== 'undefined' ? location.search : '';
const built = typeof __MOBILE__ !== 'undefined' ? __MOBILE__ : false;
export const MOBILE = /[?&]desktop/.test(q) ? false : /[?&]mobile/.test(q) ? true : built;
export const TOUCH = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
export const DEBUG = /[?&]debug/.test(q);

const desktop = {
  name: 'desktop',
  // ---- store layout (metres) ----
  layout: {
    width: 36,
    salesDepth: 28,
    stockDepth: 12,
    gondolas: 7,
    gondolaX0: 6.2,
    gondolaSpacing: 3.6,
    aisleZ0: 11,
    aisleZ1: 24,
    checkouts: 5,
    checkoutX0: 5.5,
    checkoutSpacing: 3.4,
    chestFreezers: true,
    staffRoom: true,
    stockDoors: [10, 26],
    produceTables: 3,
  },
  texSize: 1024,
  atlasSize: 2048,
  productDensity: 1,
  shadows: true,
  shadowSize: 2048,
  post: 'full',
  pixelRatioMax: 1.5,
  dust: 2600,
  fixtureLights: 4,
  coolerLights: 1,
  freezerLight: true,
  fog: 0.042,
  farPlane: 70,
  hrtf: true,
  secondsPerHour: 100,
  monster: { walk: 1.35, prowl: 2.3, run: 4.7, runPerHour: 0.14, sight: 15, hearing: 1 },
  breathSeconds: 10,
  comfortItems: 5,
  batterySpawns: 2,
  lanternMinutes: 2.6,
};

const mobile = {
  name: 'mobile',
  layout: {
    width: 24,
    salesDepth: 20,
    stockDepth: 9,
    gondolas: 4,
    gondolaX0: 5.6,
    gondolaSpacing: 3.6,
    aisleZ0: 9,
    aisleZ1: 16,
    checkouts: 3,
    checkoutZ0: 3.0,
    checkoutLen: 2.8,
    checkoutX0: 5,
    checkoutSpacing: 3.4,
    chestFreezers: false,
    staffRoom: false,
    stockDoors: [5, 17],
    produceTables: 2,
  },
  texSize: 512,
  atlasSize: 1024,
  productDensity: 0.55,
  shadows: false,
  shadowSize: 0,
  post: 'lite',
  pixelRatioMax: 1.25,
  dust: 0,
  fixtureLights: 2,
  coolerLights: 1,
  freezerLight: false,
  fog: 0.06,
  farPlane: 40,
  hrtf: false,
  secondsPerHour: 65,
  monster: { walk: 1.25, prowl: 2.1, run: 4.2, runPerHour: 0.1, sight: 12, hearing: 0.85 },
  breathSeconds: 11,
  comfortItems: 3,
  batterySpawns: 2,
  lanternMinutes: 2.2,
};

export const CFG = MOBILE ? mobile : desktop;
