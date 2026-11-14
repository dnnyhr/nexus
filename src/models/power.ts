import * as THREE from 'three';
import { addAnimator, pokeAge } from './anim';
import { BAND, MAT, statusLight } from './palette';
import { asModel, beacon, box, cyl, foot, pad, strut, windowPane } from './kit';

// Solar mast: a tall vertical array that turns to follow the Sun, which at the lunar
// south pole always stays near the horizon (NASA studies vertical solar arrays for this).
// The panel group is exposed as userData.tracker so the game can rotate it.
// Footprint: 1 × 1 tile (2 × 2 m).
export function solarMast(): THREE.Group {
  const g = new THREE.Group();
  g.add(pad(0.85));
  const base = 0.16;
  const mastH = 7.4;

  // Electronics box at the foot with the power band.
  g.add(box(0.9, 0.7, 0.7, MAT.hull, { pos: [0, base + 0.35, 0] }));
  g.add(box(0.92, 0.14, 0.72, BAND.power, { pos: [0, base + 0.5, 0] }));
  g.add(cyl(0.13, 0.17, mastH, MAT.structure, { pos: [0, base + 0.7 + mastH / 2, 0] }));
  g.add(cyl(0.2, 0.2, 0.25, MAT.darkMetal, { pos: [0, base + 0.85, 0] }));

  // Tracker: panel that rotates around the mast.
  const tracker = new THREE.Group();
  tracker.userData.dynamic = true; // turns to follow the Sun
  tracker.position.y = base + 0.7;
  const w = 1.7;
  const h = 4.6;
  const cy = 3.9;
  tracker.add(box(w + 0.1, h + 0.1, 0.06, MAT.darkMetal, { pos: [0, cy, 0.2] }));
  tracker.add(box(w, h, 0.07, MAT.solarCell, { pos: [0, cy, 0.24] }));
  for (let i = 1; i < 6; i++) tracker.add(box(w - 0.04, 0.035, 0.03, MAT.structure, { pos: [0, cy - h / 2 + (i * h) / 6, 0.287] }));
  tracker.add(box(0.035, h - 0.04, 0.03, MAT.structure, { pos: [0, cy, 0.293] }));
  for (const y of [cy - 1.5, cy + 1.5]) tracker.add(box(0.12, 0.12, 0.22, MAT.darkMetal, { pos: [0, y, 0.08] }));
  g.add(tracker);

  const b = beacon(0.25);
  b.position.y = base + 0.7 + mastH;
  g.add(b);
  g.userData.tracker = tracker;

  // The panel follows the Sun (the game sets userData.sunAzimuth); without it, it drifts
  // slowly as the Sun crawls along the horizon. Poke: a full recalibration turn.
  addAnimator(g, (t) => {
    const target = (g.userData.sunAzimuth as number | undefined) ?? Math.sin(t * 0.05) * 0.6;
    const age = pokeAge(g, t);
    const spin = age < 1.6 ? (1 - Math.cos((age / 1.6) * Math.PI)) * Math.PI : 0;
    tracker.rotation.y = target + spin;
  });
  return asModel(g, 'solar-mast', 1, 1);
}

// Battery: insulated storage block on feet with cooling fins and a status window.
// Footprint: 1 × 1 tile.
export function battery(): THREE.Group {
  const g = new THREE.Group();
  const lift = 0.45;
  for (const [x, z] of [[-0.55, -0.45], [0.55, -0.45], [-0.55, 0.45], [0.55, 0.45]] as const) g.add(foot(x, z, lift + 0.05));
  g.add(box(1.4, 1.1, 1.1, MAT.hull, { pos: [0, lift + 0.55, 0] }));
  g.add(box(1.5, 0.1, 1.2, MAT.hullShade, { pos: [0, lift + 1.15, 0] }));
  g.add(box(1.42, 0.18, 1.12, BAND.power, { pos: [0, lift + 0.85, 0] }));
  // Cooling fins on the left and right sides; the front stays clear for the status window.
  for (let i = 0; i < 4; i++) {
    const z = -0.36 + i * 0.24;
    for (const side of [-1, 1]) g.add(box(0.18, 0.6, 0.06, MAT.hullShade, { pos: [side * 0.79, lift + 0.45, z] }));
  }
  const w = windowPane(0.5, 0.14);
  w.position.set(0, lift + 0.45, 0.56);
  g.add(w);
  // Charge meter: five lights under the window. userData.charge (0-1) comes from the game.
  const leds = Array.from({ length: 5 }, (_, i) => {
    const m = statusLight();
    g.add(box(0.07, 0.05, 0.02, m, { pos: [-0.2 + i * 0.1, lift + 0.3, 0.56] }));
    return m;
  });
  addAnimator(g, (t) => {
    const charge = (g.userData.charge as number | undefined) ?? 0.6 + Math.sin(t * 0.15) * 0.4;
    const lit = Math.ceil(charge * 5);
    const age = pokeAge(g, t);
    leds.forEach((m, i) => {
      // Poke: a chase sweep across the meter. Otherwise the top lit light blinks (charging).
      const chase = age < 1.2 ? (Math.floor(age * 10) % 5 === i ? 1 : 0.1) : -1;
      const on = i < lit ? (i === lit - 1 && t % 1 < 0.5 ? 0.4 : 1) : 0.05;
      m.emissiveIntensity = chase >= 0 ? chase : on;
    });
  });
  g.add(strut([0.5, lift + 0.2, 0.3], [0.7, 0.05, 0.9], 0.04, MAT.darkMetal));
  const b = beacon(0.2);
  b.position.set(0.5, lift + 1.2, -0.3);
  g.add(b);
  return asModel(g, 'battery', 1, 1);
}
