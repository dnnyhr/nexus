import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ROVER } from '../game/config';
import { RoverDriver } from './rover';

describe('rover driving', () => {
  it('accelerates smoothly and drives where it is told', () => {
    const obj = new THREE.Object3D();
    const d = new RoverDriver(obj);
    d.update(1 / 60, new THREE.Vector2(0, 1), []);
    expect(d.speed).toBeLessThan(1);
    for (let i = 0; i < 300; i++) d.update(1 / 60, new THREE.Vector2(0, 1), []);
    expect(d.speed).toBeCloseTo(ROVER.maxSpeed, 1);
    expect(obj.position.z).toBeGreaterThan(10);
  });

  it('turns towards the input direction', () => {
    const obj = new THREE.Object3D();
    const d = new RoverDriver(obj);
    for (let i = 0; i < 400; i++) d.update(1 / 60, new THREE.Vector2(1, 0), []);
    expect(obj.position.x).toBeGreaterThan(5);
  });

  it('stops against a building', () => {
    const obj = new THREE.Object3D();
    const d = new RoverDriver(obj);
    const wall = { box: new THREE.Box2(new THREE.Vector2(-5, 6), new THREE.Vector2(5, 8)) };
    for (let i = 0; i < 600; i++) d.update(1 / 60, new THREE.Vector2(0, 1), [wall]);
    expect(obj.position.z).toBeLessThan(6);
  });
});
