import * as THREE from 'three';
import { beaconMaterial, MAT } from './palette';

// Shared parts. Every model is assembled from these so the whole base shares one visual
// language: same segment counts, same feet, same pads, same hatches, same beacons.

export type Vec3 = [number, number, number];

export interface Place {
  pos?: Vec3;
  rot?: Vec3;
  scale?: Vec3;
}

/** Segment rule from the style guide: 8 sides below 1 m across, 12 above. */
export const seg = (radius: number): number => (radius < 0.5 ? 8 : 12);

export function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, place: Place = {}): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  if (place.pos) m.position.set(...place.pos);
  if (place.rot) m.rotation.set(...place.rot);
  if (place.scale) m.scale.set(...place.scale);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function box(w: number, h: number, d: number, mat: THREE.Material, place: Place = {}): THREE.Mesh {
  return mesh(new THREE.BoxGeometry(w, h, d), mat, place);
}

export function cyl(rTop: number, rBottom: number, h: number, mat: THREE.Material, place: Place = {}): THREE.Mesh {
  return mesh(new THREE.CylinderGeometry(rTop, rBottom, h, seg(Math.max(rTop, rBottom))), mat, place);
}

export function sphere(r: number, mat: THREE.Material, place: Place = {}): THREE.Mesh {
  const s = seg(r);
  return mesh(new THREE.SphereGeometry(r, s, s / 2), mat, place);
}

/** Half sphere (dome) opening downwards, sitting on y = 0 of its own frame. */
export function dome(r: number, mat: THREE.Material, place: Place = {}): THREE.Mesh {
  return mesh(new THREE.SphereGeometry(r, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat, place);
}

/** Cylinder between two points (pipes, struts, cables). */
export function strut(from: Vec3, to: Vec3, r: number, mat: THREE.Material = MAT.structure): THREE.Mesh {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const len = a.distanceTo(b);
  const m = mesh(new THREE.CylinderGeometry(r, r, len, 8), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize());
  return m;
}

/** Octagonal leveling pad: nothing in the base sits directly on loose regolith. */
export function pad(radius: number): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(radius, radius * 1.06, 0.12, 8), MAT.structure, { pos: [0, 0.06, 0], rot: [0, Math.PI / 8, 0] }));
  g.add(mesh(new THREE.CylinderGeometry(radius * 0.94, radius * 0.94, 0.04, 8), MAT.darkMetal, { pos: [0, 0.14, 0], rot: [0, Math.PI / 8, 0] }));
  return g;
}

/** Adjustable leg with a round footpad. Top of the leg is at `height`. */
export function foot(x: number, z: number, height: number): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.07, 0.07, height, MAT.structure, { pos: [x, height / 2, z] }));
  g.add(cyl(0.11, 0.11, 0.12, MAT.darkMetal, { pos: [x, height * 0.55, z] }));
  g.add(cyl(0.22, 0.26, 0.06, MAT.darkMetal, { pos: [x, 0.03, z] }));
  return g;
}

/** Function band around a horizontal hull aligned with the X axis. */
export function hullBand(radius: number, width: number, x: number, y: number, mat: THREE.Material): THREE.Mesh {
  return mesh(new THREE.CylinderGeometry(radius + 0.025, radius + 0.025, width, 12), mat, { pos: [x, y, 0], rot: [0, 0, Math.PI / 2] });
}

/** Function band around a vertical body. */
export function ringBand(radius: number, width: number, y: number, mat: THREE.Material): THREE.Mesh {
  return mesh(new THREE.CylinderGeometry(radius + 0.025, radius + 0.025, width, seg(radius)), mat, { pos: [0, y, 0] });
}

/** Door: dark frame, shaded leaf and a small porthole. Faces +Z of its own frame. */
export function hatch(w = 1.0, h = 1.9): THREE.Group {
  const g = new THREE.Group();
  g.add(box(w + 0.16, h + 0.16, 0.08, MAT.darkMetal, { pos: [0, h / 2, 0] }));
  g.add(box(w, h, 0.1, MAT.hullShade, { pos: [0, h / 2, 0.02] }));
  g.add(cyl(0.13, 0.13, 0.06, MAT.glass, { pos: [0, h * 0.72, 0.08], rot: [Math.PI / 2, 0, 0] }));
  g.add(box(0.08, 0.3, 0.06, MAT.darkMetal, { pos: [w * 0.35, h * 0.48, 0.09] }));
  return g;
}

/** Window pane with a dark frame. Faces +Z of its own frame. */
export function windowPane(w: number, h: number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(w + 0.1, h + 0.1, 0.05, MAT.darkMetal));
  g.add(box(w, h, 0.05, MAT.glass, { pos: [0, 0, 0.018] }));
  return g;
}

/** Small blinking beacon on a post. Each one blinks with its own rhythm. */
export function beacon(height = 0.5): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.035, 0.035, height, MAT.structure, { pos: [0, height / 2, 0] }));
  g.add(cyl(0.08, 0.08, 0.12, beaconMaterial(), { pos: [0, height + 0.06, 0] }));
  g.add(cyl(0.1, 0.1, 0.03, MAT.darkMetal, { pos: [0, height + 0.135, 0] }));
  return g;
}

/** Low-poly regolith rock. Deterministic for a given seed so the scene never "pops". */
export function rock(size: number, seed: number, mat: THREE.Material = MAT.regolithDark): THREE.Mesh {
  const geo = new THREE.DodecahedronGeometry(size, 0);
  const pos = geo.getAttribute('position');
  let s = seed * 9301 + 49297;
  const rand = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < pos.count; i++) {
    const k = 0.78 + rand() * 0.4;
    pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k * 0.7, pos.getZ(i) * k);
  }
  geo.computeVertexNormals();
  return mesh(geo, mat);
}

/** Tag a model with its id and footprint in 2 m tiles. */
export function asModel(g: THREE.Group, id: string, tilesX: number, tilesZ: number): THREE.Group {
  g.name = id;
  Object.assign(g.userData, { id, tiles: [tilesX, tilesZ] });
  return g;
}

/**
 * Regolith shielding berm: a hipped heap (wide base, narrow ridge, sloped ends) along X,
 * sitting on y = 0, with a few rocks on the ridge so it doesn't look machined.
 */
export function berm(length: number, height: number, depth: number, seed: number): THREE.Group {
  const g = new THREE.Group();
  const geo = new THREE.BoxGeometry(1, 1, 1);
  geo.userData.noAudit = true;
  const pos = geo.getAttribute('position');
  const ridgeLen = Math.max(length - height * 2.2, length * 0.3);
  const ridgeDepth = depth * 0.28;
  for (let i = 0; i < pos.count; i++) {
    const top = pos.getY(i) > 0;
    pos.setXYZ(
      i,
      Math.sign(pos.getX(i)) * (top ? ridgeLen : length) / 2,
      top ? height : 0,
      Math.sign(pos.getZ(i)) * (top ? ridgeDepth : depth) / 2,
    );
  }
  geo.computeVertexNormals();
  g.add(mesh(geo, MAT.regolithPiled));
  const n = Math.max(2, Math.round(ridgeLen / 1.4));
  for (let i = 0; i < n; i++) {
    const r = rock(0.35 + ((seed + i) % 3) * 0.08, seed + i, MAT.regolithPiled);
    r.position.set(-ridgeLen / 2 + (i + 0.5) * (ridgeLen / n), height - 0.05, ((i % 2) - 0.5) * ridgeDepth * 0.6);
    r.rotation.y = i * 1.7;
    g.add(r);
  }
  return g;
}

/** Vehicle wheel (open-mesh style lunar wheel): dark tire, light hub. Axis along X. */
export function wheel(r: number, width: number): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(r, r, width, 8), MAT.darkMetal, { rot: [0, 0, Math.PI / 2] }));
  g.add(mesh(new THREE.CylinderGeometry(r * 0.45, r * 0.45, width + 0.04, 8), MAT.hullShade, { rot: [0, 0, Math.PI / 2] }));
  return g;
}

/**
 * Parabolic-looking dish whose back sits exactly at the origin and opens along +Y, with a
 * feed horn on three struts. Tilt the returned group to aim it.
 */
export function dish(radius: number, depthAngle = 0.6): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(new THREE.SphereGeometry(radius, 12, 3, 0, Math.PI * 2, 0, depthAngle), MAT.hullDouble, {
    pos: [0, radius, 0],
    rot: [Math.PI, 0, 0],
  }));
  const rimY = radius * (1 - Math.cos(depthAngle));
  const rimR = radius * Math.sin(depthAngle) * 0.95;
  const focus = radius * 0.62;
  for (const a of [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3]) {
    g.add(strut([Math.cos(a) * rimR, rimY, Math.sin(a) * rimR], [0, focus, 0], Math.max(0.008, radius * 0.012), MAT.structure));
  }
  g.add(cyl(radius * 0.07, radius * 0.05, radius * 0.14, MAT.darkMetal, { pos: [0, focus + radius * 0.05, 0] }));
  g.add(cyl(radius * 0.12, radius * 0.12, radius * 0.06, MAT.darkMetal, { pos: [0, 0.01, 0] }));
  return g;
}
