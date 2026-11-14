import * as THREE from 'three';
import { asModel, beacon, foot, hatch, pad, rock, windowPane } from './kit';
import { habitat } from './habitat';
import { processor } from './processor';
import { battery, solarMast } from './power';
import { greenhouse } from './greenhouse';
import { collectorRobot, harvesterRobot, rover } from './vehicles';
import { antenna, lander } from './landmarks';
import { commander } from './commander';

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

/** All models together, laid out like a small base, to check scale and consistency. */
function lineup(): THREE.Group {
  const g = new THREE.Group();
  const place = (m: THREE.Group, x: number, z: number, ry = 0) => {
    m.position.set(x, 0, z);
    m.rotation.y = ry;
    g.add(m);
  };
  place(habitat(1), 0, 0);
  place(greenhouse(), 9, 1);
  place(processor(), -8, 1);
  place(solarMast(), -4, -6);
  place(solarMast(), -1.5, -6.5);
  place(battery(), -6.5, -5);
  place(antenna(), 5, -5);
  place(lander(), 12, -8);
  place(collectorRobot(), -6, 5, -0.6);
  place(harvesterRobot(), 7, 4.5, 0.4);
  place(rover(), 3, 6, 0.3);
  place(commander(), -1.4, 4.4, 0.3);
  return asModel(g, 'lineup', 0, 0);
}

export const MODELS: ModelEntry[] = [
  { id: 'lineup', name: 'Conjunto', build: lineup },
  { id: 'habitat', name: 'Hábitat', build: () => habitat(1) },
  { id: 'habitat-shield-3', name: 'Hábitat · blindaje máximo', build: () => habitat(3) },
  { id: 'processor', name: 'Procesador de regolito', build: processor },
  { id: 'solar-mast', name: 'Mástil solar', build: solarMast },
  { id: 'battery', name: 'Batería', build: battery },
  { id: 'greenhouse', name: 'Invernadero', build: greenhouse },
  { id: 'collector-robot', name: 'Robot recolector', build: collectorRobot },
  { id: 'harvester-robot', name: 'Robot cosechador', build: harvesterRobot },
  { id: 'rover', name: 'Rover de expedición', build: rover },
  { id: 'antenna', name: 'Antena de comunicaciones', build: antenna },
  { id: 'lander', name: 'Módulo de aterrizaje', build: lander },
  { id: 'commander', name: 'Comandante', build: commander },
  { id: 'kit', name: 'Piezas compartidas', build: kitSample },
];
