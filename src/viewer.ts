import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { MODELS } from './models';
import { MAT, setNightLevel } from './models/palette';
import { createLighting } from './scene/lighting';
import './style.css';
import './viewer.css';

// Model viewer: one model at a time on a regolith disc, under the same low south-pole
// sun the game uses. Lets us polish each model before it goes into the game.

const canvas = document.querySelector<HTMLCanvasElement>('#scene')!;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a0b);

const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 400);
camera.position.set(9, 6, 11);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.48;
controls.autoRotateSpeed = 0.8;

const light = createLighting(scene, 10);

const ground = new THREE.Mesh(new THREE.CylinderGeometry(9, 9.4, 0.4, 24), MAT.regolith);
ground.position.y = -0.2;
ground.receiveShadow = true;
scene.add(ground);

let index = Math.max(0, MODELS.findIndex((m) => `#${m.id}` === location.hash));
let current: THREE.Group | null = null;

function triangles(obj: THREE.Object3D): number {
  let n = 0;
  obj.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      const g = o.geometry as THREE.BufferGeometry;
      n += (g.index ? g.index.count : g.getAttribute('position').count) / 3;
    }
  });
  return Math.round(n);
}

function show(i: number): void {
  index = (i + MODELS.length) % MODELS.length;
  const entry = MODELS[index];
  if (current) scene.remove(current);
  current = entry.build();
  scene.add(current);
  const box = new THREE.Box3().setFromObject(current);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  controls.target.set(center.x, size.y * 0.35, center.z);
  const groundR = Math.max(9, Math.hypot(size.x, size.z) * 0.62);
  ground.scale.set(groundR / 9, 1, groundR / 9);
  ground.position.set(center.x, -0.2, center.z);
  light.sun.position.set(center.x - 16, 6, center.z + 9);
  light.sun.target.position.copy(center);
  const ext = Math.max(10, groundR);
  Object.assign(light.sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext });
  light.sun.shadow.camera.updateProjectionMatrix();
  // Frame the model: keep the viewing direction, set the distance from its size.
  const dist = Math.max(size.x, size.y, size.z) * (entry.id === 'lineup' || entry.id.endsWith('progression') ? 0.75 : 1.9) + 3;
  const dir = camera.position.clone().sub(controls.target).normalize();
  camera.position.copy(controls.target).addScaledVector(dir, dist);
  const tiles = current.userData.tiles as [number, number];
  document.querySelector('#name')!.textContent = entry.name;
  document.querySelector('#stats')!.textContent =
    ` · ${triangles(current)} triángulos · ${tiles[0]}×${tiles[1]} casillas · ${size.x.toFixed(1)}×${size.y.toFixed(1)}×${size.z.toFixed(1)} m`;
  history.replaceState(null, '', `#${entry.id}`);
}

let night = false;
document.querySelector('#prev')!.addEventListener('click', () => show(index - 1));
document.querySelector('#next')!.addEventListener('click', () => show(index + 1));
document.querySelector('#spin')!.addEventListener('click', () => (controls.autoRotate = !controls.autoRotate));
document.querySelector('#night')!.addEventListener('click', (e) => {
  night = !night;
  setNightLevel(night ? 1 : 0);
  light.setNight(night ? 1 : 0);
  (e.target as HTMLButtonElement).textContent = night ? 'Día' : 'Noche';
});

function resize(): void {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();
show(index);

if (import.meta.env.DEV) Object.assign(window, { camera, controls });

renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});
