import * as THREE from 'three';
import { asModel, beacon, foot, hatch, pad, rock, windowPane } from './kit';
import { habitat, station, type StationLevel } from './habitat';
import { processor } from './processor';
import { battery, solarMast } from './power';
import { greenhouse, type GreenhouseLevel } from './greenhouse';
import { collectorRobot, harvesterRobot, rover } from './vehicles';
import { antenna, lander } from './landmarks';
import { astronaut } from './astronaut';
import { setDamage } from './damage';

export interface ModelEntry {
  id: string;
  name: string;
  build: () => THREE.Group;
}

/** Sample of the shared parts, used to check the kit itself in the viewer. */
function kitSample(): THREE.Group {
  const g = new THREE.Group();
  g.add(pad(1.2));
  const h = hatch();
  h.position.set(-2.4, 0, 0);
  g.add(h);
  const w = windowPane(0.8, 0.5);
  w.position.set(2.4, 1.5, 0);
  g.add(w);
  g.add(foot(0, 2.4, 1.2));
  const b = beacon();
  b.position.set(0, 0.16, 0);
  g.add(b);
  const r = rock(0.5, 3);
  r.position.set(0, 0.2, -2.4);
  g.add(r);
  return asModel(g, 'kit', 2, 2);
}

/** Levels 1 to 5 of one building side by side (5 m apart), to compare how it grows. */
function progression(build: (level: number) => THREE.Group): THREE.Group {
  const g = new THREE.Group();
  let cursor = 0;
  for (let l = 1; l <= 5; l++) {
    const m = build(l);
    const box = new THREE.Box3().setFromObject(m);
    m.position.x = cursor - box.min.x;
    m.position.z = -(box.min.z + box.max.z) / 2;
    cursor += box.max.x - box.min.x + 5;
    g.add(m);
  }
  for (const c of g.children) c.position.x -= (cursor - 5) / 2;
  return asModel(g, 'progression', 0, 0);
}

/** All models together, laid out like a small base, to check scale and consistency. */
function lineup(): THREE.Group {
  const g = new THREE.Group();
  const place = (m: THREE.Group, x: number, z: number, ry = 0) => {
    m.position.set(x, 0, z);
    m.rotation.y = ry;
    g.add(m);
  };
  place(habitat(1), 0, 0);
  place(greenhouse(1), 9, 1);
  place(processor(), -8, 1);
  place(solarMast(), -4, -6);
  place(solarMast(), -1.5, -6.5);
  place(battery(), -6.5, -5);
  place(antenna(), 5, -5);
  place(lander(), 12, -8);
  place(collectorRobot(), -6, 5, -0.6);
  place(harvesterRobot(), 7, 4.5, 0.4);
  place(rover(), 3, 6, 0.3);
  place(astronaut(), -1.4, 4.4, 0.3);
  return asModel(g, 'lineup', 0, 0);
}

export const MODELS: ModelEntry[] = [
  { id: 'lineup', name: 'Conjunto', build: lineup },
  { id: 'station-progression', name: 'Estación · niveles 1 a 5', build: () => progression((l) => station(l as StationLevel)) },
  ...([1, 2, 3, 4, 5] as const).map((l) => ({ id: `station-${l}`, name: `Estación · nivel ${l}`, build: () => station(l) })),
  { id: 'station-shield-3', name: 'Estación · blindaje máximo', build: () => station(3, 3) },
  { id: 'greenhouse-progression', name: 'Invernadero · niveles 1 a 5', build: () => progression((l) => greenhouse(l as GreenhouseLevel)) },
  ...([1, 2, 3, 4, 5] as const).map((l) => ({ id: `greenhouse-${l}`, name: `Invernadero · nivel ${l}`, build: () => greenhouse(l) })),
  { id: 'processor', name: 'Procesador de regolito', build: processor },
  { id: 'solar-mast', name: 'Mástil solar', build: solarMast },
  { id: 'battery', name: 'Batería', build: battery },
  { id: 'collector-robot', name: 'Robot recolector', build: collectorRobot },
  { id: 'harvester-robot', name: 'Robot cosechador', build: harvesterRobot },
  { id: 'rover', name: 'Rover de expedición', build: rover },
  { id: 'antenna', name: 'Antena de comunicaciones', build: antenna },
  { id: 'lander', name: 'Módulo de aterrizaje', build: lander },
  { id: 'astronaut', name: 'Astronauta', build: astronaut },
  ...([
    ['processor', 'Procesador', processor],
    ['solar-mast', 'Mástil solar', solarMast],
    ['station-3', 'Estación nivel 3', () => station(3)],
    ['greenhouse-3', 'Invernadero nivel 3', () => greenhouse(3)],
    ['antenna', 'Antena', antenna],
    ['battery', 'Batería', battery],
  ] as [string, string, () => THREE.Group][]).map(([id, name, build]) => ({
    id: `damaged-${id}`,
    name: `${name} · dañado por micrometeoritos`,
    build: () => {
      const m = build();
      setDamage(m, 1);
      return m;
    },
  })),
  { id: 'kit', name: 'Piezas compartidas', build: kitSample },
];
