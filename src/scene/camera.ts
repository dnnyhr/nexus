import * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { BUILD_RADIUS } from './terrain';

export type CameraMode = 'follow' | 'isometric' | 'top';

export interface TacticalCameraOptions {
  center?: THREE.Vector3;
  radius?: number;
  reducedMotion?: () => boolean;
}

function transitionEase(progress: number): number {
  if (progress === 0 || progress === 1) return progress;
  let low = 0;
  let high = 1;
  for (let i = 0; i < 16; i++) {
    const t = (low + high) / 2;
    const x = 3 * (1 - t) ** 2 * t * 0.23 + 3 * (1 - t) * t ** 2 * 0.32 + t ** 3;
    if (x < progress) low = t;
    else high = t;
  }
  return 1 - (1 - (low + high) / 2) ** 3;
}

export class TacticalCamera {
  private current: CameraMode = 'follow';
  private elapsed = 0;
  private moving = false;
  private disposed = false;
  private enabled: boolean;
  private readonly saved;
  private readonly center: THREE.Vector3;
  private readonly radius: number;
  private readonly followOffset = new THREE.Vector3();
  private readonly fromTarget = new THREE.Vector3();
  private readonly toTarget = new THREE.Vector3();
  private readonly offset = new THREE.Vector3();
  private readonly fromOrbit = new THREE.Spherical();
  private readonly toOrbit = new THREE.Spherical();
  private readonly orbit = new THREE.Spherical();
  private readonly focus = new THREE.Vector3();
  private readonly motionQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly controls: OrbitControls,
    private readonly opts: TacticalCameraOptions = {},
  ) {
    this.saved = {
      minDistance: controls.minDistance, maxDistance: controls.maxDistance,
      minPolarAngle: controls.minPolarAngle, maxPolarAngle: controls.maxPolarAngle,
      enableDamping: controls.enableDamping, enabled: controls.enabled,
    };
    this.enabled = controls.enabled;
    this.center = opts.center?.clone() ?? new THREE.Vector3(0, 0.8, 0);
    this.radius = Number.isFinite(opts.radius) && opts.radius! > 0 ? opts.radius! : BUILD_RADIUS;
    this.followOffset.subVectors(camera.position, controls.target);
    this.focus.copy(controls.target);
  }

  get mode(): CameraMode { return this.current; }
  get transitioning(): boolean { return this.moving; }

  setEnabled(enabled: boolean): void {
    if (this.disposed) return;
    this.enabled = enabled;
    this.controls.enabled = enabled && !this.moving;
  }

  setMode(mode: CameraMode): void {
    if (this.disposed || this.current === mode) return;
    if (this.current === 'follow' && !this.moving) this.followOffset.subVectors(this.camera.position, this.controls.target);
    this.current = mode;
    this.begin();
  }

  resize(): void {
    if (!this.disposed && this.current !== 'follow') this.begin();
  }

  private begin(): void {
    const c = this.controls;
    this.fromTarget.copy(c.target);
    this.offset.subVectors(this.camera.position, c.target);
    this.fromOrbit.setFromVector3(this.offset);
    c.enableDamping = false;
    c.update();
    c.target.copy(this.fromTarget);
    this.camera.position.copy(this.fromTarget).add(this.offset);
    this.camera.lookAt(c.target);
    this.toTarget.copy(this.current === 'follow' ? this.focus : this.center);
    if (this.current === 'follow') this.toOrbit.setFromVector3(this.followOffset);
    else {
      const vertical = THREE.MathUtils.degToRad(this.camera.fov);
      const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * Math.max(0.1, this.camera.aspect));
      const distance = this.radius / Math.sin(Math.min(vertical, horizontal) / 2);
      this.toOrbit.set(distance, this.current === 'top' ? 0.035 : Math.acos(1 / Math.sqrt(3)), Math.PI / 4);
    }
    const delta = this.toOrbit.theta - this.fromOrbit.theta;
    this.toOrbit.theta = this.fromOrbit.theta + Math.atan2(Math.sin(delta), Math.cos(delta));
    c.minDistance = 0;
    c.maxDistance = Infinity;
    c.minPolarAngle = 0.001;
    c.maxPolarAngle = Math.PI / 2;
    c.enabled = false;
    this.elapsed = 0;
    this.moving = true;
    if (this.reduceMotion()) this.update(0, this.focus);
  }

  private reduceMotion(): boolean {
    return this.opts.reducedMotion?.() ?? this.motionQuery?.matches ?? false;
  }

  update(dt: number, focus: THREE.Vector3): void {
    if (this.disposed) return;
    if (Number.isFinite(focus.x) && Number.isFinite(focus.y) && Number.isFinite(focus.z)) this.focus.set(focus.x, 0.8, focus.z);
    const step = Number.isFinite(dt) ? Math.max(0, dt) : 0;
    const c = this.controls;
    if (this.moving) {
      this.elapsed += step;
      const progress = this.reduceMotion() ? 1 : Math.min(1, this.elapsed / 0.28);
      const t = transitionEase(progress);
      if (this.current === 'follow') this.toTarget.copy(this.focus);
      c.target.lerpVectors(this.fromTarget, this.toTarget, t);
      this.orbit.set(
        THREE.MathUtils.lerp(this.fromOrbit.radius, this.toOrbit.radius, t),
        THREE.MathUtils.lerp(this.fromOrbit.phi, this.toOrbit.phi, t),
        THREE.MathUtils.lerp(this.fromOrbit.theta, this.toOrbit.theta, t),
      );
      this.camera.position.copy(c.target).add(this.offset.setFromSpherical(this.orbit));
      if (progress === 1) {
        c.target.copy(this.toTarget);
        this.moving = false;
        c.minDistance = this.current === 'follow' ? this.saved.minDistance : this.toOrbit.radius * 0.5;
        c.maxDistance = this.current === 'follow' ? this.saved.maxDistance : this.toOrbit.radius * 2;
        c.minPolarAngle = this.current === 'top' ? 0.035 : this.saved.minPolarAngle;
        c.maxPolarAngle = this.current === 'top' ? 0.035 : this.saved.maxPolarAngle;
        c.enableDamping = this.saved.enableDamping;
        c.enabled = this.enabled;
      }
    } else if (this.current === 'follow') {
      this.offset.subVectors(this.focus, c.target).multiplyScalar(1 - Math.exp(-4 * step));
      c.target.add(this.offset);
      this.camera.position.add(this.offset);
    }
    c.update();
  }

  destroy(): void {
    if (this.disposed) return;
    Object.assign(this.controls, this.saved);
    this.moving = false;
    this.disposed = true;
  }
}
