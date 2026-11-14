import * as THREE from 'three';
import { asModel, beacon, foot, hatch, pad, rock, windowPane } from './kit';
import { habitat } from './habitat';
import { processor } from './processor';
import { battery, solarMast } from './power';

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

export const MODELS: ModelEntry[] = [
  { id: 'habitat', name: 'Hábitat', build: () => habitat(1) },
  { id: 'habitat-shield-3', name: 'Hábitat · blindaje máximo', build: () => habitat(3) },
  { id: 'processor', name: 'Procesador de regolito', build: processor },
  { id: 'solar-mast', name: 'Mástil solar', build: solarMast },
  { id: 'battery', name: 'Batería', build: battery },
  { id: 'kit', name: 'Piezas compartidas', build: kitSample },
];
