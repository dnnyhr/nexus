import * as THREE from 'three';
import { addAnimator, joint, pokeAge } from './anim';
import { BAND, MAT } from './palette';
import { asModel, beacon, berm, box, dish, dome, foot, hullBand, mesh, ringBand, rock, strut, windowPane } from './kit';

// The station grows in 5 levels around a central node, like a real modular outpost:
//   1. Core module with airlock (the first habitat that lands).
//   2. + Connecting node with a small observation cupola.
//   3. + Crew quarters module behind the node, roof handrails.
//   4. + Laboratory module with radiator wings, the cupola becomes an observation tower,
//        solar blankets on the roofs.
//   5. + Large inflatable habitat with a regolith skirt, floodlight masts, comms mast.
// Every horizontal module is the same kit piece (hullModule), so the station stays coherent.
// The regolith berms are radiation shielding and grow with `shieldLevel` (0-3).

const R = 1.6; // module radius
const Y = 2.25; // module axis height
const CAP = R * 0.42; // depth of the flattened end caps

export type StationLevel = 1 | 2 | 3 | 4 | 5;

interface ModuleOptions {
  length: number;
  band: THREE.Material;
  bandAt: number;
  windows: number[];
  roof?: 'radiator' | 'solar' | 'none';
  rails?: boolean;
  shield?: number;
}

/** Horizontal pressurized module along local X; front (windows) faces +Z, berm on -Z. */
function hullModule(o: ModuleOptions): THREE.Group {
  const g = new THREE.Group();
  const L = o.length;
  g.add(mesh(new THREE.CylinderGeometry(R, R, L, 12, 1, true), MAT.hull, { pos: [0, Y, 0], rot: [0, 0, Math.PI / 2] }));
  for (const side of [-1, 1]) {
    g.add(mesh(new THREE.SphereGeometry(R, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), MAT.hullShade, {
      pos: [(side * L) / 2, Y, 0],
      rot: [0, 0, -side * (Math.PI / 2)],
      scale: [1, 0.42, 1],
    }));
  }

  // Rings every ~1.8 m, plus the function band.
  const rings = Math.max(2, Math.round(L / 1.8));
  for (let i = 0; i <= rings; i++) {
    const x = -L / 2 + 0.25 + (i * (L - 0.5)) / rings;
    if (Math.abs(x - o.bandAt) > 0.4) g.add(hullBand(R, 0.14, x, Y, MAT.hullShade));
  }
  g.add(hullBand(R, 0.36, o.bandAt, Y, o.band));

  // Cradles and legs.
  const cx = L / 2 - 1.0;
  for (const x of [-cx, cx]) {
    g.add(box(0.5, 0.35, 2.6, MAT.structure, { pos: [x, Y - R + 0.05, 0] }));
    g.add(foot(x, 1.05, Y - R - 0.1));
    g.add(foot(x, -1.05, Y - R - 0.1));
  }

  // Windows following the hull curve.
  const a = 0.38;
  for (const x of o.windows) {
    const w = windowPane(0.55, 0.42);
    w.position.set(x, Y + Math.sin(a) * (R + 0.02), Math.cos(a) * (R + 0.02));
    w.rotation.x = -a;
    g.add(w);
  }

  // Roof equipment.
  const top = Y + R;
  if (o.roof === 'radiator') {
    g.add(box(Math.min(2.4, L - 1.6), 0.06, 1.1, MAT.hullShade, { pos: [0, top + 0.12, -0.2] }));
    for (const x of [-0.8, 0.8]) g.add(strut([x, top - 0.05, -0.2], [x, top + 0.12, -0.2], 0.05));
  } else if (o.roof === 'solar') {
    // Flexible solar blanket on a low frame.
    g.add(box(L - 1.4, 0.05, 1.5, MAT.solarCell, { pos: [0, top + 0.18, -0.15] }));
    g.add(box(L - 1.3, 0.04, 0.06, MAT.structure, { pos: [0, top + 0.2, 0.62] }));
    g.add(box(L - 1.3, 0.04, 0.06, MAT.structure, { pos: [0, top + 0.2, -0.92] }));
    for (const x of [-(L - 1.6) / 2, 0, (L - 1.6) / 2]) g.add(strut([x, top - 0.08, -0.15], [x, top + 0.16, -0.15], 0.04));
  }

  // Handrails along the roof (EVA maintenance).
  if (o.rails) {
    for (const z of [0.75, -0.75]) {
      const y = Y + Math.sqrt(R * R - z * z) + 0.18;
      g.add(strut([-L / 2 + 0.4, y, z], [L / 2 - 0.4, y, z], 0.025, MAT.structure));
      for (let x = -L / 2 + 0.5; x <= L / 2 - 0.4; x += 1.4) g.add(strut([x, y - 0.2, z], [x, y, z], 0.02, MAT.structure));
    }
  }

  // Shielding berm against the back.
  if (o.shield && o.shield > 0) {
    const h = 1.2 + o.shield * 0.7;
    const bm = berm(L + 0.6, h, 2.4, Math.round(L * 7));
    bm.position.z = -R - 0.1;
    g.add(bm);
  }
  return g;
}

/** Pressurized tunnel between two points at module height. */
function tunnel(from: [number, number], to: [number, number]): THREE.Group {
  const g = new THREE.Group();
  g.add(strut([from[0], Y, from[1]], [to[0], Y, to[1]], 0.78, MAT.hullShade));
  const mid: [number, number, number] = [(from[0] + to[0]) / 2, Y, (from[1] + to[1]) / 2];
  const ring = strut(
    [mid[0] - (to[0] - from[0]) * 0.08, Y, mid[2] - (to[1] - from[1]) * 0.08],
    [mid[0] + (to[0] - from[0]) * 0.08, Y, mid[2] + (to[1] - from[1]) * 0.08],
    0.86,
    MAT.darkMetal,
  );
  g.add(ring);
  return g;
}

/** Central node: octagonal drum with feet and docking flanges. */
function node(level: StationLevel): THREE.Group {
  const g = new THREE.Group();
  const h = 3.3;
  g.add(mesh(new THREE.CylinderGeometry(1.5, 1.5, h, 8), MAT.hull, { pos: [0, Y, 0], rot: [0, Math.PI / 8, 0] }));
  g.add(mesh(new THREE.CylinderGeometry(1.25, 1.5, 0.3, 8), MAT.hullShade, { pos: [0, Y + h / 2 + 0.15, 0], rot: [0, Math.PI / 8, 0] }));
  g.add(mesh(new THREE.CylinderGeometry(1.53, 1.53, 0.3, 8), BAND.habitat, { pos: [0, Y + 0.9, 0], rot: [0, Math.PI / 8, 0] }));
  for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) g.add(foot(x * 0.85, z * 0.85, Y - h / 2 + 0.05));
  const roofY = Y + h / 2 + 0.3;

  if (level <= 3) {
    // Small observation cupola: glass drum under a dome.
    g.add(mesh(new THREE.CylinderGeometry(0.75, 0.85, 0.45, 8), MAT.glass, { pos: [0, roofY + 0.22, 0], rot: [0, Math.PI / 8, 0] }));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.add(strut([Math.cos(a) * 0.82, roofY, Math.sin(a) * 0.82], [Math.cos(a) * 0.73, roofY + 0.45, Math.sin(a) * 0.73], 0.03, MAT.hull));
    }
    g.add(dome(0.78, MAT.hull, { pos: [0, roofY + 0.45, 0], scale: [1, 0.55, 1] }));
    g.userData.radar = radarArm(g, roofY + 0.88, 0.5);
  } else {
    // Observation tower: two glass bands, a gallery ring and a dome.
    g.add(cylAt(0.95, 1.1, 1.6, MAT.hull, roofY + 0.8));
    g.add(cylAt(1.0, 1.0, 0.5, MAT.glass, roofY + 1.2));
    g.add(cylAt(1.0, 1.0, 0.45, MAT.glass, roofY + 2.0));
    g.add(cylAt(1.35, 1.35, 0.1, MAT.structure, roofY + 1.6));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      g.add(strut([Math.cos(a) * 1.35, roofY + 1.6, Math.sin(a) * 1.35], [Math.cos(a) * 1.35, roofY + 2.0, Math.sin(a) * 1.35], 0.02));
    }
    g.add(cylAt(1.05, 1.05, 0.12, MAT.hullShade, roofY + 2.28));
    g.add(dome(1.0, MAT.hull, { pos: [0, roofY + 2.32, 0], scale: [1, 0.5, 1] }));
    const b = beacon(0.5);
    b.position.set(0.3, roofY + 2.62, 0);
    g.add(b);
    g.userData.radar = radarArm(g, roofY + 2.82, 0.8);
  }
  return g;
}

/** Small rotating sensor arm (survey radar) on a short post. */
function radarArm(parent: THREE.Object3D, y: number, span: number): THREE.Group {
  parent.add(mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.3, 8), MAT.structure, { pos: [0, y - 0.15, 0] }));
  const arm = joint(parent, 0, y, 0);
  arm.add(box(span, 0.05, 0.1, MAT.hullShade));
  arm.add(box(0.14, 0.12, 0.12, MAT.darkMetal, { pos: [span / 2 - 0.05, 0.04, 0] }));
  return arm;
}

function cylAt(rTop: number, rBottom: number, h: number, mat: THREE.Material, y: number): THREE.Mesh {
  return mesh(new THREE.CylinderGeometry(rTop, rBottom, h, 8), mat, { pos: [0, y, 0], rot: [0, Math.PI / 8, 0] });
}

/** Airlock vestibule with a hinged hatch and steps, facing +Z. userData.door swings open. */
function airlock(): THREE.Group {
  const g = new THREE.Group();
  const vz = R + 0.2;
  const front = vz + 0.5;
  g.add(box(1.5, 2.25, 1.0, MAT.hullShade, { pos: [0, 2.0, vz] }));
  g.add(box(1.62, 0.12, 1.12, MAT.hull, { pos: [0, 3.16, vz] }));
  g.add(box(1.0, 1.75, 0.06, MAT.darkMetal, { pos: [0, 1.98, front] }));
  // Hinge on the left edge of the frame.
  const door = joint(g, -0.43, 1.98, front + 0.03);
  door.add(box(0.86, 1.6, 0.06, MAT.hull, { pos: [0.43, 0, 0] }));
  door.add(mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.04, 8), MAT.glass, { pos: [0.43, 0.47, 0.04], rot: [Math.PI / 2, 0, 0] }));
  door.add(box(0.06, 0.3, 0.06, MAT.darkMetal, { pos: [0.75, -0.05, 0.05] }));
  for (const y of [-0.55, 0.55]) door.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.16, 8), MAT.darkMetal, { pos: [0, y, 0.02] }));
  // Lit interior seen when the door opens.
  g.add(box(0.8, 1.55, 0.01, MAT.glass, { pos: [0, 1.98, front + 0.035] }));
  g.userData.door = door;
  for (let i = 0; i < 4; i++) g.add(box(1.0, 0.1, 0.26, MAT.structure, { pos: [0, 0.95 - i * 0.24, front + 0.17 + i * 0.24] }));
  for (const dx of [-0.55, 0.55]) g.add(strut([dx, 1.0, front + 0.05], [dx, 0.0, front + 1.05], 0.03));
  return g;
}

/** Large inflatable habitat with strap bands, windows and a regolith skirt. */
function inflatable(): THREE.Group {
  const g = new THREE.Group();
  const r = 3.2;
  const cy = 2.3;
  g.add(mesh(new THREE.CylinderGeometry(r * 0.94, r, 0.35, 12), MAT.structure, { pos: [0, 0.18, 0] }));
  g.add(mesh(new THREE.SphereGeometry(r, 12, 8), MAT.hull, { pos: [0, cy, 0], scale: [1, 0.62, 1] }));
  for (const y of [-0.55, 0.0, 0.55]) {
    const rr = r * Math.sqrt(1 - (y / (r * 0.62)) ** 2) + 0.03;
    g.add(mesh(new THREE.TorusGeometry(rr, 0.07, 4, 24), y === 0 ? BAND.habitat : MAT.hullShade, {
      pos: [0, cy + y * 1.0, 0],
      rot: [Math.PI / 2, 0, 0],
    }));
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    const w = windowPane(0.6, 0.4);
    const rr = r * 0.97;
    w.position.set(Math.sin(a) * rr, cy + 0.28, Math.cos(a) * rr);
    w.rotation.set(-0.15, a, 0);
    g.add(w);
  }
  g.add(dome(0.6, MAT.hullShade, { pos: [0, cy + r * 0.62 - 0.05, 0], scale: [1, 0.4, 1] }));
  // Regolith skirt: a clean sloped ring of piled regolith with a few stones on top.
  g.add(mesh(new THREE.CylinderGeometry(r + 0.05, r + 0.75, 0.9, 12, 1, true), MAT.regolithPiled, { pos: [0, 0.45, 0] }));
  g.add(mesh(new THREE.RingGeometry(r - 0.3, r + 0.05, 12, 1), MAT.regolithPiled, { pos: [0, 0.9, 0], rot: [-Math.PI / 2, 0, 0] }));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.5;
    const k = rock(0.28, 40 + i, MAT.regolithPiled);
    k.position.set(Math.cos(a) * (r + 0.3), 0.85, Math.sin(a) * (r + 0.3));
    g.add(k);
  }
  return g;
}

/** Floodlight mast for the outer perimeter. */
function floodlight(): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.06, 0.09, 3.6, 8), MAT.structure, { pos: [0, 1.8, 0] }));
  g.add(box(0.7, 0.12, 0.12, MAT.darkMetal, { pos: [0, 3.55, 0] }));
  for (const x of [-0.25, 0.25]) g.add(box(0.22, 0.16, 0.14, MAT.lamp, { pos: [x, 3.45, 0.08], rot: [0.4, 0, 0] }));
  g.add(mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.08, 8), MAT.darkMetal, { pos: [0, 0.04, 0] }));
  return g;
}

/** Tall comms mast with a dish and whip antennas. */
function commsMast(): THREE.Group {
  const g = new THREE.Group();
  for (const a of [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3]) g.add(strut([Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5], [0, 5.2, 0], 0.04));
  for (const y of [1.6, 3.2]) g.add(ringBand(0.33 - y * 0.05, 0.05, y, MAT.structure));
  // Dish mounted on a short arm off the mast.
  const dishYaw = joint(g, 0, 4.6, 0);
  dishYaw.add(strut([0, 0, 0], [0, 0, 0.3], 0.035));
  const d = dish(0.55);
  d.position.z = 0.3;
  d.rotation.x = 1.25;
  dishYaw.add(d);
  g.userData.dish = dishYaw;
  g.add(strut([0, 5.45, 0], [0, 6.4, 0], 0.02));
  const b = beacon(0.15);
  b.position.y = 5.2;
  g.add(b);
  return g;
}

export function station(level: StationLevel = 1, shieldLevel = 1): THREE.Group {
  const g = new THREE.Group();
  const coreLen = 6.2;

  // 1. Core module with airlock.
  const core = hullModule({
    length: coreLen,
    band: BAND.habitat,
    bandAt: 2.0,
    windows: [0.2, 1.1, 2.9],
    roof: level >= 4 ? 'solar' : 'radiator',
    rails: level >= 3,
    shield: shieldLevel,
  });
  g.add(core);
  const lock = airlock();
  lock.position.x = -1.4;
  g.add(lock);
  const coreBeacon = beacon(0.3);
  coreBeacon.position.set(-2.6, Y + R - 0.25, 0.3);
  g.add(coreBeacon);
  // Poke the station: the airlock door slides open, waits and closes.
  const door = lock.userData.door as THREE.Group;
  const moving: { radar?: THREE.Group; wings?: THREE.Group[]; dish?: THREE.Group; whip?: THREE.Group } = {};
  addAnimator(g, (t) => {
    const age = pokeAge(g, t);
    const open = age < 3 ? Math.min(1, age / 0.6) * Math.min(1, (3 - age) / 0.6) : 0;
    door.rotation.y = -open * 1.7 * (open * (3 - 2 * open));
    if (moving.radar) moving.radar.rotation.y = t * 0.8;
    if (moving.dish) moving.dish.rotation.y = Math.sin(t * 0.15) * 0.8;
    if (moving.whip) moving.whip.rotation.z = Math.sin(t * 1.7) * 0.03;
    // Radiators turn slowly to stay edge-on to the Sun.
    moving.wings?.forEach((w) => (w.rotation.z = Math.sin(t * 0.08) * 0.5));
  });

  if (level === 1) {
    moving.whip = joint(g, 2.4, Y + R - 0.2, -0.3);
    moving.whip.add(strut([0, 0, 0], [0, 1.2, 0], 0.025));
    return asModel(g, 'station-1', 4, 3);
  }

  // 2. Node with cupola, joined to the core's +X end.
  const nx = coreLen / 2 + CAP + 1.75;
  g.add(tunnel([coreLen / 2, 0], [nx - 1.2, 0]));
  const n = node(level);
  n.position.x = nx;
  g.add(n);
  moving.radar = n.userData.radar as THREE.Group;

  // 3. Crew quarters behind the node (along -Z).
  if (level >= 3) {
    const len = 5.0;
    const crew = hullModule({
      length: len,
      band: BAND.habitat,
      bandAt: -1.2,
      windows: [0.3, 1.2],
      roof: level >= 4 ? 'solar' : 'radiator',
      rails: true,
      shield: shieldLevel,
    });
    crew.rotation.y = Math.PI / 2; // local +X -> world -Z, windows face +X
    const cz = -(1.3 + 0.5 + len / 2 + CAP);
    crew.position.set(nx, 0, cz);
    g.add(crew);
    g.add(tunnel([nx, -1.2], [nx, cz + len / 2]));
  }

  // 4. Laboratory beyond the node (+X) with radiator wings.
  if (level >= 4) {
    const len = 5.0;
    const lx = nx + 1.3 + 0.5 + len / 2 + CAP;
    const lab = hullModule({ length: len, band: BAND.industry, bandAt: 1.4, windows: [-0.8, 0.1], roof: 'solar', rails: true, shield: shieldLevel });
    lab.position.x = lx;
    g.add(lab);
    g.add(tunnel([nx + 1.2, 0], [lx - len / 2, 0]));
    // Radiator wings on a mast at the far end.
    const wx = lx + len / 2 - 0.4;
    g.add(strut([wx, Y + R - 0.1, 0], [wx, Y + R + 1.4, 0], 0.07));
    moving.wings = [-1, 1].map((side) => {
      const wing = joint(g, wx, Y + R + 1.3, 0);
      wing.add(strut([0, 0, 0], [0, 0, side * 4.05], 0.045));
      wing.add(box(1.5, 0.05, 3.2, MAT.hullShade, { pos: [0, 0, side * 2.3] }));
      for (const dz of [-1.0, 0, 1.0]) wing.add(box(1.52, 0.07, 0.05, MAT.structure, { pos: [0, 0, side * 2.3 + dz] }));
      return wing;
    });
  }

  // 5. Inflatable habitat in front of the node, floodlights and comms mast.
  if (level >= 5) {
    const iz = 1.3 + 0.7 + 3.2;
    const inf = inflatable();
    inf.position.set(nx, 0, iz);
    g.add(inf);
    g.add(tunnel([nx, 1.2], [nx, iz - 2.9]));
    for (const [x, z] of [[-4.6, 3.6], [nx + 5.6, 4.2], [-4.4, -3.4], [nx - 3.4, -8.6]] as const) {
      const f = floodlight();
      f.position.set(x, 0, z);
      f.rotation.y = Math.atan2(nx - x, iz * 0.3 - z);
      g.add(f);
    }
    const mast = commsMast();
    mast.position.set(nx + 5.4, 0, -4.2);
    g.add(mast);
    moving.dish = mast.userData.dish as THREE.Group;
  }

  const tiles = ([0, [4, 3], [6, 3], [6, 6], [9, 6], [9, 9]] as const)[level];
  return asModel(g, `station-${level}`, tiles[0], tiles[1]);
}

/** Kept for existing callers: the level-1 station. */
export function habitat(shieldLevel = 1): THREE.Group {
  return station(1, shieldLevel);
}
