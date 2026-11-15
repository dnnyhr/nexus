import type { Sample } from '../../engine/types';
import { RESOURCE_LABELS, validSamples, type ResourceKey } from './model';

const NS = 'http://www.w3.org/2000/svg';

export function renderResourceChart(samples: Sample[]): SVGSVGElement {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 600 180');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Reservas simuladas en porcentaje de capacidad. Valores disponibles en tabla de muestras.');
  const items = validSamples(samples);
  const add = (tag: string, attrs: Record<string, string>, text?: string) => {
    const node = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    if (text) node.textContent = text;
    svg.append(node);
    return node;
  };
  if (!items.length) {
    add('text', { x: '24', y: '90', fill: 'currentColor' }, 'Sin muestras registradas');
    return svg;
  }
  const start = items[0].t;
  const duration = Math.max(1, items.at(-1)!.t - start);
  for (const value of [0, 50, 100]) {
    const y = 148 - value * 1.16;
    add('path', { d: `M44 ${y}H580`, stroke: '#586471', 'stroke-width': '1', fill: 'none' });
    add('text', { x: '4', y: String(y + 4), fill: 'currentColor', 'font-size': '12' }, `${value} %`);
  }
  const styles: [ResourceKey, string, string][] = [['o2', '#f2f0eb', ''], ['water', '#a4d8ff', '8 3'], ['food', '#b6d89a', '2 3'], ['energy', '#f2b54a', '10 3 2 3']];
  for (const [key, color, dash] of styles) {
    let d = '';
    let connected = false;
    for (const sample of items) {
      if (!Number.isFinite(sample[key])) { connected = false; continue; }
      const x = 44 + (sample.t - start) / duration * 536;
      const y = 148 - Math.max(0, Math.min(100, sample[key])) * 1.16;
      d += `${connected ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)} `;
      connected = true;
      if (items.length === 1) add('circle', { cx: String(x), cy: String(y), r: '3', fill: color });
    }
    const path = add('path', { d, stroke: color, 'stroke-width': '2', fill: 'none', 'stroke-dasharray': dash });
    const title = document.createElementNS(NS, 'title');
    title.textContent = RESOURCE_LABELS[key];
    path.append(title);
  }
  add('text', { x: '44', y: '174', fill: 'currentColor', 'font-size': '12' }, `${start} s`);
  add('text', { x: '580', y: '174', fill: 'currentColor', 'font-size': '12', 'text-anchor': 'end' }, `${items.at(-1)!.t} s`);
  return svg;
}
