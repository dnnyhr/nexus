import * as THREE from 'three';
import { BAND, MAT } from './palette';
import { asModel, beacon, box, hatch, mesh, strut } from './kit';

// Greenhouse: a tunnel on a low plinth with a translucent roof held by structural ribs.
// Inside, two planter rows grow under hanging LED bars (as in ISS plant experiments).
// userData.plants holds each plant so the game can grow, wilt or harvest it.
// Footprint: 3 × 2 tiles (6 × 4 m).

const R = 1.75;
const LEN = 5.2;
const PLINTH = 0.35;

/** One plant: a few faceted leaf clumps. `growth` goes from 0 (seedling) to 1 (ready). */
export function plant(seed: number): THREE.Group {
  const g = new THREE.Group();
  const leaves = [
    [0, 0.12, 0, 0.2, MAT.plant],
    [0.09, 0.2, 0.05, 0.14, MAT.plantLight],
    [-0.08, 0.22, -0.05, 0.13, MAT.plantLight],
    [0.0, 0.3, 0.0, 0.11, MAT.plant],
  ] as const;
  leaves.forEach(([x, y, z, r, mat], i) => {
    const leaf = mesh(new THREE.OctahedronGeometry(r * 1.1, 0), mat, { pos: [x, y, z], scale: [1, 0.7, 1] });
    leaf.rotation.y = seed * 1.3 + i;
    g.add(leaf);
  });
  return g;
}

export function setPlantGrowth(p: THREE.Object3D, growth: number): void {
  const s = 0.25 + 0.75 * THREE.MathUtils.clamp(growth, 0, 1);
  p.scale.setScalar(s);
}

export function greenhouse(): THREE.Group {
  const g = new THREE.Group();

  // Plinth with the greenhouse band.
  g.add(box(LEN + 0.3, PLINTH, R * 2 + 0.3, MAT.hullShade, { pos: [0, PLINTH / 2, 0] }));
  g.add(box(LEN + 0.34, 0.12, R * 2 + 0.34, BAND.greenhouse, { pos: [0, PLINTH - 0.1, 0] }));

  // Translucent roof (half cylinder along X).
  g.add(mesh(new THREE.CylinderGeometry(R, R, LEN, 12, 1, true, -Math.PI / 2, Math.PI), MAT.greenhouseRoof, {
    pos: [0, PLINTH, 0],
    rot: [0, 0, Math.PI / 2],
  }));

  // Ribs every ~1.3 m, including both ends.
  const ribs = 5;
  for (let i = 0; i < ribs; i++) {
    const x = -LEN / 2 + (i * LEN) / (ribs - 1);
    g.add(mesh(new THREE.TorusGeometry(R, 0.07, 4, 12, Math.PI), MAT.hull, { pos: [x, PLINTH, 0], rot: [0, Math.PI / 2, 0] }));
  }
  g.add(strut([-LEN / 2, PLINTH + R, 0], [LEN / 2, PLINTH + R, 0], 0.05, MAT.hull));

  // End walls (opaque, semicircular) and the door on the +X end.
  for (const side of [-1, 1]) {
    const wall = mesh(new THREE.CircleGeometry(R - 0.02, 12, 0, Math.PI), MAT.hullDouble, {
      pos: [side * (LEN / 2), PLINTH, 0],
      rot: [0, side * (Math.PI / 2), 0],
    });
    g.add(wall);
  }
  const door = hatch(0.9, 1.6);
  door.position.set(LEN / 2 + 0.02, PLINTH, 0);
  door.rotation.y = Math.PI / 2;
  g.add(door);

  // Planter rows with plants, and LED bars hanging above each row.
  const plants: THREE.Object3D[] = [];
  for (const z of [-0.75, 0.75]) {
    g.add(box(LEN - 0.6, 0.3, 0.6, MAT.hullShade, { pos: [0, PLINTH + 0.15, z] }));
    g.add(box(LEN - 0.7, 0.04, 0.5, MAT.regolithDark, { pos: [0, PLINTH + 0.31, z] }));
    for (let i = 0; i < 6; i++) {
      const p = plant(i + (z > 0 ? 6 : 0));
      p.position.set(-LEN / 2 + 0.75 + i * ((LEN - 1.5) / 5), PLINTH + 0.32, z);
      g.add(p);
      plants.push(p);
    }
    g.add(box(LEN - 0.8, 0.05, 0.14, MAT.ledGrow, { pos: [0, PLINTH + 1.3, z] }));
    for (const x of [-1.6, 1.6]) g.add(strut([x, PLINTH + 1.3, z], [x, PLINTH + R * 0.92, z * 0.55], 0.015, MAT.darkMetal));
  }

  // Water tank on the -X end.
  g.add(mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.1, 8), MAT.hull, { pos: [-LEN / 2 - 0.5, 0.7, -1.0] }));
  g.add(mesh(new THREE.CylinderGeometry(0.47, 0.47, 0.12, 8), BAND.greenhouse, { pos: [-LEN / 2 - 0.5, 0.95, -1.0] }));
  g.add(strut([-LEN / 2 - 0.5, 0.3, -0.6], [-LEN / 2, 0.3, -0.6], 0.04, MAT.darkMetal));

  const b = beacon(0.3);
  b.position.set(LEN / 2 - 0.2, PLINTH + R - 0.05, 0);
  g.add(b);

  g.userData.plants = plants;
  return asModel(g, 'greenhouse', 3, 2);
}
