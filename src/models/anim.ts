import * as THREE from 'three';

// Minimal animation system for code-built models. A model registers animators (functions
// of time) and the modes it supports; the game or the viewer sets the mode and calls
// animateModel() every frame. Animators only move pivots, never rebuild geometry.

export type AnimMode = 'idle' | 'walk' | 'work' | 'drive' | 'jump' | 'land';
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
    if (list) {
      const mode = (o.userData.mode as AnimMode | undefined) ?? 'idle';
      for (const fn of list) fn(t, dt, mode);
    }
    // Generic poke reaction: a soft squash and settle.
    if (o.userData.pokedAt !== undefined) {
      const b = pokeBounce(pokeAge(o, t));
      o.scale.set(1 + b * 0.03, 1 - b * 0.05, 1 + b * 0.03);
    }
  });
}

/** Empty group used as a joint: children hang from it and rotate around its origin. */
export function joint(parent: THREE.Object3D, x: number, y: number, z: number): THREE.Group {
  const j = new THREE.Group();
  j.userData.joint = true; // animated: keep it out of static mesh merging
  j.position.set(x, y, z);
  parent.add(j);
  return j;
}

/** Smoothly approach a target value (frame-rate independent). */
export function approach(current: number, target: number, rate: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-rate * dt));
}

// ---------------------------------------------------------------------------------------
// Interaction: tapping a structure "pokes" it. Every model gives a small squash-and-settle
// bounce, and models can add their own reaction by reading pokeAge() in their animator.

export function poke(model: THREE.Object3D, t: number): void {
  model.userData.pokedAt = t;
}

/** Seconds since the model was last poked (Infinity if never). */
export function pokeAge(model: THREE.Object3D, t: number): number {
  const at = model.userData.pokedAt as number | undefined;
  return at === undefined ? Infinity : t - at;
}

/** Damped bounce for a poke: starts at 0, wobbles, settles back to 0 in ~0.7 s. */
export function pokeBounce(age: number): number {
  return age < 0.7 ? Math.sin(age * Math.PI * 4.5) * Math.exp(-age * 5) : 0;
}

/** Walk up from a picked mesh to the nearest buildable model (skips preview groups). */
export function findModel(o: THREE.Object3D | null): THREE.Object3D | null {
  while (o) {
    const id = o.userData.id as string | undefined;
    if (id && id !== 'lineup' && id !== 'progression') return o;
    o = o.parent;
  }
  return null;
}
