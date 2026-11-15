import type { MissionEvent, Sample, Scenario } from '../../engine/types';
import { chartTexts } from './commanderTexts';

const NS = 'http://www.w3.org/2000/svg';

export interface ChartOverlay {
  samples: Sample[];
  label?: string;
}

export interface ChartOptions {
  width?: number;
  height?: number;
  untilT?: number;
  overlay?: ChartOverlay;
}

interface SeriesSpec {
  key: 'o2' | 'water' | 'food' | 'energy';
  label: string;
  color: string;
  dash: string;
}

const SERIES: SeriesSpec[] = [
  { key: 'o2', label: 'O₂', color: '#67e8f9', dash: '' },
  { key: 'water', label: 'Agua', color: '#60a5fa', dash: '10 4' },
  { key: 'food', label: 'Alimentos', color: '#6ee7b7', dash: '2 4' },
  { key: 'energy', label: 'Energía', color: '#fcd34d', dash: '14 4 2 4' },
];

const EXPOSURE_COLOR = '#fda4af';
const TEXT_COLOR = '#cbd5e1';
const MUTED_COLOR = '#94a3b8';
const GRID_COLOR = '#334155';
const DARKNESS_COLOR = '#64748b';
const STORM_COLOR = '#a78bfa';

type SvgAttrs = Record<string, string | number | undefined>;

function make(tag: string, attrs: SvgAttrs = {}): SVGElement {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== undefined) node.setAttribute(key, String(value));
  }
  return node;
}

function makeText(tag: string, attrs: SvgAttrs, content: string): SVGElement {
  const node = make(tag, attrs);
  node.textContent = content;
  return node;
}

function finite(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, finite(value, low)));
}

function round(value: number): number {
  return Math.round(finite(value) * 10) / 10;
}

function pattern(id: string, color: string, size: number, rotation: number): SVGElement {
  const node = make('pattern', {
    id,
    width: size,
    height: size,
    patternUnits: 'userSpaceOnUse',
    patternTransform: `rotate(${rotation})`,
  });
  node.appendChild(make('rect', { width: size, height: size, fill: '#0f172a' }));
  node.appendChild(make('line', { x1: 0, y1: 0, x2: 0, y2: size, stroke: color, 'stroke-width': 1.5 }));
  return node;
}

function drawSeries(
  parent: SVGElement,
  points: { x: number; y: number }[],
  color: string,
  dash: string,
  className: string,
): void {
  if (points.length === 0) return;
  if (points.length === 1) {
    parent.appendChild(
      make('circle', {
        cx: round(points[0].x),
        cy: round(points[0].y),
        r: 2.5,
        fill: color,
        class: `c-chart-dot ${className}`,
      }),
    );
    return;
  }
  parent.appendChild(
    make('polyline', {
      points: points.map((point) => `${round(point.x)},${round(point.y)}`).join(' '),
      fill: 'none',
      stroke: color,
      'stroke-width': 2,
      'stroke-linejoin': 'round',
      'stroke-linecap': 'round',
      'stroke-dasharray': dash || undefined,
      class: `c-chart-line ${className}`,
    }),
  );
}

export function renderChart(
  samples: Sample[],
  events: MissionEvent[],
  scenario: Scenario,
  opts: ChartOptions = {},
): SVGSVGElement {
  const width = clamp(opts.width ?? 760, 320, 2000);
  const height = clamp(opts.height ?? 340, 220, 1200);
  const margin = { top: 30, right: 56, bottom: 58, left: 46 };
  const plotWidth = Math.max(10, width - margin.left - margin.right);
  const plotHeight = Math.max(10, height - margin.top - margin.bottom);

  const clean = (list: Sample[]) => (Array.isArray(list) ? list.filter((item) => item && Number.isFinite(item.t)) : []);
  const groups: { samples: Sample[]; ghost: boolean }[] = [{ samples: clean(samples), ghost: false }];
  if (opts.overlay) groups.push({ samples: clean(opts.overlay.samples), ghost: true });
  const allSamples = groups.flatMap((group) => group.samples);

  const lastT = allSamples.reduce((max, item) => Math.max(max, item.t), 0);
  const requestedUntil = finite(opts.untilT ?? 0);
  const duration = finite(scenario.duration, 0);
  const until = Math.max(1, requestedUntil > 0 ? requestedUntil : lastT > 0 ? lastT : duration > 0 ? duration : 1);
  const exposurePeak = allSamples.reduce((max, item) => Math.max(max, finite(item.exposure)), 0);
  const exposureMax = Math.max(10, Math.ceil(Math.max(finite(scenario.exposureLimit), exposurePeak) / 10) * 10);

  const x = (t: number) => margin.left + (clamp(t, 0, until) / until) * plotWidth;
  const yResource = (value: number) => margin.top + (1 - clamp(value, 0, 100) / 100) * plotHeight;
  const yExposure = (value: number) => margin.top + (1 - clamp(value, 0, exposureMax) / exposureMax) * plotHeight;

  const svg = make('svg', {
    viewBox: `0 0 ${round(width)} ${round(height)}`,
    class: 'c-chart',
    role: 'img',
    'aria-label': chartTexts.ariaLabel,
    preserveAspectRatio: 'xMidYMid meet',
  }) as SVGSVGElement;
  svg.appendChild(makeText('title', {}, chartTexts.title));
  svg.appendChild(makeText('desc', {}, chartTexts.description(until, exposureMax)));

  const defs = make('defs');
  defs.appendChild(pattern('c-chart-hatch-darkness', DARKNESS_COLOR, 8, 0));
  defs.appendChild(pattern('c-chart-hatch-storm', STORM_COLOR, 6, 45));
  svg.appendChild(defs);

  const bands = make('g', { class: 'c-chart-bands' });
  for (const event of scenario.events) {
    if (event.kind !== 'darkness' && event.kind !== 'storm') continue;
    const start = clamp(event.startAt, 0, until);
    const end = clamp(event.endAt, 0, until);
    if (end <= start) continue;
    const isDark = event.kind === 'darkness';
    bands.appendChild(
      make('rect', {
        x: round(x(start)),
        y: margin.top,
        width: round(x(end) - x(start)),
        height: round(plotHeight),
        fill: `url(#${isDark ? 'c-chart-hatch-darkness' : 'c-chart-hatch-storm'})`,
        class: `c-chart-band c-chart-band-${event.kind}`,
      }),
    );
    bands.appendChild(
      makeText(
        'text',
        {
          x: round(x(start) + 4),
          y: margin.top - 8,
          fill: isDark ? DARKNESS_COLOR : STORM_COLOR,
          'font-size': 11,
          class: 'c-chart-band-label',
        },
        isDark ? chartTexts.darkness : chartTexts.storm,
      ),
    );
  }
  svg.appendChild(bands);

  const warnings = make('g', { class: 'c-chart-warnings' });
  for (const event of events) {
    if (event.kind !== 'darkness_warning' && event.kind !== 'storm_warning') continue;
    if (!Number.isFinite(event.t) || event.t < 0 || event.t > until) continue;
    warnings.appendChild(
      make('line', {
        x1: round(x(event.t)),
        x2: round(x(event.t)),
        y1: margin.top,
        y2: margin.top + plotHeight,
        stroke: MUTED_COLOR,
        'stroke-width': 1,
        'stroke-dasharray': '2 5',
        class: 'c-chart-warning',
      }),
    );
    warnings.appendChild(
      makeText(
        'text',
        {
          x: round(x(event.t)),
          y: margin.top + 12,
          fill: MUTED_COLOR,
          'font-size': 10,
          'text-anchor': 'middle',
          class: 'c-chart-warning-label',
        },
        chartTexts.warning,
      ),
    );
  }
  svg.appendChild(warnings);

  const grid = make('g', { class: 'c-chart-grid' });
  for (const value of [0, 25, 50, 75, 100]) {
    grid.appendChild(
      make('line', {
        x1: margin.left,
        x2: margin.left + plotWidth,
        y1: round(yResource(value)),
        y2: round(yResource(value)),
        stroke: GRID_COLOR,
        'stroke-width': 1,
      }),
    );
    grid.appendChild(
      makeText(
        'text',
        { x: margin.left - 6, y: round(yResource(value) + 4), fill: MUTED_COLOR, 'font-size': 10, 'text-anchor': 'end' },
        `${value}%`,
      ),
    );
  }
  for (const value of [0, exposureMax / 2, exposureMax]) {
    grid.appendChild(
      makeText(
        'text',
        {
          x: round(width - margin.right + 6),
          y: round(yExposure(value) + 4),
          fill: EXPOSURE_COLOR,
          'font-size': 10,
          'text-anchor': 'start',
        },
        `${Math.round(value)} u`,
      ),
    );
  }
  for (let index = 0; index <= 4; index += 1) {
    const tick = (until * index) / 4;
    grid.appendChild(
      makeText(
        'text',
        {
          x: round(x(tick)),
          y: margin.top + plotHeight + 16,
          fill: MUTED_COLOR,
          'font-size': 10,
          'text-anchor': 'middle',
        },
        chartTexts.timeAxis(tick),
      ),
    );
  }
  svg.appendChild(grid);

  const seriesGroup = make('g', { class: 'c-chart-series' });
  for (const group of groups) {
    const container = make('g', { class: group.ghost ? 'c-chart-group c-chart-ghost' : 'c-chart-group' });
    for (const series of SERIES) {
      const points = group.samples
        .filter((item) => Number.isFinite(item[series.key]))
        .map((item) => ({ x: x(item.t), y: yResource(item[series.key]) }));
      drawSeries(container, points, series.color, series.dash, `c-chart-line-${series.key}`);
    }
    const exposurePoints = group.samples
      .filter((item) => Number.isFinite(item.exposure))
      .map((item) => ({ x: x(item.t), y: yExposure(item.exposure) }));
    drawSeries(container, exposurePoints, EXPOSURE_COLOR, '1 4', 'c-chart-line-exposure');
    seriesGroup.appendChild(container);
  }
  svg.appendChild(seriesGroup);

  const legend = make('g', { class: 'c-chart-legend' });
  let cursor = margin.left;
  const legendY = height - 30;
  for (const series of SERIES) {
    legend.appendChild(
      make('line', {
        x1: cursor,
        x2: cursor + 16,
        y1: legendY - 4,
        y2: legendY - 4,
        stroke: series.color,
        'stroke-width': 2,
        'stroke-dasharray': series.dash || undefined,
      }),
    );
    legend.appendChild(
      makeText('text', { x: cursor + 21, y: legendY, fill: TEXT_COLOR, 'font-size': 11 }, series.label),
    );
    cursor += 21 + series.label.length * 6.2 + 14;
  }
  legend.appendChild(
    make('line', {
      x1: cursor,
      x2: cursor + 16,
      y1: legendY - 4,
      y2: legendY - 4,
      stroke: EXPOSURE_COLOR,
      'stroke-width': 2,
      'stroke-dasharray': '1 4',
    }),
  );
  legend.appendChild(
    makeText('text', { x: cursor + 21, y: legendY, fill: EXPOSURE_COLOR, 'font-size': 11 }, chartTexts.unitExposure),
  );
  if (opts.overlay) {
    legend.appendChild(
      makeText('text', { x: margin.left, y: height - 10, fill: MUTED_COLOR, 'font-size': 10 }, chartTexts.ghostNote),
    );
  }
  svg.appendChild(legend);

  if (samples.length === 0) {
    svg.appendChild(
      makeText(
        'text',
        {
          x: round(margin.left + plotWidth / 2),
          y: round(margin.top + plotHeight / 2),
          fill: MUTED_COLOR,
          'font-size': 12,
          'text-anchor': 'middle',
          class: 'c-chart-empty',
        },
        chartTexts.empty,
      ),
    );
  }

  return svg;
}
