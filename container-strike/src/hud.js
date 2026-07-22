// DOM HUD: status bars, ammo, money, killfeed, radar, dynamic crosshair,
// buy menu, scoreboard, announcements, damage/flash overlays.
import { G } from './state.js';
import { WEAPONS, GRENADES, EQUIPMENT, buyableFor, computeInaccuracy, KNIFE } from './weapons.js';
import { fmtTime, clamp, DEG } from './util.js';

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor() {
    this.el = {
      hud: $('hud'), health: $('health-num'), healthBar: $('health-bar'),
      armor: $('armor-num'), armorBar: $('armor-bar'),
      ammoMag: $('ammo-mag'), ammoReserve: $('ammo-reserve'), weaponName: $('weapon-name'),
      money: $('money'), timer: $('round-timer'), scoreCT: $('score-ct'), scoreT: $('score-t'),
      roundNum: $('round-num'), killfeed: $('killfeed'), announce: $('announce'),
      subannounce: $('subannounce'), tip: $('tip'), crosshair: $('crosshair'),
      flash: $('flash-overlay'), damage: $('damage-overlay'), scope: $('scope-overlay'),
      hitdir: $('hitdir'), buyMenu: $('buy-menu'), buyGrid: $('buy-grid'), buyMoney: $('buy-money'),
      scoreboard: $('scoreboard'), sbCT: $('sb-ct'), sbT: $('sb-t'),
      pickup: $('pickup-hint'), pickupName: $('pickup-name'),
      spectate: $('spectate-hint'), specName: $('spec-name'),
      radar: $('radar'), belt: $('grenade-belt'),
      matchEnd: $('match-end'), matchResult: $('match-result'), matchScore: $('match-score'),
    };
    this.radarCtx = this.el.radar.getContext('2d');
    this.buyOpen = false;
    this.announceUntil = 0;
    this.damageT = 0;
    this.flashPeak = 0;
    this._radarBase = null;
    window.addEventListener('keydown', (e) => {
      if (!G.started || G.paused) return;
      if (e.code === 'KeyB') this.toggleBuy();
      if (e.code === 'Tab') this.showScoreboard(true);
      if (e.code === 'Escape' && this.buyOpen) this.toggleBuy(false);
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Tab') this.showScoreboard(false);
    });
  }

  show() { this.el.hud.style.display = 'block'; }
  hide() { this.el.hud.style.display = 'none'; }

  // ------------------------------------------------------------- status
  refreshAll() {
    const p = G.player;
    this.el.health.textContent = Math.max(0, Math.ceil(p.health));
    this.el.healthBar.style.width = clamp(p.health, 0, 100) + '%';
    this.el.armor.textContent = Math.ceil(p.armor) + (p.helmet ? '+' : '');
    this.el.armorBar.style.width = clamp(p.armor, 0, 100) + '%';
    this.el.money.textContent = '$' + p.money;
    this.el.scoreCT.textContent = G.game.scores.CT;
    this.el.scoreT.textContent = G.game.scores.T;
    this.el.roundNum.textContent = 'ROUND ' + G.game.round + ' — YOU ARE ' + (p.team === 'CT' ? 'CT' : 'T');
    this.refreshWeapon();
    this.refreshBelt();
    if (this.buyOpen) this.buildBuyMenu();
  }

  refreshWeapon() {
    const p = G.player;
    const w = p.currentWeapon();
    if (p.slot === 'knife') {
      this.el.weaponName.textContent = 'KNIFE';
      this.el.ammoMag.textContent = '—';
      this.el.ammoReserve.textContent = '';
    } else if (p.slot === 'grenade') {
      const gid = p.currentGrenadeId();
      this.el.weaponName.textContent = gid ? GRENADES[gid].name.toUpperCase() : '—';
      this.el.ammoMag.textContent = gid ? p.weapons.grenades[gid] : 0;
      this.el.ammoReserve.textContent = '';
    } else if (w) {
      this.el.weaponName.textContent = w.def.name.toUpperCase() + (p.reloadEnd > G.time ? ' · RELOADING' : '');
      this.el.ammoMag.textContent = w.ammo;
      this.el.ammoReserve.textContent = '/ ' + w.reserve;
    }
    this.refreshBelt();
  }

  refreshBelt() {
    const p = G.player;
    const parts = [];
    for (const [gid, n] of Object.entries(p.weapons.grenades)) {
      if (n <= 0) continue;
      const sel = p.slot === 'grenade' && p.currentGrenadeId() === gid;
      parts.push(`<div class="gr${sel ? ' sel' : ''}">${GRENADES[gid].name.split(' ')[0].toUpperCase()}${n > 1 ? ' ×' + n : ''}</div>`);
    }
    this.el.belt.innerHTML = parts.join('');
  }

  // ------------------------------------------------------------- events
  killfeed(attacker, victim, def, headshot) {
    const div = document.createElement('div');
    div.className = 'kf';
    const a = attacker ? `<span class="${attacker.team.toLowerCase()}">${attacker.name}</span>` : '';
    const wep = `<span class="wep">${def ? def.name : '?'}${headshot ? ' ⌖' : ''}</span>`;
    div.innerHTML = `${a}${wep}<span class="${victim.team.toLowerCase()}">${victim.name}</span>`;
    this.el.killfeed.appendChild(div);
    while (this.el.killfeed.children.length > 6) this.el.killfeed.removeChild(this.el.killfeed.firstChild);
    setTimeout(() => { if (div.parentNode) div.parentNode.removeChild(div); }, 7000);
  }

  announce(main, sub = '') {
    this.el.announce.textContent = main;
    this.el.subannounce.textContent = sub;
    this.el.announce.style.opacity = main ? 1 : 0;
    this.el.subannounce.style.opacity = sub ? 1 : 0;
    this.announceUntil = G.time + 3.2;
  }

  tip(text) { this.el.tip.textContent = text; this.el.tip.style.display = text ? 'block' : 'none'; this.tipUntil = G.time + 8; }

  onPlayerDamaged(dir, dmg) {
    this.damageT = Math.min(1, this.damageT + dmg / 60 + 0.25);
    this.refreshAll();
    if (dir) {
      // rotate the hit indicator toward the shot's origin direction
      const p = G.player;
      const fromYaw = Math.atan2(dir.x, dir.z);
      const rel = fromYaw - p.yaw;
      this.el.hitdir.style.opacity = 0.9;
      this.el.hitdir.style.transform = `rotate(${rel}rad) translateY(-70px)`;
      this._hitdirUntil = G.time + 0.6;
    }
  }

  flash(amount) {
    this.flashPeak = Math.max(this.flashPeak, amount);
  }

  setFlashOpacity(v) {
    this.el.flash.style.opacity = clamp(v, 0, 1);
  }

  showPickupHint(name) {
    this.el.pickup.style.display = name ? 'block' : 'none';
    if (name) this.el.pickupName.textContent = name.toUpperCase();
  }

  showMatchEnd(won, scores, team) {
    document.exitPointerLock && document.exitPointerLock();
    this.el.matchEnd.style.display = 'flex';
    this.el.matchResult.textContent = won ? 'VICTORY' : 'DEFEAT';
    this.el.matchResult.style.color = won ? '#8fd06a' : '#d06a5a';
    this.el.matchScore.textContent = `CT ${scores.CT} — ${scores.T} T   (you were ${team})`;
  }

  // ------------------------------------------------------------- buy menu
  toggleBuy(force) {
    const want = force !== undefined ? force : !this.buyOpen;
    if (want && (!G.player.alive || !G.game.buyAllowed(G.player))) { G.audio.ui('deny'); return; }
    this.buyOpen = want;
    this.el.buyMenu.style.display = want ? 'block' : 'none';
    if (want) {
      this.buildBuyMenu();
      document.exitPointerLock && document.exitPointerLock();
    } else if (G.started && !G.paused) {
      G.renderer.domElement.requestPointerLock();
    }
  }

  buildBuyMenu() {
    const p = G.player;
    this.el.buyMoney.textContent = '$' + p.money;
    const cats = buyableFor(p.team);
    let html = '';
    for (const cat of cats) {
      html += `<div class="buy-cat"><h2>${cat.title}</h2>`;
      for (const w of cat.items) {
        const afford = p.money >= w.price;
        html += `<div class="buy-item${afford ? '' : ' disabled'}" data-buy="w:${w.id}">
          <span>${w.name}</span><span class="price">$${w.price}</span></div>`;
      }
      html += '</div>';
    }
    html += '<div class="buy-cat"><h2>GEAR</h2>';
    const kev = p.money >= EQUIPMENT.kevlar.price && p.armor < 100;
    const helmCost = p.armor === 100 && !p.helmet ? EQUIPMENT.helmet.upgradePrice : EQUIPMENT.helmet.price;
    const helm = p.money >= helmCost && !(p.helmet && p.armor === 100);
    html += `<div class="buy-item${kev ? '' : ' disabled'}" data-buy="a:kevlar"><span>Kevlar Vest</span><span class="price">$${EQUIPMENT.kevlar.price}</span></div>`;
    html += `<div class="buy-item${helm ? '' : ' disabled'}" data-buy="a:helmet"><span>Kevlar + Helmet</span><span class="price">$${helmCost}</span></div>`;
    html += '</div>';
    html += '<div class="buy-cat"><h2>GRENADES</h2>';
    for (const [gid, g] of Object.entries(GRENADES)) {
      if (g.team && g.team !== p.team) continue;
      const owned = p.weapons.grenades[gid];
      const can = p.money >= g.price && owned < g.maxCarry;
      html += `<div class="buy-item${can ? '' : ' disabled'}${owned ? ' owned' : ''}" data-buy="g:${gid}">
        <span>${g.name}${owned ? ' ×' + owned : ''}</span><span class="price">$${g.price}</span></div>`;
    }
    html += '</div>';
    this.el.buyGrid.innerHTML = html;
    this.el.buyGrid.querySelectorAll('.buy-item').forEach((item) => {
      item.addEventListener('click', () => {
        const [kind, id] = item.dataset.buy.split(':');
        if (kind === 'w') G.game.buyWeapon(G.player, id);
        else if (kind === 'g') G.game.buyGrenade(G.player, id);
        else if (kind === 'a') G.game.buyArmor(G.player, id === 'helmet');
        this.buildBuyMenu();
        this.refreshAll();
      });
    });
  }

  // ------------------------------------------------------------- scoreboard
  showScoreboard(show) {
    this.el.scoreboard.style.display = show ? 'block' : 'none';
    if (!show) return;
    const rows = (team) => G.game.teamOf(team)
      .sort((a, b) => b.kills - a.kills)
      .map((e) => `<tr class="${e.alive ? '' : 'dead'}${e.isPlayer ? ' me' : ''}">
        <td>${e.name}${e.isPlayer ? ' (YOU)' : ''}</td><td>${e.kills}</td><td>${e.deaths}</td><td>$${e.money}</td></tr>`)
      .join('');
    this.el.sbCT.innerHTML = rows('CT');
    this.el.sbT.innerHTML = rows('T');
  }

  // ------------------------------------------------------------- radar
  _drawRadarBase() {
    const c = document.createElement('canvas');
    c.width = c.height = 176;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(10,12,8,0.9)';
    ctx.fillRect(0, 0, 176, 176);
    const b = G.world.bounds;
    const sx = 176 / (b.maxX - b.minX), sz = 176 / (b.maxZ - b.minZ);
    ctx.fillStyle = 'rgba(150,160,130,0.5)';
    for (const col of G.world.colliders) {
      if (col.material.name === 'ground' || col.max.y < 0.5) continue;
      ctx.fillRect((col.min.x - b.minX) * sx, (col.min.z - b.minZ) * sz,
        Math.max(1.5, (col.max.x - col.min.x) * sx), Math.max(1.5, (col.max.z - col.min.z) * sz));
    }
    this._radarBase = c;
  }

  drawRadar() {
    if (!G.world) return;
    if (!this._radarBase) this._drawRadarBase();
    const ctx = this.radarCtx;
    ctx.clearRect(0, 0, 176, 176);
    ctx.drawImage(this._radarBase, 0, 0);
    const b = G.world.bounds;
    const px = (x) => (x - b.minX) * 176 / (b.maxX - b.minX);
    const pz = (z) => (z - b.minZ) * 176 / (b.maxZ - b.minZ);
    const p = G.player;
    // teammates + self + spotted enemies
    for (const e of G.game.everyone()) {
      if (!e.alive) continue;
      const mine = e.team === p.team;
      let show = mine;
      if (!mine) {
        // enemies show if any teammate sees them (approx: recently fired or near a teammate LOS)
        show = G.time - e.lastShotTime < 2;
      }
      if (!show) continue;
      ctx.fillStyle = e.isPlayer ? '#e8f0d0' : mine ? (p.team === 'CT' ? '#5b8dd6' : '#d6a45b') : '#e05a4e';
      ctx.beginPath();
      ctx.arc(px(e.pos.x), pz(e.pos.z), e.isPlayer ? 4 : 3, 0, 7);
      ctx.fill();
      if (e.isPlayer) {
        ctx.strokeStyle = '#e8f0d0';
        ctx.beginPath();
        ctx.moveTo(px(e.pos.x), pz(e.pos.z));
        ctx.lineTo(px(e.pos.x - Math.sin(e.yaw) * 4), pz(e.pos.z - Math.cos(e.yaw) * 4));
        ctx.stroke();
      }
    }
    // decoy blips masquerade as enemy fire
    if (G.decoys) {
      for (const d of G.decoys) {
        if (d.fakeBlip && G.time - d.fakeBlip < 1 && d.owner.team !== p.team) {
          ctx.fillStyle = '#e05a4e';
          ctx.fillRect(px(d.pos.x) - 2, pz(d.pos.z) - 2, 4, 4);
        }
      }
    }
    // grenades in flight
    ctx.fillStyle = '#d8d8a0';
    for (const n of G.grenades.live) ctx.fillRect(px(n.pos.x) - 1, pz(n.pos.z) - 1, 2, 2);
    // smokes
    ctx.fillStyle = 'rgba(200,200,200,0.35)';
    for (const s of G.smokes) {
      ctx.beginPath();
      ctx.arc(px(s.center.x), pz(s.center.z), s.r * 176 / (b.maxX - b.minX), 0, 7);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,120,30,0.45)';
    for (const f of G.fires) {
      ctx.beginPath();
      ctx.arc(px(f.center.x), pz(f.center.z), f.r * 176 / (b.maxX - b.minX), 0, 7);
      ctx.fill();
    }
  }

  // ------------------------------------------------------------- frame
  update(dt) {
    const g = G.game;
    // timer
    const t = g.phase === 'freeze' ? g.timeLeft() : g.phase === 'live' ? g.timeLeft() : 0;
    this.el.timer.textContent = g.phase === 'end' ? '0:00' : fmtTime(t);
    this.el.timer.classList.toggle('low', g.phase === 'live' && t < 15);
    // announce fade
    if (G.time > this.announceUntil) {
      this.el.announce.style.opacity = 0;
      this.el.subannounce.style.opacity = 0;
    }
    if (this.tipUntil && G.time > this.tipUntil) this.tip('');
    // damage overlay decay
    this.damageT = Math.max(0, this.damageT - dt * 1.4);
    const lowHealth = G.player.alive && G.player.health <= 25 ? 0.35 : 0;
    this.el.damage.style.opacity = Math.min(1, this.damageT + lowHealth);
    if (this._hitdirUntil && G.time > this._hitdirUntil) this.el.hitdir.style.opacity = 0;
    // crosshair: gap tracks live inaccuracy; hidden when scoped or dead
    const p = G.player;
    const def = p.currentDef();
    const scopedHide = p.scoped && (def?.zoom || 0) >= 3;
    this.el.crosshair.style.display = p.alive && !scopedHide && G.started ? 'block' : 'none';
    this.el.scope.style.display = p.alive && scopedHide ? 'block' : 'none';
    if (p.alive && def && def.inacc) {
      const speed = Math.hypot(p.vel.x, p.vel.z);
      const inacc = computeInaccuracy(def, {
        speed, maxSpeed: def.moveSpeed, grounded: p.grounded, crouched: p.crouched,
        fireInacc: p.fireInacc, scoped: p.scoped,
      });
      const gap = 3 + inacc / DEG * 9;
      this.el.crosshair.style.setProperty('--gap', clamp(gap, 3, 60) + 'px');
    } else if (p.alive) {
      this.el.crosshair.style.setProperty('--gap', '5px');
    }
    // spectate hint
    const spec = !p.alive && p.spectating;
    this.el.spectate.style.display = !p.alive && G.started && g.phase !== 'warmup' ? 'block' : 'none';
    if (spec) this.el.specName.textContent = p.spectating.name;
    else if (!p.alive) this.el.specName.textContent = '—';
    this.drawRadar();
  }
}
