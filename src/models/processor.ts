import * as THREE from 'three';
import { addAnimator, joint, pokeAge } from './anim';
import { BAND, MAT } from './palette';
import { asModel, beacon, box, cyl, mesh, pad, ringBand, rock, sphere, strut, windowPane } from './kit';

// Regolith processor (ISRU oxygen plant): a conveyor brings regolith up to a hopper, the
// reactor heats it to release oxygen, which goes to a spherical tank. A radiator panel at
// the back sheds the heat. Footprint: 2 × 2 tiles (4 × 4 m).

export function processor(): THREE.Group {
  const g = new THREE.Group();
  g.add(pad(1.9));
  const base = 0.16;

  // Reactor (in its own group so it can rumble), with an exhaust fan on top.
  const reactor = joint(g, 0.1, 0, -0.2);
  reactor.add(cyl(0.8, 0.8, 2.2, MAT.hull, { pos: [0, base + 1.1, 0] }));
  reactor.add(cyl(0.45, 0.8, 0.45, MAT.hullShade, { pos: [0, base + 2.42, 0] }));
  reactor.add(cyl(0.16, 0.16, 0.4, MAT.darkMetal, { pos: [0, base + 2.8, 0] }));
  reactor.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.14, 12, 1, true), MAT.structure, { pos: [0, base + 3.05, 0] }));
  const fan = joint(reactor, 0, base + 3.05, 0);
  fan.add(cyl(0.06, 0.06, 0.1, MAT.darkMetal));
  for (let i = 0; i < 4; i++) fan.add(box(0.5, 0.012, 0.09, MAT.hullShade, { rot: [0.35, (i * Math.PI) / 4, 0] }));
  for (const y of [0.3, 1.9]) reactor.add(ringBand(0.8, 0.1, base + y, MAT.hullShade));
  reactor.add(ringBand(0.8, 0.28, base + 1.45, BAND.industry));
  const port = windowPane(0.3, 0.3);
  port.position.set(0, base + 0.95, 0.82);
  reactor.add(port);

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
  // Moving cleats, some carrying regolith up to the hopper.
  const cleats: THREE.Object3D[] = [];
  for (let i = 0; i < 6; i++) {
    const c = joint(ramp, 0, 0.06, 0);
    c.add(box(0.46, 0.05, 0.06, MAT.structure));
    if (i % 2 === 0) {
      const k = rock(0.08, 90 + i, MAT.regolithPiled);
      k.position.set(0, 0.06, 0.07);
      c.add(k);
    }
    cleats.push(c);
  }
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
  b.position.set(0.55, base + 2.25, -0.2);
  g.add(b);

  // Exhaust puffs released on a poke (a short vent of hot gas).
  const puffMat = new THREE.MeshLambertMaterial({ color: 0xe9e4da, transparent: true, opacity: 0, depthWrite: false, flatShading: true });
  const puffs = [0, 1, 2].map((i) => {
    const p = mesh(new THREE.IcosahedronGeometry(0.18 + i * 0.05, 0), puffMat);
    p.visible = false;
    reactor.add(p);
    return p;
  });

  const travel = rampLen - 0.4;
  // userData.active (set by the game): false when switched off or without power.
  let belt = 0;
  let fanSpeed = 9;
  addAnimator(g, (t, dt) => {
    const active = g.userData.active !== false;
    fanSpeed += ((active ? 9 : 0) - fanSpeed) * Math.min(1, dt * 1.5);
    fan.rotation.y += dt * fanSpeed;
    belt += dt * 0.12 * (fanSpeed / 9);
    // Cleats run up the belt (towards local -Z, the hopper end).
    cleats.forEach((c, i) => {
      const u = (i / cleats.length + belt) % 1;
      c.position.z = travel / 2 - u * travel;
      c.visible = u > 0.03 && u < 0.97;
    });
    // Poke: the reactor rumbles and vents.
    const age = pokeAge(g, t);
    reactor.position.x = 0.1 + (age < 0.6 ? Math.sin(age * 90) * 0.02 * (1 - age / 0.6) : 0);
    puffs.forEach((p, i) => {
      const a = age - i * 0.15;
      p.visible = a > 0 && a < 1.4;
      if (p.visible) {
        p.position.set(Math.sin(i * 2) * 0.15, base + 3.15 + a * 1.2, Math.cos(i * 2) * 0.15);
        p.scale.setScalar(0.6 + a);
      }
    });
    puffMat.opacity = age < 1.6 ? 0.55 * (1 - age / 1.6) : 0;
  });

  return asModel(g, 'processor', 2, 2);
}
