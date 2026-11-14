import * as THREE from 'three';
import { BAND, MAT } from './palette';
import { asModel, beacon, berm, box, foot, hullBand, mesh, strut, windowPane } from './kit';

// Habitat: horizontal cylindrical module on legs (as in NASA surface-habitat studies),
// with an airlock vestibule at the front and a regolith berm at the back that works as
// radiation shielding. The berm grows with the shielding level (0-3).
// Footprint: 4 × 3 tiles (8 × 6 m).

const R = 1.6; // hull radius
const L = 6.2; // hull length
const Y = 2.25; // hull axis height

export function habitat(shieldLevel = 1): THREE.Group {
  const g = new THREE.Group();

  // Hull with flattened end caps.
  g.add(mesh(new THREE.CylinderGeometry(R, R, L, 12, 1, true), MAT.hull, { pos: [0, Y, 0], rot: [0, 0, Math.PI / 2] }));
  for (const side of [-1, 1]) {
    const cap = mesh(new THREE.SphereGeometry(R, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), MAT.hullShade, {
      pos: [(side * L) / 2, Y, 0],
      rot: [0, 0, -side * (Math.PI / 2)],
      scale: [1, 0.42, 1],
    });
    g.add(cap);
  }

  // Structural rings and the function band (habitat = muted brick).
  for (const x of [-L / 2 + 0.25, -0.9, 0.9, L / 2 - 0.25]) g.add(hullBand(R, 0.14, x, Y, MAT.hullShade));
  g.add(hullBand(R, 0.36, 2.0, Y, BAND.habitat));

  // Cradles and legs.
  for (const x of [-2.1, 2.1]) {
    g.add(box(0.5, 0.35, 2.6, MAT.structure, { pos: [x, Y - R + 0.05, 0] }));
    g.add(foot(x, 1.05, Y - R - 0.1));
    g.add(foot(x, -1.05, Y - R - 0.1));
  }

  // Window row on the front, tilted to follow the hull curve.
  const a = 0.38;
  for (const x of [0.2, 1.1, 2.9]) {
    const w = windowPane(0.55, 0.42);
    w.position.set(x, Y + Math.sin(a) * (R + 0.02), Math.cos(a) * (R + 0.02));
    w.rotation.x = -a;
    g.add(w);
  }

  // Airlock vestibule with door and steps.
  const vx = -1.4;
  const vz = R + 0.2; // vestibule center
  const front = vz + 0.5;
  g.add(box(1.5, 2.25, 1.0, MAT.hullShade, { pos: [vx, 2.0, vz] }));
  g.add(box(1.62, 0.12, 1.12, MAT.hull, { pos: [vx, 3.16, vz] }));
  g.add(box(1.0, 1.75, 0.06, MAT.darkMetal, { pos: [vx, 1.98, front] }));
  g.add(box(0.86, 1.6, 0.06, MAT.hull, { pos: [vx, 1.98, front + 0.03] }));
  g.add(mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.04, 8), MAT.glass, { pos: [vx, 2.45, front + 0.07], rot: [Math.PI / 2, 0, 0] }));
  for (let i = 0; i < 4; i++) {
    g.add(box(1.0, 0.1, 0.26, MAT.structure, { pos: [vx, 0.95 - i * 0.24, front + 0.17 + i * 0.24] }));
  }
  for (const dx of [-0.55, 0.55]) g.add(strut([vx + dx, 1.0, front + 0.05], [vx + dx, 0.0, front + 1.05], 0.03));

  // Roof: radiator panel, antenna and beacon.
  g.add(box(2.2, 0.06, 1.1, MAT.hullShade, { pos: [-0.6, Y + R + 0.12, -0.2] }));
  g.add(strut([-1.5, Y + R - 0.05, -0.2], [-1.5, Y + R + 0.12, -0.2], 0.05));
  g.add(strut([0.3, Y + R - 0.05, -0.2], [0.3, Y + R + 0.12, -0.2], 0.05));
  g.add(strut([2.4, Y + R - 0.2, -0.3], [2.4, Y + R + 1.0, -0.3], 0.025));
  const b = beacon(0.3);
  b.position.set(-2.6, Y + R - 0.25, 0);
  g.add(b);

  // Regolith shielding berm against the back of the hull.
  if (shieldLevel > 0) {
    const h = 1.2 + shieldLevel * 0.7;
    const bm = berm(L + 0.6, h, 2.4, 11);
    bm.position.z = -R - 0.1;
    g.add(bm);
  }

  return asModel(g, 'habitat', 4, 3);
}
