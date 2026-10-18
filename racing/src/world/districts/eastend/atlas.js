// THE WORKS and EASTSIDE — where things are in the texture atlases (no DOM
// here: plans and builds both look tiles up; tex.js draws them). A tile
// grid atlas maps one wall bay to one tile; a named atlas maps a sign or a
// decal to its own rectangle (px, from the canvas's top-left).

/** Brick facade bays (THE WORKS): 8 × 8 tiles, each 4 m × 4 m. */
export const BRICK = { W: 1024, H: 1024, tw: 128, th: 128, mw: 4, mh: 4 };
// tile ids (row * 8 + col)
export const BK = {
  // upper storeys: segmental-arched steel sash windows
  win: 0, winLit: 1, winCool: 2, winBroken: 3, winBricked: 4, winBoarded: 5, win2: 6, winLit2: 7,
  // pairs of narrow round-arched windows, small windows, plain bays
  pair: 8, pairLit: 9, small: 10, smallLit: 11, oculus: 12, pilaster: 13, downpipe: 14, vent: 15,
  // ground floor
  rollup: 16, rollupOpen: 17, door: 18, barred: 19, barredLit: 20, carriage: 21, office: 22, plinth: 23,
  rollupTag: 24, rollupHalf: 25, archBricked: 26, barFront: 27, shutter: 28, steelDoor: 29, number: 30, fireDoor: 31,
  // hall bays two tiles tall (8 m): the id is the top tile, the one below it is the bottom
  hall: 32, hallLit: 33, hallCool: 34, hallBroken: 35, hallPier: 36, hallBlind: 37, hallLouvre: 38, hallDoor: 39,
  // parapets and plain wall
  cornice: 48, coping: 49, dentil: 50, nameBand: 51, plain: 52, anchors: 53, sooty: 54, plainLight: 55,
  // roof glazing (saw-tooth lights, monitor windows)
  glaze: 56, glazeLit: 57, glazeCool: 58, glazeBroken: 59, monitorLit: 60, monitor: 61, louvre: 62, metal: 63,
};

/** Corrugated cladding bays (warehouses): 8 × 2 tiles, each 5 m × 10 m, painted neutral (vertex-tinted). */
export const METAL = { W: 1024, H: 512, tw: 128, th: 256, mw: 5, mh: 10 };
export const MT = {
  plain: 0, plinth: 1, rollup: 2, rollupOpen: 3, dock: 4, dockOpen: 5, door: 6, office: 7,
  officeDark: 8, clerestory: 9, louvre: 10, rusty: 11, rollupHalf: 12, number: 13, hazard: 14, patched: 15,
};

/** Clapboard houses (EASTSIDE): 8 × 8 tiles, each 3 m × 3 m. */
export const HOUSE = { W: 1024, H: 1024, tw: 128, th: 128, mw: 3, mh: 3 };
export const HS = {
  // siding (neutral: vertex-tinted)
  plain: 0, win: 1, winLit: 2, winTV: 3, picture: 4, pictureLit: 5, small: 6, smallLit: 7,
  door: 8, doorLit: 9, garage: 10, garageWin: 11, garage2L: 12, garage2R: 13, vent: 14, shutters: 15,
  // brick (natural colour)
  bPlain: 16, bWin: 17, bWinLit: 18, bPicture: 19, bPictureLit: 20, bDoor: 21, bGarage: 22, bSmall: 23,
  // stone / stucco (natural light colour, tintable)
  sPlain: 24, sWin: 25, sWinLit: 26, sArch: 27, sArchLit: 28, sDoor: 29, sGarage: 30, sSmall: 31,
  // attic / dormer / gable
  dormer: 32, dormerLit: 33, gableVent: 34, shingleSide: 35, attic: 36, atticLit: 37, porchCeil: 38, lattice: 39,
  // school and church (brick)
  schoolWin: 40, schoolWinLit: 41, schoolDoor: 42, schoolPlain: 43, gym: 44, churchWin: 45, churchWinLit: 46, churchDoor: 47,
  // shop and plaza walls
  stuccoPlain: 48, stuccoTrim: 49, rearDoor: 50, rearPlain: 51, block: 52, blockVent: 53, trimBand: 54, white: 55,
};

/** Named rectangles: the works' signs, ghost signs, graffiti (px in a 1024 × 1024 canvas). */
export const WSIGN = {
  W: 1024, H: 1024,
  rivet: [0, 0, 512, 128],          // THE RIVET (bar, red neon)
  body: [512, 0, 512, 128],         // body shop neon
  ghostIron: [0, 128, 512, 192],    // painted on brick: HALCYON IRON WORKS
  ghostCold: [512, 128, 512, 192],  // COLD STORAGE
  power: [0, 320, 512, 96],         // HALCYON POWER & LIGHT (stone band)
  salvage: [512, 320, 512, 96],     // scrapyard board
  tires: [0, 416, 256, 96],         // TIRES 24 HR (lit box)
  liquor: [256, 416, 256, 96],      // LIQUOR (lit box)
  xing: [512, 416, 128, 128],       // railroad crossbuck
  danger: [640, 416, 128, 128],     // DANGER / KEEP OUT
  stack: [768, 416, 64, 384],       // FOUNDRY, down a chimney
  belt: [832, 416, 192, 96],        // PORT HALCYON BELT RY (girder plate)
  ghostSoap: [832, 512, 192, 128],  // small ghost sign
  noentry: [832, 640, 192, 96],     // PRIVATE PROPERTY board
  parts: [0, 512, 384, 96],         // AUTO PARTS (lit box)
  open: [384, 512, 128, 96],        // OPEN (neon)
  yard: [0, 608, 384, 96],          // PORT RAIL YARD
  lowline: [384, 608, 384, 96],     // LOW LINE (painted on the girder)
  bulb: [832, 736, 192, 64],        // a row of bare bulbs (warm)
  graffiti: [0, 800, 1024, 224],    // a long wall of pieces (concrete behind)
  graffiti2: [0, 704, 768, 96],     // tags and throw-ups (a strip)
};

/** Named rectangles: Eastside's stores, signs and lettering (1024 × 1024). */
export const ESIGN = {
  W: 1024, H: 1024,
  // strip mall storefronts: each 6 m wide × 4.5 m (128 × 96 px), row of 8 (two rows)
  store0: [0, 0, 128, 96],
  dinerSign: [0, 192, 512, 128],    // STARLITE DINER (neon script)
  bowl: [512, 192, 256, 256],       // BOWL-O-RAMA (pin)
  gas: [768, 192, 256, 128],        // gas station sign (prices)
  plaza: [768, 320, 256, 128],      // EASTGATE PLAZA pylon
  water: [0, 320, 512, 96],         // EASTSIDE (on the water tower)
  school: [0, 416, 512, 64],        // EASTSIDE HIGH SCHOOL (letters on brick)
  scoreboard: [0, 480, 256, 128],   // HOME / GUEST
  burger: [256, 480, 256, 128],     // BURGER BARN
  motel: [512, 448, 256, 160],      // MOTEL / VACANCY
  church: [768, 448, 256, 96],      // church board
  canopy: [768, 544, 256, 64],      // gas canopy fascia
  dealer: [0, 608, 512, 96],        // dealer banner
  menu: [512, 608, 256, 128],       // drive-thru menu board
  driveIn: [768, 608, 256, 128],    // THE STARLITE DRIVE-IN (marquee)
  foodtown: [0, 704, 512, 96],      // FOODTOWN
  mascot: [512, 736, 256, 128],     // EAGLES (school mascot)
  screen: [768, 736, 256, 128],     // the drive-in screen's picture
  stripe: [0, 800, 512, 64],        // red/white band (canopies)
  pool: [512, 864, 256, 160],       // pool water
  house: [768, 864, 256, 160],      // mailbox / house numbers / misc
  flag: [0, 864, 512, 160],         // bunting and flags
};

/** UV rect [u0, v0, u1, v1] of grid tile `id` (sub-rect fx0..fx1 × fy0..fy1 of it, from its bottom-left). */
export function tileUV(A, id, fx0 = 0, fy0 = 0, fx1 = 1, fy1 = 1) {
  const cols = A.W / A.tw;
  const c = id % cols, r = Math.floor(id / cols);
  const x0 = c * A.tw + 0.75, x1 = (c + 1) * A.tw - 0.75;
  const yb = (r + 1) * A.th - 0.75, yt = r * A.th + 0.75;      // canvas px (bottom, top)
  const px0 = x0 + (x1 - x0) * fx0, px1 = x0 + (x1 - x0) * fx1;
  const pyb = yb - (yb - yt) * fy0, pyt = yb - (yb - yt) * fy1;
  return [px0 / A.W, 1 - pyb / A.H, px1 / A.W, 1 - pyt / A.H];
}

/** UV rect of a named rectangle (sub-rect fx0..fx1 × fy0..fy1 from its bottom-left). */
export function rectUV(A, name, fx0 = 0, fy0 = 0, fx1 = 1, fy1 = 1) {
  const [x, y, w, h] = A[name];
  const x0 = x + 0.5, x1 = x + w - 0.5, yb = y + h - 0.5, yt = y + 0.5;
  const px0 = x0 + (x1 - x0) * fx0, px1 = x0 + (x1 - x0) * fx1;
  const pyb = yb - (yb - yt) * fy0, pyt = yb - (yb - yt) * fy1;
  return [px0 / A.W, 1 - pyb / A.H, px1 / A.W, 1 - pyt / A.H];
}

/** Store front k (0..15) of the strip-mall row (Eastside sign atlas). */
export function storeUV(k) {
  const x = (k % 8) * 128, y = Math.floor(k / 8) * 96;
  const x0 = x + 0.5, x1 = x + 127.5, yb = y + 95.5, yt = y + 0.5;
  return [x0 / ESIGN.W, 1 - yb / ESIGN.H, x1 / ESIGN.W, 1 - yt / ESIGN.H];
}
