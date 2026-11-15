import * as THREE from 'three';
import { ROVER } from '../game/config';
import { setMode } from '../models/anim';
import { heightAt } from './terrain';

// Driving the expedition rover. Input is a world-space direction (like walking); the rover
// accelerates smoothly, steers towards it, follows the terrain (into the ice crater too)
// and stops against building footprints.

const RADIUS = 1.3;
const TURN_RATE = 1.8; // rad/s at full speed
const WORLD_LIMIT = 70;

export class RoverDriver {
  speed = 0;
  constructor(public obj: THREE.Object3D) {}

  update(dt: number, input: THREE.Vector2, colliders: { box: THREE.Box2 }[]): void {
    const len = Math.min(1, input.length());
    let targetSpeed = 0;
    if (len > 0.08) {
      const heading = Math.atan2(input.x, input.y);
      let turn = heading - this.obj.rotation.y;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      // Steer harder when slow so it can turn in place-ish; drive forward when lined up.
      this.obj.rotation.y += Math.sign(turn) * Math.min(Math.abs(turn), TURN_RATE * dt * (0.6 + 0.4 * len));
      targetSpeed = ROVER.maxSpeed * len * Math.max(0, Math.cos(turn));
    }
    this.speed += Math.sign(targetSpeed - this.speed) * Math.min(Math.abs(targetSpeed - this.speed), ROVER.accel * dt);
    const step = this.speed * dt;
    const nx = this.obj.position.x + Math.sin(this.obj.rotation.y) * step;
    const nz = this.obj.position.z + Math.cos(this.obj.rotation.y) * step;
    const blocked = colliders.some((c) => c.box.distanceToPoint(new THREE.Vector2(nx, nz)) < RADIUS);
    if (blocked) {
      this.speed = 0;
    } else if (Math.hypot(nx, nz) < WORLD_LIMIT) {
      this.obj.position.x = nx;
      this.obj.position.z = nz;
    } else {
      this.speed = 0;
    }
    // Follow the ground, tilting with the slope.
    const p = this.obj.position;
    p.y = heightAt(p.x, p.z);
    const ahead = heightAt(p.x + Math.sin(this.obj.rotation.y) * 1.2, p.z + Math.cos(this.obj.rotation.y) * 1.2);
    const behind = heightAt(p.x - Math.sin(this.obj.rotation.y) * 1.2, p.z - Math.cos(this.obj.rotation.y) * 1.2);
    this.obj.rotation.x = -Math.atan2(ahead - behind, 2.4);
    setMode(this.obj, Math.abs(this.speed) > 0.3 ? 'drive' : 'idle');
  }
}
