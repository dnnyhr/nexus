import * as THREE from 'three';
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

  /** Building roots by slot, for picking and for the UI. */
  readonly buildings = new Map<THREE.Object3D, Slot>();

  constructor() {
    this.place('antenna', antenna(), SLOTS.antenna, Math.atan2(-30, -136));
    this.place('lander', lander(), SLOTS.lander, 0.4);
    this.place('rover', rover(), SLOTS.rover, -0.6);
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
    this.ensure('station', `${s.levels.station}:${s.levels.shield}`, () => station(s.levels.station as StationLevel, s.levels.shield), SLOTS.station);
    this.ensure('greenhouse', `${s.levels.greenhouse}`, () => greenhouse(s.levels.greenhouse as GreenhouseLevel), SLOTS.greenhouse);
    this.ensure('processor', `${s.levels.processor}`, processor, SLOTS.processor, -Math.PI / 2);
    MAST_SLOTS.forEach((p, i) => this.ensure(`solarMast:${i}`, i < s.counts.solarMast ? 'on' : '', solarMast, p));
    BATTERY_SLOTS.forEach((p, i) => this.ensure(`battery:${i}`, i < s.counts.battery ? 'on' : '', battery, p));
    this.syncRobots(s);
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
    this.built.get(id)!.key = key;
  }

  private syncRobots(s: GameState): void {
    const want = [
      ...Array.from({ length: s.levels.collectorRobot > 0 ? 1 : 0 }, () => 'collector'),
      ...Array.from({ length: s.levels.harvesterRobot }, () => 'harvester'),
    ];
    const have = this.agents.filter((a) => a.obj.userData.id !== 'commander').map((a) => a.obj.userData.id as string);
    if (want.join() === have.map((h) => (h === 'collector-robot' ? 'collector' : 'harvester')).join()) return;
    // Rebuild the robot fleet (it only changes when the player builds a robot).
    for (const a of this.agents.filter((a) => a.obj.userData.id !== 'commander')) this.group.remove(a.obj);
    this.agents = this.agents.filter((a) => a.obj.userData.id === 'commander');
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
    for (const { obj } of this.built.values()) {
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
    const isRobot = a.obj.userData.id !== 'commander';
    // Robots stop while the crew shelters or when robots are switched off; the commander hides inside.
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
