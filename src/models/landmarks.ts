import * as THREE from 'three';
import { addAnimator, joint, pokeAge } from './anim';
import { BAND, MAT } from './palette';
import { asModel, beacon, box, cyl, dish, mesh, pad, sphere, strut, windowPane } from './kit';

// Comms antenna and the lander the commander arrived in.

/** Comms antenna: dish aimed low at Earth, which sits near the horizon from the south pole. 1 × 1 tile. */
export function antenna(): THREE.Group {
  const g = new THREE.Group();
  g.add(pad(0.85));
  for (const a of [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3]) {
    g.add(strut([Math.cos(a) * 0.7, 0.16, Math.sin(a) * 0.7], [0, 1.9, 0], 0.04));
  }
  g.add(box(0.5, 0.4, 0.4, MAT.hull, { pos: [0, 0.36, 0] }));
  g.add(box(0.52, 0.1, 0.42, BAND.habitat, { pos: [0, 0.46, 0] }));
  g.add(cyl(0.1, 0.1, 0.3, MAT.darkMetal, { pos: [0, 2.0, 0] }));

  const yaw = new THREE.Group();
  yaw.position.set(0, 2.15, 0);
  g.add(yaw);
  const head = dish(1.0, 0.55);
  head.position.y = 0.08;
  head.rotation.x = 1.35; // aim ~12° above the horizon, towards +Z
  yaw.add(head);
  // Fine tracking jitter around Earth; poke: a full sweep to re-acquire the signal.
  addAnimator(g, (t) => {
    const age = pokeAge(g, t);
    const sweep = age < 2.2 ? (1 - Math.cos((age / 2.2) * Math.PI)) * Math.PI : 0;
    yaw.rotation.y = Math.sin(t * 0.3) * 0.06 + sweep;
    head.rotation.x = 1.35 + Math.sin(t * 0.23) * 0.03 - (age < 2.2 ? Math.sin((age / 2.2) * Math.PI) * 0.35 : 0);
  });
  const b = beacon(0.15);
  b.position.set(0.18, 0.56, 0.1);
  g.add(b);
  return asModel(g, 'antenna', 1, 1);
}

/** Lander: descent stage on four legs, crew cabin on top. 3 × 3 tiles. */
export function lander(): THREE.Group {
  const g = new THREE.Group();
  const deckY = 1.6;

  // Descent stage.
  g.add(mesh(new THREE.CylinderGeometry(1.6, 1.6, 1.0, 8), MAT.hullShade, { pos: [0, deckY, 0], rot: [0, Math.PI / 8, 0] }));
  g.add(mesh(new THREE.CylinderGeometry(1.62, 1.62, 0.16, 8), MAT.darkMetal, { pos: [0, deckY - 0.45, 0], rot: [0, Math.PI / 8, 0] }));
  g.add(mesh(new THREE.ConeGeometry(0.55, 0.7, 8, 1, true), MAT.darkMetal, { pos: [0, deckY - 0.85, 0] }));
  for (const a of [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4]) {
    g.add(sphere(0.42, MAT.hull, { pos: [Math.cos(a) * 1.55, deckY + 0.05, Math.sin(a) * 1.55] }));
  }

  // Legs with footpads.
  for (const a of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
    const top: [number, number, number] = [Math.cos(a) * 1.3, deckY - 0.2, Math.sin(a) * 1.3];
    const bottom: [number, number, number] = [Math.cos(a) * 2.4, 0.12, Math.sin(a) * 2.4];
    g.add(strut(top, bottom, 0.08));
    g.add(strut([Math.cos(a) * 1.1, deckY - 0.5, Math.sin(a) * 1.1], [bottom[0] * 0.92, 0.5, bottom[2] * 0.92], 0.04));
    g.add(cyl(0.38, 0.42, 0.1, MAT.darkMetal, { pos: [bottom[0], 0.05, bottom[2]] }));
  }

  // Crew cabin.
  const cy = deckY + 0.5;
  g.add(cyl(1.0, 1.15, 1.6, MAT.hull, { pos: [0, cy + 0.8, 0] }));
  g.add(cyl(0.6, 1.0, 0.45, MAT.hullShade, { pos: [0, cy + 1.82, 0] }));
  g.add(mesh(new THREE.CylinderGeometry(1.03, 1.03, 0.22, 12), BAND.habitat, { pos: [0, cy + 1.25, 0] }));
  const w = windowPane(0.45, 0.32);
  w.position.set(0, cy + 1.0, 1.1);
  w.rotation.x = -0.08;
  g.add(w);
  g.add(box(0.8, 1.15, 0.08, MAT.darkMetal, { pos: [0.75, cy + 0.6, 0.75], rot: [0, Math.PI / 4, 0] }));
  // Cabin hatch on a hinge along its left edge.
  const k = 0.34 * Math.SQRT1_2;
  const hatchJoint = joint(g, 0.77 - k, cy + 0.6, 0.77 + k);
  hatchJoint.rotation.y = Math.PI / 4;
  hatchJoint.add(box(0.68, 1.02, 0.1, MAT.hullShade, { pos: [0.34, 0, 0] }));
  hatchJoint.add(box(0.05, 0.22, 0.05, MAT.darkMetal, { pos: [0.6, 0, 0.07] }));
  g.add(box(0.6, 0.95, 0.01, MAT.glass, { pos: [0.75 + 0.03, cy + 0.6, 0.75 + 0.03], rot: [0, Math.PI / 4, 0] }));

  // Ladder down the front-right leg.
  const lt: [number, number, number] = [Math.cos(Math.PI / 4) * 1.55, deckY - 0.5, Math.sin(Math.PI / 4) * 1.55];
  const lb: [number, number, number] = [Math.cos(Math.PI / 4) * 2.3, 0.1, Math.sin(Math.PI / 4) * 2.3];
  for (const off of [-0.2, 0.2]) {
    g.add(strut([lt[0] + off * 0.7, lt[1], lt[2] - off * 0.7], [lb[0] + off * 0.7, lb[1], lb[2] - off * 0.7], 0.025));
  }
  for (let i = 1; i < 5; i++) {
    const t = i / 5;
    const p = [lt[0] + (lb[0] - lt[0]) * t, lt[1] + (lb[1] - lt[1]) * t, lt[2] + (lb[2] - lt[2]) * t];
    g.add(strut([p[0] - 0.14, p[1], p[2] + 0.14], [p[0] + 0.14, p[1], p[2] - 0.14], 0.02));
  }

  // Rendezvous radar on a short mast, always turning.
  g.add(strut([0, cy + 2.0, 0], [0, cy + 2.5, 0], 0.035));
  const radar = joint(g, 0, cy + 2.55, 0);
  radar.add(box(0.7, 0.05, 0.12, MAT.hullShade));
  radar.add(box(0.12, 0.16, 0.14, MAT.darkMetal, { pos: [0.3, 0.05, 0] }));
  const b = beacon(0.2);
  b.position.set(-0.5, cy + 1.95, 0);
  g.add(b);
  addAnimator(g, (t) => {
    radar.rotation.y = t * 1.1;
    const age = pokeAge(g, t);
    const open = age < 3 ? Math.min(1, age / 0.6) * Math.min(1, (3 - age) / 0.6) : 0;
    hatchJoint.rotation.y = Math.PI / 4 - 1.5 * open * open * (3 - 2 * open);
  });
  return asModel(g, 'lander', 3, 3);
}
