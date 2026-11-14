import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CYCLE } from './game/config';
import { tick, type PowerReport } from './game/sim';
import { cyclePhase, newGame, type GameState } from './game/state';
import { animateSharedMaterials, setNightLevel } from './models/palette';
import { BaseView } from './scene/base';
import { createLighting } from './scene/lighting';
import { createSky } from './scene/sky';
import { BUILD_RADIUS, createTerrain } from './scene/terrain';
import './style.css';

// Game entry: renderer, camera, world, and the loop that advances the simulation in fixed
// steps and keeps the 3D base in sync with the game state.

const SIM_STEP = 0.25;

const canvas = document.querySelector<HTMLCanvasElement>('#scene')!;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050506);

const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 700);
camera.position.set(28, 26, 34);
const controls = new OrbitControls(camera, canvas);
controls.target.set(2, 0, 0);
controls.enableDamping = true;
controls.minDistance = 10;
controls.maxDistance = 80;
controls.minPolarAngle = 0.35;
controls.maxPolarAngle = 1.3;
controls.screenSpacePanning = false;

const light = createLighting(scene, 34);
const terrain = createTerrain();
scene.add(createSky(), terrain);

export const state: GameState = newGame();
const base = new BaseView();
scene.add(base.group);
base.sync(state);

let power: PowerReport = tick(state, 0);
let night = cyclePhase(state.time).isDay ? 0 : 1;

/** At the lunar south pole the Sun circles the horizon once per lunar day. */
function sunAzimuth(time: number): number {
  return (time / (CYCLE.daySeconds + CYCLE.nightSeconds)) * Math.PI * 2 + 2.6;
}

function resize(): void {
  const { innerWidth: w, innerHeight: h } = window;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const clock = new THREE.Clock();
let acc = 0;
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1);
  acc += dt;
  while (acc >= SIM_STEP) {
    power = tick(state, SIM_STEP);
    acc -= SIM_STEP;
  }
  base.sync(state);

  // Day and night fade smoothly; the Sun moves along the horizon.
  const { isDay } = cyclePhase(state.time);
  night += ((isDay ? 0 : 1) - night) * Math.min(1, dt * 0.4);
  light.setNight(night);
  setNightLevel(night);
  const az = sunAzimuth(state.time);
  light.sun.position.set(Math.cos(az) * 40, 4 + (1 - night) * 3, Math.sin(az) * 40);

  // Keep the camera over the base.
  const t = controls.target;
  const r = Math.hypot(t.x, t.z);
  if (r > BUILD_RADIUS) t.multiplyScalar(BUILD_RADIUS / r);
  t.y = 0;

  base.update(state, clock.elapsedTime, dt, Math.atan2(Math.cos(az), Math.sin(az)), power);
  animateSharedMaterials(clock.elapsedTime);
  controls.update();
  renderer.render(scene, camera);
});

