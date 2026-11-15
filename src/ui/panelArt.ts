import { COLLECT, ROVER } from '../game/config';
import { capacity, carryMax, type PowerReport } from '../game/sim';
import { cyclePhase, type GameState } from '../game/state';
import './panelArt.css';

// A small live illustration at the top of each panel, drawn from the real state: the plant
// grows and wilts, the hopper fills, the battery charges, the dish talks to Earth. One SVG
// per panel, kept in the DOM and updated in place (only attributes that changed are set).
// Palette: the game's bone white, warm greys, amber for attention, brick red for danger,
// olive for plants. Motion is CSS and stops for people who ask for reduced motion.

const NS = 'http://www.w3.org/2000/svg';
export const ART_W = 264;
export const ART_H = 112;

const C = {
  bone: '#f5f2ec', hull: '#c3c9cf', dark: '#3f3d3a', soil: '#6b6862', regolith: '#8e8a82',
  amber: '#f2b54a', red: '#c8553d', olive: '#6e8b5a', leaf: '#8fae6e', water: '#5d8fc4', panel: '#1d3a66', glass: '#9fc6e0',
};

type Attrs = Record<string, string | number>;
export interface Art { node: SVGSVGElement; update(): void }
export interface ArtContext { s: GameState; power(): PowerReport }

function make<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Attrs = {}, parent?: SVGElement): SVGElementTagNameMap[K] {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  parent?.append(n);
  return n;
}

/** Set an attribute only when it changes (panels refresh often). */
function set(n: SVGElement, k: string, v: string | number): void {
  const s = String(v);
  if (n.getAttribute(k) !== s) n.setAttribute(k, s);
}

function cls(n: SVGElement, name: string, on: boolean): void {
  n.classList.toggle(name, on);
}

function frame(label: string): SVGSVGElement {
  const svg = make('svg', { viewBox: `0 0 ${ART_W} ${ART_H}`, class: 'art', role: 'img', 'aria-label': label });
  make('rect', { width: ART_W, height: ART_H, fill: '#0b0c0e' }, svg);
  return svg;
}

function ground(svg: SVGSVGElement, y = 96): void {
  make('path', { d: `M0 ${y} L60 ${y - 3} L130 ${y + 1} L200 ${y - 4} L264 ${y} V112 H0 Z`, fill: C.soil }, svg);
}

const mix = (a: string, b: string, k: number): string => {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * Math.max(0, Math.min(1, k))).toString(16).padStart(2, '0')).join('')}`;
};

// ---- Greenhouse: the plant grows with `growth` and wilts with `stress` -----------------------

function greenhouseArt(c: ArtContext): Art {
  const svg = frame('greenhouse');
  const leds = make('rect', { x: 92, y: 10, width: 80, height: 5, rx: 2, fill: '#e7a6d8' }, svg);
  const glow = make('path', { d: 'M92 15 L60 92 H204 L172 15 Z', fill: '#e7a6d8', opacity: 0 }, svg);
  make('path', { d: 'M40 96 Q132 -8 224 96', fill: 'none', stroke: C.glass, 'stroke-width': 2, opacity: 0.6 }, svg);
  make('path', { d: 'M40 96 Q132 -8 224 96 Z', fill: C.glass, opacity: 0.07 }, svg);
  ground(svg);
  const soil = make('rect', { x: 92, y: 86, width: 80, height: 10, rx: 2, fill: C.soil }, svg);
  const plant = make('g', { class: 'plant-sway' }, svg);
  const stem = make('path', { fill: 'none', 'stroke-width': 3.5, 'stroke-linecap': 'round' }, plant);
  const leaves = Array.from({ length: 6 }, (_, i) => make('path', { d: i % 2 ? 'M0 0 q14 -10 26 0 q-12 8 -26 0z' : 'M0 0 q-14 -10 -26 0 q12 8 26 0z' }, plant));
  const fruits = Array.from({ length: 3 }, () => make('circle', { r: 5, fill: C.red }, plant));
  // Thermometer and water drop on the side.
  make('rect', { x: 232, y: 30, width: 8, height: 56, rx: 4, fill: '#1c1d20', stroke: C.hull, 'stroke-width': 1 }, svg);
  const mercury = make('rect', { x: 234, width: 4, rx: 2 }, svg);
  const drop = make('path', { d: 'M24 52 q8 12 0 18 q-8 -6 0 -18z', fill: C.water }, svg);
  return {
    node: svg,
    update() {
      const p = c.s.plant;
      const g = Math.max(0, Math.min(100, p.growth)) / 100;
      const stress = Math.max(0, Math.min(100, p.stress)) / 100;
      const dead = p.dead;
      const color = dead ? '#6b5236' : stress > 0.5 ? mix('#c9b458', '#8a6a3e', (stress - 0.5) * 2) : mix(C.leaf, '#c9b458', stress * 2);
      const h = 10 + g * 62;
      const bend = dead ? 34 : stress * 22;
      set(stem, 'd', `M132 88 Q${132 + bend * 0.4} ${88 - h * 0.55} ${132 + bend} ${88 - h + bend * 0.3}`);
      set(stem, 'stroke', dead ? '#5a4630' : mix(C.olive, '#9a8a4a', stress));
      leaves.forEach((leaf, i) => {
        const at = (i + 1) / (leaves.length + 1);
        const visible = g >= at * 0.9 - 0.05 || dead;
        const y = 88 - h * at;
        const x = 132 + bend * at * at;
        const droop = (i % 2 ? 1 : -1) * (dead ? 55 : stress * 40);
        const scale = 0.55 + 0.45 * Math.min(1, g / at);
        set(leaf, 'transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${droop.toFixed(1)}) scale(${scale.toFixed(2)})`);
        set(leaf, 'fill', color);
        set(leaf, 'opacity', visible ? 1 : 0);
      });
      fruits.forEach((f, i) => {
        set(f, 'cx', 132 + bend + (i - 1) * 9);
        set(f, 'cy', 88 - h + 6 + (i % 2) * 6);
        set(f, 'opacity', g >= 1 && !dead ? 1 : 0);
      });
      cls(plant, 'still', dead || stress > 0.6);
      const light = Math.max(0, Math.min(100, p.light)) / 100;
      set(glow, 'opacity', (0.05 + light * 0.18).toFixed(2));
      set(leds, 'opacity', (0.25 + light * 0.75).toFixed(2));
      const temp = Math.max(0, Math.min(100, p.temp)) / 100;
      set(mercury, 'y', 84 - temp * 52);
      set(mercury, 'height', 2 + temp * 52);
      set(mercury, 'fill', p.temp > 60 ? C.red : p.temp < 40 ? C.water : C.leaf);
      set(drop, 'opacity', (0.25 + (p.water / 100) * 0.75).toFixed(2));
      set(soil, 'fill', mix('#8e8a82', '#4a443c', p.water / 100));
    },
  };
}

// ---- Processor: hopper fills with regolith, the drum turns, oxygen bubbles out ---------------

function processorArt(c: ArtContext): Art {
  const svg = frame('processor');
  ground(svg);
  make('path', { d: 'M30 30 H90 L78 70 H42 Z', fill: '#1c1d20', stroke: C.hull, 'stroke-width': 2 }, svg);
  const fill = make('path', { fill: C.regolith }, svg);
  make('rect', { x: 52, y: 70, width: 16, height: 18, fill: C.hull }, svg);
  make('rect', { x: 100, y: 40, width: 80, height: 48, rx: 6, fill: C.bone }, svg);
  make('rect', { x: 100, y: 52, width: 80, height: 6, fill: C.amber }, svg);
  const gear = make('g', { class: 'spin', style: 'transform-origin: 140px 72px' }, svg);
  make('circle', { cx: 140, cy: 72, r: 11, fill: 'none', stroke: C.dark, 'stroke-width': 4, 'stroke-dasharray': '4 3' }, gear);
  make('circle', { cx: 140, cy: 72, r: 4, fill: C.dark }, gear);
  make('path', { d: 'M68 78 H100', stroke: C.hull, 'stroke-width': 3 }, svg);
  make('path', { d: 'M180 64 H214 V30', fill: 'none', stroke: C.hull, 'stroke-width': 3 }, svg);
  const bubbles = make('g', { class: 'bubbles' }, svg);
  for (let i = 0; i < 4; i++) make('circle', { cx: 214 + (i % 2 ? 6 : -6), cy: 26, r: 4 - (i % 3), fill: 'none', stroke: C.glass, 'stroke-width': 1.5, style: `animation-delay:${i * 0.45}s` }, bubbles);
  const label = make('text', { x: 222, y: 92, 'text-anchor': 'middle', class: 'art-label' }, svg);
  label.textContent = 'O₂';
  return {
    node: svg,
    update() {
      const s = c.s;
      const k = Math.min(1, s.res.regolith / Math.max(1, capacity(s).regolith));
      // Fill the hopper (a trapezoid from y 30 to 70) up to its level.
      const y = 70 - 40 * k;
      const spread = ((70 - y) * 12) / 40;
      set(fill, 'd', k > 0.01 ? `M42 70 H78 L${(78 + spread).toFixed(1)} ${y.toFixed(1)} H${(42 - spread).toFixed(1)} Z` : 'M0 0');
      const running = c.power().running.processor;
      cls(gear, 'on', running);
      cls(bubbles, 'on', running);
    },
  };
}

// ---- Solar masts: panels in the low polar Sun, or dark; power flows along the wire -----------

function solarArt(c: ArtContext): Art {
  const svg = frame('solar');
  const sky = make('rect', { width: ART_W, height: 96, fill: '#0b0c0e' }, svg);
  const sun = make('g', { class: 'sun-pulse' }, svg);
  make('circle', { cx: 28, cy: 84, r: 16, fill: C.bone, opacity: 0.25 }, sun);
  make('circle', { cx: 28, cy: 84, r: 7, fill: '#fffdf8' }, sun);
  make('path', { d: 'M0 84 H90', stroke: C.bone, 'stroke-width': 1, opacity: 0.5 }, sun);
  const stars = make('g', {}, svg);
  for (const [x, y] of [[40, 20], [90, 12], [150, 26], [210, 14], [240, 40], [120, 40]]) make('circle', { cx: x, cy: y, r: 1.2, fill: C.bone }, stars);
  ground(svg);
  const masts: SVGGElement[] = [];
  for (let i = 0; i < 4; i++) {
    const g = make('g', {}, svg);
    const x = 80 + i * 44;
    make('path', { d: `M${x} 96 V44`, stroke: C.hull, 'stroke-width': 3 }, g);
    make('rect', { x: x - 18, y: 26, width: 36, height: 22, fill: C.panel, stroke: '#2ee6d6', 'stroke-width': 1, transform: `rotate(-12 ${x} 37)` }, g);
    masts.push(g);
  }
  const flow = make('path', { d: 'M80 92 H252', stroke: C.amber, 'stroke-width': 2, 'stroke-dasharray': '3 9', class: 'flow' }, svg);
  const out = make('text', { x: 252, y: 86, 'text-anchor': 'end', class: 'art-label' }, svg);
  return {
    node: svg,
    update() {
      const s = c.s;
      const day = cyclePhase(s.time).isDay;
      const gen = c.power().generation;
      set(sun, 'visibility', day ? 'visible' : 'hidden');
      set(stars, 'opacity', day ? 0.25 : 1);
      set(sky, 'fill', day ? '#101216' : '#07080b');
      masts.forEach((m, i) => set(m, 'opacity', i < Math.max(1, s.counts.solarMast) ? (i < s.counts.solarMast ? 1 : 0.2) : 0));
      cls(flow, 'on', gen > 0.05);
      set(flow, 'opacity', gen > 0.05 ? 1 : 0.15);
      out.textContent = `${gen.toFixed(1)}/s`;
    },
  };
}

// ---- Battery: charge level, and an arrow that says if it is charging or draining -------------

function batteryArt(c: ArtContext): Art {
  const svg = frame('battery');
  make('rect', { x: 56, y: 22, width: 140, height: 68, rx: 8, fill: '#1c1d20', stroke: C.bone, 'stroke-width': 3 }, svg);
  make('rect', { x: 196, y: 44, width: 10, height: 24, rx: 2, fill: C.bone }, svg);
  const level = make('rect', { x: 62, y: 28, height: 56, rx: 4 }, svg);
  const cells = make('g', {}, svg);
  const pct = make('text', { x: 126, y: 63, 'text-anchor': 'middle', class: 'art-big' }, svg);
  const arrow = make('path', { class: 'pulse', 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg);
  return {
    node: svg,
    update() {
      const s = c.s;
      const p = c.power();
      const k = Math.max(0, Math.min(1, s.res.energy / Math.max(1, capacity(s).energy)));
      set(level, 'width', (128 * k).toFixed(1));
      set(level, 'fill', k < 0.1 ? C.red : k < 0.2 ? C.amber : C.leaf);
      pct.textContent = `${Math.round(k * 100)}%`;
      const n = Math.max(1, s.counts.battery + 1);
      if (cells.childElementCount !== n - 1) {
        cells.replaceChildren();
        for (let i = 1; i < n; i++) make('path', { d: `M${62 + (128 / n) * i} 30 V82`, stroke: '#0b0c0e', 'stroke-width': 2 }, cells);
      }
      const net = p.generation - p.demand;
      set(arrow, 'd', net >= 0 ? 'M226 76 V36 M216 46 L226 36 L236 46' : 'M226 36 V76 M216 66 L226 76 L236 66');
      set(arrow, 'stroke', net >= 0 ? C.leaf : C.amber);
      set(arrow, 'opacity', Math.abs(net) < 0.05 ? 0.2 : 1);
    },
  };
}

// ---- Habitat: one module per level, the regolith berm over it, the crew's health -------------

function stationArt(c: ArtContext): Art {
  const svg = frame('habitat');
  ground(svg);
  const berm = make('path', { fill: C.regolith }, svg);
  const mods = make('g', {}, svg);
  const heart = make('path', { d: 'M232 30 c-6 -8 -18 -2 -12 8 l12 12 l12 -12 c6 -10 -6 -16 -12 -8z' }, svg);
  const crew = make('g', {}, svg);
  for (let i = 0; i < 4; i++) {
    const g = make('g', { transform: `translate(${214 + (i % 2) * 14} ${62 + Math.floor(i / 2) * 16})` }, crew);
    make('circle', { cy: -6, r: 3.5, fill: C.bone }, g);
    make('rect', { x: -3, y: -2, width: 6, height: 8, rx: 2, fill: C.bone }, g);
  }
  return {
    node: svg,
    update() {
      const s = c.s;
      const n = Math.max(1, Math.min(5, s.levels.station));
      if (mods.childElementCount !== n) {
        mods.replaceChildren();
        const w = 34;
        const x0 = 104 - (n * w) / 2;
        for (let i = 0; i < n; i++) {
          const g = make('g', {}, mods);
          make('rect', { x: x0 + i * w + 2, y: 54, width: w - 4, height: 36, rx: 14, fill: C.bone, stroke: C.dark, 'stroke-width': 1.5 }, g);
          make('rect', { x: x0 + i * w + 2, y: 66, width: w - 4, height: 5, fill: C.amber }, g);
          make('circle', { cx: x0 + i * w + w / 2, cy: 62, r: 3, fill: '#1c1d20' }, g);
        }
      }
      const b = Math.min(3, s.levels.shield);
      set(berm, 'd', b ? `M${20 - b * 4} 96 Q104 ${52 - b * 10} ${188 + b * 4} 96 Z` : 'M0 0');
      set(berm, 'opacity', b ? 0.75 : 0);
      const hp = s.crewHealth / 100;
      set(heart, 'fill', hp < 0.3 ? C.red : hp < 0.6 ? C.amber : C.red);
      set(heart, 'opacity', (0.35 + hp * 0.65).toFixed(2));
      cls(heart, 'beat', hp > 0);
    },
  };
}

// ---- Robots: the collector with its scoop load and the harvester, asleep when off ------------

function robotsArt(c: ArtContext): Art {
  const svg = frame('robots');
  ground(svg);
  const robot = (x: number, label: string) => {
    const g = make('g', { class: 'bob' }, svg);
    make('rect', { x, y: 52, width: 44, height: 26, rx: 6, fill: C.bone }, g);
    make('rect', { x, y: 60, width: 44, height: 4, fill: C.amber }, g);
    for (const dx of [8, 36]) make('circle', { cx: x + dx, cy: 84, r: 8, fill: C.dark, stroke: C.hull, 'stroke-width': 2 }, g);
    make('path', { d: `M${x + 44} 58 l14 8 l-4 10`, fill: 'none', stroke: C.hull, 'stroke-width': 3 }, g);
    make('rect', { x: x + 14, y: 40, width: 16, height: 12, rx: 3, fill: '#1c1d20', stroke: C.hull }, g);
    const eye = make('circle', { cx: x + 22, cy: 46, r: 3, fill: C.amber }, g);
    const t = make('text', { x: x + 22, y: 30, 'text-anchor': 'middle', class: 'art-label' }, g);
    t.textContent = label;
    return { g, eye };
  };
  const a = robot(40, '');
  const load = make('path', { fill: C.regolith }, svg);
  const b = robot(160, '');
  const zzz = make('text', { x: 132, y: 30, 'text-anchor': 'middle', class: 'art-label' }, svg);
  zzz.textContent = 'z z z';
  return {
    node: svg,
    update() {
      const s = c.s;
      const on = s.power.robots;
      const lv = s.levels.collectorRobot;
      set(a.g, 'opacity', lv ? 1 : 0.18);
      set(b.g, 'opacity', s.levels.harvesterRobot ? 1 : 0.18);
      cls(a.g, 'on', on && lv > 0);
      cls(b.g, 'on', on && s.levels.harvesterRobot > 0);
      for (const r of [a, b]) set(r.eye, 'fill', on ? C.amber : '#55565a');
      const k = lv ? COLLECT.robotLoad[Math.min(3, lv) - 1] / COLLECT.robotLoad[2] : 0;
      set(load, 'd', `M98 ${66 - k * 10} q8 -${4 + k * 6} 14 0 l-2 8 h-10 z`);
      set(load, 'opacity', lv ? 1 : 0);
      set(zzz, 'opacity', on ? 0 : 1);
    },
  };
}

// ---- Rover: ice crates fill as it scoops in the dark crater ---------------------------------

function roverArt(c: ArtContext): Art {
  const svg = frame('rover');
  ground(svg);
  make('path', { d: 'M36 70 H200 L190 56 H70 Z', fill: C.bone }, svg);
  make('rect', { x: 40, y: 64, width: 156, height: 4, fill: C.amber }, svg);
  for (const x of [62, 104, 150, 186]) make('circle', { cx: x, cy: 84, r: 11, fill: C.dark, stroke: C.hull, 'stroke-width': 2 }, svg);
  make('path', { d: 'M160 56 V30', stroke: C.hull, 'stroke-width': 2 }, svg);
  make('circle', { cx: 160, cy: 28, r: 6, fill: 'none', stroke: C.hull, 'stroke-width': 2 }, svg);
  const crates = Array.from({ length: 3 }, (_, i) => {
    make('rect', { x: 74 + i * 26, y: 34, width: 22, height: 22, fill: '#1c1d20', stroke: C.hull }, svg);
    return make('rect', { x: 76 + i * 26, width: 18, fill: '#cfe3ef' }, svg);
  });
  return {
    node: svg,
    update() {
      const k = Math.min(1, c.s.rover.ice / ROVER.iceCargoMax);
      crates.forEach((r, i) => {
        const part = Math.max(0, Math.min(1, k * 3 - i));
        set(r, 'height', (18 * part).toFixed(1));
        set(r, 'y', (54 - 18 * part).toFixed(1));
      });
    },
  };
}

// ---- Antenna: the dish talks to Earth, 1.3 light-seconds away -------------------------------

function antennaArt(): Art {
  const svg = frame('antenna');
  ground(svg);
  make('path', { d: 'M52 96 V56', stroke: C.hull, 'stroke-width': 3 }, svg);
  make('path', { d: 'M30 40 Q52 70 76 42', fill: C.bone, stroke: C.dark, 'stroke-width': 1.5 }, svg);
  make('circle', { cx: 56, cy: 40, r: 3, fill: C.amber, class: 'blink' }, svg);
  const waves = make('g', { class: 'waves' }, svg);
  for (let i = 0; i < 3; i++) make('path', { d: 'M80 30 q10 10 0 20', fill: 'none', stroke: C.amber, 'stroke-width': 2.5, 'stroke-linecap': 'round', style: `animation-delay:${i * 0.5}s` }, waves);
  make('path', { d: 'M90 40 H200', stroke: C.bone, 'stroke-width': 1, 'stroke-dasharray': '2 6', opacity: 0.5 }, svg);
  make('circle', { cx: 222, cy: 40, r: 18, fill: '#2e5d86' }, svg);
  make('path', { d: 'M212 32 q6 -4 10 0 q2 6 -4 8 q-6 2 -6 -8z', fill: '#8a9a63' }, svg);
  make('path', { d: 'M224 23 A18 18 0 0 1 224 57 A10 18 0 0 0 224 23z', fill: '#07080b', opacity: 0.55 }, svg);
  const t = make('text', { x: 145, y: 30, 'text-anchor': 'middle', class: 'art-label' }, svg);
  t.textContent = '1.3 s';
  return { node: svg, update() {} };
}

// ---- Lander: the ship you arrived in, and the regolith bag you carry -------------------------

function landerArt(c: ArtContext): Art {
  const svg = frame('lander');
  ground(svg);
  make('path', { d: 'M60 96 L74 70 M120 96 L106 70', stroke: C.hull, 'stroke-width': 3 }, svg);
  make('path', { d: 'M66 70 Q66 30 90 26 Q114 30 114 70 Z', fill: C.bone, stroke: C.dark, 'stroke-width': 1.5 }, svg);
  make('rect', { x: 66, y: 50, width: 48, height: 4, fill: C.red }, svg);
  make('rect', { x: 84, y: 56, width: 12, height: 14, fill: '#1c1d20' }, svg);
  make('path', { d: 'M168 50 q-14 0 -16 22 q0 18 22 18 q22 0 22 -18 q-2 -22 -16 -22 z', fill: '#7a7c80', stroke: C.dark }, svg);
  const fill = make('rect', { x: 154, width: 40, fill: C.regolith }, svg);
  make('rect', { x: 160, y: 46, width: 28, height: 6, rx: 2, fill: C.amber }, svg);
  const t = make('text', { x: 174, y: 36, 'text-anchor': 'middle', class: 'art-label' }, svg);
  return {
    node: svg,
    update() {
      const s = c.s;
      const k = Math.min(1, s.carried / Math.max(1, carryMax(s)));
      set(fill, 'height', (30 * k).toFixed(1));
      set(fill, 'y', (88 - 30 * k).toFixed(1));
      t.textContent = `${Math.floor(s.carried)}/${carryMax(s)}`;
    },
  };
}

// ---- Power: where the energy goes, system by system -----------------------------------------

export function powerArt(c: ArtContext): Art {
  const svg = frame('power');
  const rows: [string, (r: PowerReport, s: GameState) => boolean][] = [
    ['♥', () => true],
    ['☼', (r) => r.running.heating],
    ['⚙', (r) => r.running.processor],
    ['✿', (r) => r.running.lights > 0],
  ];
  const sun = make('circle', { cx: 24, cy: 56, r: 10, fill: C.bone }, svg);
  const batt = make('rect', { x: 70, y: 40, width: 40, height: 32, rx: 4, fill: '#1c1d20', stroke: C.bone, 'stroke-width': 2 }, svg);
  const bfill = make('rect', { x: 73, y: 43, height: 26, rx: 2, fill: C.leaf }, svg);
  const flowIn = make('path', { d: 'M36 56 H68', stroke: C.amber, 'stroke-width': 2, 'stroke-dasharray': '3 6', class: 'flow' }, svg);
  const outs = rows.map(([icon], i) => {
    const y = 16 + i * 26;
    const line = make('path', { d: `M112 56 C150 56 150 ${y} 190 ${y}`, fill: 'none', stroke: C.amber, 'stroke-width': 2, 'stroke-dasharray': '3 6', class: 'flow' }, svg);
    const dot = make('circle', { cx: 204, cy: y, r: 10, fill: '#1c1d20', stroke: C.bone, 'stroke-width': 1.5 }, svg);
    const t = make('text', { x: 204, y: y + 4.5, 'text-anchor': 'middle', class: 'art-icon' }, svg);
    t.textContent = icon;
    return { line, dot, t };
  });
  void batt;
  return {
    node: svg,
    update() {
      const s = c.s;
      const r = c.power();
      const k = Math.max(0, Math.min(1, s.res.energy / Math.max(1, capacity(s).energy)));
      set(bfill, 'width', (34 * k).toFixed(1));
      set(bfill, 'fill', k < 0.2 ? C.amber : C.leaf);
      set(sun, 'opacity', r.generation > 0.05 ? 1 : 0.15);
      cls(flowIn, 'on', r.generation > 0.05);
      set(flowIn, 'opacity', r.generation > 0.05 ? 1 : 0.15);
      outs.forEach((o, i) => {
        const on = i === 0 ? r.lifeSupportPowered : rows[i][1](r, s);
        cls(o.line, 'on', on);
        set(o.line, 'opacity', on ? 1 : 0.12);
        set(o.dot, 'stroke', i === 0 && !on ? C.red : on ? C.bone : '#55565a');
        set(o.t, 'opacity', on ? 1 : 0.3);
      });
    },
  };
}

export type ArtKind = 'station' | 'greenhouse' | 'processor' | 'solarMast' | 'battery' | 'robots' | 'rover' | 'antenna' | 'lander';

export function panelArt(kind: ArtKind, c: ArtContext): Art {
  switch (kind) {
    case 'greenhouse': return greenhouseArt(c);
    case 'processor': return processorArt(c);
    case 'solarMast': return solarArt(c);
    case 'battery': return batteryArt(c);
    case 'station': return stationArt(c);
    case 'robots': return robotsArt(c);
    case 'rover': return roverArt(c);
    case 'antenna': return antennaArt();
    case 'lander': return landerArt(c);
  }
}
