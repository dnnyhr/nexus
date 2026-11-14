import * as THREE from 'three';
import { setMode } from '../models/anim';
import { astronaut } from '../models/astronaut';
import { heightAt } from './terrain';

// The astronaut, driven by the player. Movement comes as a 2D input (joystick or keys,
// already turned to world directions), the body turns towards where it walks, and it
// slides along building footprints instead of passing through them.

const SPEED = 2.6; // m/s, a brisk lunar lope
const RADIUS = 0.35; // body radius for collisions
const WORLD_LIMIT = 60;

export class Player {
  readonly obj = astronaut();
  private busy = 0;
  private onDone: (() => void) | null = null;

  constructor(start: THREE.Vector3) {
    this.obj.position.copy(start);
  }

  get position(): THREE.Vector3 {
    return this.obj.position;
  }

  /** Play the work animation for `seconds`, then run `done` (e.g. add regolith). */
  work(seconds: number, done: () => void): boolean {
    if (this.busy > 0) return false;
    this.busy = seconds;
    this.onDone = done;
    return true;
  }

  isBusy(): boolean {
    return this.busy > 0;
  }

  update(dt: number, input: THREE.Vector2, colliders: { box: THREE.Box2 }[], hidden: boolean): void {
    this.obj.visible = !hidden;
    if (hidden) return;
    if (this.busy > 0) {
      this.busy -= dt;
      setMode(this.obj, 'work');
      if (this.busy <= 0) {
        const done = this.onDone;
        this.onDone = null;
        done?.();
      }
      return;
    }
    const len = Math.min(1, input.length());
    if (len < 0.08) {
      setMode(this.obj, 'idle');
      return;
    }
    setMode(this.obj, 'walk');
    const heading = Math.atan2(input.x, input.y);
    let turn = heading - this.obj.rotation.y;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    this.obj.rotation.y += turn * Math.min(1, dt * 10);

    const step = SPEED * len * dt;
    const next = new THREE.Vector2(this.position.x + (input.x / input.length()) * step, this.position.z + (input.y / input.length()) * step);
    // Resolve each axis separately so the body slides along walls.
    const blocked = (x: number, z: number) => colliders.some((c) => c.box.distanceToPoint(new THREE.Vector2(x, z)) < RADIUS);
    if (!blocked(next.x, this.position.z)) this.position.x = next.x;
    if (!blocked(this.position.x, next.y)) this.position.z = next.y;
    const r = Math.hypot(this.position.x, this.position.z);
    if (r > WORLD_LIMIT) this.position.multiplyScalar(WORLD_LIMIT / r);
    this.position.y = heightAt(this.position.x, this.position.z);
  }
}
