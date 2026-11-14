import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CYCLE } from './game/config';
import { collectByHand, tick, type PowerReport } from './game/sim';
import { cyclePhase, newGame, type GameState } from './game/state';
import { findModel, poke } from './models/anim';
import { animateSharedMaterials, setNightLevel } from './models/palette';
import { Effects } from './scene/fx';
import { Hud } from './ui/hud';
import { t, type StringKey } from './ui/i18n';
import type { PanelKind } from './ui/panels';
import { BaseView } from './scene/base';
import { createLighting } from './scene/lighting';
import { createSky } from './scene/sky';
import { createTerrain } from './scene/terrain';
import { Player } from './scene/player';
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
camera.position.set(-7.4 + 11, 13, 2.2 + 14);
const controls = new OrbitControls(camera, canvas);
controls.target.set(-7.4, 0.8, 2.2);
controls.enableDamping = true;
controls.minDistance = 7;
controls.maxDistance = 45;
controls.minPolarAngle = 0.35;
controls.maxPolarAngle = 1.3;
controls.screenSpacePanning = false;
controls.enablePan = false;

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
  action: () => doAction(),
});

const player = new Player(new THREE.Vector3(-7.4, 0, 2.2));
scene.add(player.obj);
let colliders = base.colliders();
const REACH = 2.6;

function panelKind(model: THREE.Object3D): PanelKind | undefined {
  const id = model.userData.id as string;
  return PANEL_BY_ID.find(([prefix]) => id.startsWith(prefix))?.[1];
}

/** What the action button does here: use the nearby structure, or dig. */
function doAction(): void {
  if (state.sheltered || player.isBusy()) return;
  const near = base.nearest(player.position, REACH, colliders);
  const kind = near && panelKind(near);
  if (near && kind) {
    poke(near, clock.elapsedTime);
    hud.open(kind, near);
    return;
  }
  player.work(1.1, () => {
    const at = player.position.clone().add(new THREE.Vector3(Math.sin(player.obj.rotation.y) * 0.7, 0, Math.cos(player.obj.rotation.y) * 0.7));
    const got = collectByHand(state);
    fx.dust(at);
    hud.float(at.clone().add(new THREE.Vector3(0, 1.6, 0)), got > 0 ? t('regolithGain', { n: got }) : t('storageFull'), got === 0);
  });
}

function updateAction(): void {
  if (player.isBusy()) return hud.setAction(t('busy'), true);
  const near = base.nearest(player.position, REACH, colliders);
  const kind = near && panelKind(near);
  hud.setAction(kind ? t('use', { x: t(KIND_LABEL[kind]) }) : t('dig'));
  // Walking away closes the panel of the structure left behind.
  const anchor = hud.panelAnchor();
  if (anchor && base.nearest(player.position, REACH + 2, colliders.filter((c) => c.obj === anchor)) !== anchor) hud.close();
}

const KIND_LABEL: Record<PanelKind, StringKey> = {
  station: 'station', greenhouse: 'greenhouse', processor: 'processor', solarMast: 'solarMast', battery: 'battery',
  robots: 'robots', rover: 'rover', antenna: 'antenna', lander: 'lander',
};

// ---- Tapping the world -------------------------------------------------------------------
// A tap is a press and release without dragging the camera. Tapping a structure opens its
// panel; tapping the ground digs regolith by hand.

const PANEL_BY_ID: [string, PanelKind][] = [
  ['station', 'station'], ['greenhouse', 'greenhouse'], ['processor', 'processor'], ['solar-mast', 'solarMast'],
  ['battery', 'battery'], ['antenna', 'antenna'], ['lander', 'lander'], ['rover', 'rover'],
  ['collector-robot', 'robots'], ['harvester-robot', 'robots'],
];
const raycaster = new THREE.Raycaster();
let downAt: { x: number; y: number } | null = null;
canvas.addEventListener('pointerdown', (e) => (downAt = { x: e.clientX, y: e.clientY }));
canvas.addEventListener('pointerup', (e) => {
  if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 8) return;
  const ndc = new THREE.Vector2((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const model = findModel(raycaster.intersectObject(base.group, true)[0]?.object ?? null);
  if (!model) return hud.close();
  poke(model, clock.elapsedTime);
  const kind = panelKind(model);
  // The commander has to walk up to a structure to use it.
  const near = base.nearest(player.position, REACH, colliders.filter((c) => c.obj === model)) === model;
  if (kind && near) hud.open(kind, model);
  else {
    const box = new THREE.Box3().setFromObject(model);
    hud.float(new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y + 0.3, (box.min.z + box.max.z) / 2), t('getCloser'), true);
  }
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

// ---- Keyboard (desktop): WASD / arrows move the commander, Q / E turn the camera,
// Space / F is the action button.
const keys = new Set<string>();
window.addEventListener('keydown', (e) => {
  if ((e.target as HTMLElement).tagName === 'INPUT') return;
  const k = e.key.toLowerCase();
  if ((k === ' ' || k === 'f') && !keys.has(k)) doAction();
  keys.add(k);
  if (k === ' ') e.preventDefault();
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());

/** Movement input in world XZ, relative to where the camera looks. */
function moveInput(): THREE.Vector2 {
  const kx = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
  const ky = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0);
  const v = hud.joystick.value.lengthSq() > 0 ? hud.joystick.value.clone() : new THREE.Vector2(kx, ky);
  if (v.lengthSq() === 0) return v;
  if (v.length() > 1) v.normalize();
  const fwd = new THREE.Vector3().subVectors(controls.target, camera.position).setY(0).normalize();
  const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
  const w = fwd.multiplyScalar(v.y).addScaledVector(right, v.x);
  return new THREE.Vector2(w.x, w.z);
}

function cameraTurn(dt: number): void {
  const turn = (keys.has('e') ? 1 : 0) - (keys.has('q') ? 1 : 0);
  if (!turn) return;
  const offset = camera.position.clone().sub(controls.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), -turn * dt * 1.2);
  camera.position.copy(controls.target).add(offset);
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

  cameraTurn(dt);
  // The commander moves; the camera follows (keeping the angle the player chose).
  colliders = base.colliders();
  player.update(dt, moveInput(), colliders, state.sheltered);
  const follow = new THREE.Vector3(player.position.x, 0.8, player.position.z).sub(controls.target).multiplyScalar(Math.min(1, dt * 4));
  controls.target.add(follow);
  camera.position.add(follow);
  updateAction();

  base.update(state, clock.elapsedTime, dt, Math.atan2(Math.cos(az), Math.sin(az)), power);
  animateSharedMaterials(clock.elapsedTime);
  fx.update(dt);
  hud.update(dt);
  controls.update();
  renderer.render(scene, camera);
});

