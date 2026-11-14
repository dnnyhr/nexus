import * as THREE from 'three';
import { addAnimator, approach, joint, setModes } from './anim';
import { BAND, MAT } from './palette';
import { asModel, beacon, box, dish as dishPart, mesh, rock, strut } from './kit';

// Robots and the expedition rover, with moving parts. All vehicles face +Z and share the
// same wheel, headlight and sensor-mast pieces. Modes: idle, drive, work.

// ---------------------------------------------------------------------------------------
// Shared parts

/** Wheel with tread blocks, rim and hub. Returns the group and its spin pivot (axis X). */
function wheel(r: number, w: number, spokes = 0): { group: THREE.Group; spin: THREE.Group } {
  const group = new THREE.Group();
  const spin = joint(group, 0, 0, 0);
  spin.add(mesh(new THREE.CylinderGeometry(r, r, w, 12), MAT.darkMetal, { rot: [0, 0, Math.PI / 2] }));
  // Tread blocks around the tire.
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    spin.add(box(w * 0.8, r * 0.16, r * 0.24, MAT.structure, {
      pos: [0, Math.cos(a) * (r + 0.01), Math.sin(a) * (r + 0.01)],
      rot: [a, 0, 0],
    }));
  }
  spin.add(mesh(new THREE.CylinderGeometry(r * 0.62, r * 0.62, w + 0.03, 12), MAT.hullShade, { rot: [0, 0, Math.PI / 2] }));
  spin.add(mesh(new THREE.CylinderGeometry(r * 0.25, r * 0.25, w + 0.07, 8), MAT.structure, { rot: [0, 0, Math.PI / 2] }));
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2;
    spin.add(box(w + 0.05, r * 0.5, r * 0.09, MAT.darkMetal, { pos: [0, Math.cos(a) * r * 0.4, Math.sin(a) * r * 0.4], rot: [a, 0, 0] }));
  }
  return { group, spin };
}

/** Pan-tilt camera head on a mast. Returns the group and the pan pivot. */
function sensorMast(height: number): { group: THREE.Group; pan: THREE.Group } {
  const group = new THREE.Group();
  group.add(mesh(new THREE.CylinderGeometry(0.03, 0.035, height, 8), MAT.structure, { pos: [0, height / 2, 0] }));
  const pan = joint(group, 0, height, 0);
  pan.add(box(0.24, 0.12, 0.14, MAT.hullShade, { pos: [0, 0.06, 0] }));
  pan.add(box(0.26, 0.03, 0.16, MAT.darkMetal, { pos: [0, 0.135, 0] }));
  for (const x of [-0.06, 0.06]) {
    pan.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.04, 8), MAT.darkMetal, { pos: [x, 0.06, 0.08], rot: [Math.PI / 2, 0, 0] }));
    pan.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.01, 8), MAT.glass, { pos: [x, 0.06, 0.103], rot: [Math.PI / 2, 0, 0] }));
  }
  return { group, pan };
}

/** Pair of headlights on a front face at height y, depth z. */
function headlights(g: THREE.Object3D, spread: number, y: number, z: number): void {
  for (const s of [-1, 1]) {
    g.add(box(0.12, 0.07, 0.04, MAT.darkMetal, { pos: [s * spread, y, z] }));
    g.add(box(0.09, 0.045, 0.02, MAT.lamp, { pos: [s * spread, y, z + 0.025] }));
  }
}

const ease = (x: number) => x * x * (3 - 2 * x);
/** Piecewise animation helper: value of a keyframed loop at phase 0..1. */
function keyframes(phase: number, keys: [number, number][]): number {
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, v0] = keys[i];
    const [t1, v1] = keys[i + 1];
    if (phase >= t0 && phase <= t1) return v0 + (v1 - v0) * ease((phase - t0) / Math.max(1e-6, t1 - t0));
  }
  return keys[keys.length - 1][1];
}

// ---------------------------------------------------------------------------------------
// Collector robot

/** Collector robot: four-wheel digger with a front bucket. Footprint 1 × 1 tile. */
export function collectorRobot(): THREE.Group {
  const g = new THREE.Group();
  const wheels: THREE.Group[] = [];
  for (const z of [-0.38, 0.38]) {
    for (const s of [-1, 1]) {
      const w = wheel(0.22, 0.14);
      w.group.position.set(s * 0.53, 0.22, z);
      g.add(w.group);
      wheels.push(w.spin);
    }
  }
  const body = joint(g, 0, 0, 0);
  // Rocker suspension beams.
  for (const s of [-1, 1]) {
    body.add(strut([s * 0.46, 0.22, -0.38], [s * 0.42, 0.42, 0], 0.035, MAT.darkMetal));
    body.add(strut([s * 0.46, 0.22, 0.38], [s * 0.42, 0.42, 0], 0.035, MAT.darkMetal));
    body.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.08, 8), MAT.structure, { pos: [s * 0.43, 0.42, 0], rot: [0, 0, Math.PI / 2] }));
  }
  body.add(box(0.86, 0.2, 1.16, MAT.structure, { pos: [0, 0.38, 0] }));
  body.add(box(0.78, 0.3, 0.9, MAT.hull, { pos: [0, 0.625, -0.04] }));
  body.add(box(0.8, 0.06, 0.92, BAND.industry, { pos: [0, 0.56, -0.04] }));
  // Side vents and the regolith hopper on the back.
  for (const s of [-1, 1]) for (const z of [-0.25, -0.1, 0.05]) body.add(box(0.01, 0.12, 0.06, MAT.darkMetal, { pos: [s * 0.396, 0.66, z] }));
  body.add(box(0.5, 0.16, 0.3, MAT.hullShade, { pos: [0, 0.86, -0.3] }));
  body.add(box(0.44, 0.02, 0.24, MAT.regolithPiled, { pos: [0, 0.94, -0.3] }));
  // Solar panel with frame.
  body.add(box(0.5, 0.03, 0.42, MAT.darkMetal, { pos: [0, 0.795, 0.16] }));
  body.add(box(0.46, 0.03, 0.38, MAT.solarCell, { pos: [0, 0.81, 0.16] }));
  headlights(body, 0.25, 0.62, 0.41);
  const mast = sensorMast(0.32);
  mast.group.position.set(0.28, 0.78, 0.32);
  body.add(mast.group);
  body.add(strut([-0.32, 0.78, -0.4], [-0.32, 1.25, -0.4], 0.008));
  const b = beacon(0.1);
  b.position.set(-0.32, 0.775, 0.36);
  body.add(b);

  // Bucket arm: pivot at the front of the chassis.
  const arm = joint(body, 0, 0.5, 0.5);
  for (const s of [-1, 1]) arm.add(box(0.05, 0.06, 0.42, MAT.darkMetal, { pos: [s * 0.3, -0.02, 0.2] }));
  arm.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.66, 8), MAT.structure, { pos: [0, 0, 0], rot: [0, 0, Math.PI / 2] }));
  const bucket = joint(arm, 0, -0.04, 0.42);
  bucket.add(box(0.76, 0.04, 0.34, MAT.structure, { pos: [0, -0.16, 0.14] }));
  bucket.add(box(0.72, 0.3, 0.04, MAT.structure, { pos: [0, -0.02, -0.02] }));
  for (const s of [-1, 1]) bucket.add(box(0.04, 0.27, 0.38, MAT.structure, { pos: [s * 0.4, -0.04, 0.14] }));
  for (let i = 0; i < 5; i++) bucket.add(box(0.05, 0.03, 0.08, MAT.darkMetal, { pos: [-0.3 + i * 0.15, -0.17, 0.33] }));
  const load = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const k = rock(0.1, i + 70, MAT.regolithPiled);
    k.position.set(-0.2 + i * 0.2, -0.1, 0.12);
    load.add(k);
  }
  bucket.add(load);

  setModes(g, ['idle', 'drive', 'work']);
  let speed = 0;
  addAnimator(g, (t, dt, mode) => {
    speed = approach(speed, mode === 'drive' ? 1 : 0, 3, dt);
    for (const w of wheels) w.rotation.x += speed * dt * 4;
    body.position.y = speed * Math.abs(Math.sin(t * 9)) * 0.015;
    mast.pan.rotation.y = Math.sin(t * 0.7) * (mode === 'work' ? 0.3 : 0.8);
    if (mode === 'work') {
      // Dig cycle: lower, scoop forward, lift with load, tip back.
      const ph = (t / 3.2) % 1;
      arm.rotation.x = keyframes(ph, [[0, -0.3], [0.25, 0.55], [0.45, 0.55], [0.7, -0.45], [1, -0.3]]);
      bucket.rotation.x = keyframes(ph, [[0, 0], [0.25, -0.2], [0.45, 0.6], [0.7, 0.4], [0.85, -0.5], [1, 0]]);
      load.visible = ph > 0.4 && ph < 0.85;
    } else {
      arm.rotation.x = approach(arm.rotation.x, -0.35, 4, dt);
      bucket.rotation.x = approach(bucket.rotation.x, 0.15, 4, dt);
      load.visible = false;
    }
  });
  return asModel(g, 'collector-robot', 1, 1);
}

// ---------------------------------------------------------------------------------------
// Harvester robot

/** Harvester robot: tracked base, turret, three-joint arm with gripper, crop basket. 1 × 1 tile. */
export function harvesterRobot(): THREE.Group {
  const g = new THREE.Group();
  const rollers: THREE.Mesh[] = [];
  // Tracks with end drums and road wheels.
  for (const s of [-1, 1]) {
    g.add(box(0.15, 0.16, 0.66, MAT.darkMetal, { pos: [s * 0.32, 0.12, 0] }));
    for (const z of [-0.33, 0.33]) g.add(mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.17, 8), MAT.darkMetal, { pos: [s * 0.32, 0.12, z], rot: [0, 0, Math.PI / 2] }));
    for (const z of [-0.2, 0, 0.2]) {
      const r = mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.17, 8), MAT.hullShade, { pos: [s * 0.32, 0.1, z], rot: [0, 0, Math.PI / 2] });
      g.add(r);
      rollers.push(r);
    }
    for (let i = 0; i < 6; i++) g.add(box(0.16, 0.02, 0.05, MAT.structure, { pos: [s * 0.32, 0.205, -0.27 + i * 0.11] }));
  }
  // Body and band.
  g.add(box(0.46, 0.24, 0.7, MAT.hull, { pos: [0, 0.34, 0] }));
  g.add(box(0.48, 0.05, 0.72, BAND.greenhouse, { pos: [0, 0.29, 0] }));
  headlights(g, 0.15, 0.36, 0.355);
  // Crop basket with greens.
  g.add(box(0.42, 0.18, 0.28, MAT.hullShade, { pos: [0, 0.55, -0.2] }));
  g.add(box(0.36, 0.02, 0.22, MAT.regolithDark, { pos: [0, 0.6, -0.2] }));
  for (const [x, z, r, m] of [[-0.1, -0.22, 0.09, MAT.plantLight], [0.08, -0.16, 0.08, MAT.plant], [0.04, -0.27, 0.07, MAT.plantLight]] as const) {
    g.add(mesh(new THREE.OctahedronGeometry(r, 0), m, { pos: [x, 0.66, z], scale: [1, 0.65, 1] }));
  }
  // Sensor head with an LED eye.
  const head = sensorMast(0.12);
  head.group.position.set(-0.13, 0.46, 0.22);
  g.add(head.group);

  // Turret and three-joint arm with a two-finger gripper.
  const turret = joint(g, 0.08, 0.46, 0.12);
  turret.add(mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.08, 8), MAT.structure, { pos: [0, 0.04, 0] }));
  const shoulder = joint(turret, 0, 0.1, 0);
  shoulder.add(mesh(new THREE.SphereGeometry(0.065, 8, 4), MAT.darkMetal));
  shoulder.add(box(0.07, 0.36, 0.07, MAT.hull, { pos: [0, 0.18, 0] }));
  const elbow = joint(shoulder, 0, 0.36, 0);
  elbow.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 8), MAT.darkMetal, { rot: [0, 0, Math.PI / 2] }));
  elbow.add(box(0.06, 0.06, 0.32, MAT.hull, { pos: [0, 0, 0.16] }));
  const wrist = joint(elbow, 0, 0, 0.32);
  wrist.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.06, 8), BAND.greenhouse, { rot: [Math.PI / 2, 0, 0] }));
  const fingers = [-1, 1].map((s) => {
    const f = joint(wrist, s * 0.03, 0, 0.03);
    f.add(box(0.015, 0.03, 0.09, MAT.darkMetal, { pos: [0, 0, 0.045] }));
    return f;
  });

  setModes(g, ['idle', 'drive', 'work']);
  let speed = 0;
  addAnimator(g, (t, dt, mode) => {
    speed = approach(speed, mode === 'drive' ? 1 : 0, 3, dt);
    for (const r of rollers) r.rotation.y += speed * dt * 6;
    head.pan.rotation.y = Math.sin(t * 0.9) * 0.6;
    if (mode === 'work') {
      // Reach to a plant in front, grip, lift, turn to the basket, release, come back.
      const ph = (t / 4) % 1;
      turret.rotation.y = keyframes(ph, [[0, 0], [0.35, 0], [0.55, Math.PI], [0.8, Math.PI], [1, 0]]);
      shoulder.rotation.x = keyframes(ph, [[0, 0.2], [0.15, 0.9], [0.3, 0.9], [0.4, 0.1], [0.6, 0.35], [0.75, 0.35], [1, 0.2]]);
      elbow.rotation.x = keyframes(ph, [[0, 0.3], [0.15, 0.6], [0.3, 0.6], [0.4, 0.1], [0.6, 0.7], [0.75, 0.7], [1, 0.3]]);
      const open = keyframes(ph, [[0, 0.35], [0.18, 0.35], [0.25, 0.02], [0.62, 0.02], [0.7, 0.35], [1, 0.35]]);
      fingers[0].rotation.y = -open;
      fingers[1].rotation.y = open;
    } else {
      turret.rotation.y = approach(turret.rotation.y, 0, 3, dt);
      shoulder.rotation.x = approach(shoulder.rotation.x, 0.1, 3, dt);
      elbow.rotation.x = approach(elbow.rotation.x, 0.9, 3, dt);
    }
  });
  return asModel(g, 'harvester-robot', 1, 1);
}

// ---------------------------------------------------------------------------------------
// Expedition rover

/** Expedition rover: open two-seat terrain vehicle with independent suspension. 2 × 1 tiles. */
export function rover(): THREE.Group {
  const g = new THREE.Group();
  const wr = 0.42;
  const track = 1.0;
  const axle = 1.15;
  const spins: THREE.Group[] = [];
  const steer: THREE.Group[] = [];

  // Wheels with steering knuckles (front), A-arms and dampers.
  for (const z of [-axle, axle]) {
    for (const s of [-1, 1]) {
      const knuckle = joint(g, s * track, wr, z);
      const w = wheel(wr, 0.26, 5);
      knuckle.add(w.group);
      spins.push(w.spin);
      if (z > 0) steer.push(knuckle);
      g.add(strut([s * 0.55, 0.62, z - 0.18], [s * (track - 0.16), wr + 0.08, z], 0.035, MAT.structure));
      g.add(strut([s * 0.55, 0.62, z + 0.18], [s * (track - 0.16), wr + 0.08, z], 0.035, MAT.structure));
      g.add(strut([s * 0.5, 0.48, z], [s * (track - 0.16), wr - 0.06, z], 0.03, MAT.structure));
      g.add(strut([s * 0.45, 0.95, z * 0.82], [s * (track - 0.2), wr + 0.12, z], 0.045, MAT.darkMetal));
    }
  }

  // Sprung body.
  const body = joint(g, 0, 0, 0);
  // Fenders.
  for (const z of [-axle, axle]) for (const s of [-1, 1]) {
    body.add(mesh(new THREE.CylinderGeometry(wr + 0.09, wr + 0.09, 0.34, 10, 1, true, -0.2, Math.PI * 0.75), MAT.hullShade, {
      pos: [s * track, wr, z], rot: [0, 0, Math.PI / 2],
    }));
  }
  // Tubular frame and deck.
  for (const s of [-1, 1]) body.add(strut([s * 0.6, 0.62, -1.55], [s * 0.6, 0.62, 1.55], 0.05, MAT.structure));
  for (const z of [-1.5, -0.6, 0.3, 1.5]) body.add(strut([-0.6, 0.62, z], [0.6, 0.62, z], 0.04, MAT.structure));
  body.add(box(1.3, 0.05, 2.3, MAT.hull, { pos: [0, 0.695, 0] }));
  body.add(box(1.32, 0.04, 0.42, BAND.industry, { pos: [0, 0.705, 1.3] }));
  // Bumpers.
  for (const z of [-1.62, 1.62]) body.add(box(1.25, 0.12, 0.1, MAT.darkMetal, { pos: [0, 0.6, z] }));
  // Light bar.
  body.add(box(1.0, 0.06, 0.06, MAT.structure, { pos: [0, 1.32, 1.05] }));
  for (const s of [-1, 1]) body.add(strut([s * 0.48, 0.72, 1.05], [s * 0.48, 1.3, 1.05], 0.025));
  for (const x of [-0.36, -0.12, 0.12, 0.36]) {
    body.add(box(0.16, 0.08, 0.06, MAT.darkMetal, { pos: [x, 1.32, 1.1] }));
    body.add(box(0.12, 0.05, 0.02, MAT.lamp, { pos: [x, 1.32, 1.138] }));
  }
  headlights(body, 0.45, 0.6, 1.68);

  // Seats with frames and harness straps.
  for (const x of [-0.34, 0.34]) {
    body.add(strut([x - 0.18, 0.72, 0.1], [x - 0.18, 0.9, 0.1], 0.025));
    body.add(strut([x + 0.18, 0.72, 0.1], [x + 0.18, 0.9, 0.1], 0.025));
    body.add(box(0.48, 0.08, 0.46, MAT.hullShade, { pos: [x, 0.94, 0.1] }));
    const back = joint(body, x, 0.98, -0.12);
    back.rotation.x = -0.18;
    back.add(box(0.48, 0.55, 0.07, MAT.hullShade, { pos: [0, 0.27, 0] }));
    back.add(box(0.06, 0.5, 0.02, BAND.industry, { pos: [-0.12, 0.25, 0.05] }));
    back.add(box(0.06, 0.5, 0.02, BAND.industry, { pos: [0.12, 0.25, 0.05] }));
  }
  // Console with screen and hand controller.
  const con = joint(body, 0, 1.0, 0.72);
  con.rotation.x = 0.5;
  con.add(box(0.9, 0.34, 0.16, MAT.hull));
  con.add(box(0.46, 0.18, 0.02, MAT.glass, { pos: [0, 0.03, 0.09] }));
  body.add(strut([0, 0.72, 0.62], [0, 0.95, 0.66], 0.04));
  // Hand controller on a pedestal between the seats.
  body.add(box(0.16, 0.28, 0.24, MAT.hullShade, { pos: [0, 0.86, 0.42] }));
  body.add(strut([0, 1.0, 0.45], [0, 1.12, 0.47], 0.018, MAT.darkMetal));
  body.add(mesh(new THREE.SphereGeometry(0.04, 8, 4), MAT.darkMetal, { pos: [0, 1.13, 0.47] }));

  // Rear cargo rack: sample boxes and a shovel.
  for (const s of [-1, 1]) body.add(strut([s * 0.6, 0.72, -1.5], [s * 0.6, 1.1, -1.5], 0.025));
  body.add(strut([-0.6, 1.1, -1.5], [0.6, 1.1, -1.5], 0.025));
  body.add(box(0.5, 0.3, 0.45, MAT.hullShade, { pos: [-0.3, 0.87, -1.05] }));
  body.add(box(0.36, 0.22, 0.4, MAT.hull, { pos: [0.3, 0.83, -1.05] }));
  body.add(strut([0.55, 0.78, -0.75], [0.55, 0.78, -1.45], 0.015, MAT.structure));
  body.add(box(0.12, 0.02, 0.16, MAT.darkMetal, { pos: [0.55, 0.78, -0.68] }));

  // High-gain antenna on a mast; the dish slowly tracks Earth.
  body.add(strut([0.5, 0.72, -0.6], [0.5, 1.95, -0.6], 0.03));
  const dish = joint(body, 0.5, 1.95, -0.6);
  const hga = dishPart(0.34);
  hga.rotation.x = 0.9;
  dish.add(hga);
  const cam = sensorMast(0.45);
  cam.group.position.set(-0.52, 0.72, 0.95);
  body.add(cam.group);
  const b = beacon(0.2);
  b.position.set(-0.55, 0.72, -1.4);
  body.add(b);

  setModes(g, ['idle', 'drive']);
  let speed = 0;
  addAnimator(g, (t, dt, mode) => {
    speed = approach(speed, mode === 'drive' ? 1 : 0, 2, dt);
    for (const w of spins) w.rotation.x += speed * dt * 5;
    const turn = Math.sin(t * 0.6) * 0.3 * speed;
    for (const k of steer) k.rotation.y = turn;
    body.position.y = speed * (Math.sin(t * 7) * 0.02 + Math.sin(t * 3.1) * 0.015);
    body.rotation.z = speed * Math.sin(t * 2.3) * 0.015;
    dish.rotation.y = Math.sin(t * 0.2) * 0.4;
    cam.pan.rotation.y = Math.sin(t * 0.8) * 0.7;
  });
  return asModel(g, 'rover', 2, 1);
}

