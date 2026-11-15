import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CYCLE, ENERGY } from './game/config';
import { build, checkBuild, nextCost } from './game/build';
import type { BuildingKind } from './game/config';
import { damageOf, impact, impactChance, repair, repairCost } from './game/damage';
import { activeShower } from './game/meteors';
import { protection, stepStorm } from './game/storm';
import { stepRescue } from './game/rescue';
import { RESCUE, ROVER } from './game/config';
import { radiationScale, snapshotWeather, SOURCES, toSpaceWeather, type SpaceWeather } from './data/spaceweather';
import { loadTelemetry } from './data/telemetry';
import { el } from './ui/dom';
import { advanceMission, currentMission, MISSIONS, unlocked } from './game/missions';
import { carryMax, collectByHand, deliverRegolith, resolvePower, robotUnload, tick, type PowerReport } from './game/sim';
import { cyclePhase, newGame, type GameState } from './game/state';
import { clearSave, loadGame, saveGame, simulateOffline } from './game/save';
import { type PortableSave } from './game/savePng';
import { openPngSave } from './ui/savePng';
import { fixedStepClock } from './game/loop';
import { CADET_DESIGN, createMissionRunner, darknessAt, missionPowerOptions, project, startMission, summarize, type Command, type CommandResult, type Design, type MissionEvent, type MissionRunner, type MissionState, type Summary } from './engine';
import { mountPrepare, type Mounted } from './ui/mission/prepare';
import { mountMissionBar } from './ui/mission/missionBar';
import { mountCommander, type CommanderHandle } from './ui/mission/commander';
import { mountReport } from './ui/mission/report';
import { commandText } from './ui/mission/commanderTexts';
import './ui/mission/report.css';
import {
  mountCommanderRadio, mountControlCenter, mountSystemsHud, mountTelemetryRibbon, systemsFromGame, telemetryFromGame,
  type CommanderRadioHandle, type ControlCenterHandle, type RadioCall, type SystemsHudHandle, type TelemetryRibbonHandle,
} from './ui/experience';
import { mountBackgroundMusic } from './ui/experience/backgroundMusic';
import { compareFlightPlans, mountFlightReview, type FlightComparison } from './ui/flightreview';
import { mountPassport } from './ui/passport';
import { mountTitle, type TitleHandle } from './ui/shell/titleScreen';
import { createTitleScene } from './ui/shell/titleScene';
import { CinematicDirector } from './scene/cinematics/director';
import { preloadOrbitalMaps } from './scene/cinematics/orbit';
import type { SequenceKind } from './scene/cinematics/timeline';
import { mountDebrief, type DebriefHandle } from './ui/shell/debrief';
import { TacticalCamera } from './scene/camera';
import { mountCameraControl } from './scene/cameraControl';
import { animateModel, findModel, poke } from './models/anim';
import { animateSharedMaterials, setNightLevel } from './models/palette';
import { CargoDrops, createMarker, Effects, Flashes } from './scene/fx';
import { Hud } from './ui/hud';
import { getLang, getPlayerName, setPlayerName, t, type StringKey } from './ui/i18n';
import { loadProfile, saveProfile } from './game/profile';
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
// Touch screens: a finger drag is much bigger than a mouse drag, so turn slower and stop
// sooner (no long spin after lifting the finger). Two fingers zoom.
if (matchMedia('(pointer: coarse)').matches) {
  controls.rotateSpeed = 0.45;
  controls.zoomSpeed = 0.8;
  controls.dampingFactor = 0.18;
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
}

// Tactical views (follow, isometric, top) share the same camera and orbit controls.
const cameraRig = new TacticalCamera(camera, controls);

const light = createLighting(scene, 34);
const terrain = createTerrain();
scene.add(createSky(), terrain);

// The saved game is only shown behind the start menu; it runs, and catches up the time away,
// once free mode is chosen. A mission swaps in its own state and never touches the save.
const loaded = loadGame();
// The astronaut's name (kept apart from the save, so a new game keeps it).
const profile = loadProfile();
if (profile) setPlayerName(profile.name);
export let state: GameState = loaded ?? newGame();
type Mode = 'menu' | 'free' | 'mission';
let mode: Mode = 'menu';
let runner: MissionRunner | null = null;
/** A flight sequence or a modal owns the screen: no world input reaches the game. */
let inputLocked = false;
let contextLost = false;
/** Bumped when the state is replaced, so deferred work started before cannot act on the new one. */
let epoch = 0;
const base = new BaseView();
scene.add(base.group);

let power: PowerReport = resolvePower(structuredClone(state), SIM_STEP, cyclePhase(state.time).isDay);
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
  newGame: () => { if (mode !== 'free') return; clearSave(); resetting = true; location.reload(); },
  jump: () => { if (!inputLocked && (mode === 'free' || runner?.canDispatch())) player.jump(); },
  dig: () => dig(),
  saveArchive: openSaveArchive,
  get dispatch() { return mode === 'mission' ? dispatch : undefined; },
});

/** Buildings and build sites follow the state (and what the missions have unlocked). */
// Collector robots deliver one bucket per trip to the processor.
base.onRobotUnload = (robot) => {
  if (mode !== 'free' || inputLocked) return;
  const n = robotUnload(state);
  hud.float(robot.position.clone().add(new THREE.Vector3(0, 1.8, 0)), n > 0 ? t('robotDelivered', { n }) : t('hopperFull'), n === 0);
};

function syncWorld(): void {
  base.sync(state);
  base.syncSites(state, mode === 'mission' ? new Set() : unlocked(state));
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
  if (mode === 'menu' || state.sheltered || player.isBusy()) return null;
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
  if (near && panel === 'rover' && mode === 'free') return { type: 'board', obj: near };
  const key = near && base.keyOf(near);
  if (near && key && damageOf(state, key) > 0) return { type: 'repair', key, obj: near };
  if (near && panel === 'processor' && state.carried > 0) return { type: 'deliver', obj: near };
  const site = base.nearestSite(player.position, REACH);
  if (site) return { type: 'build', kind: site.kind, obj: site.obj };
  if (near && panel) return { type: 'use', panel, obj: near };
  return null;
}

function doAction(): void {
  if (inputLocked || (mode === 'mission' && !runner?.canDispatch())) return;
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
    if (mode === 'mission') {
      const r = dispatch({ type: 'enterShelter' });
      if (!r.ok) return hud.float(topOf(act.obj), r.reason ?? '', true);
    } else {
      state.sheltered = true;
    }
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
    const before = state.carried;
    const r = mode === 'mission' ? dispatch({ type: 'deliverRegolith' }) : null;
    const amount = r ? before - state.carried : deliverRegolith(state);
    poke(act.obj, clock.elapsedTime);
    hud.float(topOf(act.obj), amount > 0 ? t('delivered', { n: amount }) : r && !r.ok && r.reason ? r.reason : t('hopperFull'), amount === 0);
    return;
  }
  if (mode !== 'free') return;
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
  if (inputLocked || (mode === 'mission' && !runner?.canDispatch())) return;
  if (mode === 'menu' || state.sheltered || player.isBusy() || player.airborne) return;
  if (towards) player.obj.rotation.y = Math.atan2(towards.x - player.position.x, towards.z - player.position.z);
  const head = player.position.clone().add(new THREE.Vector3(0, 2.4, 0));
  if (state.carried >= carryMax(state)) return hud.float(head, t('bagFull'), true);
  const started = epoch;
  player.work(1.1, () => {
    if (started !== epoch) return;
    const at = player.position.clone().add(new THREE.Vector3(Math.sin(player.obj.rotation.y) * 0.7, 0, Math.cos(player.obj.rotation.y) * 0.7));
    const above = at.clone().add(new THREE.Vector3(0, 1.6, 0));
    let got: number;
    if (mode === 'mission') {
      const before = state.carried;
      const r = dispatch({ type: 'collectRegolith' });
      got = state.carried - before;
      if (!r.ok) return hud.float(above, r.reason ?? t('bagFull'), true);
    } else {
      got = collectByHand(state);
    }
    fx.dust(at);
    hud.float(above, got > 0 ? t('regolithGain', { n: got }) : t('bagFull'), got === 0);
  });
}

/** Keep the action prompt next to what the astronaut would act on. */
function updatePrompt(): void {
  if (mode === 'menu') return hud.setPrompt(null);
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
  if (mode !== 'free') {
    marker.visible = false;
    hud.setTarget(null, player.position);
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
/** Free mode: catch up the time away, then run the base as it always did. */
let weatherTimer = 0;
function startFree(restored?: GameState): void {
  const saved = restored ? null : loadGame();
  state = restored ?? saved ?? newGame();
  runner = null;
  epoch++;
  clearFlightInput();
  leaveMissionHud();
  mode = 'free';
  hud.setState(state);
  base.parkRover(state.rover.x, state.rover.z, state.rover.rot);
  player.position.set(state.player.x, 0, state.player.z);
  camera.position.set(state.player.x + 11, 13, state.player.z + 14);
  controls.target.set(state.player.x, 0.8, state.player.z);
  flightButton.hidden = true;
  if (flightMode) toggleFlightMode();
  const away = saved ? simulateOffline(state, (Date.now() - saved.savedAt) / 1000) : null;
  power = tick(state, 0);
  hud.setMode('free');
  syncWorld();
  colliders = base.colliders();
  player.unstick(colliders);
  if (!weatherTimer) weatherTimer = window.setInterval(refreshWeather, 10 * 60 * 1000);
  mountCamera();
  hud.setShower(shower ? shower.shower.name[getLang()] : null);
  // First time here: ask the astronaut's name (it can be changed any time in Profile).
  if (!profile && !getPlayerName()) hud.openProfile();
  bgm.play();
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
}

// ---- Saving: every 30 s, and whenever the page is hidden or closed ------------------------
let resetting = false;
function save(): void {
  if (resetting || mode !== 'free') return;
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
  hud.setShower(mode === 'free' && shower ? shower.shower.name[getLang()] : null);
}, 1000);

// ---- Solar storms with real space weather ---------------------------------------------------
let weather: SpaceWeather = snapshotWeather();
/** Real space weather with provenance (NASA DONKI, NOAA GOES/RTSW). Never an input of the mission engine. */
const refreshWeather = () => loadTelemetry().then((tel) => { weather = toSpaceWeather(tel); });
refreshWeather();
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
if (import.meta.env.DEV) Object.assign(window, { game: { get state() { return state; }, runner: () => runner, marker, player, base, camera, controls, renderer, scene, power: () => power, sync: () => { syncWorld(); colliders = base.colliders(); }, storm: () => { state.storm.nextIn = 0; state.mission = Math.max(state.mission, STORMS_FROM); }, forceImpact: () => { const m = state.mission; state.mission = Math.max(m, IMPACTS_FROM); const r = Math.random; Math.random = () => 0; maybeImpact(); Math.random = r; state.mission = m; } } });

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
  if (inputLocked || mode === 'menu' || (mode === 'mission' && !runner?.canDispatch())) return;
  const ndc = new THREE.Vector2((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
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

function resize(): void {
  const { innerWidth: w, innerHeight: h } = window;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  cameraRig.resize();
}
window.addEventListener('resize', resize);
resize();

// ---- Keyboard and mouse (desktop): WASD / arrows move, Space hops, F uses, right click
// (or R) digs, Q / E turn the camera.
const keys = new Set<string>();
window.addEventListener('keydown', (e) => {
  if (inputLocked || mode === 'menu' || (e.target as HTMLElement).closest('input, textarea, select, [contenteditable]')) return;
  const k = e.key.toLowerCase();
  if (!keys.has(k)) {
    if (k === ' ') player.jump();
    if (k === 'f') doAction();
    if (k === 'r') dig();
    if (k === 'h' && mode === 'mission' && !commander && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
      e.preventDefault();
      toggleFlightMode();
    }
    if (k === 'escape' && flightMode && mode === 'mission' && !commander) {
      toggleFlightMode();
    }
  }
  keys.add(k);
  if (k === ' ') e.preventDefault();
});
canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  const ndc = new THREE.Vector2((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
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
  const turn = (keys.has('e') ? 1 : 0) - (keys.has('q') ? 1 : 0);
  if (!turn) return;
  const offset = camera.position.clone().sub(controls.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), -turn * dt * 1.2);
  camera.position.copy(controls.target).add(offset);
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

// ---- Control Center, Cadet briefing, Mission 1, debrief and retry ---------------------------

const overlay = el('div', { id: 'mission-overlay' });
Object.assign(overlay.style, {
  position: 'fixed', inset: '0', zIndex: '93', overflowY: 'auto', display: 'none',
  background: 'rgba(5, 5, 6, 0.6)', backdropFilter: 'blur(6px)', webkitBackdropFilter: 'blur(6px)',
});
const barRoot = el('div', { id: 'mission-bar-root' });
Object.assign(barRoot.style, {
  position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 'max(8px, env(safe-area-inset-bottom))',
  width: 'min(600px, calc(100vw - 16px))', zIndex: '20', pointerEvents: 'none',
});
const cameraHost = el('div.nx-camera-host');
document.body.append(barRoot, cameraHost, overlay);
const showOverlay = (on: boolean) => { overlay.style.display = on ? '' : 'none'; };
/** While a full-screen view owns the screen, the mission HUD steps out of the way. */
const coverHud = (on: boolean) => document.body.classList.toggle('nx-overlay', on);
const bgm = mountBackgroundMusic({ root: document.querySelector<HTMLElement>('#topright') ?? document.body });

let center: ControlCenterHandle | null = null;
let title: TitleHandle | null = null;
let screen: Mounted | null = null;
let missionBar: { update(force?: boolean): void; destroy(): void } | null = null;
let ribbon: TelemetryRibbonHandle | null = null;
let systems: SystemsHudHandle | null = null;
let radio: CommanderRadioHandle | null = null;
let cameraUi: { update(): void; destroy(): void } | null = null;
let commander: CommanderHandle | null = null;
let debrief: DebriefHandle | null = null;
let previousSummary: Summary | null = null;
let comparison: FlightComparison | undefined;
const flights: MissionState[] = [];
let ended = false;
let eventsSeen = 0;
let lastShortageRadio = -Infinity;

function dispatch(cmd: Command): CommandResult {
  if (inputLocked) return { ok: false, reason: 'Secuencia de vuelo en curso' };
  return runner ? runner.dispatch(cmd) : { ok: false, reason: 'Sin misión en curso' };
}

/** Say why an action from a mission panel was refused, next to the astronaut. */
function refusal(r: CommandResult): void {
  if (!r.ok && r.reason) hud.float(player.position.clone().add(new THREE.Vector3(0, 2.6, 0)), r.reason, true);
}

function mountCamera(): void {
  if (!cameraUi) cameraUi = mountCameraControl(cameraHost, cameraRig);
}

/** Title menu over the 3D space scene. Leaving it fades out; it never runs the economy. */
function showTitle(): void {
  bgm.pause();
  mode = 'menu';
  document.body.classList.add('nx-on-title');
  titleScene.frame(camera);
  void preloadOrbitalMaps();
  title = mountTitle(document.body, {
    savedMission: () => loadGame()?.mission ?? null,
    onCadetLaunch: () => { void leaveTitle(); startMissionMode(CADET_DESIGN); },
    onCadetDesign: () => { void leaveTitle(); showPrepare(CADET_DESIGN); },
    onSimulator: () => { void leaveTitle(); startFree(); },
    onProgress: openProgress,
    onLoadPng: openSaveArchive,
  });
}

function leaveTitle(): Promise<void> {
  document.body.classList.remove('nx-on-title');
  const closing = title?.destroy() ?? Promise.resolve();
  title = null;
  return closing;
}

/** Progress, certifications and science live one step away from the title, never in front. */
function openProgress(): void {
  center?.destroy();
  center = mountControlCenter(document.body, {
    getGame: () => loadGame() ?? newGame(0),
    hasFreeSave: () => !!loadGame(),
    missionReady: true,
    // Laboratory crises are not connected to the engine yet: shown as in preparation, never playable.
    labReady: false,
    onCadet: () => { center?.destroy(); center = null; void leaveTitle(); startMissionMode(CADET_DESIGN); },
    onSimulator: () => { center?.destroy(); center = null; void leaveTitle(); startFree(); },
    onLab: () => {},
    onClose: () => { center?.destroy(); center = null; },
    closable: true,
    initialOpen: true,
  });
}

function showPrepare(initial?: Design, previous: Summary | null = null): void {
  showOverlay(true);
  coverHud(true);
  screen = mountPrepare(overlay, {
    initial, previous,
    onConfirm: (design) => { screen?.destroy(); screen = null; showOverlay(false); startMissionMode(design); },
    onBack: () => { screen?.destroy(); screen = null; showOverlay(false); returnToControl(); },
  });
}

function missionTelemetry() {
  const ms = runner!.mission;
  return telemetryFromGame(ms.game, ms.lastPower, Date.now(), {
    dark: darknessAt(ms).isDark,
    exposure: ms.exposure,
    exposureLimit: ms.scenario.exposureLimit,
    storm: ms.game.storm.phase !== 'none',
  });
}

/** Power every switched-on circuit asks for right now, as if the batteries had no limit. */
function requestedDemand(ms: MissionState, isDay: boolean): number {
  const probe = structuredClone(ms.game);
  probe.res.energy = 1e9;
  return resolvePower(probe, SIM_STEP, isDay, { ...missionPowerOptions(probe), dischargeLimit: 1e9 }).demand;
}

function missionSystems() {
  const ms = runner!.mission;
  const scale = missionPowerOptions(ms.game).lightsDrawScale;
  const dark = darknessAt(ms).isDark;
  const shed = ms.lastPower.shed ?? [];
  const names = { lifeSupport: 'lifeSupport', heating: 'heating', processor: 'processor', robots: 'robots', greenhouse: 'greenhouse' } as const;
  return systemsFromGame(ms.game, ms.lastPower, {
    dark,
    available: ms.lastPower.available,
    lightsDraw: (ms.lastPower.running.lights / 100) * ENERGY.growLightsMaxDraw * scale,
    cause: shed.length && !shed.includes('lifeSupport')
      ? { key: 'sysCauseLimit', vars: { a: (ms.lastPower.available ?? 0).toFixed(2), d: requestedDemand(ms, !dark).toFixed(2), x: shed.map((c) => t(names[c]).toLowerCase()).join(', ') }, risk: 'caution' }
      : null,
  });
}

/** Swap in a fresh mission state: HUD, buildings, colliders, astronaut and camera follow it. */
function startMissionMode(design: Design, restored?: MissionState): void {
  epoch++;
  closeCommander();
  debrief?.destroy();
  debrief = null;
  comparison = undefined;
  const ms = restored ?? startMission(design);
  runner = createMissionRunner(ms);
  state = ms.game;
  mode = 'mission';
  ended = false;
  eventsSeen = 0;
  lastShortageRadio = -Infinity;
  power = ms.lastPower;
  showOverlay(false);
  coverHud(false);
  document.body.classList.add('nx-mission');
  flightButton.hidden = false;
  flightMode = false;
  flightSnapshot = null;
  cameraHost.style.visibility = '';
  document.body.classList.remove('nx-flight');
  updateFlightButton();
  hud.setState(state);
  hud.setMode('mission');
  hud.setShower(null);
  syncWorld();
  colliders = base.colliders();
  base.parkRover(state.rover.x, state.rover.z, state.rover.rot);
  player.position.set(state.player.x, 0, state.player.z);
  player.unstick(colliders);
  if (cameraRig.mode === 'follow') {
    camera.position.set(state.player.x + 11, 13, state.player.z + 14);
    controls.target.set(state.player.x, 0.8, state.player.z);
  }
  missionBar?.destroy();
  missionBar = mountMissionBar(barRoot, {
    getState: () => runner!.mission,
    isPaused: () => runner!.paused,
    getSpeed: () => runner!.speed,
    onTogglePause: togglePause,
    onSpeed: (v) => { if (runner) runner.speed = v; },
    onOpenCommander: openCommander,
    onSkip: () => { runner?.skipToNextStop(); },
  });
  ribbon?.destroy();
  ribbon = mountTelemetryRibbon(document.body, {
    getSnapshot: missionTelemetry,
    onOpenPower: () => systems?.setCollapsed(false),
    onOpenCommander: openCommander,
  });
  systems?.destroy();
  systems = mountSystemsHud(document.body, {
    getSnapshot: missionSystems,
    onBreaker: (system, on) => refusal(dispatch({ type: 'setPower', system, on })),
    onLights: (value) => refusal(dispatch({ type: 'setGrowLights', value })),
    onPriority: (order) => refusal(dispatch({ type: 'setPriority', order })),
    canCommand: () => !!runner && runner.canDispatch(),
    initialCollapsed: false,
  });
  radio?.destroy();
  radio = mountCommanderRadio(document.body);
  mountCamera();
  barRoot.querySelector('.m-controls')?.insertBefore(evacuate, barRoot.querySelector('.m-status'));
  evacuate.hidden = false;
  cameraRig.setMode('follow');
  controls.update();
  bgm.play();
  // Earth launch, cislunar transit and touchdown; the camera ends on the exact gameplay pose.
  if (restored) { runner.paused = true; eventsSeen = ms.events.length; if (ms.phase !== 'running') { ended = true; showDebrief(ms); } }
  else playSequence('arrival', () => { canvas.focus({ preventScroll: true }); });
}

function togglePause(): void {
  if (!runner || runner.blocked || runner.mission.phase !== 'running') return;
  runner.paused = !runner.paused;
  missionBar?.update();
}

/** The commander pauses the mission; closing restores the pause state it found. */
function openCommander(): void {
  if (inputLocked || !runner || runner.blocked || commander || runner.mission.phase !== 'running') return;
  const active = runner;
  const wasPaused = active.paused;
  const focusBack = document.activeElement as HTMLElement | null;
  active.paused = true;
  active.blocked = true;
  hud.close();
  coverHud(true);
  const close = () => {
    commander?.destroy();
    commander = null;
    coverHud(false);
    active.blocked = false;
    active.paused = wasPaused;
    focusBack?.focus();
  };
  commander = mountCommander(document.body, {
    getState: () => active.mission,
    onClose: close,
    onConfirm: (plan) => {
      // Both futures are projected from this same checkpoint before anything is applied.
      try {
        comparison = compareFlightPlans(active.mission, plan, { kind: 'endOfMission' }, project);
      } catch {
        comparison = undefined;
      }
      const results = active.confirm(plan);
      results.forEach((r, i) => {
        if (!r.ok) radio?.push({ text: `${commandText(plan[i])}: ${r.reason ?? ''}`, priority: 'warning', at: active.mission.t });
      });
      close();
    },
  });
  closeCommander = close;
  // Focus goes into the dialog, so Esc and Tab act there and not on the control that opened it.
  document.querySelector<HTMLElement>('.c-commander button')?.focus();
}
let closeCommander = (): void => {};

let flightMode = false;
let flightSnapshot: { systemsOpen: boolean; density: 'full' | 'compact' } | null = null;
const flightButton = el('button.nx-flight-btn', { type: 'button' }, 'H');
Object.assign(flightButton.style, {
  position: 'fixed', right: 'max(12px, env(safe-area-inset-right))', bottom: 'max(12px, env(safe-area-inset-bottom))',
  zIndex: '45', padding: '6px 10px', minHeight: '36px',
});
flightButton.hidden = true;
document.body.append(flightButton);

function updateFlightButton(): void {
  flightButton.textContent = flightMode ? t('flightModeOff') : t('flightModeOn');
  flightButton.title = t('flightModeHint');
}

function toggleFlightMode(): void {
  if (mode !== 'mission' || commander) return;
  flightMode = !flightMode;
  if (flightMode) {
    flightSnapshot = {
      systemsOpen: systems ? !systems.isCollapsed() : true,
      density: ribbon ? (ribbon.el.classList.contains('is-compact') ? 'compact' : 'full') : 'full',
    };
    systems?.setCollapsed(true);
    ribbon?.setDensity('compact');
    cameraHost.style.visibility = 'hidden';
    document.body.classList.add('nx-flight');
  } else {
    if (flightSnapshot) {
      systems?.setCollapsed(!flightSnapshot.systemsOpen);
      ribbon?.setDensity(flightSnapshot.density);
    }
    cameraHost.style.visibility = '';
    document.body.classList.remove('nx-flight');
    flightSnapshot = null;
  }
  updateFlightButton();
}
flightButton.addEventListener('click', toggleFlightMode);

const RADIO: Partial<Record<MissionEvent['kind'], Omit<RadioCall, 'text'>>> = {
  darkness_warning: { priority: 'warning', hintKey: 'nxHintDarkWarn', whyKey: 'sciPolarWhy' },
  darkness_start: { priority: 'warning', hintKey: 'nxHintDarkWarn' },
  darkness_end: { priority: 'routine' },
  storm_warning: { priority: 'critical', hintKey: 'nxHintStormWarn', whyKey: 'sciStormWhy' },
  storm_start: { priority: 'critical', hintKey: 'nxHintStormWarn', whyKey: 'sciShieldWhy' },
  storm_end: { priority: 'routine', hintKey: 'nxHintStormEnd' },
  harvest: { priority: 'routine', whyKey: 'sciPlantsWhy' },
  plant_dead: { priority: 'warning', hintKey: 'nxHintPlantDead', whyKey: 'sciPlantsWhy' },
  life_support_unpowered: { priority: 'critical', hintKey: 'nxHintLifeSupport' },
  power_shortage: { priority: 'warning', hintKey: 'nxHintShortage' },
};

function radioEvent(e: MissionEvent): void {
  const call = RADIO[e.kind];
  if (!call || !radio) return;
  if (e.kind === 'power_shortage') {
    if (e.t - lastShortageRadio < 30) return;
    lastShortageRadio = e.t;
  }
  // A critical call replaces older routine traffic instead of waiting behind it.
  if (call.priority === 'critical') radio.clear();
  radio.push({ ...call, text: e.text, at: e.t });
}

/** Once per frame in mission mode: radio for new events, the HUD, and the debrief exactly once. */
function missionFrame(active: MissionRunner): void {
  const ms = active.mission;
  for (; eventsSeen < ms.events.length; eventsSeen++) radioEvent(ms.events[eventsSeen]);
  missionBar?.update();
  ribbon?.update();
  systems?.update();
  if (ms.phase === 'running' || ended) return;
  ended = true;
  closeCommander();
  active.blocked = true;
  hud.close();
  keys.clear();
  evacuate.hidden = true;
  flights.push(structuredClone(ms));
  // Victory earns its fly-over before the Flight Readiness Review; a failure goes straight there.
  if (ms.phase === 'victory') playSequence('victory', () => showDebrief(ms));
  else showDebrief(ms);
}

function showDebrief(ms: MissionState): void {
  const retry = (design: Design) => {
    previousSummary = summarize(ms);
    debrief?.destroy();
    debrief = null;
    showPrepare(design, previousSummary);
  };
  const menu = () => returnToControl();
  showOverlay(true);
  coverHud(true);
  debrief = mountDebrief(overlay, [
    { id: 'result', labelKey: 'nxTabResult', mount: (root) => mountReport(root, { getState: () => ms, previous: previousSummary, onRetry: retry, onMenu: menu }) },
    { id: 'review', labelKey: 'nxTabReview', mount: (root) => mountFlightReview(root, { getState: () => ms, comparison, weather, onRetry: retry, onMenu: menu, onPassport: () => debrief?.show('passport') }) },
    { id: 'passport', labelKey: 'nxTabPassport', mount: (root) => mountPassport(root, { name: getPlayerName(), missions: flights, onBack: () => debrief?.show('review') }) },
  ], 'review');
}

/** Motion preference: the title shot and the flight sequences stay still when it asks so. */
const REDUCED_MOTION = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---- Flight sequences (arrival, evacuation, victory) ---------------------------------------

const titleScene = createTitleScene(REDUCED_MOTION);
// Compile the title shaders up front so the first menu frame is not a long blank one.
renderer.compile(titleScene.scene, camera);
const cinema = new CinematicDirector({ camera, controls, scene, lander: base.objectOf('lander')!, astronaut: player.obj });
canvas.tabIndex = 0;
const evacuate = el('button.cinema-evacuate', { type: 'button', hidden: true }, 'Evacuar');
document.body.append(evacuate);

function clearFlightInput(): void {
  keys.clear();
  downAt = null;
  hud.resetInput();
  player.resetMotion();
}

function leaveMissionHud(): void {
  missionBar?.destroy(); missionBar = null;
  ribbon?.destroy(); ribbon = null;
  systems?.destroy(); systems = null;
  radio?.destroy(); radio = null;
  evacuate.hidden = true;
  document.body.classList.remove('nx-mission');
  coverHud(false);
}

let contextPause: { active: MissionRunner; blocked: boolean } | null = null;
function blockMission(active: MissionRunner, blocked: boolean): void {
  if (contextLost && contextPause?.active === active) {
    contextPause.blocked = blocked;
    active.blocked = true;
  } else active.blocked = blocked;
}

/** Hand the camera to a sequence: the mission is paused and blocked, inputs drained, HUD hidden. */
function playSequence(kind: SequenceKind, done: () => void): void {
  if (cinema.active) return;
  const active = runner;
  const wasBlocked = active?.blocked ?? false;
  const wasPaused = active?.paused ?? false;
  inputLocked = true;
  epoch++;
  if (active) { blockMission(active, true); active.paused = true; }
  clearFlightInput();
  hud.close();
  document.body.classList.add('nx-cinema');
  const markerVisible = marker.visible;
  marker.visible = false;
  clock.getDelta();
  cinema.start(kind, () => {
    if (active && runner === active) { blockMission(active, wasBlocked); active.paused = wasPaused; }
    missionBar?.update(true);
    document.body.classList.remove('nx-cinema');
    marker.visible = markerVisible;
    clearFlightInput();
    inputLocked = false;
    done();
  });
}

/** Back to the title menu without reloading: the mission is dropped, the free save untouched. */
function returnToControl(): void {
  epoch++;
  closeCommander();
  debrief?.destroy(); debrief = null;
  screen?.destroy(); screen = null;
  showOverlay(false);
  leaveMissionHud();
  runner = null;
  inputLocked = false;
  clearFlightInput();
  hud.close();
  showTitle();
}

evacuate.addEventListener('click', () => {
  if (inputLocked || !runner || runner.blocked || runner.mission.phase !== 'running') return;
  const active = runner;
  const paused = active.paused;
  const blocked = active.blocked;
  active.blocked = true;
  inputLocked = true;
  clearFlightInput();
  const dialog = el('dialog.cinema-confirm', { 'aria-labelledby': 'evacuation-title' },
    el('h2', { id: 'evacuation-title' }, 'Evacuar base'),
    el('p', {}, 'Terminar este intento y evacuar a la tripulación. Volverás al menú; este vuelo no cuenta como victoria.'),
    el('form', { method: 'dialog' }, el('button', { value: 'continue', autofocus: true }, 'Continuar misión'), el('button', { value: 'evacuate' }, 'Confirmar evacuación')));
  for (const type of ['keydown', 'keyup']) dialog.addEventListener(type, (event) => event.stopPropagation());
  dialog.addEventListener('close', () => {
    dialog.remove();
    inputLocked = false;
    active.paused = paused;
    blockMission(active, blocked);
    clearFlightInput();
    if (dialog.returnValue === 'evacuate') playSequence('evacuation', returnToControl);
    else evacuate.focus();
  }, { once: true });
  document.body.append(dialog);
  dialog.showModal();
});

document.addEventListener('visibilitychange', () => { clock.getDelta(); clearFlightInput(); });
canvas.addEventListener('webglcontextlost', () => {
  contextLost = true;
  cinema.interrupt();
  contextPause = runner ? { active: runner, blocked: runner.blocked } : null;
  if (runner) runner.blocked = true;
});
canvas.addEventListener('webglcontextrestored', () => {
  contextLost = false;
  clock.getDelta();
  clearFlightInput();
  if (runner && contextPause?.active === runner) runner.blocked = contextPause.blocked;
  contextPause = null;
});
if (import.meta.env.DEV) Object.assign(window, { cinema });

const freeClock = fixedStepClock(SIM_STEP);
let frame = 0;
renderer.setAnimationLoop(() => {
  const realDt = clock.getDelta();
  if (document.hidden || contextLost) return;
  const dt = Math.min(realDt, 0.1);
  if (cinema.active) {
    cinema.update(realDt);
    renderer.shadowMap.needsUpdate = true;
    renderer.render(cinema.renderScene, camera);
    return;
  }
  if (mode === 'menu') {
    titleScene.update(dt, camera);
    renderer.render(titleScene.scene, camera);
    return;
  }
  adaptQuality(dt);
  renderer.shadowMap.needsUpdate = frame++ % 2 === 0;
  if (mode === 'free' && !inputLocked) {
    freeClock.advance(dt, () => {
      power = tick(state, SIM_STEP);
      checkMissions();
      maybeImpact();
      stormStep();
      if (stepRescue(state, SIM_STEP)) {
        hud.radioText(t('rescueNews', { mat: RESCUE.materials }));
        drops.drop(new THREE.Vector3(-14, 0, 15.5));
      }
    });
  } else if (mode === 'mission' && runner) {
    runner.advance(dt);
    power = runner.mission.lastPower;
    missionFrame(runner);
    if (cinema.active) { renderer.render(cinema.renderScene, camera); return; }
  }
  // The astronaut only moves when the world is live: not behind the menu, a pause or an overlay.
  const live = !inputLocked && (mode === 'free' || (mode === 'mission' && !!runner && runner.canDispatch()));
  const pdt = live ? dt : 0;
  // Day and night fade smoothly; the Sun moves along the horizon.
  const isDay = mode === 'mission' && runner ? !darknessAt(runner.mission).isDark : cyclePhase(state.time).isDay;
  night += ((isDay ? 0 : 1) - night) * Math.min(1, dt * 0.4);
  light.setNight(night);
  setNightLevel(night);
  const az = sunAzimuth(state.time);
  light.sun.position.set(Math.cos(az) * 40, 4 + (1 - night) * 3, Math.sin(az) * 40);

  colliders = base.colliders();
  const input = live ? moveInput() : new THREE.Vector2();
  if (state.rover.driving) {
    const rv = base.rover();
    driver.update(pdt, input, colliders.filter((c) => c.obj !== rv));
    // The astronaut sits in the driver's seat and rides along.
    player.sitAt(rv, DRIVER_SEAT);
  } else {
    player.update(pdt, input, colliders, state.sheltered, live && (keys.has(' ') || hud.jumpHeld()));
  }
  animateModel(player.obj, clock.elapsedTime, dt);
  const focus = state.rover.driving ? base.rover().position : player.position;
  // Q / E turn the camera only when no tactical transition is running.
  if (!cameraRig.transitioning && live) cameraTurn(dt);
  cameraRig.setEnabled(!inputLocked && !(runner && runner.blocked && mode === 'mission'));
  cameraRig.update(dt, focus);
  updatePrompt();
  updateMarker(clock.elapsedTime);

  base.update(state, clock.elapsedTime, inputLocked ? 0 : dt, Math.atan2(Math.cos(az), Math.sin(az)), power);
  animateSharedMaterials(clock.elapsedTime);
  fx.update(dt);
  flashes.update(dt);
  drops.update(dt);
  hud.setStorm(mode !== 'free' || state.storm.phase === 'none' ? null : {
    phase: state.storm.phase,
    seconds: state.storm.timeLeft,
    label: state.storm.flare ? state.storm.flare.class : `S${radiationScale(weather.protons.flux)}`,
    dose: state.dose,
    exposed: !state.sheltered,
  }, clock.elapsedTime);
  hud.update(dt);
  renderer.render(scene, camera);
});

const pngButton = el('button.t-btn.png-save-open', { type: 'button', onclick: openSaveArchive }, 'Partidas PNG');
document.querySelector('#topright')?.append(pngButton);

function openSaveArchive(): void {
  if (inputLocked || cinema.active || commander) return;
  const active = runner, wasPaused = active?.paused ?? false, wasBlocked = active?.blocked ?? false;
  inputLocked = true; epoch++; clearFlightInput(); hud.close();
  if (active) { active.paused = true; active.blocked = true; }
  renderer.render(mode === 'menu' ? titleScene.scene : scene, camera);
  const image = document.createElement('canvas'); image.width = canvas.width; image.height = canvas.height;
  image.getContext('2d')?.drawImage(canvas, 0, 0);
  let current: PortableSave | null = null;
  const common = { format: 'nexus-save' as const, version: 1 as const, createdAt: Date.now(), name: getPlayerName(), lang: getLang() };
  if (mode === 'free') {
    const game = structuredClone(state), rv = base.rover();
    game.player = { x: player.position.x, z: player.position.z };
    Object.assign(game.rover, { x: rv.position.x, z: rv.position.z, rot: rv.rotation.y });
    current = { ...common, checkpoint: { mode: 'free', game } };
  } else if (mode === 'mission' && active) current = { ...common, checkpoint: { mode: 'mission', mission: structuredClone(active.mission), position: { x: player.position.x, z: player.position.z }, speed: active.speed } };
  openPngSave({ current, image,
    close: () => {
      inputLocked = false; clearFlightInput();
      if (active && runner === active) { active.paused = wasPaused; active.blocked = wasBlocked; }
    },
    load: (loadedSave) => {
      if (mode === 'free') save();
      void leaveTitle(); debrief?.destroy(); debrief = null; screen?.destroy(); screen = null;
      setPlayerName(loadedSave.name);
      saveProfile({ name: loadedSave.name });
      const cp = loadedSave.checkpoint;
      if (cp.mode === 'free') {
        cp.game.savedAt = Date.now(); startFree(cp.game);
        if (!saveGame(state)) hud.radioText('Partida cargada. Conserva PNG: guardado local no disponible.', true);
      } else {
        startMissionMode(cp.mission.design, cp.mission);
        runner!.speed = cp.speed;
        player.position.set(cp.position.x, 0, cp.position.z); player.unstick(base.colliders());
        missionBar?.update(true);
      }
    },
  });
}

showTitle();
