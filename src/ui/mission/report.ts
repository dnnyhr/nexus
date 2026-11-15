import { PRICES, type DesignItem, type MissionState, type Sample, type Summary } from '../../engine';
import { el } from '../dom';
import { cx, type CommanderKey } from './commanderTexts';
import { tx, type TextKey } from './texts';
import './report.css';

// The mission report: the outcome, measured numbers, what it cost, a timeline, a chart of
// the resources (with the same data as a table) and the design, with a button to redesign.

export interface ReportOptions {
  mission: MissionState;
  summary: Summary;
  onRetry(): void;
  onMenu(): void;
}

const SVG = 'http://www.w3.org/2000/svg';
const SERIES: { key: keyof Sample; label: CommanderKey; color: string }[] = [
  { key: 'o2', label: 'serO2', color: '#9fc6e0' },
  { key: 'water', label: 'serWater', color: '#5d8fc4' },
  { key: 'food', label: 'serFood', color: '#8fae6e' },
  { key: 'energy', label: 'serEnergy', color: '#f2b54a' },
];

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  return n;
}

function chart(ms: MissionState): SVGSVGElement {
  const W = 640, H = 220, L = 34, R = 8, T = 10, B = 26;
  const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'm-chart', role: 'img', 'aria-label': cx('repChart') });
  const x = (t: number) => L + (t / ms.scenario.duration) * (W - L - R);
  const y = (v: number) => T + (1 - Math.max(0, Math.min(100, v)) / 100) * (H - T - B);
  for (const e of ms.scenario.events) {
    s.append(svg('rect', { x: x(e.startAt), y: T, width: x(e.endAt) - x(e.startAt), height: H - T - B, class: e.kind === 'storm' ? 'm-band-storm' : 'm-band-dark' }));
  }
  for (const v of [0, 50, 100]) {
    s.append(svg('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), class: 'm-grid' }));
    const label = svg('text', { x: L - 6, y: y(v) + 4, 'text-anchor': 'end', class: 'm-axis' });
    label.textContent = `${v}%`;
    s.append(label);
  }
  for (const t of [0, 150, 300, 450, 600].filter((v) => v <= ms.scenario.duration)) {
    const label = svg('text', { x: x(t), y: H - 8, 'text-anchor': 'middle', class: 'm-axis' });
    label.textContent = `${t}s`;
    s.append(label);
  }
  for (const ser of SERIES) {
    const pts = ms.samples.map((p) => `${x(p.t).toFixed(1)},${y(p[ser.key] as number).toFixed(1)}`).join(' ');
    s.append(svg('polyline', { points: pts, fill: 'none', stroke: ser.color, 'stroke-width': 2.2, 'stroke-linejoin': 'round' }));
  }
  // Exposure against its limit, dashed.
  const lim = ms.scenario.exposureLimit;
  s.append(svg('polyline', { points: ms.samples.map((p) => `${x(p.t).toFixed(1)},${y((p.exposure / lim) * 100).toFixed(1)}`).join(' '), fill: 'none', stroke: '#e8604a', 'stroke-width': 2, 'stroke-dasharray': '5 4' }));
  return s;
}

function table(ms: MissionState): HTMLElement {
  const rows = ms.samples.filter((p, i) => p.t % 30 === 0 || i === ms.samples.length - 1);
  return el('details.m-details', {},
    el('summary', {}, cx('repTable')),
    el('div.m-table-wrap', {}, el('table.m-table', {},
      el('thead', {}, el('tr', {}, el('th', { scope: 'col' }, cx('repTime')), ...SERIES.map((s) => el('th', { scope: 'col' }, cx(s.label))), el('th', { scope: 'col' }, cx('serExposure')))),
      el('tbody', {}, ...rows.map((p) => el('tr', {},
        el('th', { scope: 'row' }, `${Math.round(p.t)} s`),
        ...SERIES.map((s) => el('td', {}, `${Math.round(p[s.key] as number)} %`)),
        el('td', {}, p.exposure.toFixed(1))))))));
}

function designList(sum: Summary): HTMLElement {
  const d = sum.design;
  const qty: Record<DesignItem, number> = {
    solarMasts: d.solarMasts, batteries: d.batteries, greenhouse: d.greenhouse, processor: d.processor, shield: d.shield,
    reserveO2: d.reserves.o2, reserveWater: d.reserves.water, reserveFood: d.reserves.food,
  };
  const items = (Object.keys(PRICES) as DesignItem[]).filter((k) => qty[k] > 0);
  return el('ul.m-list', {}, ...(items.length ? items.map((k) => el('li', {}, `${qty[k]} × ${tx(`item_${k}` as TextKey)}`)) : [el('li', {}, '—')]));
}

/** Lessons chosen from what really happened in this game (2-3), plus one tip if it failed. */
function lessons(ms: MissionState, sum: Summary): { learned: CommanderKey[]; tip: CommanderKey } {
  const had = (k: string) => ms.events.some((e) => e.kind === k);
  const code = sum.failure?.code;
  const out: CommanderKey[] = [];
  if (code === 'crew_lost' && had('life_support_unpowered')) out.push('learnLifeSupport');
  if (code === 'exposure_exceeded') out.push('learnRadiation');
  if (code === 'food_depleted') out.push('learnFood');
  if (code === 'water_depleted') out.push('learnWater');
  if (code === 'o2_depleted') out.push('learnAir');
  out.push(sum.secondsShortage > 0 ? 'learnDarkShort' : 'learnDarkOk');
  if (sum.secondsSheltered > 0 && code !== 'exposure_exceeded') out.push('learnShelterOk', 'learnShelterCost');
  if (sum.harvests > 0) out.push('learnHarvest');
  if (had('plant_dead')) out.push('learnPlantDead');
  const learned = [...new Set(out)].slice(0, 3);
  const tip: CommanderKey = code === 'exposure_exceeded' ? 'tipShelter'
    : code === 'food_depleted' ? 'tipFood'
    : code === 'water_depleted' ? 'tipWater'
    : code === 'o2_depleted' ? 'tipAir'
    : code === 'crew_lost' ? 'tipBatteries'
    : 'tipWin';
  return { learned, tip };
}

export function mountReport(root: HTMLElement, opts: ReportOptions): { destroy(): void } {
  const { mission: ms, summary: sum } = opts;
  const win = sum.phase === 'victory';
  const { learned, tip } = lessons(ms, sum);
  const stat = (label: CommanderKey, value: string) => el('div.m-stat', {}, el('span', {}, cx(label)), el('strong', {}, value));
  const node = el('section.m-screen.m-report', { role: 'dialog', 'aria-modal': 'true' },
    el('div.m-panel', {},
      el('h2', { class: win ? 'm-win' : 'm-fail' }, cx(win ? 'repWin' : 'repFail')),
      sum.failure ? el('p.m-result', {}, cx('repWhy', { why: cx(`fail_${sum.failure.code}` as CommanderKey), t: Math.round(sum.failure.t) })) : null,
      el('h3', {}, cx('repLearned')),
      el('ul.m-lessons', {}, ...learned.map((k) => el('li', {}, cx(k)))),
      el('h3', {}, cx('repNext')),
      el('p.m-tip', {}, cx(tip)),
      el('h3', {}, cx('repTradeoffs')),
      el('div.m-stats', {},
        stat('repDuration', `${Math.round(sum.duration)} / ${ms.scenario.duration}`),
        stat('repHarvests', String(sum.harvests)),
        stat('repExposure', `${sum.exposure.toFixed(1)} / ${ms.scenario.exposureLimit}`),
        stat('repMinLife', `${Math.max(0, Math.round(sum.minLifeSupport))} %`),
        stat('repSheltered', `${Math.round(sum.secondsSheltered)}`),
        stat('repShortage', `${Math.round(sum.secondsShortage)}`)),
      el('h3', {}, cx('repChart')),
      el('div.m-legend', {}, ...SERIES.map((s) => el('span', {}, el('i', { style: `background:${s.color}` }), cx(s.label))),
        el('span', {}, el('i.m-dash'), cx('serExposure')), el('span', {}, cx('shadeDark'))),
      chart(ms),
      table(ms),
      el('h3', {}, cx('repTimeline')),
      el('ol.m-timeline-list', {}, ...ms.events.map((e) => el('li', {}, el('span', {}, `${Math.round(e.t)} s`), cx(`ev_${e.kind}` as CommanderKey)))),
      el('h3', {}, cx('repDesign')),
      designList(sum),
      el('div.m-actions', {},
        el('button.m-btn', { onclick: () => opts.onMenu() }, cx('repMenu')),
        el('button.m-btn.m-primary', { onclick: () => opts.onRetry() }, cx('repRetry'))),
    ));
  root.append(node);
  return { destroy: () => node.remove() };
}
