import * as THREE from 'three';
import { MAT } from '../models/palette';

// Small 3D effects: a puff of regolith dust where the player digs. On the Moon there is no
// air, so dust flies in clean arcs and falls straight back instead of hanging in a cloud.

interface Grain { mesh: THREE.Mesh; vel: THREE.Vector3; age: number }

export class Effects {
  readonly group = new THREE.Group();
  private grains: Grain[] = [];
  private geo = new THREE.OctahedronGeometry(0.13, 0);

  dust(at: THREE.Vector3): void {
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + Math.random() * 0.5;
      const m = new THREE.Mesh(this.geo, MAT.regolithPiled);
      m.position.copy(at).add(new THREE.Vector3(0, 0.05, 0));
      this.group.add(m);
      this.grains.push({ mesh: m, vel: new THREE.Vector3(Math.cos(a) * 1.2, 2.2 + Math.random(), Math.sin(a) * 1.2), age: 0 });
    }
  }

  update(dt: number): void {
    const g = 1.62; // lunar gravity, m/s²
    for (const p of this.grains) {
      p.age += dt;
      p.vel.y -= g * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.rotation.x += dt * 5;
    }
    this.grains = this.grains.filter((p) => {
      if (p.age < 2.2 && p.mesh.position.y > -0.2) return true;
      this.group.remove(p.mesh);
      return false;
    });
  }
}

/** Mission marker: a white chevron that bobs above the place the current mission points to. */
export function createMarker(): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
  const chevron = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.8, 4), mat);
  chevron.rotation.x = Math.PI;
  g.add(chevron);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.62, 24), mat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.6;
  g.add(ring);
  g.userData.chevron = chevron;
  return g;
}

/** Impact flash: a bright burst that fades in a fraction of a second. */
export class Flashes {
  readonly group = new THREE.Group();
  private items: { mesh: THREE.Mesh; age: number }[] = [];

  flash(at: THREE.Vector3): void {
    const mat = new THREE.MeshBasicMaterial({ color: 0xfff1c8, transparent: true, opacity: 1, depthWrite: false });
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 1), mat);
    m.position.copy(at);
    this.group.add(m);
    this.items.push({ mesh: m, age: 0 });
  }

  update(dt: number): void {
    for (const f of this.items) {
      f.age += dt;
      f.mesh.scale.setScalar(1 + f.age * 6);
      (f.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - f.age / 0.45);
    }
    this.items = this.items.filter((f) => {
      if (f.age < 0.45) return true;
      this.group.remove(f.mesh);
      f.mesh.geometry.dispose();
      (f.mesh.material as THREE.Material).dispose();
      return false;
    });
  }
}

/** Emergency cargo pod: falls from the sky, lands with dust, stays a while, then is gone. */
export class CargoDrops {
  readonly group = new THREE.Group();
  private pods: { obj: THREE.Group; age: number; at: THREE.Vector3; landed: boolean }[] = [];
  constructor(private onLand: (at: THREE.Vector3) => void) {}

  drop(at: THREE.Vector3): void {
    const pod = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 1.6, 8), MAT.hull);
    body.position.y = 0.8;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.7, 0.7, 8), MAT.hullShade);
    cap.position.y = 1.95;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.2, 8), MAT.bandHabitat);
    band.position.y = 1.1;
    for (const m of [body, cap, band]) { m.castShadow = true; pod.add(m); }
    pod.position.set(at.x, 40, at.z);
    this.group.add(pod);
    this.pods.push({ obj: pod, age: 0, at: at.clone(), landed: false });
  }

  update(dt: number): void {
    for (const p of this.pods) {
      p.age += dt;
      const k = Math.min(1, p.age / 2.5);
      p.obj.position.y = p.at.y + 40 * (1 - k * k);
      if (k >= 1 && !p.landed) {
        p.landed = true;
        this.onLand(p.at);
      }
    }
    this.pods = this.pods.filter((p) => {
      if (p.age < 40) return true;
      this.group.remove(p.obj);
      return false;
    });
  }
}
