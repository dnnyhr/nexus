import * as THREE from 'three';
import { COLORS } from '../models/palette';
import { rock } from '../models/kit';
import { mergeStatic } from './optimize';

// Lunar south-pole terrain: gentle undulation, small craters, a flat building area at the
// center, and one large permanently shadowed crater with water ice on its floor.
// Deterministic: the same terrain every time.

export const BUILD_RADIUS = 26;
export const ICE_CRATER = { x: 34, z: -30, r: 11 };

const CRATERS = [
  { x: -24, z: 18, r: 5 },
  { x: 22, z: 26, r: 3.5 },
  { x: -36, z: -22, r: 7 },
  { x: 8, z: -40, r: 4 },
  { x: -10, z: 38, r: 3 },
  { x: 44, z: 12, r: 5.5 },
  ICE_CRATER,
];

function hash(x: number, z: number): number {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function valueNoise(x: number, z: number): number {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const xf = x - xi;
  const zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi);
  const b = hash(xi + 1, zi);
  const c = hash(xi, zi + 1);
  const d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Ground height at (x, z). Exported so buildings, robots and the rover sit on the surface. */
export function heightAt(x: number, z: number): number {
  let h = (valueNoise(x * 0.06, z * 0.06) - 0.5) * 2.2 + (valueNoise(x * 0.18, z * 0.18) - 0.5) * 0.5;
  for (const c of CRATERS) {
    const d = Math.hypot(x - c.x, z - c.z) / c.r;
    if (d < 1) h -= (1 - d * d) * c.r * 0.32; // bowl
    else if (d < 1.5) h += Math.sin(((d - 1) / 0.5) * Math.PI) * c.r * 0.08; // rim
  }
  // Flatten the building area, blending smoothly at its edge.
  const r = Math.hypot(x, z);
  const t = THREE.MathUtils.smoothstep(r, BUILD_RADIUS * 0.85, BUILD_RADIUS * 1.25);
  return h * t;
}

export function createTerrain(size = 240, segments = 120): THREE.Group {
  const g = new THREE.Group();
  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  const base = new THREE.Color(COLORS.regolith);
  const dark = new THREE.Color(COLORS.regolithDark);
  const shadowed = new THREE.Color(0x3a3936);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, heightAt(x, z));
    c.copy(base).lerp(dark, valueNoise(x * 0.11 + 7, z * 0.11) * 0.55);
    const d = Math.hypot(x - ICE_CRATER.x, z - ICE_CRATER.z) / ICE_CRATER.r;
    if (d < 1.05) c.lerp(shadowed, THREE.MathUtils.smoothstep(1.05 - d, 0, 0.35));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  ground.receiveShadow = true;
  ground.name = 'ground';
  ground.userData.dynamic = true; // keep: vertex colors, and picked by name for digging
  g.add(ground);

  // Water-ice glints on the shadowed crater floor.
  const ice = new THREE.MeshLambertMaterial({ color: 0xcfe3ec, emissive: 0x6f8fa0, emissiveIntensity: 0.35, flatShading: true });
  for (let i = 0; i < 14; i++) {
    const a = hash(i, 3) * Math.PI * 2;
    const rr = Math.sqrt(hash(i, 9)) * ICE_CRATER.r * 0.55;
    const x = ICE_CRATER.x + Math.cos(a) * rr;
    const z = ICE_CRATER.z + Math.sin(a) * rr;
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.25 + hash(i, 5) * 0.3, 0), ice);
    m.position.set(x, heightAt(x, z) + 0.05, z);
    m.scale.y = 0.4;
    g.add(m);
  }

  // Scattered rocks outside the building area.
  for (let i = 0; i < 60; i++) {
    const a = hash(i, 1) * Math.PI * 2;
    const rr = BUILD_RADIUS + 2 + hash(i, 2) * 60;
    const x = Math.cos(a) * rr;
    const z = Math.sin(a) * rr;
    const r = rock(0.3 + hash(i, 4) * 0.9, i);
    r.position.set(x, heightAt(x, z) + 0.1, z);
    r.rotation.y = hash(i, 6) * 6;
    g.add(r);
  }
  // Rocks and ice glints never move: bake them into one mesh per material.
  mergeStatic(g);
  return g;
}
