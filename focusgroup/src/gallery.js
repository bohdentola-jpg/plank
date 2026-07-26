// FOCUS GROUP — ?gallery
//
// A turntable of the week for the screenshot harness. Builds a set, hides the
// HUD, and orbits. Params:
//   ?gallery&set=flat|basement|studio   which one to look at
//   &day=1..6                           how dressed the flat is
//   &x=&z=&y=&r=&ang=                   where to put the camera
//   &spin=0.15                          radians a second
//   &cam=<lensId>                       sit on a hidden camera instead

import * as THREE from 'three';
import { buildFlat } from './apartment.js';
import { buildBasement } from './basement.js';
import { buildStudio } from './studio.js';
import { dayByNumber } from './story.js';

export function galleryMode(game) {
  const qs = new URLSearchParams(location.search);
  const num = (k, d) => (qs.has(k) ? parseFloat(qs.get(k)) : d);
  const which = qs.get('set') || 'flat';
  const dayN = Math.max(1, Math.min(6, num('day', 4)));
  const day = dayByNumber(dayN);

  game.state = 'gallery';
  game.showScreen('play');
  game.hud.setVisible(false);
  game.teardown();

  const dress = { ...day.dress, lenses: day.lenses };
  if (which === 'basement') game.world = buildBasement({});
  else if (which === 'studio') game.world = buildStudio(dress);
  else game.world = buildFlat(dress, day.light, dayN === 5 ? 'grey' : 'sodium');
  game.scene.add(game.world.group);
  if (which === 'studio') game.world.props.rigUp(1);

  const target = new THREE.Vector3(num('x', -1.6), num('y', 1.15), num('z', -1.1));
  const spot = qs.get('cam') ? game.world.camSpots.get(qs.get('cam')) : null;
  const radius = num('r', 3.2);
  const spin = num('spin', 0.15);
  let ang = num('ang', 0.7);

  game.tick = (dt) => {
    if (spot) {
      game.camera.position.copy(spot.pos);
      game.camera.lookAt(spot.look);
      game.camera.fov = spot.fov;
      game.camera.updateProjectionMatrix();
    } else {
      ang += spin * dt;
      game.camera.position.set(
        target.x + Math.sin(ang) * radius,
        target.y + num('h', 0.55),
        target.z + Math.cos(ang) * radius
      );
      game.camera.lookAt(target);
    }
    game.world.update(dt, game);
  };
  game.state = 'play';
  game.paused = false;
  game.day = day;
  game.dayIndex = dayN - 1;
  game.steps = [];
  game.warm = day.light || 0;

  window.__fg = { world: game.world, game };
}
