import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Draw-call reduction. Each model is made of hundreds of small meshes, and every mesh is
// one draw call (two with shadows). mergeStatic() bakes meshes into one mesh per material,
// at every level of the hierarchy: the static body of a building becomes a few meshes, and
// inside each animated pivot (joint() groups or nodes flagged userData.dynamic) its own
// static parts are merged too, so a wheel, a limb or a plant still moves as one piece.
// Materials are kept by reference, so per-instance effects (beacons, battery lights) work.

function isPivot(o: THREE.Object3D): boolean {
  return !!(o.userData.joint || o.userData.dynamic);
}

/** Merge the meshes that move with `root` (stopping at nested pivots), then recurse into them. */
export function mergeStatic(root: THREE.Object3D): void {
  root.updateMatrixWorld(true);
  const toRoot = root.matrixWorld.clone().invert();
  const byMaterial = new Map<THREE.Material, { geos: THREE.BufferGeometry[]; shadow: boolean }>();
  const merged: THREE.Mesh[] = [];
  const pivots: THREE.Object3D[] = [];

  const visit = (o: THREE.Object3D) => {
    for (const child of [...o.children]) {
      if (isPivot(child)) {
        pivots.push(child);
        continue;
      }
      if (child instanceof THREE.Mesh && !Array.isArray(child.material) && !child.geometry.getAttribute('color')) {
        const g = child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone();
        for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
        g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(toRoot, child.matrixWorld));
        const entry = byMaterial.get(child.material) ?? { geos: [], shadow: false };
        entry.geos.push(g);
        entry.shadow ||= child.castShadow;
        byMaterial.set(child.material, entry);
        merged.push(child);
      }
      visit(child);
    }
  };
  visit(root);

  if (merged.length > 1) {
    for (const o of merged) o.parent?.remove(o);
    for (const [mat, { geos, shadow }] of byMaterial) {
      const geo = mergeGeometries(geos, false);
      geos.forEach((g) => g.dispose());
      if (!geo) continue;
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = shadow;
      m.receiveShadow = true;
      m.name = 'merged';
      root.add(m);
    }
  }
  for (const p of pivots) mergeStatic(p);
}

/** Small details (leaves, drops, sparks) don't need to cast shadows. */
export function noShadows(root: THREE.Object3D): void {
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = false;
  });
}
