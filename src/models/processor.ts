import * as THREE from 'three';
import { BAND, MAT } from './palette';
import { asModel, beacon, box, cyl, mesh, pad, ringBand, sphere, strut, windowPane } from './kit';

// Regolith processor (ISRU oxygen plant): a conveyor brings regolith up to a hopper, the
// reactor heats it to release oxygen, which goes to a spherical tank. A radiator panel at
// the back sheds the heat. Footprint: 2 × 2 tiles (4 × 4 m).

export function processor(): THREE.Group {
  const g = new THREE.Group();
  g.add(pad(1.9));
  const base = 0.16;

  // Reactor.
  g.add(cyl(0.8, 0.8, 2.2, MAT.hull, { pos: [0.1, base + 1.1, -0.2] }));
  g.add(cyl(0.45, 0.8, 0.45, MAT.hullShade, { pos: [0.1, base + 2.42, -0.2] }));
  g.add(cyl(0.16, 0.16, 0.5, MAT.darkMetal, { pos: [0.1, base + 2.85, -0.2] }));
  for (const y of [0.3, 1.9]) {
    const ring = ringBand(0.8, 0.1, base + y, MAT.hullShade);
    ring.position.x = 0.1;
    ring.position.z = -0.2;
    g.add(ring);
  }
  const band = ringBand(0.8, 0.28, base + 1.45, BAND.industry);
  band.position.set(0.1, base + 1.45, -0.2);
  g.add(band);
  const port = windowPane(0.3, 0.3);
  port.position.set(0.1, base + 0.95, 0.62);
  g.add(port);

  // Hopper on a frame, with a chute into the reactor.
  const hx = -1.3;
  const hz = 0.0;
  const hopper = mesh(new THREE.CylinderGeometry(0.75, 0.25, 0.8, 4, 1), MAT.hullShade, {
    pos: [hx, base + 2.0, hz],
    rot: [0, Math.PI / 4, 0],
  });
  g.add(hopper);
  for (const [dx, dz] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]] as const) {
    g.add(strut([hx + dx, base, hz + dz], [hx + dx * 0.8, base + 1.7, hz + dz * 0.8], 0.04));
  }
  g.add(strut([hx, base + 1.55, hz], [-0.55, base + 1.2, 0.0], 0.09, MAT.darkMetal));

  // Conveyor ramp from the ground up to the hopper mouth (robots unload at the bottom).
  const rampLen = 3.0;
  const rampAngle = 0.95;
  const topY = base + 2.45;
  const topZ = hz + 0.35;
  const ramp = new THREE.Group();
  ramp.add(box(0.5, 0.08, rampLen, MAT.darkMetal));
  ramp.add(box(0.6, 0.12, rampLen, MAT.structure, { pos: [0, -0.09, 0] }));
  for (let i = 0; i < 5; i++) ramp.add(box(0.5, 0.05, 0.06, MAT.structure, { pos: [0, 0.06, -rampLen / 2 + 0.3 + i * 0.6] }));
  ramp.position.set(hx, topY - (Math.sin(rampAngle) * rampLen) / 2, topZ + (Math.cos(rampAngle) * rampLen) / 2);
  ramp.rotation.x = rampAngle;
  g.add(ramp);
  g.add(strut([hx, base, topZ + 0.9], [hx, base + 1.15, topZ + 0.9], 0.05));

  // Oxygen tank with its feed pipe.
  const tx = 1.25;
  const tz = 0.95;
  g.add(sphere(0.55, MAT.hull, { pos: [tx, base + 0.95, tz] }));
  const tankBand = ringBand(0.56, 0.08, 0, BAND.industry);
  tankBand.position.set(tx, base + 0.95, tz);
  g.add(tankBand);
  for (const a of [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3]) {
    g.add(strut([tx + Math.cos(a) * 0.45, base, tz + Math.sin(a) * 0.45], [tx + Math.cos(a) * 0.3, base + 0.6, tz + Math.sin(a) * 0.3], 0.035));
  }
  g.add(strut([0.7, base + 1.6, 0.1], [tx, base + 1.5, tz], 0.05, MAT.darkMetal));

  // Radiator panel at the back.
  g.add(box(2.4, 1.4, 0.06, MAT.hullShade, { pos: [0.2, base + 1.7, -1.55] }));
  for (const x of [-0.6, 0.2, 1.0]) g.add(box(0.05, 1.46, 0.1, MAT.structure, { pos: [x, base + 1.7, -1.55] }));
  g.add(strut([-0.9, base, -1.55], [-0.9, base + 1.0, -1.55], 0.04));
  g.add(strut([1.3, base, -1.55], [1.3, base + 1.0, -1.55], 0.04));

  const b = beacon(0.3);
  b.position.set(0.1, base + 3.1, -0.2);
  g.add(b);

  return asModel(g, 'processor', 2, 2);
}
