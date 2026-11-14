import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { MODELS } from './models';
import { createLighting } from './scene/lighting';
import { createSky } from './scene/sky';
import { createTerrain } from './scene/terrain';
import './style.css';

// Game scene preview: terrain, sky and the base lineup under the south-pole lighting.
// Gameplay arrives in later changes.

const canvas = document.querySelector<HTMLCanvasElement>('#scene')!;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050506);

const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 600);
camera.position.set(26, 22, 30);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0, 0);
controls.enableDamping = true;
controls.minDistance = 12;
controls.maxDistance = 70;
controls.minPolarAngle = 0.35;
controls.maxPolarAngle = 1.36;

createLighting(scene, 24);
scene.add(createSky(), createTerrain());
const base = MODELS.find((m) => m.id === 'lineup')!.build();
scene.add(base);

function resize(): void {
  const { innerWidth: w, innerHeight: h } = window;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});
