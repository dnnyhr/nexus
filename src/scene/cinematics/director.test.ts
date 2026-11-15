import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { describe, expect, it } from 'vitest';
import { CinematicDirector, type CinemaEnd } from './director';
import { DURATIONS, shot, type SequenceKind } from './timeline';

function setup(reducedMotion = false) {
  const camera = new THREE.PerspectiveCamera(40, 1.7, 0.5, 700);
  camera.position.set(2, 13, 18);
  const controls = new OrbitControls(camera);
  controls.target.set(-9, 0.8, 4);
  controls.enableDamping = true;
  controls.update();
  const scene = new THREE.Scene();
  const lander = new THREE.Group(); lander.position.set(-18, 0, 12);
  const astronaut = new THREE.Group();
  scene.add(lander, astronaut);
  const endings: CinemaEnd[] = [];
  let cleaned = 0;
  const director = new CinematicDirector({ camera, controls, scene, lander, astronaut, reducedMotion: () => reducedMotion,
    ui: () => ({ update() {}, destroy() { cleaned++; } }),
  });
  const saved = { position: camera.position.clone(), quaternion: camera.quaternion.clone(), target: controls.target.clone() };
  return { camera, controls, scene, lander, astronaut, director, saved, endings, finish: (reason: CinemaEnd) => endings.push(reason), cleaned: () => cleaned };
}

function restored(rig: ReturnType<typeof setup>) {
  expect(rig.camera.position.toArray()).toEqual(rig.saved.position.toArray());
  expect(rig.camera.quaternion.toArray()).toEqual(rig.saved.quaternion.toArray());
  expect(rig.controls.target.toArray()).toEqual(rig.saved.target.toArray());
  expect(rig.camera.near).toBe(0.5); expect(rig.camera.far).toBe(700);
  expect(rig.controls.enabled).toBe(true); expect(rig.controls.enableDamping).toBe(true);
  expect(rig.lander.position.toArray()).toEqual([-18, 0, 12]);
  expect(rig.astronaut.visible).toBe(true);
  expect(rig.scene.children).toHaveLength(2);
}

describe('cinematic camera lifecycle', () => {
  it.each(['arrival', 'evacuation', 'victory'] as SequenceKind[])('finishes %s exactly once and restores borrowed scene/camera', kind => {
    const rig = setup();
    rig.director.start(kind, rig.finish);
    expect(rig.controls.enabled).toBe(false);
    expect(rig.director.start(kind, rig.finish)).toBe(false);
    rig.director.update(DURATIONS[kind] / 2);
    rig.director.update(DURATIONS[kind] / 2);
    rig.director.skip(); rig.director.interrupt(); rig.director.update(100);
    expect(rig.endings).toEqual(['complete']);
    expect(rig.cleaned()).toBe(1);
    restored(rig);
  });
  it.each([0, 2, 6, 8.99, 9, 12.9, 15.99])('safe arrival skip at %s seconds', time => {
    const rig = setup(); rig.director.start('arrival', rig.finish); rig.director.update(time);
    rig.director.skip(); rig.director.skip();
    expect(rig.endings).toEqual(['skipped']); restored(rig);
  });
  it('approaches the exact gameplay pose before releasing camera', () => {
    const rig = setup(); rig.director.start('arrival', rig.finish); rig.director.update(15.999);
    expect(rig.camera.position.distanceTo(rig.saved.position)).toBeLessThan(0.001);
    expect(rig.controls.target.distanceTo(rig.saved.target)).toBeLessThan(0.001);
    rig.director.update(0.001); restored(rig);
  });
  it('reduced motion has no orbital allocation or camera movement', () => {
    const rig = setup(true); rig.director.start('arrival', rig.finish);
    expect(rig.endings).toEqual(['skipped']); expect(rig.cleaned()).toBe(0); restored(rig);
  });
  it('invalid deltas do not contaminate pose; interruption allows another flight', () => {
    const rig = setup(); rig.director.start('evacuation', rig.finish);
    rig.director.update(NaN); rig.director.update(-1);
    expect(rig.director.elapsed).toBe(0);
    rig.director.interrupt(); restored(rig);
    expect(rig.director.start('victory', rig.finish)).toBe(true);
    rig.director.skip(); expect(rig.endings).toEqual(['interrupted', 'skipped']);
  });
  it('same scene pose at same cinematic time regardless of frame grouping', () => {
    const a = setup(), b = setup();
    a.director.start('arrival', a.finish); b.director.start('arrival', b.finish);
    for (let i = 0; i < 360; i++) a.director.update(1 / 30);
    b.director.update(12);
    expect(a.camera.position.distanceTo(b.camera.position)).toBeLessThan(1e-8);
    a.director.skip(); b.director.skip();
  });
  it('scene scale switch is covered by an explicit orbital ellipsis', () => {
    expect(shot('arrival', 8.999).mask).toBeGreaterThan(0.99);
    expect(shot('arrival', 9).orbital).toBe(false);
    expect(shot('arrival', 9).mask).toBe(1);
    expect(shot('arrival', 15.999).mask).toBe(0);
  });
});
