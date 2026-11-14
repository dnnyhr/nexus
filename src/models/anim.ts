import * as THREE from 'three';

// Minimal animation system for code-built models. A model registers animators (functions
// of time) and the modes it supports; the game or the viewer sets the mode and calls
// animateModel() every frame. Animators only move pivots, never rebuild geometry.

export type AnimMode = 'idle' | 'walk' | 'work' | 'drive';
export type Animator = (t: number, dt: number, mode: AnimMode) => void;

export function addAnimator(model: THREE.Object3D, fn: Animator): void {
  (model.userData.animators ??= [] as Animator[]).push(fn);
}

export function setModes(model: THREE.Object3D, modes: AnimMode[]): void {
  model.userData.modes = modes;
  model.userData.mode ??= modes[0];
}

export function setMode(model: THREE.Object3D, mode: AnimMode): void {
  model.userData.mode = mode;
}

/** Run the animators of a model and of every animated model inside it. */
export function animateModel(root: THREE.Object3D, t: number, dt: number): void {
  root.traverse((o) => {
    const list = o.userData.animators as Animator[] | undefined;
    if (!list) return;
    const mode = (o.userData.mode as AnimMode | undefined) ?? 'idle';
    for (const fn of list) fn(t, dt, mode);
  });
}

/** Empty group used as a joint: children hang from it and rotate around its origin. */
export function joint(parent: THREE.Object3D, x: number, y: number, z: number): THREE.Group {
  const j = new THREE.Group();
  j.position.set(x, y, z);
  parent.add(j);
  return j;
}

/** Smoothly approach a target value (frame-rate independent). */
export function approach(current: number, target: number, rate: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-rate * dt));
}
