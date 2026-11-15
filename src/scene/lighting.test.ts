import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createLighting } from './lighting';

describe('lunar lighting', () => {
  it('keeps a single shadow caster and readable night fill without more lights', () => {
    const scene = new THREE.Scene();
    const lighting = createLighting(scene);
    const lights = scene.children.filter(object => object instanceof THREE.Light) as THREE.Light[];
    expect(lights).toHaveLength(3);
    expect(lights.filter(light => light.castShadow)).toHaveLength(1);
    lighting.setNight(1);
    expect(lighting.sun.intensity).toBe(0);
    expect(lighting.bounce.intensity).toBeGreaterThan(0.5);
    expect(lighting.ambient.intensity).toBeGreaterThan(0);
    expect(lighting.sun.shadow.mapSize.toArray()).toEqual([2048, 2048]);
  });

  it('interpolates hue across twilight instead of switching at midpoint', () => {
    const lighting = createLighting(new THREE.Scene());
    lighting.setNight(0.499);
    const before = lighting.bounce.color.clone();
    lighting.setNight(0.501);
    const after = lighting.bounce.color;
    expect(Math.abs(before.r - after.r) + Math.abs(before.g - after.g) + Math.abs(before.b - after.b)).toBeLessThan(0.003);
    lighting.setNight(NaN);
    expect(Number.isFinite(lighting.sun.intensity)).toBe(true);
  });
});
