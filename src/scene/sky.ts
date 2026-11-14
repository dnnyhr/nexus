import * as THREE from 'three';
import { mergeStatic } from './optimize';

// Black sky with stars, a ring of distant mountains, and Earth sitting low on the horizon,
// as seen from the lunar south pole.

export function createSky(radius = 160): THREE.Group {
  const g = new THREE.Group();

  // Stars: fixed pseudo-random points on the upper hemisphere.
  const n = 900;
  const pts = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = (Math.sin(i * 12.9898) * 43758.5453) % 1;
    const v = (Math.sin(i * 78.233) * 12345.6789) % 1;
    const theta = Math.abs(u) * Math.PI * 2;
    const phi = Math.acos(Math.abs(v) * 0.96);
    pts.set([Math.cos(theta) * Math.sin(phi) * radius, Math.cos(phi) * radius, Math.sin(theta) * Math.sin(phi) * radius], i * 3);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
  g.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xd8d4cc, size: 1.4, sizeAttenuation: false })));

  // Distant massifs around the south pole: broad, low and rounded (no pyramids).
  const mountainMat = new THREE.MeshLambertMaterial({ color: 0x77736c, flatShading: true });
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + Math.sin(i * 3.1) * 0.15;
    const r = radius * 0.7 + Math.sin(i * 1.7) * 10;
    const w = 22 + Math.abs(Math.sin(i * 0.7)) * 18;
    const h = 5 + Math.abs(Math.sin(i * 2.3)) * 7;
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), mountainMat);
    m.scale.set(w, h, w * 0.6);
    m.position.set(Math.cos(a) * r, -1.5, Math.sin(a) * r);
    m.rotation.y = -a;
    m.receiveShadow = true;
    g.add(m);
  }

  // Earth: low above the horizon, lit from the same side as the Sun.
  const earthGeo = new THREE.IcosahedronGeometry(5, 2);
  const pos = earthGeo.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  const ocean = new THREE.Color(0x3d6aa3);
  const land = new THREE.Color(0x7a9a63);
  const cloud = new THREE.Color(0xe8ecef);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const k = Math.sin(x * 0.9) * Math.cos(z * 0.8) + Math.sin(y * 1.3);
    const c = k > 0.7 ? cloud : k > 0.15 ? land : ocean;
    colors.set([c.r, c.g, c.b], i * 3);
  }
  earthGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const earth = new THREE.Mesh(earthGeo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: 0x0d1626 }));
  earth.position.set(-30, 34, -radius * 0.85);
  earth.name = 'earth';
  earth.userData.dynamic = true; // keep its vertex colors out of merging
  g.add(earth);
  mergeStatic(g);
  return g;
}
