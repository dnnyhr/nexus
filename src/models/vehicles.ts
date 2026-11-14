import * as THREE from 'three';
import { BAND, MAT } from './palette';
import { asModel, beacon, box, cyl, mesh, strut, wheel } from './kit';

// Robots and the expedition rover. All vehicles face +Z (their front) and share the same
// wheel, chassis and sensor-mast language.

function wheels(g: THREE.Group, r: number, w: number, xs: number, zs: number[], y = r): void {
  for (const z of zs) {
    for (const side of [-1, 1]) {
      const wh = wheel(r, w);
      wh.position.set(side * xs, y, z);
      g.add(wh);
    }
  }
}

function sensorMast(height: number): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.035, 0.035, height, MAT.structure, { pos: [0, height / 2, 0] }));
  g.add(box(0.22, 0.12, 0.14, MAT.hullShade, { pos: [0, height + 0.06, 0.02] }));
  g.add(box(0.07, 0.07, 0.03, MAT.glass, { pos: [0.05, height + 0.06, 0.1] }));
  g.add(box(0.07, 0.07, 0.03, MAT.glass, { pos: [-0.05, height + 0.06, 0.1] }));
  return g;
}

/** Collector robot: digs regolith with a front bucket. Footprint 1 × 1 tile. */
export function collectorRobot(): THREE.Group {
  const g = new THREE.Group();
  wheels(g, 0.24, 0.16, 0.5, [-0.38, 0.38]);
  g.add(box(0.8, 0.32, 1.1, MAT.hull, { pos: [0, 0.48, 0] }));
  g.add(box(0.82, 0.1, 1.12, BAND.industry, { pos: [0, 0.42, 0] }));
  g.add(box(0.6, 0.04, 0.7, MAT.solarCell, { pos: [0, 0.66, -0.12] }));

  // Bucket on two arms.
  const bucket = new THREE.Group();
  bucket.add(box(0.78, 0.04, 0.36, MAT.structure, { pos: [0, 0, 0.18] }));
  bucket.add(box(0.78, 0.3, 0.04, MAT.structure, { pos: [0, 0.15, 0] }));
  for (const side of [-1, 1]) bucket.add(box(0.04, 0.26, 0.34, MAT.structure, { pos: [side * 0.37, 0.12, 0.17] }));
  bucket.position.set(0, 0.12, 0.72);
  g.add(bucket);
  for (const side of [-1, 1]) g.add(strut([side * 0.3, 0.5, 0.45], [side * 0.3, 0.3, 0.74], 0.03, MAT.darkMetal));

  const m = sensorMast(0.35);
  m.position.set(0.22, 0.64, 0.3);
  g.add(m);
  const b = beacon(0.12);
  b.position.set(-0.25, 0.64, 0.3);
  g.add(b);
  return asModel(g, 'collector-robot', 1, 1);
}

/** Harvester robot: small arm with a gripper and a basket for crops. Footprint 1 × 1 tile. */
export function harvesterRobot(): THREE.Group {
  const g = new THREE.Group();
  wheels(g, 0.17, 0.12, 0.36, [-0.28, 0.28]);
  g.add(box(0.56, 0.26, 0.8, MAT.hull, { pos: [0, 0.34, 0] }));
  g.add(box(0.58, 0.08, 0.82, BAND.greenhouse, { pos: [0, 0.29, 0] }));

  // Basket with harvested greens.
  g.add(box(0.46, 0.18, 0.36, MAT.hullShade, { pos: [0, 0.56, -0.18] }));
  g.add(mesh(new THREE.OctahedronGeometry(0.12, 0), MAT.plantLight, { pos: [-0.08, 0.66, -0.2], scale: [1, 0.6, 1] }));
  g.add(mesh(new THREE.OctahedronGeometry(0.1, 0), MAT.plant, { pos: [0.1, 0.66, -0.14], scale: [1, 0.6, 1] }));

  // Two-segment arm with gripper.
  const shoulder: [number, number, number] = [0, 0.5, 0.22];
  const elbow: [number, number, number] = [0, 0.95, 0.32];
  const wrist: [number, number, number] = [0, 0.72, 0.62];
  g.add(cyl(0.08, 0.08, 0.1, MAT.darkMetal, { pos: shoulder }));
  g.add(strut(shoulder, elbow, 0.04, MAT.structure));
  g.add(mesh(new THREE.SphereGeometry(0.06, 8, 4), MAT.darkMetal, { pos: elbow }));
  g.add(strut(elbow, wrist, 0.035, MAT.structure));
  for (const side of [-1, 1]) g.add(strut(wrist, [side * 0.06, 0.6, 0.68], 0.018, MAT.darkMetal));

  const m = sensorMast(0.18);
  m.position.set(0.18, 0.47, -0.36);
  g.add(m);
  return asModel(g, 'harvester-robot', 1, 1);
}

/** Expedition rover: open two-seat terrain vehicle with a high-gain antenna. 2 × 1 tiles. */
export function rover(): THREE.Group {
  const g = new THREE.Group();
  const wr = 0.42;
  wheels(g, wr, 0.26, 0.95, [-1.15, 1.15]);
  // Fenders.
  for (const z of [-1.15, 1.15]) {
    for (const side of [-1, 1]) {
      g.add(mesh(new THREE.CylinderGeometry(wr + 0.08, wr + 0.08, 0.32, 8, 1, true, 0, Math.PI), MAT.hullShade, {
        pos: [side * 0.95, wr, z],
        rot: [0, 0, Math.PI / 2],
      }));
    }
  }
  // Chassis frame and deck.
  g.add(box(1.5, 0.12, 3.0, MAT.structure, { pos: [0, 0.62, 0] }));
  g.add(box(1.4, 0.06, 2.4, MAT.hull, { pos: [0, 0.71, 0] }));
  g.add(box(1.42, 0.08, 0.5, BAND.industry, { pos: [0, 0.7, 1.35] }));
  for (const z of [-1.15, 1.15]) g.add(strut([-0.95, wr, z], [0.95, wr, z], 0.05, MAT.darkMetal));

  // Seats.
  for (const x of [-0.36, 0.36]) {
    g.add(box(0.5, 0.1, 0.5, MAT.hullShade, { pos: [x, 0.95, 0.1] }));
    g.add(box(0.5, 0.55, 0.08, MAT.hullShade, { pos: [x, 1.2, -0.17], rot: [-0.15, 0, 0] }));
    g.add(strut([x, 0.74, 0.1], [x, 0.9, 0.1], 0.04));
  }
  // Console and handles.
  g.add(box(0.9, 0.35, 0.2, MAT.hull, { pos: [0, 1.0, 0.75], rot: [0.5, 0, 0] }));
  g.add(box(0.5, 0.18, 0.03, MAT.glass, { pos: [0, 1.04, 0.86], rot: [0.5, 0, 0] }));
  // Cargo rack.
  g.add(box(1.2, 0.4, 0.7, MAT.hullShade, { pos: [0, 0.94, -0.95] }));
  g.add(box(1.24, 0.06, 0.74, MAT.structure, { pos: [0, 1.16, -0.95] }));
  // High-gain antenna.
  g.add(strut([0.55, 0.74, -0.55], [0.55, 1.9, -0.55], 0.03));
  const dish = mesh(new THREE.SphereGeometry(0.32, 12, 3, 0, Math.PI * 2, 0, 0.6), MAT.hullDouble, {
    pos: [0.55, 1.85, -0.55],
    rot: [-1.3, 0, 0],
  });
  g.add(dish);
  const b = beacon(0.2);
  b.position.set(-0.6, 0.74, -1.3);
  g.add(b);
  return asModel(g, 'rover', 2, 1);
}
