import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { MODELS } from './index';

// Z-fighting audit: two surfaces lying in the same plane, facing the same way and
// overlapping, flicker on screen ("texturas que chocan"). For every axis-aligned box and
// cylinder cap in a model, compare its faces against all others and report coplanar
// overlaps. Rotated parts are skipped (their bounding boxes are not exact).

interface Face { mesh: string; axis: 0 | 1 | 2; dir: 1 | -1; at: number; min: [number, number]; max: [number, number] }

const EPS = 0.004;

function axisAligned(m: THREE.Mesh): boolean {
  const q = new THREE.Quaternion();
  m.getWorldQuaternion(q);
  const e = new THREE.Euler().setFromQuaternion(q);
  return [e.x, e.y, e.z].every((a) => Math.abs(Math.sin(a * 2)) < 1e-3);
}

function faces(root: THREE.Object3D): Face[] {
  const out: Face[] = [];
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const geo = o.geometry;
    const isBox = geo instanceof THREE.BoxGeometry;
    const isCyl = geo instanceof THREE.CylinderGeometry && !geo.parameters.openEnded;
    if (!(isBox || isCyl) || !axisAligned(o) || geo.userData.noAudit) return;
    const mat = o.material as THREE.Material;
    if (mat.transparent) return;
    const b = new THREE.Box3().setFromObject(o);
    const lo = b.min.toArray() as number[];
    const hi = b.max.toArray() as number[];
    const name = `${geo.type}@${b.getCenter(new THREE.Vector3()).toArray().map((v) => v.toFixed(2)).join(',')}`;
    for (const axis of [0, 1, 2] as const) {
      // Cylinders only have flat faces along their own axis; skip their sides.
      if (isCyl) {
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(o.getWorldQuaternion(new THREE.Quaternion()));
        if (Math.abs(up.getComponent(axis)) < 0.9) continue;
      }
      const others = [0, 1, 2].filter((a) => a !== axis) as [number, number];
      for (const dir of [1, -1] as const) {
        out.push({
          mesh: name, axis, dir, at: dir > 0 ? hi[axis] : lo[axis],
          min: [lo[others[0]], lo[others[1]]], max: [hi[others[0]], hi[others[1]]],
        });
      }
    }
  });
  return out;
}

function zFights(root: THREE.Object3D): string[] {
  const f = faces(root);
  const issues: string[] = [];
  for (let i = 0; i < f.length; i++) {
    for (let j = i + 1; j < f.length; j++) {
      const a = f[i];
      const b = f[j];
      if (a.mesh === b.mesh || a.axis !== b.axis || a.dir !== b.dir || Math.abs(a.at - b.at) > EPS) continue;
      // Bottom faces resting on the ground are never visible.
      if (a.axis === 1 && a.dir < 0 && Math.abs(a.at) < 0.01) continue;
      const ox = Math.min(a.max[0], b.max[0]) - Math.max(a.min[0], b.min[0]);
      const oy = Math.min(a.max[1], b.max[1]) - Math.max(a.min[1], b.min[1]);
      if (ox > 0.01 && oy > 0.01) issues.push(`${'xyz'[a.axis]}${a.dir > 0 ? '+' : '-'} ${a.mesh} ~ ${b.mesh}`);
    }
  }
  return issues;
}

describe('models have no coplanar overlapping faces (z-fighting)', () => {
  for (const entry of MODELS.filter((m) => !m.id.endsWith('progression') && m.id !== 'lineup')) {
    it(entry.id, () => {
      expect(zFights(entry.build())).toEqual([]);
    });
  }
});

// Open surfaces (cylinders without caps, partial spheres, discs, rings) have a back side
// that the camera can see. With a single-sided material that side is not drawn and the
// part looks transparent from behind.
function isOpen(geo: THREE.BufferGeometry): boolean {
  if (geo instanceof THREE.CylinderGeometry || geo instanceof THREE.ConeGeometry) {
    return geo.parameters.openEnded || geo.parameters.thetaLength < Math.PI * 2 - 1e-6;
  }
  if (geo instanceof THREE.SphereGeometry) {
    return geo.parameters.phiLength < Math.PI * 2 - 1e-6 || geo.parameters.thetaLength < Math.PI - 1e-6;
  }
  if (geo instanceof THREE.TorusGeometry) return false;
  return geo instanceof THREE.CircleGeometry || geo instanceof THREE.RingGeometry || geo instanceof THREE.PlaneGeometry;
}

describe('open surfaces are double-sided (no see-through backs)', () => {
  for (const entry of MODELS.filter((m) => !m.id.endsWith('progression') && m.id !== 'lineup')) {
    it(entry.id, () => {
      const bad: string[] = [];
      entry.build().traverse((o) => {
        if (o instanceof THREE.Mesh && isOpen(o.geometry) && (o.material as THREE.Material).side !== THREE.DoubleSide) {
          bad.push(o.geometry.type);
        }
      });
      expect(bad).toEqual([]);
    });
  }
});

// Floating parts: every mesh must be connected to the ground through a chain of touching
// parts. Two parts "touch" when their world bounding boxes overlap or are within 2 cm.
// Rotated parts get loose boxes, so this can miss a gap but never invents one.
function floatingParts(root: THREE.Object3D): string[] {
  root.updateMatrixWorld(true);
  const parts: { name: string; box: THREE.Box3 }[] = [];
  root.traverse((o) => {
    if (o instanceof THREE.Mesh && o.visible) {
      const b = new THREE.Box3().setFromObject(o);
      const c = b.getCenter(new THREE.Vector3());
      parts.push({ name: `${o.geometry.type}@${c.toArray().map((v) => v.toFixed(2)).join(',')}`, box: b.expandByScalar(0.02) });
    }
  });
  const grounded = new Set<number>();
  const queue: number[] = [];
  parts.forEach((p, i) => {
    if (p.box.min.y <= 0.03) { grounded.add(i); queue.push(i); }
  });
  while (queue.length) {
    const i = queue.pop()!;
    parts.forEach((p, j) => {
      if (!grounded.has(j) && p.box.intersectsBox(parts[i].box)) { grounded.add(j); queue.push(j); }
    });
  }
  return parts.filter((_, i) => !grounded.has(i)).map((p) => p.name);
}

describe('no floating parts (everything connects to the ground)', () => {
  for (const entry of MODELS.filter((m) => !m.id.endsWith('progression') && m.id !== 'lineup' && m.id !== 'kit')) {
    it(entry.id, () => {
      expect(floatingParts(entry.build())).toEqual([]);
    });
  }
});
