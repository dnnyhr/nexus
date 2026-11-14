import * as THREE from 'three';
import { BAND, MAT } from './palette';
import { asModel, beacon, box, hatch, mesh, strut, windowPane } from './kit';

// The greenhouse grows in 5 levels:
//   1. One short tunnel with two planter rows (first crops).
//   2. A longer tunnel, more plants, a second water tank.
//   3. Two parallel tunnels joined by a service module (nutrients, controls, door).
//   4. + Vertical farming tower: stacked glass rings of plants around an LED core.
//   5. + Geodesic biodome with dwarf trees, connected to the tunnels.
// userData.plants holds every plant so the game can grow, wilt or harvest them.

const R = 1.75;
const PLINTH = 0.35;

/** One plant: a few faceted leaf clumps. Scale it with setPlantGrowth(). */
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
  p.scale.setScalar(0.25 + 0.75 * THREE.MathUtils.clamp(growth, 0, 1));
}

/** Dwarf tree for the biodome: faceted crown on a short trunk. */
function tree(seed: number): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.08, 0.12, 1.0, 6), MAT.structure, { pos: [0, 0.5, 0] }));
  g.add(mesh(new THREE.IcosahedronGeometry(0.65, 0), MAT.plant, { pos: [0, 1.35, 0], rot: [seed, seed * 2, 0], scale: [1, 0.85, 1] }));
  g.add(mesh(new THREE.IcosahedronGeometry(0.4, 0), MAT.plantLight, { pos: [0.25, 1.75, 0.1], rot: [seed * 3, 0, seed] }));
  return g;
}

/** Growing tunnel along X: plinth, translucent roof, ribs, end walls, planter rows, LED bars. */
function tunnelHouse(length: number, plants: THREE.Object3D[], seedBase: number, door: boolean): THREE.Group {
  const g = new THREE.Group();
  g.add(box(length + 0.3, PLINTH, R * 2 + 0.3, MAT.hullShade, { pos: [0, PLINTH / 2, 0] }));
  g.add(box(length + 0.34, 0.12, R * 2 + 0.34, BAND.greenhouse, { pos: [0, PLINTH - 0.1, 0] }));
  g.add(mesh(new THREE.CylinderGeometry(R, R, length, 12, 1, true, -Math.PI / 2, Math.PI), MAT.greenhouseRoof, {
    pos: [0, PLINTH, 0],
    rot: [0, 0, Math.PI / 2],
  }));
  const ribs = Math.max(3, Math.round(length / 1.3) + 1);
  for (let i = 0; i < ribs; i++) {
    const x = -length / 2 + (i * length) / (ribs - 1);
    g.add(mesh(new THREE.TorusGeometry(R, 0.07, 4, 12, Math.PI), MAT.hull, { pos: [x, PLINTH, 0], rot: [0, Math.PI / 2, 0] }));
  }
  g.add(strut([-length / 2, PLINTH + R, 0], [length / 2, PLINTH + R, 0], 0.05, MAT.hull));
  for (const side of [-1, 1]) {
    g.add(mesh(new THREE.CircleGeometry(R - 0.02, 12, 0, Math.PI), MAT.hullDouble, {
      pos: [side * (length / 2), PLINTH, 0],
      rot: [0, side * (Math.PI / 2), 0],
    }));
  }
  if (door) {
    const d = hatch(0.9, 1.6);
    d.position.set(length / 2 + 0.02, PLINTH, 0);
    d.rotation.y = Math.PI / 2;
    g.add(d);
  }
  const perRow = Math.max(4, Math.round((length - 1.5) / 0.75) + 1);
  for (const z of [-0.75, 0.75]) {
    g.add(box(length - 0.6, 0.3, 0.6, MAT.hullShade, { pos: [0, PLINTH + 0.15, z] }));
    g.add(box(length - 0.7, 0.04, 0.5, MAT.regolithDark, { pos: [0, PLINTH + 0.31, z] }));
    for (let i = 0; i < perRow; i++) {
      const p = plant(seedBase + i + (z > 0 ? perRow : 0));
      p.position.set(-length / 2 + 0.75 + i * ((length - 1.5) / (perRow - 1)), PLINTH + 0.32, z);
      g.add(p);
      plants.push(p);
    }
    g.add(box(length - 0.8, 0.05, 0.14, MAT.ledGrow, { pos: [0, PLINTH + 1.3, z] }));
    for (const x of [-(length / 2 - 1), length / 2 - 1]) {
      g.add(strut([x, PLINTH + 1.3, z], [x, PLINTH + R * 0.92, z * 0.55], 0.015, MAT.darkMetal));
    }
  }
  return g;
}

function waterTank(): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.1, 8), MAT.hull, { pos: [0, 0.7, 0] }));
  g.add(mesh(new THREE.CylinderGeometry(0.47, 0.47, 0.12, 8), BAND.greenhouse, { pos: [0, 0.95, 0] }));
  g.add(mesh(new THREE.CylinderGeometry(0.3, 0.45, 0.15, 8), MAT.hullShade, { pos: [0, 1.32, 0] }));
  for (const [x, z] of [[0.3, 0.3], [-0.3, 0.3], [0, -0.4]] as const) g.add(strut([x, 0, z], [x * 0.7, 0.2, z * 0.7], 0.03));
  return g;
}

/** Service module joining the tunnel ends: controls, nutrient mixing and the main door. */
function serviceModule(depth: number): THREE.Group {
  const g = new THREE.Group();
  const w = 2.6;
  const h = 2.8;
  g.add(box(w + 0.2, PLINTH, depth + 0.2, MAT.hullShade, { pos: [0, PLINTH / 2, 0] }));
  g.add(box(w, h, depth, MAT.hull, { pos: [0, PLINTH + h / 2, 0] }));
  g.add(box(w + 0.1, 0.12, depth + 0.1, MAT.hullShade, { pos: [0, PLINTH + h + 0.06, 0] }));
  g.add(box(w + 0.04, 0.3, depth + 0.04, BAND.greenhouse, { pos: [0, PLINTH + h - 0.5, 0] }));
  const door = hatch(1.0, 1.9);
  door.position.set(w / 2 + 0.02, PLINTH, 0);
  door.rotation.y = Math.PI / 2;
  g.add(door);
  for (const z of [-depth / 2 + 0.9, depth / 2 - 0.9]) {
    const win = windowPane(0.7, 0.45);
    win.position.set(w / 2 + 0.03, PLINTH + 1.7, z);
    win.rotation.y = Math.PI / 2;
    g.add(win);
  }
  // Roof: small radiator and beacon.
  g.add(box(1.6, 0.05, depth * 0.5, MAT.hullShade, { pos: [0, PLINTH + h + 0.35, 0] }));
  for (const z of [-depth * 0.2, depth * 0.2]) g.add(strut([0, PLINTH + h + 0.1, z], [0, PLINTH + h + 0.33, z], 0.04));
  const b = beacon(0.3);
  b.position.set(w / 2 - 0.3, PLINTH + h + 0.12, depth / 2 - 0.3);
  g.add(b);
  return g;
}

/** Vertical farming tower: glass rings of plants stacked around an LED core. */
function farmTower(plants: THREE.Object3D[]): THREE.Group {
  const g = new THREE.Group();
  const r = 1.25;
  const tiers = 4;
  const tierH = 0.95;
  g.add(mesh(new THREE.CylinderGeometry(r + 0.2, r + 0.3, PLINTH, 12), MAT.hullShade, { pos: [0, PLINTH / 2, 0] }));
  g.add(mesh(new THREE.CylinderGeometry(r + 0.32, r + 0.32, 0.1, 12), BAND.greenhouse, { pos: [0, PLINTH - 0.05, 0] }));
  g.add(mesh(new THREE.CylinderGeometry(0.16, 0.16, tiers * tierH, 8), MAT.ledGrow, { pos: [0, PLINTH + (tiers * tierH) / 2, 0] }));
  for (let t = 0; t < tiers; t++) {
    const y = PLINTH + t * tierH + 0.1;
    g.add(mesh(new THREE.CylinderGeometry(r - 0.1, r - 0.1, 0.12, 12), MAT.hullShade, { pos: [0, y, 0] }));
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + t * 0.45;
      const p = plant(100 + t * 7 + i);
      p.position.set(Math.cos(a) * (r - 0.4), y + 0.06, Math.sin(a) * (r - 0.4));
      p.scale.setScalar(0.8);
      g.add(p);
      plants.push(p);
    }
  }
  g.add(mesh(new THREE.CylinderGeometry(r, r, tiers * tierH, 12, 1, true), MAT.greenhouseRoof, { pos: [0, PLINTH + (tiers * tierH) / 2, 0] }));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    g.add(strut([Math.cos(a) * r, PLINTH, Math.sin(a) * r], [Math.cos(a) * r, PLINTH + tiers * tierH, Math.sin(a) * r], 0.04, MAT.hull));
  }
  const topY = PLINTH + tiers * tierH;
  g.add(mesh(new THREE.CylinderGeometry(r + 0.1, r + 0.1, 0.15, 12), MAT.hull, { pos: [0, topY + 0.07, 0] }));
  g.add(mesh(new THREE.CylinderGeometry(0.5, r, 0.4, 12), MAT.hullShade, { pos: [0, topY + 0.35, 0] }));
  const b = beacon(0.3);
  b.position.y = topY + 0.55;
  g.add(b);
  return g;
}

/** Geodesic biodome: glass icosphere half with a frame on every edge, trees inside. */
function biodome(plants: THREE.Object3D[]): THREE.Group {
  const g = new THREE.Group();
  const r = 4.2;
  g.add(mesh(new THREE.CylinderGeometry(r + 0.15, r + 0.3, PLINTH, 12), MAT.hullShade, { pos: [0, PLINTH / 2, 0] }));
  g.add(mesh(new THREE.CylinderGeometry(r + 0.32, r + 0.32, 0.1, 12), BAND.greenhouse, { pos: [0, PLINTH - 0.05, 0] }));
  g.add(mesh(new THREE.CylinderGeometry(r - 0.2, r - 0.2, 0.06, 12), MAT.regolithDark, { pos: [0, PLINTH + 0.03, 0] }));

  // Glass: upper half of an icosphere.
  const ico = new THREE.IcosahedronGeometry(r, 1);
  const glass = mesh(ico, MAT.greenhouseRoof, { pos: [0, PLINTH, 0] });
  g.add(glass);
  // Frame: one thin strut per edge above the plinth.
  const edges = new THREE.EdgesGeometry(ico);
  const ep = edges.getAttribute('position');
  for (let i = 0; i < ep.count; i += 2) {
    const ay = ep.getY(i);
    const by = ep.getY(i + 1);
    if (ay < -0.2 && by < -0.2) continue;
    const a: [number, number, number] = [ep.getX(i), Math.max(ay, 0) + PLINTH, ep.getZ(i)];
    const b: [number, number, number] = [ep.getX(i + 1), Math.max(by, 0) + PLINTH, ep.getZ(i + 1)];
    g.add(mesh(edgeStrut(a, b), MAT.hull));
  }
  // Clip the glass below the plinth by squashing negative vertices to the plinth.
  const gp = ico.getAttribute('position');
  for (let i = 0; i < gp.count; i++) if (gp.getY(i) < 0) gp.setY(i, 0);
  ico.computeVertexNormals();

  // Trees and a ring of planters.
  const spots = [[0, 0], [-1.6, 1.1], [1.7, 0.9], [0.3, -1.8], [-1.2, -1.5]] as const;
  spots.forEach(([x, z], i) => {
    const t = tree(i + 1);
    t.position.set(x, PLINTH + 0.05, z);
    t.scale.setScalar(i === 0 ? 1.5 : 1.0);
    g.add(t);
  });
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const p = plant(200 + i);
    p.position.set(Math.cos(a) * (r - 1.0), PLINTH + 0.06, Math.sin(a) * (r - 1.0));
    g.add(p);
    plants.push(p);
  }
  const top = beacon(0.3);
  top.position.y = PLINTH + r - 0.05;
  g.add(top);
  return g;
}

/** Thin 4-sided open strut, for dense frames such as the geodesic dome. */
function edgeStrut(a: [number, number, number], b: [number, number, number]): THREE.BufferGeometry {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const geo = new THREE.CylinderGeometry(0.05, 0.05, va.distanceTo(vb), 4, 1, true);
  const m = new THREE.Matrix4().compose(
    va.clone().add(vb).multiplyScalar(0.5),
    new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize()),
    new THREE.Vector3(1, 1, 1),
  );
  geo.applyMatrix4(m);
  return geo;
}

/** Tunnel joining two points at plinth level (for the biodome link). */
function corridor(fromX: number, toX: number, z: number): THREE.Group {
  const g = new THREE.Group();
  const len = Math.abs(toX - fromX);
  const cx = (fromX + toX) / 2;
  g.add(box(len, PLINTH, 1.6, MAT.hullShade, { pos: [cx, PLINTH / 2, z] }));
  g.add(mesh(new THREE.CylinderGeometry(0.95, 0.95, len, 8, 1, true, -Math.PI / 2, Math.PI), MAT.hullDouble, {
    pos: [cx, PLINTH, z],
    rot: [0, 0, Math.PI / 2],
  }));
  for (const x of [fromX + 0.15, toX - 0.15]) {
    g.add(mesh(new THREE.TorusGeometry(0.98, 0.07, 4, 8, Math.PI), MAT.structure, { pos: [x, PLINTH, z], rot: [0, Math.PI / 2, 0] }));
  }
  return g;
}

export type GreenhouseLevel = 1 | 2 | 3 | 4 | 5;

export function greenhouse(level: GreenhouseLevel = 1): THREE.Group {
  const g = new THREE.Group();
  const plants: THREE.Object3D[] = [];

  if (level <= 2) {
    const len = level === 1 ? 5.2 : 7.8;
    g.add(tunnelHouse(len, plants, 0, true));
    const t1 = waterTank();
    t1.position.set(-len / 2 - 0.5, 0, -1.0);
    g.add(t1);
    g.add(strut([-len / 2 - 0.5, 0.3, -0.6], [-len / 2, 0.3, -0.6], 0.04, MAT.darkMetal));
    if (level === 2) {
      const t2 = waterTank();
      t2.position.set(-len / 2 - 0.5, 0, 1.0);
      g.add(t2);
    }
    const b = beacon(0.3);
    b.position.set(len / 2 - 0.2, PLINTH + R - 0.05, 0);
    g.add(b);
    g.userData.plants = plants;
    return asModel(g, `greenhouse-${level}`, level === 1 ? 3 : 4, 2);
  }

  // Level 3+: two tunnels joined by the service module at +X.
  const len = 6.5;
  const gap = 2.3;
  for (const z of [-gap, gap]) {
    const t = tunnelHouse(len, plants, z > 0 ? 20 : 0, false);
    t.position.z = z;
    g.add(t);
  }
  const depth = gap * 2 + R * 2 + 0.2;
  const svc = serviceModule(depth);
  svc.position.x = len / 2 + 1.3;
  g.add(svc);
  // Water tanks against the outer side of each tunnel's -X end.
  for (const z of [-gap - 1.55, gap + 1.55]) {
    const t = waterTank();
    t.position.set(-len / 2 - 0.7, 0, z);
    g.add(t);
  }

  if (level >= 4) {
    const tower = farmTower(plants);
    tower.position.set(len / 2 + 4.3, 0, -gap + 0.2);
    g.add(tower);
    g.add(corridor(len / 2 + 2.6, len / 2 + 3.05, -gap + 0.2));
  }

  if (level >= 5) {
    const dome = biodome(plants);
    const dx = -len / 2 - 2.6 - 4.2;
    dome.position.set(dx, 0, 0);
    g.add(dome);
    // One corridor from the dome to each tunnel's end wall.
    for (const z of [-gap, gap]) {
      const edge = dx + Math.sqrt(4.2 * 4.2 - z * z) - 0.3;
      g.add(corridor(edge, -len / 2, z));
    }
  }

  g.userData.plants = plants;
  const tiles = ([0, 0, 0, [6, 5], [7, 5], [12, 5]] as const)[level] as readonly [number, number];
  return asModel(g, `greenhouse-${level}`, tiles[0], tiles[1]);
}
