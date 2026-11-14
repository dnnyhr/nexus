import * as THREE from 'three';
import './style.css';

// Minimal bootstrap: renderer, camera and a placeholder ground plane.
// Real terrain, models and gameplay arrive in later changes.

const canvas = document.querySelector<HTMLCanvasElement>('#scene')!;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a0b);

const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 500);
camera.position.set(18, 16, 18);
camera.lookAt(0, 0, 0);

// Low, grazing sun: at the lunar south pole the Sun never rises far above the horizon.
const sun = new THREE.DirectionalLight(0xfff4e0, 2.2);
sun.position.set(-30, 4, 10);
scene.add(sun, new THREE.AmbientLight(0x8a8478, 0.35));

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(60, 60),
  new THREE.MeshLambertMaterial({ color: 0x8e8a82 }),
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

function resize(): void {
  const { innerWidth: w, innerHeight: h } = window;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

renderer.setAnimationLoop(() => renderer.render(scene, camera));
