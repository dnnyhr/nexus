import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Player } from './player';

const still = new THREE.Vector2();

describe('player', () => {
  it('hops low and short, like the Apollo astronauts (no flying)', () => {
    const p = new Player(new THREE.Vector3(0, 0, 0));
    p.jump();
    let maxH = 0;
    let airtime = 0;
    for (let i = 0; i < 300; i++) {
      p.update(1 / 60, still, [], false, false);
      maxH = Math.max(maxH, p.position.y);
      if (!p.airborne) { airtime = (i + 1) / 60; break; }
    }
    expect(maxH).toBeLessThan(0.35);
    expect(maxH).toBeGreaterThan(0.15);
    expect(airtime).toBeGreaterThan(0.8);
    expect(airtime).toBeLessThan(1.4);
  });

  it('absorbs each landing before the next hop, even holding the jump key', () => {
    const p = new Player(new THREE.Vector3(0, 0, 0));
    p.jump();
    const ground: number[] = [];
    let onGround = 0;
    let wasAir = true;
    for (let i = 0; i < 60 * 6; i++) {
      p.update(1 / 60, still, [], false, true);
      if (p.airborne) {
        if (!wasAir && onGround > 0) ground.push(onGround);
        onGround = 0;
        wasAir = true;
      } else {
        onGround += 1 / 60;
        wasAir = false;
      }
    }
    expect(ground.length).toBeGreaterThan(1);
    for (const g of ground) expect(g).toBeGreaterThanOrEqual(0.3);
  });

  it('a jump pressed right on landing is ignored', () => {
    const p = new Player(new THREE.Vector3(0, 0, 0));
    p.jump();
    while (p.airborne) p.update(1 / 60, still, [], false, false);
    p.jump();
    expect(p.airborne).toBe(false);
  });

  it('is pushed out when a building appears on top of it', () => {
    const p = new Player(new THREE.Vector3(0, 0, 0));
    const box = new THREE.Box2(new THREE.Vector2(-2, -1), new THREE.Vector2(3, 4));
    p.unstick([{ box }]);
    expect(box.distanceToPoint(new THREE.Vector2(p.position.x, p.position.z))).toBeGreaterThan(0.3);
  });

  it('can always walk out of a footprint it is standing in', () => {
    const p = new Player(new THREE.Vector3(0, 0, 0));
    const box = new THREE.Box2(new THREE.Vector2(-1, -1), new THREE.Vector2(1, 1));
    const out = new THREE.Vector2(1, 0);
    for (let i = 0; i < 120; i++) p.update(1 / 60, out, [{ box }], false, false);
    expect(p.position.x).toBeGreaterThan(1.3);
  });

  it('cannot walk into a footprint from outside', () => {
    const p = new Player(new THREE.Vector3(-3, 0, 0));
    const box = new THREE.Box2(new THREE.Vector2(-1, -1), new THREE.Vector2(1, 1));
    for (let i = 0; i < 180; i++) p.update(1 / 60, new THREE.Vector2(1, 0), [{ box }], false, false);
    expect(p.position.x).toBeLessThan(-1.3);
  });
});
