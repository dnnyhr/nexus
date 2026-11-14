import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CYCLE } from './game/config';
import { collectByHand, tick, type PowerReport } from './game/sim';
import { cyclePhase, newGame, type GameState } from './game/state';
import { findModel, poke } from './models/anim';
import { animateSharedMaterials, setNightLevel } from './models/palette';
import { Effects } from './scene/fx';
import { Hud } from './ui/hud';
import { t } from './ui/i18n';
import type { PanelKind } from './ui/panels';
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
const fx = new Effects();
scene.add(fx.group);

const clock = new THREE.Clock();
const hud = new Hud({
  s: state,
  camera,
  power: () => power,
  changed: () => base.sync(state),
  poke: (o) => { if (o) poke(o, clock.elapsedTime); },
});

// ---- Tapping the world -------------------------------------------------------------------
// A tap is a press and release without dragging the camera. Tapping a structure opens its
// panel; tapping the ground digs regolith by hand.

const PANEL_BY_ID: [string, PanelKind][] = [
  ['station', 'station'], ['greenhouse', 'greenhouse'], ['processor', 'processor'], ['solar-mast', 'solarMast'],
  ['battery', 'battery'], ['antenna', 'antenna'], ['lander', 'lander'], ['rover', 'rover'],
  ['collector-robot', 'robots'], ['harvester-robot', 'robots'], ['commander', 'station'],
];
const raycaster = new THREE.Raycaster();
let downAt: { x: number; y: number } | null = null;
canvas.addEventListener('pointerdown', (e) => (downAt = { x: e.clientX, y: e.clientY }));
canvas.addEventListener('pointerup', (e) => {
  if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 8) return;
  const ndc = new THREE.Vector2((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.intersectObject(base.group, true)[0];
  const model = findModel(hit?.object ?? null);
  if (model) {
    const id = model.userData.id as string;
    const kind = PANEL_BY_ID.find(([prefix]) => id.startsWith(prefix))?.[1];
    poke(model, clock.elapsedTime);
    if (kind) hud.open(kind, model);
    return;
  }
  if (hud.isOpen()) return hud.close();
  const ground = raycaster.intersectObject(terrain, true).find((h) => h.object.name === 'ground');
  if (!ground) return;
  const got = collectByHand(state);
  fx.dust(ground.point);
  hud.float(ground.point.clone().add(new THREE.Vector3(0, 0.6, 0)), got > 0 ? t('regolithGain', { n: got }) : t('storageFull'), got === 0);
});
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

// ---- Keyboard camera (desktop): WASD / arrows pan, Q / E rotate ------------------------
const keys = new Set<string>();
window.addEventListener('keydown', (e) => {
  if ((e.target as HTMLElement).tagName === 'INPUT') return;
  keys.add(e.key.toLowerCase());
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());

function keyboardCamera(dt: number): void {
  const fwd = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0);
  const side = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
  const turn = (keys.has('e') ? 1 : 0) - (keys.has('q') ? 1 : 0);
  if (!fwd && !side && !turn) return;
  const dir = new THREE.Vector3().subVectors(controls.target, camera.position).setY(0).normalize();
  const right = new THREE.Vector3(-dir.z, 0, dir.x);
  const speed = 0.6 * camera.position.distanceTo(controls.target) * dt;
  const move = dir.multiplyScalar(fwd * speed).addScaledVector(right, side * speed);
  controls.target.add(move);
  camera.position.add(move);
  if (turn) {
    const offset = camera.position.clone().sub(controls.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), -turn * dt * 1.2);
    camera.position.copy(controls.target).add(offset);
  }
}

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

  keyboardCamera(dt);
  // Keep the camera over the base.
  const t = controls.target;
  const r = Math.hypot(t.x, t.z);
  if (r > BUILD_RADIUS) t.multiplyScalar(BUILD_RADIUS / r);
  t.y = 0;

  base.update(state, clock.elapsedTime, dt, Math.atan2(Math.cos(az), Math.sin(az)), power);
  animateSharedMaterials(clock.elapsedTime);
  fx.update(dt);
  hud.update(dt);
  controls.update();
  renderer.render(scene, camera);
});

