import * as THREE from 'three';
import { addAnimator } from './anim';
import { MAT } from './palette';
import { mesh } from './kit';

// Micrometeoroid damage on any model. Impact sites are found on the model's real surface by
// casting rays at it from around; each site gets a scorch mark, a puncture with metal petals
// bent outwards, and some get sparks. Heavily damaged models also smoke. The number of
// visible sites grows with the damage level (userData.damage, 0-1).

const SITES = 7;

function findSites(model: THREE.Object3D): { point: THREE.Vector3; normal: THREE.Vector3 }[] {
  model.updateMatrixWorld(true);
  const meshes: THREE.Mesh[] = [];
  model.traverse((o) => {
    if (o instanceof THREE.Mesh && !(o.material as THREE.Material).transparent && o.visible) meshes.push(o);
  });
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const reach = size.length();
  const ray = new THREE.Raycaster();
  const sites: { point: THREE.Vector3; normal: THREE.Vector3 }[] = [];
  for (let i = 0; i < 24 && sites.length < SITES; i++) {
    const az = i * 2.39996; // golden angle: spread evenly around
    const el = 0.15 + ((i * 0.618) % 1) * 0.6;
    const dir = new THREE.Vector3(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el));
    const target = center.clone().add(new THREE.Vector3(0, (((i * 0.37) % 1) - 0.4) * size.y * 0.6, 0));
    ray.set(target.clone().addScaledVector(dir, reach), dir.clone().negate());
    const hit = ray.intersectObjects(meshes, false)[0];
    if (!hit?.face || hit.point.y < 0.3) continue;
    const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    if (normal.dot(dir) < 0.2) continue;
    if (sites.some((s) => s.point.distanceTo(hit.point) < 0.5)) continue;
    sites.push({ point: model.worldToLocal(hit.point.clone()), normal: normal.transformDirection(new THREE.Matrix4().copy(model.matrixWorld).invert()) });
  }
  return sites;
}

function buildLayer(model: THREE.Object3D): THREE.Group {
  const layer = new THREE.Group();
  layer.name = 'damage';
  const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffd27a });
  const smokeMat = new THREE.MeshLambertMaterial({ color: 0x3a3836, transparent: true, opacity: 0.5, depthWrite: false, flatShading: true });
  const sparks: THREE.Mesh[] = [];
  const smoke: THREE.Mesh[] = [];
  findSites(model).forEach((site, i) => {
    const g = new THREE.Group();
    g.position.copy(site.point);
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), site.normal);
    const r = 0.16 + ((i * 0.53) % 1) * 0.16;
    g.add(mesh(new THREE.CircleGeometry(r, 10), MAT.scorch, { pos: [0, 0, 0.012] }));
    g.add(mesh(new THREE.CircleGeometry(r * 0.32, 8), MAT.hole, { pos: [0, 0, 0.016] }));
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + i;
      const petal = mesh(new THREE.BoxGeometry(0.05, r * 0.32, 0.012), MAT.hullShade, {
        pos: [Math.cos(a) * r * 0.36, Math.sin(a) * r * 0.36, 0.03],
        rot: [0, 0, a - Math.PI / 2],
      });
      petal.rotateX(-0.7);
      g.add(petal);
    }
    if (i % 2 === 0) {
      const sp = new THREE.Mesh(new THREE.OctahedronGeometry(0.035, 0), sparkMat);
      sp.position.set(0, 0, 0.03);
      g.add(sp);
      sparks.push(sp);
    }
    if (i < 3) {
      const sm = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), smokeMat);
      sm.position.set(0, 0, 0.1);
      g.add(sm);
      smoke.push(sm);
    }
    g.userData.order = i;
    layer.add(g);
  });

  addAnimator(model, (t) => {
    const d = (model.userData.damage as number | undefined) ?? 0;
    const shown = Math.ceil(d * SITES);
    layer.children.forEach((c) => (c.visible = (c.userData.order as number) < shown));
    sparks.forEach((sp, i) => {
      // Short crackles at random-looking moments.
      const on = Math.sin(t * 23 + i * 7) * Math.sin(t * 5.3 + i) > 0.55;
      sp.visible = d > 0.25 && on;
      sp.scale.setScalar(0.6 + Math.abs(Math.sin(t * 40 + i)) * 0.8);
    });
    smoke.forEach((sm, i) => {
      const u = (t * 0.35 + i * 0.33) % 1;
      sm.visible = d > 0.5;
      sm.position.z = 0.1 + u * 1.2;
      sm.scale.setScalar(0.5 + u * 1.4);
    });
    smokeMat.opacity = 0.45 * (1 - ((t * 0.35) % 1) * 0.6);
  });
  return layer;
}

/** Show micrometeoroid damage on a model (0 = intact, 1 = badly hit). */
export function setDamage(model: THREE.Object3D, d: number): void {
  model.userData.damage = d;
  if (d > 0 && !model.getObjectByName('damage')) model.add(buildLayer(model));
}
