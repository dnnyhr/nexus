import * as THREE from 'three';
import { addAnimator, approach, joint, setModes } from './anim';
import { BAND, MAT } from './palette';
import { asModel, box, mesh, sphere, strut } from './kit';

// The commander in an EVA suit, about 1.9 m tall with the helmet. Built on real joints
// (hips, knees, shoulders, elbows, neck) so it can idle, walk with the bouncy lunar lope
// astronauts used in the Apollo missions, and kneel to work. Faces +Z.

/** Limb segment hanging down from a joint: a capsule from the joint to `length` below it. */
function limb(parent: THREE.Object3D, radius: number, length: number, mat: THREE.Material): THREE.Mesh {
  const m = mesh(new THREE.CapsuleGeometry(radius, Math.max(0.01, length - radius * 2), 2, 8), mat, { pos: [0, -length / 2, 0] });
  parent.add(m);
  return m;
}

/** Accordion ring at a joint (suit bellows). */
function bellows(parent: THREE.Object3D, radius: number, y = 0): void {
  parent.add(mesh(new THREE.TorusGeometry(radius, 0.022, 4, 8), MAT.hullShade, { pos: [0, y, 0], rot: [Math.PI / 2, 0, 0] }));
}

export function commander(): THREE.Group {
  const g = new THREE.Group();
  const hipY = 0.98;
  const pelvis = joint(g, 0, hipY, 0);

  // ---- Legs -------------------------------------------------------------------------
  const legs = [-1, 1].map((s) => {
    const hip = joint(pelvis, s * 0.11, -0.03, 0);
    limb(hip, 0.1, 0.43, MAT.suit);
    const knee = joint(hip, 0, -0.43, 0.01);
    bellows(knee, 0.095);
    limb(knee, 0.09, 0.42, MAT.suit);
    const ankle = joint(knee, 0, -0.42, 0);
    ankle.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 8), MAT.hullShade, { pos: [0, 0.0, 0] }));
    ankle.add(box(0.17, 0.09, 0.3, MAT.suit, { pos: [0, -0.05, 0.05] }));
    ankle.add(box(0.18, 0.035, 0.32, MAT.darkMetal, { pos: [0, -0.11, 0.05] }));
    ankle.add(box(0.15, 0.06, 0.07, MAT.hullShade, { pos: [0, -0.05, 0.215] }));
    return { hip, knee, ankle };
  });

  // ---- Torso ------------------------------------------------------------------------
  const torso = joint(pelvis, 0, 0, 0);
  torso.add(mesh(new THREE.CylinderGeometry(0.2, 0.19, 0.1, 8), MAT.hullShade, { pos: [0, 0.03, 0], scale: [1, 1, 0.8] }));
  torso.add(mesh(new THREE.CylinderGeometry(0.25, 0.2, 0.5, 8), MAT.suit, { pos: [0, 0.32, 0], scale: [1, 1, 0.76] }));
  // Chest control unit with a display and two knobs.
  torso.add(box(0.26, 0.15, 0.08, MAT.hullShade, { pos: [0, 0.3, 0.19] }));
  torso.add(box(0.1, 0.05, 0.02, MAT.glass, { pos: [-0.05, 0.33, 0.235] }));
  for (const x of [0.05, 0.1]) torso.add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.03, 6), MAT.darkMetal, { pos: [x, 0.33, 0.24], rot: [Math.PI / 2, 0, 0] }));
  // Mission patch on the chest.
  torso.add(box(0.07, 0.07, 0.01, BAND.habitat, { pos: [-0.13, 0.44, 0.17], rot: [0, -0.35, 0] }));
  // Life-support backpack with vents, band and a short antenna.
  torso.add(box(0.44, 0.6, 0.22, MAT.hullShade, { pos: [0, 0.34, -0.26] }));
  torso.add(box(0.452, 0.07, 0.232, BAND.habitat, { pos: [0, 0.5, -0.26] }));
  for (const y of [0.18, 0.24, 0.3]) torso.add(box(0.26, 0.025, 0.01, MAT.darkMetal, { pos: [0, y, -0.375] }));
  torso.add(strut([0.17, 0.62, -0.3], [0.17, 0.92, -0.3], 0.008, MAT.structure));
  // Hoses from backpack to chest unit.
  for (const s of [-1, 1]) {
    torso.add(strut([s * 0.2, 0.22, -0.16], [s * 0.21, 0.2, 0.05], 0.022, MAT.darkMetal));
    torso.add(strut([s * 0.21, 0.2, 0.05], [s * 0.12, 0.27, 0.19], 0.022, MAT.darkMetal));
  }

  // ---- Arms -------------------------------------------------------------------------
  const arms = [-1, 1].map((s) => {
    const shoulder = joint(torso, s * 0.28, 0.5, 0);
    shoulder.add(sphere(0.1, MAT.suit));
    limb(shoulder, 0.078, 0.3, MAT.suit);
    shoulder.add(mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.06, 8), BAND.habitat, { pos: [0, -0.1, 0] }));
    const elbow = joint(shoulder, 0, -0.3, 0);
    bellows(elbow, 0.075);
    limb(elbow, 0.07, 0.27, MAT.suit);
    const wrist = joint(elbow, 0, -0.27, 0);
    wrist.add(mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.04, 8), MAT.hullShade));
    wrist.add(box(0.09, 0.12, 0.11, MAT.darkMetal, { pos: [0, -0.08, 0.01] }));
    wrist.add(box(0.03, 0.06, 0.05, MAT.darkMetal, { pos: [s * -0.05, -0.06, 0.05] }));
    shoulder.rotation.z = s * 0.08;
    return { shoulder, elbow };
  });

  // ---- Head -------------------------------------------------------------------------
  const neck = joint(torso, 0, 0.58, 0);
  neck.add(mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.06, 8), MAT.hullShade));
  const helmetY = 0.17;
  neck.add(sphere(0.205, MAT.suit, { pos: [0, helmetY, -0.01] }));
  // Gold visor facing +Z and its frame.
  neck.add(mesh(new THREE.SphereGeometry(0.212, 12, 6, Math.PI * 0.18, Math.PI * 0.64, Math.PI * 0.26, Math.PI * 0.36), MAT.visor, { pos: [0, helmetY, -0.01] }));
  neck.add(mesh(new THREE.TorusGeometry(0.205, 0.016, 4, 12, Math.PI * 1.1), MAT.hullShade, { pos: [0, helmetY + 0.02, 0.005], rot: [0.2, 0, Math.PI * -0.05] }));
  // Helmet lights and camera.
  for (const s of [-1, 1]) {
    neck.add(box(0.05, 0.05, 0.08, MAT.hullShade, { pos: [s * 0.2, helmetY + 0.08, 0.03] }));
    neck.add(box(0.035, 0.035, 0.01, MAT.beacon, { pos: [s * 0.2, helmetY + 0.08, 0.075] }));
  }
  neck.add(box(0.06, 0.04, 0.07, MAT.darkMetal, { pos: [0.12, helmetY + 0.19, 0.0] }));

  // ---- Animation --------------------------------------------------------------------
  let crouch = 0;
  let walkBlend = 0;
  setModes(g, ['idle', 'walk', 'work']);
  addAnimator(g, (t, dt, mode) => {
    walkBlend = approach(walkBlend, mode === 'walk' ? 1 : 0, 6, dt);
    crouch = approach(crouch, mode === 'work' ? 1 : 0, 4, dt);
    const p = t * 5.2; // lope cadence
    const w = walkBlend;

    // Lunar lope: both legs push together, the body floats up between steps.
    pelvis.position.y = hipY + w * Math.abs(Math.sin(p)) * 0.09 - crouch * 0.32;
    torso.rotation.x = w * 0.12 + crouch * 0.35 + Math.sin(t * 1.6) * 0.015 * (1 - w);
    legs.forEach(({ hip, knee, ankle }, i) => {
      const s = i === 0 ? 1 : -1;
      const swing = Math.sin(p + (i === 0 ? 0 : 0.6)) * 0.45 * w;
      hip.rotation.x = -swing * s * 0.7 - w * 0.12 - crouch * 1.0;
      knee.rotation.x = w * (0.18 + Math.max(0, Math.sin(p + 1.2)) * 0.45) + crouch * 1.55;
      // Keep the boot level with the ground whatever the leg does.
      ankle.rotation.x = -(hip.rotation.x + knee.rotation.x);
    });
    arms.forEach(({ shoulder, elbow }, i) => {
      const s = i === 0 ? -1 : 1;
      const work = Math.sin(t * 6 + i * Math.PI) * 0.25;
      shoulder.rotation.x = (1 - crouch) * (Math.sin(p) * 0.35 * s * w + Math.sin(t * 1.2 + i) * 0.03 * (1 - w)) - crouch * (1.1 + work);
      elbow.rotation.x = -0.25 - w * 0.25 - crouch * (0.6 - work);
    });
    neck.rotation.y = (1 - w) * (1 - crouch) * Math.sin(t * 0.45) * 0.45;
    neck.rotation.x = crouch * 0.35;
  });
  return asModel(g, 'commander', 1, 1);
}
