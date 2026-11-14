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
