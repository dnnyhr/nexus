import * as THREE from 'three';
import type { BuildingKind } from '../game/config';
import type { PowerReport } from '../game/sim';
import type { GameState } from '../game/state';
import { animateModel, setMode, type AnimMode } from '../models/anim';
import { setPlantGrowth } from '../models/greenhouse';
import { station } from '../models/habitat';
import { antenna, lander } from '../models/landmarks';
import { battery, solarMast } from '../models/power';
import { processor } from '../models/processor';
import { greenhouse, type GreenhouseLevel } from '../models/greenhouse';
import { collectorRobot, harvesterRobot, rover } from '../models/vehicles';
import { setDamage } from '../models/damage';
import type { StationLevel } from '../models/habitat';
import { heightAt } from './terrain';

// The base as a 3D scene, built from the game state. Each building sits in a fixed slot
// sized for its level-5 footprint, and is rebuilt only when its level changes.

export type Slot = 'station' | 'greenhouse' | 'processor' | 'solarMast' | 'battery' | 'antenna' | 'lander' | 'rover';

const SLOTS = {
  station: new THREE.Vector3(-6, 0, -4),
  greenhouse: new THREE.Vector3(2, 0, 12),
  processor: new THREE.Vector3(14, 0, -4),
  antenna: new THREE.Vector3(-18, 0, -6),
  lander: new THREE.Vector3(-18, 0, 12),
  rover: new THREE.Vector3(9, 0, 4),
};
const MAST_SLOTS = [2, 5, 8, 11, 14, 17].map((x) => new THREE.Vector3(x, 0, -16));
const BATTERY_SLOTS = [[21, -10], [21, -7], [24, -10], [24, -7]].map(([x, z]) => new THREE.Vector3(x, 0, z));
/** Where collector robots dig and where they unload (bottom of the processor conveyor). */
const DIG_SITES = [new THREE.Vector3(22, 0, 8), new THREE.Vector3(19, 0, 16), new THREE.Vector3(-22, 0, -16)];
const UNLOAD = new THREE.Vector3(12.7, 0, -1.6);
const HARVEST_DOCK = new THREE.Vector3(2, 0, 8.6);

/** A vehicle or person that walks a loop of targets, working a while at each. */
interface Agent {
  obj: THREE.Object3D;
  targets: THREE.Vector3[];
  index: number;
  speed: number;
  workSeconds: number;
  workLeft: number;
  moveMode: AnimMode;
}

export class BaseView {
  readonly group = new THREE.Group();
  private built = new Map<string, { key: string; obj: THREE.Object3D }>();
  private agents: Agent[] = [];
  /** True after the first sync, so loading a game doesn't animate every building. */
  private ready = false;

  /** Building roots by slot, for picking and for the UI. */
  readonly buildings = new Map<THREE.Object3D, Slot>();

  /** Ghost silhouettes where unlocked buildings can be built. */
  private sites = new Map<string, { kind: BuildingKind; obj: THREE.Group }>();
  /** Newly built objects rising from the ground: object -> seconds since built. */
  private rising = new Map<THREE.Object3D, number>();
  private ghostMat = new THREE.MeshLambertMaterial({ color: 0xf5f2ec, transparent: true, opacity: 0.28, depthWrite: false });
  private ringMat = new THREE.MeshBasicMaterial({ color: 0xf2b54a, transparent: true, opacity: 0.8, side: THREE.DoubleSide });

  constructor() {
    this.place('lander', lander(), SLOTS.lander, 0.4);
    this.place('rover', rover(), SLOTS.rover, -0.6);
  }

  /** Where a building kind goes (for sites and for the mission marker). */
  slotOf(kind: BuildingKind, s: GameState): THREE.Vector3 | null {
    switch (kind) {
      case 'antenna': return SLOTS.antenna;
      case 'station': case 'shield': return SLOTS.station;
      case 'greenhouse': return SLOTS.greenhouse;
      case 'processor': return SLOTS.processor;
      case 'solarMast': return MAST_SLOTS[Math.min(s.counts.solarMast, MAST_SLOTS.length - 1)];
      case 'battery': return BATTERY_SLOTS[Math.min(s.counts.battery, BATTERY_SLOTS.length - 1)];
      case 'collectorRobot': return UNLOAD;
      case 'harvesterRobot': return HARVEST_DOCK;
    }
  }

  /** Show a ghost for every unlocked building that can be placed now. */
  syncSites(s: GameState, kinds: Set<BuildingKind>): void {
    const want = new Map<string, BuildingKind>();
    const placeable: Partial<Record<BuildingKind, boolean>> = {
      antenna: s.levels.antenna === 0,
      station: s.levels.station === 0,
      greenhouse: s.levels.greenhouse === 0,
      processor: s.levels.processor === 0,
      solarMast: s.counts.solarMast < MAST_SLOTS.length,
      battery: s.counts.battery < BATTERY_SLOTS.length,
      collectorRobot: s.levels.collectorRobot === 0,
      harvesterRobot: s.levels.harvesterRobot === 0,
    };
    for (const k of kinds) if (placeable[k]) want.set(`${k}:${k === 'solarMast' ? s.counts.solarMast : k === 'battery' ? s.counts.battery : 0}`, k);
    for (const [key, site] of this.sites) {
      if (!want.has(key)) { this.group.remove(site.obj); this.sites.delete(key); }
    }
    for (const [key, kind] of want) {
      if (this.sites.has(key)) continue;
      const at = this.slotOf(kind, s)!;
      const ghost = this.ghostOf(kind);
      ghost.position.set(at.x, heightAt(at.x, at.z), at.z);
      if (kind === 'antenna') ghost.rotation.y = Math.atan2(-30, -136);
      if (kind === 'processor') ghost.rotation.y = -Math.PI / 2;
      ghost.userData.site = kind;
      this.group.add(ghost);
      this.sites.set(key, { kind, obj: ghost });
    }
  }

  private ghostOf(kind: BuildingKind): THREE.Group {
    const model = ({
      antenna, station: () => station(1), shield: () => station(1), greenhouse: () => greenhouse(1), processor, solarMast, battery,
      collectorRobot, harvesterRobot,
    } as Record<BuildingKind, () => THREE.Group>)[kind]();
    model.traverse((o) => {
      if (o instanceof THREE.Mesh) { o.material = this.ghostMat; o.castShadow = false; o.receiveShadow = false; }
    });
    // Footprint ring on the ground.
    const box = new THREE.Box3().setFromObject(model);
    const r = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2 + 0.6;
    const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.12, r, 32), this.ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.04;
    const g = new THREE.Group();
    g.add(model, ring);
    return g;
  }

  /** The build site closest to a point, within `range` meters of its ring. */
  nearestSite(pos: THREE.Vector3, range: number): { kind: BuildingKind; obj: THREE.Object3D } | null {
    let best: { kind: BuildingKind; obj: THREE.Object3D } | null = null;
    let bestD = range;
    for (const site of this.sites.values()) {
      const box = new THREE.Box3().setFromObject(site.obj);
      const d = new THREE.Box2(new THREE.Vector2(box.min.x, box.min.z), new THREE.Vector2(box.max.x, box.max.z)).distanceToPoint(new THREE.Vector2(pos.x, pos.z));
      if (d < bestD) { bestD = d; best = site; }
    }
    return best;
  }

  /** Footprints of every building on the ground (XZ boxes), for player collisions. */
  colliders(): { obj: THREE.Object3D; box: THREE.Box2 }[] {
    const out: { obj: THREE.Object3D; box: THREE.Box2 }[] = [];
    for (const obj of this.buildings.keys()) {
      // Each module is its own box so the player can walk between modules of a big station.
      const parts = obj.userData.id?.startsWith('station') || obj.userData.id?.startsWith('greenhouse') ? obj.children : [obj];
      for (const part of parts) {
        const b3 = new THREE.Box3().setFromObject(part);
        if (b3.isEmpty() || b3.max.y < 0.5) continue;
        const box = new THREE.Box2(new THREE.Vector2(b3.min.x, b3.min.z), new THREE.Vector2(b3.max.x, b3.max.z));
        // Thin parts (struts, masts) are easy to walk around; skip the tiny ones.
        const size = box.getSize(new THREE.Vector2());
        if (size.x < 0.3 && size.y < 0.3) continue;
        box.expandByScalar(-Math.min(size.x, size.y) * 0.08);
        out.push({ obj, box });
      }
    }
    return out;
  }

  /** Built object for a damage key ('processor', 'solarMast:1', ...). */
  objectOf(key: string): THREE.Object3D | null {
    return this.built.get(key)?.obj ?? null;
  }

  /** Damage key of a built object (inverse of objectOf). */
  keyOf(obj: THREE.Object3D): string | null {
    for (const [id, b] of this.built) if (b.obj === obj) return id;
    return null;
  }

  /** The building closest to a point, if its footprint is within `range` meters. */
  nearest(pos: THREE.Vector3, range: number, colliders = this.colliders()): THREE.Object3D | null {
    let best: THREE.Object3D | null = null;
    let bestD = range;
    const p = new THREE.Vector2(pos.x, pos.z);
    for (const c of colliders) {
      const d = c.box.distanceToPoint(p);
      if (d < bestD) { bestD = d; best = c.obj; }
    }
    return best;
  }

  private place(id: string, obj: THREE.Object3D, at: THREE.Vector3, rotY = 0, slot?: Slot): void {
    const prev = this.built.get(id);
    if (prev) {
      this.group.remove(prev.obj);
      this.buildings.delete(prev.obj);
    }
    obj.position.set(at.x, heightAt(at.x, at.z), at.z);
    obj.rotation.y = rotY;
    this.group.add(obj);
    this.built.set(id, { key: '', obj });
    this.buildings.set(obj, slot ?? (id.split(':')[0] as Slot));
  }

  /** Make the scene match the state: add, upgrade or remove buildings and robots. */
  sync(s: GameState): void {
    const lv = (n: number, key = `${n}`) => (n > 0 ? key : '');
    this.ensure('antenna', lv(s.levels.antenna), antenna, SLOTS.antenna, Math.atan2(-30, -136));
    this.ensure('station', lv(s.levels.station, `${s.levels.station}:${s.levels.shield}`), () => station(s.levels.station as StationLevel, s.levels.shield), SLOTS.station);
    this.ensure('greenhouse', lv(s.levels.greenhouse), () => greenhouse(s.levels.greenhouse as GreenhouseLevel), SLOTS.greenhouse);
    this.ensure('processor', lv(s.levels.processor), processor, SLOTS.processor, -Math.PI / 2);
    MAST_SLOTS.forEach((p, i) => this.ensure(`solarMast:${i}`, i < s.counts.solarMast ? 'on' : '', solarMast, p));
    BATTERY_SLOTS.forEach((p, i) => this.ensure(`battery:${i}`, i < s.counts.battery ? 'on' : '', battery, p));
    this.syncRobots(s);
    this.ready = true;
  }

  private ensure(id: string, key: string, build: () => THREE.Group, at: THREE.Vector3, rotY = 0): void {
    const prev = this.built.get(id);
    if (prev?.key === key) return;
    if (prev) {
      this.group.remove(prev.obj);
      this.buildings.delete(prev.obj);
      this.built.delete(id);
    }
    if (!key) return;
    this.place(id, build(), at, rotY);
    const entry = this.built.get(id)!;
    entry.key = key;
    // Rise from the ground when it appears during play (not on the first sync).
    if (this.ready) this.rising.set(entry.obj, 0);
  }

  private syncRobots(s: GameState): void {
    const want = [
      ...Array.from({ length: s.levels.collectorRobot > 0 ? 1 : 0 }, () => 'collector'),
      ...Array.from({ length: s.levels.harvesterRobot }, () => 'harvester'),
    ];
    const have = this.agents.filter((a) => a.obj.userData.id !== 'astronaut').map((a) => a.obj.userData.id as string);
    if (want.join() === have.map((h) => (h === 'collector-robot' ? 'collector' : 'harvester')).join()) return;
    // Rebuild the robot fleet (it only changes when the player builds a robot).
    for (const a of this.agents.filter((a) => a.obj.userData.id !== 'astronaut')) this.group.remove(a.obj);
    this.agents = this.agents.filter((a) => a.obj.userData.id === 'astronaut');
    want.forEach((kind, i) => {
      const obj = kind === 'collector' ? collectorRobot() : harvesterRobot();
      this.group.add(obj);
      const targets = kind === 'collector'
        ? [DIG_SITES[i % DIG_SITES.length], UNLOAD]
        : [new THREE.Vector3(-1, 0, 8.6), new THREE.Vector3(6, 0, 8.6)];
      obj.position.copy(targets[1]);
      this.agents.push({ obj, targets, index: 0, speed: kind === 'collector' ? 1.8 : 0.9, workSeconds: kind === 'collector' ? 6.4 : 8, workLeft: 0, moveMode: 'drive' });
    });
  }

  /** Per-frame update: movement, animations, and state shown on the models. */
  update(s: GameState, t: number, dt: number, sunAzimuth: number, power: PowerReport): void {
    for (const a of this.agents) this.moveAgent(a, dt, s);
    for (const [obj, age] of this.rising) {
      const k = Math.min(1, (age + dt) / 1.4);
      const e = 1 - Math.pow(1 - k, 3);
      obj.scale.set(1, Math.max(0.02, e), 1);
      if (k >= 1) this.rising.delete(obj);
      else this.rising.set(obj, age + dt);
    }
    this.ringMat.opacity = 0.45 + 0.35 * Math.sin(t * 3);
    for (const [id, { obj }] of this.built) {
      setDamage(obj, s.damage[id] ?? 0);
      if (obj.userData.id === 'processor') obj.userData.active = power.running.processor && !s.sheltered && s.res.regolith > 0;
      if (obj.userData.plants) {
        obj.userData.health = 1 - s.plant.stress / 100;
        obj.userData.dead = s.plant.dead;
        obj.userData.lights = power.running.lights;
      }
      if (obj.userData.id === 'solar-mast') obj.userData.sunAzimuth = sunAzimuth - obj.rotation.y;
      if (obj.userData.id === 'battery') obj.userData.charge = s.res.energy / Math.max(1, 120 + s.counts.battery * 300);
      const plants = obj.userData.plants as THREE.Object3D[] | undefined;
      if (plants) {
        plants.forEach((p, i) => {
          const g = s.plant.dead ? 0.05 : (s.plant.growth / 100) * (0.85 + 0.15 * ((i * 0.618) % 1));
          setPlantGrowth(p, g);
        });
      }
    }
    animateModel(this.group, t, dt);
  }

  private moveAgent(a: Agent, dt: number, s: GameState): void {
    const isRobot = a.obj.userData.id !== 'astronaut';
    // Robots stop while the crew shelters or when robots are switched off; the astronaut hides inside.
    if (s.sheltered || (isRobot && !s.power.robots)) {
      setMode(a.obj, 'idle');
      a.obj.visible = isRobot || !s.sheltered;
      return;
    }
    a.obj.visible = true;
    if (a.workLeft > 0) {
      a.workLeft -= dt;
      setMode(a.obj, a.obj.userData.modes?.includes('work') ? 'work' : 'idle');
      if (a.workLeft <= 0) a.index = (a.index + 1) % a.targets.length;
      return;
    }
    const target = a.targets[a.index];
    const pos = a.obj.position;
    const dx = target.x - pos.x;
    const dz = target.z - pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.2) {
      a.workLeft = a.workSeconds;
      return;
    }
    const heading = Math.atan2(dx, dz);
    let turn = heading - a.obj.rotation.y;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    a.obj.rotation.y += turn * Math.min(1, dt * 3);
    const step = Math.min(dist, a.speed * dt * Math.max(0, Math.cos(turn)));
    pos.x += Math.sin(a.obj.rotation.y) * step;
    pos.z += Math.cos(a.obj.rotation.y) * step;
    pos.y = heightAt(pos.x, pos.z);
    setMode(a.obj, a.moveMode);
  }
}
