import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { MODELS } from './models';
import { MAT, setNightLevel } from './models/palette';
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

const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 200);
camera.position.set(9, 6, 11);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.48;
controls.autoRotateSpeed = 0.8;

const sun = new THREE.DirectionalLight(0xfff4e0, 2.4);
sun.position.set(-14, 6, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 50 });
sun.shadow.bias = -0.0005;
const ambient = new THREE.AmbientLight(0x8a8478, 0.45);
const fill = new THREE.HemisphereLight(0x3a4152, 0x4a4640, 0.35);
scene.add(sun, ambient, fill);

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
  controls.target.set(0, size.y * 0.4, 0);
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
  sun.intensity = night ? 0.05 : 2.4;
  ambient.intensity = night ? 0.12 : 0.45;
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

renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});
