import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CYCLE } from './game/config';
import { build, checkBuild, nextCost } from './game/build';
import type { BuildingKind } from './game/config';
import { damageOf, impact, impactChance, repair, repairCost } from './game/damage';
import { activeShower } from './game/meteors';
import { protection, stepStorm } from './game/storm';
import { stepRescue } from './game/rescue';
import { RESCUE, ROVER } from './game/config';
import { loadSpaceWeather, radiationScale, snapshotWeather, SOURCES, type SpaceWeather } from './data/spaceweather';
import { el } from './ui/dom';
import { advanceMission, currentMission, MISSIONS, unlocked } from './game/missions';
import { carryMax, collectByHand, deliverRegolith, robotUnload, tick, type PowerReport } from './game/sim';
import { cyclePhase, newGame, type GameState } from './game/state';
import { clearSave, loadGame, saveGame, simulateOffline } from './game/save';
import { animateModel, findModel, poke } from './models/anim';
import { animateSharedMaterials, setNightLevel } from './models/palette';
import { CargoDrops, createMarker, Effects, Flashes } from './scene/fx';
import { Hud } from './ui/hud';
import { getLang, setPlayerName, t, type StringKey } from './ui/i18n';
import { loadProfile } from './game/profile';
import type { PanelKind } from './ui/panels';
import { BaseView } from './scene/base';
import { createLighting } from './scene/lighting';
import { createSky } from './scene/sky';
import { createTerrain, heightAt, ICE_CRATER } from './scene/terrain';
import { Player } from './scene/player';
import { RoverDriver } from './scene/rover';
import { DRIVER_SEAT } from './models/vehicles';
import { deliverIce, scoopIce } from './game/rover';
import '@fontsource/barlow-semi-condensed/400.css';
import '@fontsource/barlow-semi-condensed/500.css';
import '@fontsource/barlow-semi-condensed/600.css';
import './style.css';

// Game entry: renderer, camera, world, and the loop that advances the simulation in fixed
// steps and keeps the 3D base in sync with the game state.

const SIM_STEP = 0.25;

const canvas = document.querySelector<HTMLCanvasElement>('#scene')!;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
// Resolution adapts to performance (see adaptQuality); start at most 1.5x on retina screens.
const MAX_PIXEL_RATIO = Math.min(window.devicePixelRatio, 1.5);
let pixelRatio = MAX_PIXEL_RATIO;
renderer.setPixelRatio(pixelRatio);
renderer.shadowMap.enabled = true;
// Shadows are redrawn every other frame: the Sun moves slowly, so nobody notices.
renderer.shadowMap.autoUpdate = false;
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
// Touch screens: OrbitControls turns by drag distance over the screen *height*, so on a
// phone in landscape a short drag spun the camera ~100° and kept spinning. Here a one-finger
// drag turns the camera only sideways, follows the finger exactly (a full-width swipe is
// about half a turn) and stops when the finger stops. Two fingers still zoom.
const touchScreen = matchMedia('(pointer: coarse)').matches;
if (touchScreen) {
  controls.enableRotate = false;
  controls.zoomSpeed = 0.8;
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  const fingers = new Map<number, number>(); // pointerId -> last x
  canvas.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') fingers.set(e.pointerId, e.clientX); });
  canvas.addEventListener('pointermove', (e) => {
    const last = fingers.get(e.pointerId);
    if (last === undefined) return;
    fingers.set(e.pointerId, e.clientX);
    if (fingers.size !== 1) return; // pinching: zoom only
    turnCamera(((e.clientX - last) / Math.max(1, canvas.clientWidth)) * Math.PI);
  });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) {
    canvas.addEventListener(ev, (e) => fingers.delete((e as PointerEvent).pointerId));
  }
}

/** Turn the camera around the astronaut (radians, + = drag to the right). */
function turnCamera(angle: number): void {
  const offset = camera.position.clone().sub(controls.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), -angle);
  camera.position.copy(controls.target).add(offset);
}

const light = createLighting(scene, 34);
const terrain = createTerrain();
scene.add(createSky(), terrain);

// Resume the saved game (simulating the time away), or start a new one.
const loaded = loadGame();
// The astronaut's name (kept apart from the save, so a new game keeps it).
const profile = loadProfile();
if (profile) setPlayerName(profile.name);
export const state: GameState = loaded ?? newGame();
const away = loaded ? simulateOffline(state, (Date.now() - loaded.savedAt) / 1000) : null;
const base = new BaseView();
scene.add(base.group);

let power: PowerReport = tick(state, 0);
const fx = new Effects();
scene.add(fx.group);
const marker = createMarker();
scene.add(marker);
const flashes = new Flashes();
scene.add(flashes.group);
// Emergency cargo pods land next to the lander.
const drops = new CargoDrops((at) => {
  fx.dust(at);
  flashes.flash(at.clone().setY(0.5));
  hud.float(at.clone().setY(3), t('rescueLanded', { mat: RESCUE.materials }));
});
scene.add(drops.group);

const clock = new THREE.Clock();
const hud = new Hud({
  s: state,
  camera,
  power: () => power,
  changed: () => syncWorld(),
  poke: (o) => { if (o) poke(o, clock.elapsedTime); },
  action: () => doAction(),
  newGame: () => { clearSave(); resetting = true; location.reload(); },
  jump: () => player.jump(),
  dig: () => dig(),
});
// First time here: ask the astronaut's name (it can be changed any time in Profile).
if (!profile) hud.openProfile();

/** Buildings and build sites follow the state (and what the missions have unlocked). */
// Collector robots deliver one bucket per trip to the processor.
base.onRobotUnload = (robot) => {
  const n = robotUnload(state);
  hud.float(robot.position.clone().add(new THREE.Vector3(0, 1.8, 0)), n > 0 ? t('robotDelivered', { n }) : t('hopperFull'), n === 0);
};

function syncWorld(): void {
  base.sync(state);
  base.syncSites(state, unlocked(state));
}
syncWorld();

const player = new Player(new THREE.Vector3(state.player.x, 0, state.player.z));
// The rover resumes where it was parked; the astronaut may still be at the wheel.
base.parkRover(state.rover.x, state.rover.z, state.rover.rot);
const driver = new RoverDriver(base.rover());
function roverTop(): THREE.Vector3 {
  return base.rover().position.clone().add(new THREE.Vector3(0, 2.6, 0));
}
camera.position.set(state.player.x + 11, 13, state.player.z + 14);
controls.target.set(state.player.x, 0.8, state.player.z);
scene.add(player.obj);
let colliders = base.colliders();
const REACH = 2.6;

const BUILD_LABEL: Record<BuildingKind, StringKey> = {
  bag: 'bag',
  antenna: 'antenna', station: 'station', greenhouse: 'greenhouse', processor: 'processor', solarMast: 'solarMast',
  battery: 'battery', collectorRobot: 'collectorRobot', harvesterRobot: 'harvesterRobot', shield: 'shieldBerm',
};
const KIND_LABEL: Record<PanelKind, StringKey> = {
  station: 'station', greenhouse: 'greenhouse', processor: 'processor', solarMast: 'solarMast', battery: 'battery',
  robots: 'robots', rover: 'rover', antenna: 'antenna', lander: 'lander',
};

function panelKind(model: THREE.Object3D): PanelKind | undefined {
  const id = model.userData.id as string;
  return PANEL_BY_ID.find(([prefix]) => id.startsWith(prefix))?.[1];
}

function topOf(o: THREE.Object3D, lift = 0.4): THREE.Vector3 {
  // Buildings and sites cache their box when placed; computing it every frame is costly.
  const box = (o.userData.box as THREE.Box3 | undefined) ?? new THREE.Box3().setFromObject(o);
  return new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y + lift, (box.min.z + box.max.z) / 2);
}

type Act =
  | { type: 'board'; obj: THREE.Object3D }
  | { type: 'unboard'; obj: THREE.Object3D }
  | { type: 'scoopIce'; obj: THREE.Object3D }
  | { type: 'unloadIce'; obj: THREE.Object3D }
  | { type: 'shelter'; obj: THREE.Object3D }
  | { type: 'build'; kind: BuildingKind; obj: THREE.Object3D }
  | { type: 'repair'; key: string; obj: THREE.Object3D }
  | { type: 'deliver'; obj: THREE.Object3D }
  | { type: 'use'; panel: PanelKind; obj: THREE.Object3D };

/** What F / the prompt would do right now: build here, deliver regolith, or use what is near. */
function currentAct(): Act | null {
  if (state.sheltered || player.isBusy()) return null;
  // Driving: scoop ice in the dark crater, unload it at the habitat or greenhouse, or get out.
  if (state.rover.driving) {
    const rv = base.rover();
    const inCrater = Math.hypot(rv.position.x - ICE_CRATER.x, rv.position.z - ICE_CRATER.z) < ICE_CRATER.r * 0.8;
    if (inCrater && driver.speed < 0.5) return { type: 'scoopIce', obj: rv };
    const home = base.nearest(rv.position, 4.5, colliders.filter((c) => /^(station|greenhouse)/.test(c.obj.userData.id ?? '')));
    if (home && state.rover.ice > 0) return { type: 'unloadIce', obj: rv };
    return { type: 'unboard', obj: rv };
  }
  // Priority: shelter during a storm, urgent repairs, delivering the bag, building, using.
  const near = base.nearest(player.position, REACH, colliders);
  const shelter = shelterObject();
  if (state.storm.phase !== 'none' && shelter && base.nearest(player.position, REACH + 0.6, colliders.filter((c) => c.obj === shelter)) === shelter) {
    return { type: 'shelter', obj: shelter };
  }
  const panel = near && panelKind(near);
  if (near && panel === 'rover') return { type: 'board', obj: near };
  const key = near && base.keyOf(near);
  if (near && key && damageOf(state, key) > 0) return { type: 'repair', key, obj: near };
  if (near && panel === 'processor' && state.carried > 0) return { type: 'deliver', obj: near };
  const site = base.nearestSite(player.position, REACH);
  if (site) return { type: 'build', kind: site.kind, obj: site.obj };
  if (near && panel) return { type: 'use', panel, obj: near };
  return null;
}

function doAction(): void {
  const act = currentAct();
  if (!act) return;
  if (act.type === 'use') {
    poke(act.obj, clock.elapsedTime);
    hud.open(act.panel, act.obj);
    return;
  }
  if (act.type === 'board') {
    state.rover.driving = true;
    hud.close();
    poke(act.obj, clock.elapsedTime);
    return;
  }
  if (act.type === 'unboard') {
    state.rover.driving = false;
    driver.speed = 0;
    const rv = act.obj;
    base.parkRover(rv.position.x, rv.position.z, rv.rotation.y);
    colliders = base.colliders();
    // Step out on the left side of the rover.
    player.position.set(rv.position.x + Math.cos(rv.rotation.y) * 1.8, 0, rv.position.z - Math.sin(rv.rotation.y) * 1.8);
    player.unstick(colliders);
    return;
  }
  if (act.type === 'scoopIce') {
    const got = scoopIce(state);
    fx.dust(act.obj.position.clone());
    hud.float(topOf(act.obj), got > 0 ? t('iceGain', { n: got }) : t('iceFull'), got === 0);
    return;
  }
  if (act.type === 'unloadIce') {
    const water = deliverIce(state);
    hud.float(topOf(act.obj), water > 0 ? t('waterGain', { n: water }) : t('storageFull'), water === 0);
    return;
  }
  if (act.type === 'shelter') {
    state.sheltered = true;
    hud.close();
    hud.float(topOf(act.obj), t('inShelter', { p: Math.round(protection(state) * 100) }));
    return;
  }
  if (act.type === 'repair') {
    const cost = repairCost(state, act.key);
    if (state.res.materials < cost) {
      hud.float(topOf(act.obj), t('needMaterials', { n: Math.ceil(cost - state.res.materials) }), true);
      return;
    }
    player.work(2, () => {
      if (repair(state, act.key)) hud.float(topOf(act.obj), t('repaired'));
    });
    return;
  }
  if (act.type === 'deliver') {
    const amount = deliverRegolith(state);
    poke(act.obj, clock.elapsedTime);
    hud.float(topOf(act.obj), amount > 0 ? t('delivered', { n: amount }) : t('hopperFull'), amount === 0);
    return;
  }
  const check = checkBuild(state, act.kind);
  if (!check.ok) {
    hud.float(topOf(act.obj), check.reason === 'materials' ? t('needMaterials', { n: Math.ceil((check.cost ?? 0) - state.res.materials) }) : t('maxed'), true);
    return;
  }
  const at = topOf(act.obj, 0).setY(0);
  player.obj.rotation.y = Math.atan2(at.x - player.position.x, at.z - player.position.z);
  player.work(1.5, () => {
    if (!build(state, act.kind)) return;
    syncWorld();
    colliders = base.colliders();
    // The new building may have appeared where the astronaut stands.
    player.unstick(colliders);
    fx.dust(at);
    hud.float(at.clone().setY(3), t('built'));
  });
}

/** Dig regolith into the bag, facing `towards` when given (right click on the ground). */
function dig(towards?: THREE.Vector3): void {
  if (state.sheltered || player.isBusy() || player.airborne) return;
  if (towards) player.obj.rotation.y = Math.atan2(towards.x - player.position.x, towards.z - player.position.z);
  const head = player.position.clone().add(new THREE.Vector3(0, 2.4, 0));
  if (state.carried >= carryMax(state)) return hud.float(head, t('bagFull'), true);
  player.work(1.1, () => {
    const at = player.position.clone().add(new THREE.Vector3(Math.sin(player.obj.rotation.y) * 0.7, 0, Math.cos(player.obj.rotation.y) * 0.7));
    const got = collectByHand(state);
    fx.dust(at);
    hud.float(at.clone().add(new THREE.Vector3(0, 1.6, 0)), got > 0 ? t('regolithGain', { n: got }) : t('bagFull'), got === 0);
  });
}

/** Keep the action prompt next to what the astronaut would act on. */
function updatePrompt(): void {
  player.obj.userData.load = state.carried / carryMax(state);
  player.obj.userData.bagLevel = state.levels.bag;
  if (player.isBusy()) return hud.setPrompt(player.position.clone().add(new THREE.Vector3(0, 2.3, 0)), t('busy'));
  const act = currentAct();
  if (!act) hud.setPrompt(null);
  else if (act.type === 'board') hud.setPrompt(topOf(act.obj), t('board'));
  else if (act.type === 'unboard') hud.setPrompt(roverTop(), t('unboard'), state.rover.ice ? `· ${t('iceGain', { n: Math.round(state.rover.ice) }).replace('+', '')}` : '');
  else if (act.type === 'scoopIce') hud.setPrompt(roverTop(), t('scoopIce'), `· ${Math.round(state.rover.ice)}/${ROVER.iceCargoMax}`, state.rover.ice >= ROVER.iceCargoMax);
  else if (act.type === 'unloadIce') hud.setPrompt(roverTop(), t('unloadIce'), `· ${Math.round(state.rover.ice)}`);
  else if (act.type === 'build') {
    const c = nextCost(state, act.kind);
    hud.setPrompt(topOf(act.obj), t('buildX', { x: t(BUILD_LABEL[act.kind]) }), c === null ? '' : `· ${c}`, !checkBuild(state, act.kind).ok);
  } else if (act.type === 'shelter') {
    hud.setPrompt(topOf(act.obj), t('enterShelter'));
  } else if (act.type === 'repair') {
    const kind = panelKind(act.obj);
    hud.setPrompt(topOf(act.obj), t('repairX', { x: kind ? t(KIND_LABEL[kind]) : '' }), `· ${repairCost(state, act.key)}`, state.res.materials < repairCost(state, act.key));
  } else if (act.type === 'deliver') {
    hud.setPrompt(topOf(act.obj), t('deliverX'), `· ${Math.floor(state.carried)}`);
  } else {
    hud.setPrompt(topOf(act.obj), t('useX', { x: t(KIND_LABEL[act.panel]) }));
  }
  // Walking away closes the panel of the structure left behind.
  const anchor = hud.panelAnchor();
  if (anchor && base.nearest(player.position, REACH + 2, colliders.filter((c) => c.obj === anchor)) !== anchor) hud.close();
}

/** Point the marker at the current mission's place (hidden for "dig anywhere"). */
function updateMarker(t: number): void {
  // During a solar storm the marker points to the shelter instead of the mission.
  const shelter = shelterObject();
  if (state.storm.phase !== 'none' && !state.sheltered && shelter) {
    const at = shelter.position;
    marker.visible = true;
    hud.setTarget(new THREE.Vector3(at.x, 1, at.z), player.position);
    marker.position.set(at.x, 6.5 + Math.sin(t * 6) * 0.3, at.z);
    (marker.userData.chevron as THREE.Object3D).rotation.y = t * 3;
    return;
  }
  const m = currentMission(state);
  const from = state.rover.driving ? base.rover().position : player.position;
  if (m.target === 'iceCrater') {
    marker.visible = true;
    const crater = new THREE.Vector3(ICE_CRATER.x, heightAt(ICE_CRATER.x, ICE_CRATER.z), ICE_CRATER.z);
    hud.setTarget(crater.clone().setY(1), from);
    marker.position.set(crater.x, crater.y + 5 + Math.sin(t * 2.4) * 0.25, crater.z);
    (marker.userData.chevron as THREE.Object3D).rotation.y = t;
    return;
  }
  const kind = m.target === 'dig' ? null : m.target === 'greenhouseUse' ? 'greenhouse' : m.target;
  const at = kind ? base.slotOf(kind, state) : null;
  marker.visible = !!at;
  hud.setTarget(at ? new THREE.Vector3(at.x, 1, at.z) : null, from);
  if (!at) return;
  const height = kind === 'solarMast' ? 10 : kind === 'station' || kind === 'shield' ? 6.5 : 4.2;
  marker.position.set(at.x, height + Math.sin(t * 2.4) * 0.25, at.z);
  (marker.userData.chevron as THREE.Object3D).rotation.y = t;
}

// Missions: check after every simulation step; announce the next one by radio.
function checkMissions(): void {
  const done = advanceMission(state);
  if (!done) return;
  hud.float(player.position.clone().add(new THREE.Vector3(0, 3, 0)), t('missionDone', { n: done.reward }));
  hud.radio(currentMission(state));
  syncWorld();
  colliders = base.colliders();
}
if (away && away.seconds > 60) {
  const h = Math.floor(away.seconds / 3600);
  const m = Math.round((away.seconds % 3600) / 60);
  hud.radioText(t('welcomeBack', {
    time: h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`,
    mat: Math.max(0, away.materials),
    o2: Math.max(0, away.o2),
    harvest: away.harvests ? t('welcomeHarvest', { n: away.harvests }) : '',
    plant: state.levels.greenhouse ? t('welcomePlant', { stress: away.plantStress }) : '',
  }), true);
} else {
  hud.radio(currentMission(state));
}

// ---- Saving: every 30 s, and whenever the page is hidden or closed ------------------------
let resetting = false;
function save(): void {
  if (resetting) return;
  state.player = { x: player.position.x, z: player.position.z };
  const rv = base.rover();
  Object.assign(state.rover, { x: rv.position.x, z: rv.position.z, rot: rv.rotation.y });
  saveGame(state);
}
setInterval(save, 30_000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(); });
window.addEventListener('pagehide', save);

// ---- Micrometeoroid impacts ----------------------------------------------------------------
// They start once the habitat is up (so the very first steps stay calm), and are more
// frequent while the Moon crosses a real meteor shower on today's date.
const IMPACTS_FROM = MISSIONS.findIndex((m) => m.id === 'robot');
let shower = activeShower(new Date());
let impactsSeen = 0;
setInterval(() => {
  shower = activeShower(new Date());
  hud.setShower(shower ? shower.shower.name[getLang()] : null);
}, 1000);
hud.setShower(shower ? shower.shower.name[getLang()] : null);

// ---- Solar storms with real space weather ---------------------------------------------------
let weather: SpaceWeather = snapshotWeather();
const refreshWeather = () => loadSpaceWeather().then((w) => (weather = w));
refreshWeather();
setInterval(refreshWeather, 10 * 60 * 1000);
const STORMS_FROM = MISSIONS.findIndex((m) => m.id === 'battery');

/** The habitat once built; until then the lander is the only shelter. */
function shelterObject(): THREE.Object3D | null {
  return base.objectOf(state.levels.station ? 'station' : 'lander');
}

function stormStep(): void {
  const ev = stepStorm(state, SIM_STEP, state.mission >= STORMS_FROM, weather.flares, weather.live ? weather.protons.flux : 0);
  const shelterWord = t(state.levels.station ? 'habitatWord' : 'landerWord');
  if (ev === 'warning') {
    const f = state.storm.flare;
    const secs = Math.round(state.storm.timeLeft);
    hud.radioText(f
      ? t('stormWarnFlare', { date: new Date(f.peak).toLocaleDateString(getLang()), cls: f.class, s: secs, shelter: shelterWord })
      : t('stormWarnLive', { flux: weather.protons.flux.toFixed(1), n: radiationScale(weather.protons.flux), shelter: shelterWord }));
  }
  if (ev === 'end') {
    if (state.sheltered) state.sheltered = false;
    hud.radioText(t('stormEnd', { d: state.dose.toFixed(1) }));
  }
}

hud.dataPanel = () => {
  const w = weather;
  const when = new Date(w.fetchedAt).toLocaleString(getLang());
  const sh = activeShower(new Date());
  const flares = [...w.flares].sort((a, b) => b.peak.localeCompare(a.peak)).slice(0, 6);
  return el('div', {},
    el('p', {}, t('dataTitle')),
    el('p.label', {}, w.live ? t('dataLive', { t: when }) : t('dataSnapshot', { t: when })),
    el('p', {}, t('dataProtons', { f: w.protons.flux.toFixed(2), n: radiationScale(w.protons.flux) }), ' ', el('a', { href: SOURCES.goes, target: '_blank', rel: 'noopener' }, 'NOAA SWPC')),
    el('p', {}, t('dataFlares'), ' ', el('a', { href: SOURCES.donki, target: '_blank', rel: 'noopener' }, 'DONKI')),
    el('ul.data-list', {}, ...flares.map((f) => el('li', {}, el('span', {}, new Date(f.peak).toLocaleDateString(getLang())), f.link ? el('a', { href: f.link, target: '_blank', rel: 'noopener' }, f.class) : el('span', {}, f.class)))),
    el('p', {}, t('dataShower', { x: sh ? sh.shower.name[getLang()] : t('none') })),
    el('p.fact', {}, t('dataHow')),
  );
};

function maybeImpact(): void {
  if (state.mission < IMPACTS_FROM || Math.random() >= impactChance(SIM_STEP, shower?.strength ?? 0)) return;
  const key = impact(state);
  const obj = key ? base.objectOf(key) : null;
  if (!obj) return;
  const box = new THREE.Box3().setFromObject(obj);
  const at = new THREE.Vector3(
    box.min.x + Math.random() * (box.max.x - box.min.x),
    box.min.y + (0.4 + Math.random() * 0.5) * (box.max.y - box.min.y),
    box.min.z + Math.random() * (box.max.z - box.min.z),
  );
  flashes.flash(at);
  fx.dust(at.clone().setY(0));
  poke(obj, clock.elapsedTime);
  hud.float(topOf(obj), t('impact'), true);
  if (impactsSeen++ === 0 && state.levels.antenna) {
    hud.radioText(t('impactNews'));
    if (shower) hud.radioText(t('showerNews', { name: shower.shower.name[getLang()] }));
  }
}
if (import.meta.env.DEV) Object.assign(window, { game: { state, marker, player, base, camera, controls, renderer, scene, power: () => power, sync: () => { syncWorld(); colliders = base.colliders(); }, storm: () => { state.storm.nextIn = 0; state.mission = Math.max(state.mission, STORMS_FROM); }, forceImpact: () => { const m = state.mission; state.mission = Math.max(m, IMPACTS_FROM); const r = Math.random; Math.random = () => 0; maybeImpact(); Math.random = r; state.mission = m; } } });

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
  tapAt(e.clientX, e.clientY);
});
// A quick tap on the joystick side of a touch screen still picks what is under it.
hud.joystick.onTap = (x, y) => tapAt(x, y);

/** Tap or click on the world: open what the astronaut is next to, or say to get closer. */
function tapAt(x: number, y: number): void {
  const r = canvas.getBoundingClientRect();
  const ndc = new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const model = findModel(raycaster.intersectObject(base.group, true)[0]?.object ?? null);
  if (!model || model.userData.site) return hud.close();
  poke(model, clock.elapsedTime);
  const kind = panelKind(model);
  // The astronaut has to walk up to a structure to use it.
  const near = base.nearest(player.position, REACH, colliders.filter((c) => c.obj === model)) === model;
  if (kind && near) hud.open(kind, model);
  else {
    const box = new THREE.Box3().setFromObject(model);
    hud.float(new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y + 0.3, (box.min.z + box.max.z) / 2), t('getCloser'), true);
  }
}
let night = cyclePhase(state.time).isDay ? 0 : 1;

/** At the lunar south pole the Sun circles the horizon once per lunar day. */
function sunAzimuth(time: number): number {
  return (time / (CYCLE.daySeconds + CYCLE.nightSeconds)) * Math.PI * 2 + 2.6;
}

/** Match the drawing size to the canvas on screen (rotation, full screen, toolbars). */
function resize(): void {
  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || window.innerHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
// Phones report the new size late after rotating or entering full screen, so watch the
// canvas itself and also check again on the next frames.
new ResizeObserver(resize).observe(canvas);
const resizeSoon = () => { resize(); requestAnimationFrame(resize); setTimeout(resize, 300); };
for (const ev of ['resize', 'orientationchange']) window.addEventListener(ev, resizeSoon);
for (const ev of ['fullscreenchange', 'webkitfullscreenchange']) document.addEventListener(ev, resizeSoon);
window.visualViewport?.addEventListener('resize', resizeSoon);
resize();

// ---- Keyboard and mouse (desktop): WASD / arrows move, Space hops, F uses, right click
// (or R) digs, Q / E turn the camera.
const keys = new Set<string>();
window.addEventListener('keydown', (e) => {
  if ((e.target as HTMLElement).tagName === 'INPUT') return;
  const k = e.key.toLowerCase();
  if (!keys.has(k)) {
    if (k === ' ') player.jump();
    if (k === 'f') doAction();
    if (k === 'r') dig();
  }
  keys.add(k);
  if (k === ' ') e.preventDefault();
});
canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  const r = canvas.getBoundingClientRect();
  const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const ground = raycaster.intersectObject(terrain, true).find((h) => h.object.name === 'ground');
  dig(ground?.point);
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
  const held = (keys.has('e') ? 1 : 0) - (keys.has('q') ? 1 : 0);
  if (held) turnCamera(held * dt * 1.2);
}

/** Lower the resolution when frames are slow, raise it back when there is room. */
let qualityTime = 0;
let qualityFrames = 0;
function adaptQuality(dt: number): void {
  qualityTime += dt;
  qualityFrames += 1;
  if (qualityTime < 1.5) return;
  const avg = qualityTime / qualityFrames;
  qualityTime = 0;
  qualityFrames = 0;
  const next = avg > 1 / 40 ? Math.max(0.75, pixelRatio - 0.25) : avg < 1 / 57 ? Math.min(MAX_PIXEL_RATIO, pixelRatio + 0.25) : pixelRatio;
  if (next !== pixelRatio) {
    pixelRatio = next;
    renderer.setPixelRatio(pixelRatio);
    resize();
  }
}

let acc = 0;
let frame = 0;
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1);
  adaptQuality(dt);
  renderer.shadowMap.needsUpdate = frame++ % 2 === 0;
  acc += dt;
  while (acc >= SIM_STEP) {
    power = tick(state, SIM_STEP);
    acc -= SIM_STEP;
    checkMissions();
    maybeImpact();
    stormStep();
    if (stepRescue(state, SIM_STEP)) {
      hud.radioText(t('rescueNews', { mat: RESCUE.materials }));
      drops.drop(new THREE.Vector3(-14, 0, 15.5));
    }
  }
  // Day and night fade smoothly; the Sun moves along the horizon.
  const { isDay } = cyclePhase(state.time);
  night += ((isDay ? 0 : 1) - night) * Math.min(1, dt * 0.4);
  light.setNight(night);
  setNightLevel(night);
  const az = sunAzimuth(state.time);
  light.sun.position.set(Math.cos(az) * 40, 4 + (1 - night) * 3, Math.sin(az) * 40);

  cameraTurn(dt);
  // The astronaut moves; the camera follows (keeping the angle the player chose).
  colliders = base.colliders();
  if (state.rover.driving) {
    const rv = base.rover();
    driver.update(dt, moveInput(), colliders.filter((c) => c.obj !== rv));
    // The astronaut sits in the driver's seat and rides along.
    player.sitAt(rv, DRIVER_SEAT);
  } else {
    player.update(dt, moveInput(), colliders, state.sheltered, keys.has(' ') || hud.jumpHeld());
  }
  animateModel(player.obj, clock.elapsedTime, dt);
  const focus = state.rover.driving ? base.rover().position : player.position;
  const follow = new THREE.Vector3(focus.x, 0.8, focus.z).sub(controls.target).multiplyScalar(Math.min(1, dt * 4));
  controls.target.add(follow);
  camera.position.add(follow);
  updatePrompt();
  updateMarker(clock.elapsedTime);

  base.update(state, clock.elapsedTime, dt, Math.atan2(Math.cos(az), Math.sin(az)), power);
  animateSharedMaterials(clock.elapsedTime);
  fx.update(dt);
  flashes.update(dt);
  drops.update(dt);
  hud.setStorm(state.storm.phase === 'none' ? null : {
    phase: state.storm.phase,
    seconds: state.storm.timeLeft,
    label: state.storm.flare ? state.storm.flare.class : `S${radiationScale(weather.protons.flux)}`,
    dose: state.dose,
    exposed: !state.sheltered,
  }, clock.elapsedTime);
  hud.update(dt);
  controls.update();
  renderer.render(scene, camera);
});

