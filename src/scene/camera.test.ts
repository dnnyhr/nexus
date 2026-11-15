import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { describe, expect, it } from 'vitest';
import { TacticalCamera } from './camera';

function rig(reduced = false) {
  const camera = new THREE.PerspectiveCamera(40, 1.6, 0.5, 700);
  camera.position.set(11, 13, 14);
  const controls = new OrbitControls(camera);
  controls.target.set(0, 0.8, 0);
  controls.minDistance = 7;
  controls.maxDistance = 45;
  controls.minPolarAngle = 0.35;
  controls.maxPolarAngle = 1.3;
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.update();
  const tactical = new TacticalCamera(camera, controls, { reducedMotion: () => reduced });
  return { camera, controls, tactical };
}

describe('shared tactical camera', () => {
  it('frames the base in both tactical modes without a singular movement direction', () => {
    const { camera, controls, tactical } = rig(true);
    for (const mode of ['isometric', 'top'] as const) {
      tactical.setMode(mode);
      expect(tactical.transitioning).toBe(false);
      expect(controls.target.toArray()).toEqual([0, 0.8, 0]);
      expect(camera.position.distanceTo(controls.target)).toBeGreaterThan(45);
      const groundDirection = camera.position.clone().sub(controls.target).setY(0);
      expect(groundDirection.length()).toBeGreaterThan(0.1);
      expect(camera.position.toArray().every(Number.isFinite)).toBe(true);
    }
  });

  it('retargets midflight from current pose and restores follow controls', () => {
    const { camera, controls, tactical } = rig();
    const start = camera.position.clone().sub(controls.target);
    const focus = new THREE.Vector3(5, 0, -3);
    tactical.setMode('isometric');
    tactical.update(0.1, focus);
    const middle = camera.position.clone();
    tactical.setMode('top');
    tactical.update(0, focus);
    expect(camera.position.distanceTo(middle)).toBeLessThan(1e-8);
    tactical.update(0.3, focus);
    tactical.setMode('follow');
    tactical.update(0.3, focus);
    expect(controls.target.distanceTo(new THREE.Vector3(5, 0.8, -3))).toBeLessThan(1e-8);
    expect(camera.position.clone().sub(controls.target).distanceTo(start)).toBeLessThan(1e-8);
    expect(controls.minDistance).toBe(7);
    expect(controls.maxDistance).toBe(45);
    expect(controls.minPolarAngle).toBe(0.35);
    expect(controls.maxPolarAngle).toBe(1.3);
    expect(controls.enableDamping).toBe(true);
    expect(controls.enablePan).toBe(false);
  });

  it('keeps zoom and touch mappings, reframes a narrower viewport', () => {
    const { camera, controls, tactical } = rig(true);
    const touch = controls.touches;
    tactical.setMode('isometric');
    const distance = camera.position.distanceTo(controls.target);
    camera.aspect = 0.6;
    camera.updateProjectionMatrix();
    tactical.resize();
    expect(camera.position.distanceTo(controls.target)).toBeGreaterThan(distance);
    expect(controls.touches).toBe(touch);
    expect(controls.enableZoom).toBe(true);
  });

  it('keeps overlay input blocking after a transition', () => {
    const { controls, tactical } = rig();
    tactical.setMode('top');
    tactical.setEnabled(false);
    tactical.update(0.5, new THREE.Vector3());
    expect(controls.enabled).toBe(false);
    tactical.setEnabled(true);
    expect(controls.enabled).toBe(true);
    tactical.destroy();
    tactical.setMode('top');
    expect(controls.maxDistance).toBe(45);
  });

  it('starts a transition from the visible pose while orbit inertia is pending', () => {
    const { camera, controls, tactical } = rig();
    (controls as OrbitControls & { rotateLeft(angle: number): void }).rotateLeft(0.6);
    controls.update();
    const position = camera.position.clone();
    const target = controls.target.clone();
    tactical.setMode('top');
    expect(camera.position.distanceTo(position)).toBeLessThan(1e-8);
    expect(controls.target.distanceTo(target)).toBeLessThan(1e-8);
    tactical.update(0, target);
    expect(camera.position.distanceTo(position)).toBeLessThan(1e-8);
  });

  it('ends transitions and follows equally at 30 and 60 FPS', () => {
    const a = rig();
    const b = rig();
    const focus = new THREE.Vector3(5, 0, 9);
    for (const value of [a, b]) value.tactical.setMode('top');
    for (let i = 0; i < 60; i++) a.tactical.update(1 / 60, focus);
    for (let i = 0; i < 30; i++) b.tactical.update(1 / 30, focus);
    expect(a.camera.position.distanceTo(b.camera.position)).toBeLessThan(1e-8);
    for (const value of [a, b]) value.tactical.setMode('follow');
    for (let i = 0; i < 60; i++) a.tactical.update(1 / 60, focus);
    for (let i = 0; i < 30; i++) b.tactical.update(1 / 30, focus);
    expect(a.camera.position.distanceTo(b.camera.position)).toBeLessThan(1e-8);
  });
});
