// Pockets and recipes: 9 hotbar + 27 backpack slots, stacking, tool wear,
// and list-style crafting (console Minecraft style: see the recipe, click it).
import { I, ITEMS, STACK_MAX, RECIPES, GROUPS } from './blocks.js';

export class Inventory {
  constructor() {
    this.slots = new Array(36).fill(null); // {id, n, uses?}
    this.sel = 0;
    this.onChange = null;
  }

  held() { return this.slots[this.sel]; }

  add(id, n = 1) {
    const max = STACK_MAX(id);
    const fresh = () => (ITEMS[id]?.tool ? { id, n: 1, uses: ITEMS[id].tool.uses } : { id, n: 0 });
    // top up existing stacks first, hotbar before backpack
    if (max > 1) {
      for (const s of this.slots) {
        if (!s || s.id !== id || s.n >= max) continue;
        const take = Math.min(n, max - s.n);
        s.n += take; n -= take;
        if (!n) { this.onChange?.(); return 0; }
      }
    }
    for (let i = 0; i < this.slots.length && n > 0; i++) {
      if (this.slots[i]) continue;
      const s = fresh();
      s.n = Math.min(n, max);
      n -= s.n;
      this.slots[i] = s;
    }
    this.onChange?.();
    return n; // leftover that didn't fit
  }

  countOf(id) {
    let c = 0;
    for (const s of this.slots) if (s && s.id === id) c += s.n;
    return c;
  }

  countOfAny(ids) { return ids.reduce((c, id) => c + this.countOf(id), 0); }

  remove(id, n) {
    for (let i = 0; i < this.slots.length && n > 0; i++) {
      const s = this.slots[i];
      if (!s || s.id !== id) continue;
      const take = Math.min(n, s.n);
      s.n -= take; n -= take;
      if (!s.n) this.slots[i] = null;
    }
    this.onChange?.();
    return n === 0;
  }

  removeAny(ids, n) { // drain a group (e.g. any log, any fuel)
    for (const id of ids) {
      const have = Math.min(this.countOf(id), n);
      if (have > 0) { this.remove(id, have); n -= have; }
      if (!n) return true;
    }
    return n === 0;
  }

  consumeHeld(n = 1) {
    const s = this.held();
    if (!s) return false;
    s.n -= n;
    if (s.n <= 0) this.slots[this.sel] = null;
    this.onChange?.();
    return true;
  }

  // a tool loses an edge; returns true the moment it shatters
  wearHeld() {
    const s = this.held();
    if (!s || s.uses === undefined) return false;
    if (--s.uses <= 0) { this.slots[this.sel] = null; this.onChange?.(); return true; }
    return false;
  }

  moveSlot(from, to) {
    const a = this.slots[from], b = this.slots[to];
    if (a && b && a.id === b.id && a.uses === undefined && b.uses === undefined) {
      const max = STACK_MAX(a.id);
      const take = Math.min(a.n, max - b.n);
      b.n += take; a.n -= take;
      if (!a.n) this.slots[from] = null;
    } else {
      this.slots[from] = b; this.slots[to] = a;
    }
    this.onChange?.();
  }

  serialize() { return this.slots.map((s) => (s ? [s.id, s.n, s.uses ?? -1] : 0)); }
  static restore(data) {
    const inv = new Inventory();
    if (Array.isArray(data)) {
      data.forEach((d, i) => {
        if (d && i < 36) inv.slots[i] = { id: d[0], n: d[1], ...(d[2] >= 0 ? { uses: d[2] } : {}) };
      });
    }
    return inv;
  }
}

// ------------------------------------------------------------ crafting
const expand = (need) => (typeof need === 'string' ? GROUPS[need] : [need]);

export function canCraft(recipe, inv) {
  return recipe.needs.every(([what, n]) => inv.countOfAny(expand(what)) >= n);
}

export function hasFuel(inv) { return inv.countOfAny(GROUPS.fuel) >= 1; }

// station: null | 'table' | 'furnace' — which recipe list is on offer
export function recipesFor(station) {
  return RECIPES.filter((r) => !r.station || r.station === station || (station === 'table' && !r.station));
}

export function doCraft(recipe, inv) {
  if (!canCraft(recipe, inv)) return false;
  if (recipe.station === 'furnace' && !hasFuel(inv)) return false;
  for (const [what, n] of recipe.needs) inv.removeAny(expand(what), n);
  if (recipe.station === 'furnace') inv.removeAny(GROUPS.fuel, 1);
  inv.add(recipe.out, recipe.count);
  return true;
}
