import * as THREE from 'three';
import { BAND, MAT } from './palette';
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
  g.add(strut([0.5, lift + 0.2, 0.3], [0.7, 0.05, 0.9], 0.04, MAT.darkMetal));
  const b = beacon(0.2);
  b.position.set(0.5, lift + 1.2, -0.3);
  g.add(b);
  return asModel(g, 'battery', 1, 1);
}
