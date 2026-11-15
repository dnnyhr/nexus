import * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createOrbitalScene } from './orbit';
import { DURATIONS, ease, segment, shot, type SequenceKind } from './timeline';
import { mountCinemaUI } from './overlay';

export interface CinemaHost {
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  scene: THREE.Scene;
  lander: THREE.Object3D;
  astronaut: THREE.Object3D;
  reducedMotion?: () => boolean;
  ui?: typeof mountCinemaUI;
}
export type CinemaEnd = 'complete' | 'skipped' | 'interrupted';

export class CinematicDirector {
  private flight: ReturnType<CinematicDirector['capture']> | null = null;
  private readonly target = new THREE.Vector3();
  private readonly position = new THREE.Vector3();
  private readonly motion = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;

  constructor(private readonly host: CinemaHost) {}
  get active(): boolean { return this.flight !== null; }
  get kind(): SequenceKind | null { return this.flight?.kind ?? null; }
  get elapsed(): number { return this.flight?.time ?? 0; }
  get renderScene(): THREE.Scene { return this.flight?.orbital && shot(this.flight.kind, this.flight.time).orbital ? this.flight.orbital.scene : this.host.scene; }

  private capture(kind: SequenceKind, done: (reason: CinemaEnd) => void) {
    const { camera, controls, lander, astronaut } = this.host;
    return {
      kind, done, time: 0,
      cameraPosition: camera.position.clone(), cameraQuaternion: camera.quaternion.clone(), target: controls.target.clone(),
      fov: camera.fov, near: camera.near, far: camera.far, zoom: camera.zoom,
      enabled: controls.enabled, damping: controls.enableDamping, autoRotate: controls.autoRotate,
      landerPosition: lander.position.clone(), landerVisible: lander.visible,
      astronautVisible: astronaut.visible,
      orbital: null as ReturnType<typeof createOrbitalScene> | null,
      ui: null as ReturnType<typeof mountCinemaUI> | null,
      boarding: null as THREE.Object3D | null,
      dust: null as THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial> | null,
    };
  }

  start(kind: SequenceKind, done: (reason: CinemaEnd) => void): boolean {
    if (this.active) return false;
    const flight = this.capture(kind, done);
    this.flight = flight;
    const { controls, camera, astronaut, lander, scene } = this.host;
    controls.enabled = false;
    controls.autoRotate = false;
    controls.enableDamping = false;
    controls.update();
    camera.position.copy(flight.cameraPosition);
    camera.quaternion.copy(flight.cameraQuaternion);
    controls.target.copy(flight.target);
    try {
      if (this.host.reducedMotion?.() ?? this.motion?.matches ?? false) { this.finish('skipped'); return true; }
      flight.ui = (this.host.ui ?? mountCinemaUI)(kind, () => this.skip());
      if (kind === 'arrival') flight.orbital = createOrbitalScene();
      if (kind !== 'victory') {
        astronaut.visible = false;
        flight.dust = new THREE.Mesh(new THREE.RingGeometry(1.8, 3.2, 32), new THREE.MeshBasicMaterial({ color: 0xa9a396, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
        flight.dust.rotation.x = -Math.PI / 2;
        flight.dust.position.copy(lander.position).add(new THREE.Vector3(0, 0.08, 0));
        scene.add(flight.dust);
      }
      if (kind === 'evacuation') {
        flight.boarding = astronaut.clone(true);
        flight.boarding.visible = true;
        scene.add(flight.boarding);
      }
      this.update(0);
      return true;
    } catch {
      this.finish('interrupted');
      return true;
    }
  }

  update(dt: number): void {
    const f = this.flight;
    if (!f || !Number.isFinite(dt) || dt < 0) return;
    f.time = Math.min(DURATIONS[f.kind], f.time + dt);
    if (f.time === DURATIONS[f.kind]) { this.finish('complete'); return; }
    const { camera, controls, lander, astronaut } = this.host;
    const t = f.time;
    const frame = shot(f.kind, t);
    f.ui?.update(frame.text, frame.mask);
    camera.zoom = 1;
    camera.near = frame.orbital ? 0.01 : f.near;
    camera.far = frame.orbital ? 1500 : f.far;
    camera.fov = f.fov;
    if (frame.orbital) {
      const halfFov = THREE.MathUtils.degToRad(f.fov / 2);
      const limitingFov = Math.min(halfFov, Math.atan(Math.tan(halfFov) * camera.aspect));
      const distance = 6.371 / Math.sin(limitingFov) * 1.2;
      if (t < 3.2) {
        const u = ease(segment(t, 0, 3.2));
        this.position.set(-0.65 + u * 0.47, 0.25, 0.72 + u * 0.23).normalize().multiplyScalar(distance * (1 + u * 0.25));
        this.target.set(0, 0, 0);
      } else {
        const u = ease(segment(t, 3.2, 9));
        this.position.set(-0.18, 0.25, 0.95).normalize().multiplyScalar(distance * 1.25).lerp(this.target.set(381, 1.9, 3.4), u);
        this.target.set(384.4 * ease(segment(t, 3.2, 4.4)), 0, 0);
      }
    } else if (f.kind === 'arrival') {
      const descent = ease(segment(t, 9, 13));
      lander.position.copy(f.landerPosition).add(this.position.set(0, 26 * (1 - descent), 0));
      this.position.copy(f.landerPosition).add(new THREE.Vector3(15, 14 + 22 * (1 - descent), 21));
      this.target.copy(lander.position).add(new THREE.Vector3(0, 2, 0));
      const handover = ease(segment(t, 13, 16));
      this.position.lerp(f.cameraPosition, handover);
      this.target.lerp(f.target, handover);
      camera.fov = THREE.MathUtils.lerp(40, f.fov, handover);
      astronaut.visible = t >= 13.6 && f.astronautVisible;
      if (f.dust) {
        f.dust.material.opacity = t < 13 ? 0.18 * segment(t, 11.5, 13) : 0.18 * (1 - segment(t, 13, 14.5));
        f.dust.scale.setScalar(1 + segment(t, 11.5, 14.5) * 2);
      }
    } else if (f.kind === 'evacuation') {
      const board = ease(segment(t, 0, 2));
      if (f.boarding) {
        f.boarding.position.copy(f.landerPosition).add(new THREE.Vector3(3 * (1 - board), 0.8 * board, 2.5 * (1 - board)));
        f.boarding.visible = t < 1.8;
      }
      const ascent = ease(segment(t, 2, 7));
      lander.position.copy(f.landerPosition).add(new THREE.Vector3(0, 60 * ascent, 0));
      this.target.copy(lander.position).add(new THREE.Vector3(0, 2, 0));
      this.position.copy(f.landerPosition).add(new THREE.Vector3(18 + 20 * ascent, 14 + 35 * ascent, 24 + 30 * ascent));
      const entry = ease(segment(t, 0, 1.5));
      this.position.lerp(f.cameraPosition, 1 - entry);
      this.target.lerp(f.target, 1 - entry);
      if (f.dust) {
        f.dust.material.opacity = 0.2 * segment(t, 1.8, 2.5) * (1 - segment(t, 2.5, 4));
        f.dust.scale.setScalar(1 + ascent * 4);
      }
    } else {
      const u = ease(segment(t, 0, 5.3));
      this.target.copy(f.target).lerp(new THREE.Vector3(0, 1, 0), u);
      this.position.copy(f.cameraPosition).lerp(new THREE.Vector3(26, 26, 30), u);
    }
    camera.position.copy(this.position);
    controls.target.copy(this.target);
    camera.lookAt(this.target);
    camera.updateProjectionMatrix();
  }

  skip(): void { this.finish('skipped'); }
  interrupt(): void { this.finish('interrupted'); }

  private finish(reason: CinemaEnd): void {
    const f = this.flight;
    if (!f) return;
    this.flight = null;
    const { camera, controls, lander, astronaut } = this.host;
    camera.position.copy(f.cameraPosition);
    camera.quaternion.copy(f.cameraQuaternion);
    camera.fov = f.fov; camera.near = f.near; camera.far = f.far; camera.zoom = f.zoom;
    camera.updateProjectionMatrix();
    controls.target.copy(f.target);
    controls.enabled = f.enabled; controls.enableDamping = f.damping; controls.autoRotate = f.autoRotate;
    lander.position.copy(f.landerPosition); lander.visible = f.landerVisible;
    astronaut.visible = f.astronautVisible;
    f.boarding?.removeFromParent();
    if (f.dust) { f.dust.removeFromParent(); f.dust.geometry.dispose(); f.dust.material.dispose(); }
    f.orbital?.dispose();
    f.ui?.destroy();
    f.done(reason);
  }
}
