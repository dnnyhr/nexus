import * as THREE from 'three';
import { BAND, MAT } from './palette';
import { asModel, box, mesh, sphere, strut, type Vec3 } from './kit';

// The commander in an EVA suit, 1.8 m tall, in a relaxed stance (slightly bent knees and
// elbows, so it reads as a person and not a robot). Faces +Z.
export function commander(): THREE.Group {
  const g = new THREE.Group();

  for (const s of [-1, 1]) {
    const hip: Vec3 = [s * 0.12, 0.93, 0];
    const knee: Vec3 = [s * 0.13, 0.5, 0.04];
    const ankle: Vec3 = [s * 0.13, 0.13, 0];
    g.add(strut(hip, knee, 0.095, MAT.suit));
    g.add(strut(knee, ankle, 0.085, MAT.suit));
    g.add(sphere(0.1, MAT.hullShade, { pos: knee }));
    g.add(box(0.17, 0.13, 0.3, MAT.darkMetal, { pos: [s * 0.13, 0.065, 0.04] }));

    const shoulder: Vec3 = [s * 0.29, 1.4, 0];
    const elbow: Vec3 = [s * 0.34, 1.12, 0.05];
    const hand: Vec3 = [s * 0.31, 0.88, 0.14];
    g.add(sphere(0.095, MAT.suit, { pos: shoulder }));
    g.add(strut(shoulder, elbow, 0.075, MAT.suit));
    g.add(strut(elbow, hand, 0.068, MAT.suit));
    g.add(sphere(0.075, MAT.hullShade, { pos: elbow }));
    g.add(sphere(0.07, MAT.darkMetal, { pos: hand }));
    // Mission band on the upper arm.
    const band = strut([s * 0.3, 1.33, 0.01], [s * 0.315, 1.27, 0.025], 0.082, BAND.habitat);
    g.add(band);
  }

  // Hip ring, torso (flattened tapered cylinder) and chest control unit.
  g.add(mesh(new THREE.CylinderGeometry(0.2, 0.19, 0.08, 8), MAT.hullShade, { pos: [0, 0.94, 0], scale: [1, 1, 0.8] }));
  g.add(mesh(new THREE.CylinderGeometry(0.25, 0.2, 0.52, 8), MAT.suit, { pos: [0, 1.22, 0], scale: [1, 1, 0.75] }));
  g.add(box(0.24, 0.13, 0.07, MAT.hullShade, { pos: [0, 1.2, 0.17] }));
  g.add(box(0.06, 0.04, 0.02, MAT.glass, { pos: [-0.06, 1.22, 0.21] }));

  // Life-support backpack.
  g.add(box(0.44, 0.58, 0.2, MAT.hullShade, { pos: [0, 1.24, -0.25] }));
  g.add(box(0.45, 0.07, 0.21, BAND.habitat, { pos: [0, 1.4, -0.25] }));

  // Neck ring, helmet and gold-tinted visor facing +Z.
  g.add(mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.06, 8), MAT.hullShade, { pos: [0, 1.5, 0] }));
  g.add(sphere(0.2, MAT.suit, { pos: [0, 1.67, -0.01] }));
  g.add(mesh(
    new THREE.SphereGeometry(0.205, 12, 6, Math.PI * 0.18, Math.PI * 0.64, Math.PI * 0.28, Math.PI * 0.34),
    MAT.visor,
    { pos: [0, 1.67, -0.01] },
  ));
  return asModel(g, 'commander', 1, 1);
}
