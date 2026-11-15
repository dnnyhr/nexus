import * as THREE from 'three';
import { setMode } from '../models/anim';
import { astronaut } from '../models/astronaut';
import { heightAt } from './terrain';
import { mergeStatic } from './optimize';

// The astronaut, driven by the player. Movement comes as a 2D input already turned to
// world directions. The body turns where it walks, slides along building footprints, and
// can never get trapped: if a building appears on top of it, it is pushed out to the
// nearest edge. Space makes it hop like Apollo astronauts did: low, short, a bit faster.

const WALK = 2.6; // m/s
const HOP = 3.5; // m/s while airborne: a bit faster than walking, not flying
// A low bunny hop like the Apollo astronauts': ~0.25 m high, ~1.1 s in the air.
const HOP_SPEED_UP = 0.9; // initial vertical speed of a hop, m/s
const MOON_G = 1.62; // m/s², lunar gravity
/** After landing, the knees absorb the impact before the next push-off. */
const LANDING_RECOVERY = 0.35; // s
const LANDING_SPEED = 0.45; // fraction of walking speed while absorbing the landing
const RADIUS = 0.35;
const WORLD_LIMIT = 60;

type Footprint = { box: THREE.Box2 };

export class Player {
  readonly obj = astronaut();
  private busy = 0;
  private onDone: (() => void) | null = null;
  private height = 0;
  private vy = 0;
  private landing = 0;

  constructor(start: THREE.Vector3) {
    this.obj.position.copy(start);
    mergeStatic(this.obj);
  }

  get position(): THREE.Vector3 {
    return this.obj.position;
  }

  resetMotion(): void {
    this.busy = 0;
    this.onDone = null;
    this.height = 0;
    this.vy = 0;
    this.landing = 0;
  }

  get airborne(): boolean {
    return this.height > 0 || this.vy > 0;
  }

  /** Play the work animation for `seconds`, then run `done`. Not while hopping. */
  work(seconds: number, done: () => void): boolean {
    if (this.busy > 0 || this.airborne) return false;
    this.busy = seconds;
    this.onDone = done;
    return true;
  }

  isBusy(): boolean {
    return this.busy > 0;
  }

  /** Push off for a hop: only from the ground and once the last landing is absorbed. */
  jump(): void {
    if (this.busy > 0 || this.airborne || this.landing > 0) return;
    this.vy = HOP_SPEED_UP;
  }

  /** If standing inside a footprint, step out to its nearest edge. */
  unstick(colliders: Footprint[]): void {
    const p = new THREE.Vector2(this.position.x, this.position.z);
    for (const { box } of colliders) {
      if (box.distanceToPoint(p) >= RADIUS) continue;
      const exits = [
        { d: p.x - box.min.x, x: box.min.x - RADIUS - 0.05, z: p.y },
        { d: box.max.x - p.x, x: box.max.x + RADIUS + 0.05, z: p.y },
        { d: p.y - box.min.y, x: p.x, z: box.min.y - RADIUS - 0.05 },
        { d: box.max.y - p.y, x: p.x, z: box.max.y + RADIUS + 0.05 },
      ].sort((a, b) => a.d - b.d);
      p.set(exits[0].x, exits[0].z);
    }
    this.position.x = p.x;
    this.position.z = p.y;
  }

  /** Ride in a vehicle: sit at `seat` (vehicle coordinates), moving and tilting with it. */
  sitAt(vehicle: THREE.Object3D, seat: THREE.Vector3): void {
    this.obj.visible = true;
    this.busy = 0;
    this.height = 0;
    this.vy = 0;
    this.landing = 0;
    vehicle.updateMatrixWorld();
    this.position.copy(seat).applyMatrix4(vehicle.matrixWorld);
    vehicle.getWorldQuaternion(this.obj.quaternion);
    setMode(this.obj, 'sit');
  }

  update(dt: number, input: THREE.Vector2, colliders: Footprint[], hidden: boolean, holdJump: boolean): void {
    this.obj.visible = !hidden;
    if (hidden) return;
    this.obj.rotation.x = 0;
    this.obj.rotation.z = 0;
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

    // Vertical: a hop in lunar gravity; keep hopping while the jump key is held.
    if (this.airborne) {
      this.vy -= MOON_G * dt;
      this.height += this.vy * dt;
      if (this.height <= 0) {
        this.height = 0;
        this.vy = 0;
        this.landing = LANDING_RECOVERY;
      }
    } else if (this.landing > 0) {
      this.landing -= dt;
      // Holding the jump key hops again as soon as the landing is absorbed.
      if (this.landing <= 0 && holdJump) this.jump();
    }

    const len = Math.min(1, input.length());
    if (len >= 0.08) {
      const heading = Math.atan2(input.x, input.y);
      let turn = heading - this.obj.rotation.y;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      this.obj.rotation.y += turn * Math.min(1, dt * 10);
      const speed = this.airborne ? HOP : this.landing > 0 ? WALK * LANDING_SPEED : WALK;
      const step = speed * len * dt;
      const dir = input.clone().normalize();
      const nx = this.position.x + dir.x * step;
      const nz = this.position.z + dir.y * step;
      // A footprint blocks only if we are not already inside it, so we can always walk out.
      const blocked = (x: number, z: number) => colliders.some((c) => {
        const here = c.box.distanceToPoint(new THREE.Vector2(this.position.x, this.position.z)) < RADIUS;
        return !here && c.box.distanceToPoint(new THREE.Vector2(x, z)) < RADIUS;
      });
      if (!blocked(nx, this.position.z)) this.position.x = nx;
      if (!blocked(this.position.x, nz)) this.position.z = nz;
      const r = Math.hypot(this.position.x, this.position.z);
      if (r > WORLD_LIMIT) {
        this.position.x *= WORLD_LIMIT / r;
        this.position.z *= WORLD_LIMIT / r;
      }
    }
    this.position.y = heightAt(this.position.x, this.position.z) + this.height;
    setMode(this.obj, this.airborne ? 'jump' : this.landing > 0 ? 'land' : len >= 0.08 ? 'walk' : 'idle');
  }
}
