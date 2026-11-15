import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { MissionEvent, Sample, Scenario } from '../../engine/types';
import { renderChart } from './chart';

class FakeNode {
  attributes: Record<string, string> = {};
  children: FakeNode[] = [];
  textContent = '';

  constructor(public readonly tag: string) {}

  setAttribute(name: string, value: string): void {
    this.attributes[name] = value;
  }

  getAttribute(name: string): string | null {
    return this.attributes[name] ?? null;
  }

  appendChild(child: FakeNode): FakeNode {
    this.children.push(child);
    return child;
  }
}

const scope = globalThis as unknown as { document?: unknown };
let previousDocument: unknown;

beforeEach(() => {
  previousDocument = scope.document;
  scope.document = {
    createElementNS: (_ns: string, tag: string) => new FakeNode(tag),
  };
});

afterEach(() => {
  scope.document = previousDocument;
});

const scenario: Scenario = {
  id: 'mision-1',
  seed: 1,
  duration: 600,
  budget: 300,
  events: [
    { kind: 'darkness', warnAt: 180, startAt: 240, endAt: 420 },
    { kind: 'storm', warnAt: 450, startAt: 480, endAt: 540, strength: 1 },
  ],
  exposureLimit: 40,
  depletionGrace: 20,
};

function sample(t: number, overrides: Partial<Sample> = {}): Sample {
  return {
    t,
    o2: 80,
    water: 70,
    food: 60,
    energy: 50,
    exposure: 5,
    crewHealth: 100,
    lights: 60,
    plantGrowth: 20,
    sheltered: false,
    isDark: false,
    ...overrides,
  };
}

function chart(samples: Sample[], events: MissionEvent[] = [], opts: Parameters<typeof renderChart>[3] = {}) {
  return renderChart(samples, events, scenario, opts) as unknown as FakeNode;
}

function walk(node: FakeNode, out: FakeNode[] = []): FakeNode[] {
  out.push(node);
  for (const child of node.children) walk(child, out);
  return out;
}

function byTag(node: FakeNode, tag: string): FakeNode[] {
  return walk(node).filter((item) => item.tag === tag);
}

function classes(node: FakeNode): string[] {
  return (node.attributes.class ?? '').split(' ').filter(Boolean);
}

function byClass(node: FakeNode, name: string): FakeNode[] {
  return walk(node).filter((item) => classes(item).includes(name));
}

function allAttributeValues(node: FakeNode): string[] {
  return walk(node).flatMap((item) => Object.values(item.attributes));
}

function pointsOf(node: FakeNode): number[][] {
  return (node.attributes.points ?? '')
    .split(' ')
    .filter(Boolean)
    .map((pair) => pair.split(',').map((value) => Number(value)));
}

function expectNoBrokenNumbers(node: FakeNode): void {
  expect(allAttributeValues(node).some((value) => /NaN|Infinity|undefined/.test(value))).toBe(false);
  expect(Number.isFinite(Number(node.attributes.viewBox?.split(' ')[2]))).toBe(true);
}

describe('renderChart', () => {
  it('renders empty state with 0 samples without NaN or division by zero', () => {
    const svg = chart([], []);
    expect(svg.tag).toBe('svg');
    expectNoBrokenNumbers(svg);
    expect(byClass(svg, 'c-chart-empty')).toHaveLength(1);
    expect(byTag(svg, 'polyline')).toHaveLength(0);
    expect(byTag(svg, 'circle')).toHaveLength(0);
    expect(byClass(svg, 'c-chart-band')).toHaveLength(2);
    expect(byTag(svg, 'text').map((item) => item.textContent)).toContain('Sin muestras para graficar.');
  });

  it('draws one marker per series with 1 sample and no polyline', () => {
    const svg = chart([sample(10)]);
    expectNoBrokenNumbers(svg);
    expect(byTag(svg, 'polyline')).toHaveLength(0);
    expect(byTag(svg, 'circle')).toHaveLength(5);
    const dots = byClass(svg, 'c-chart-dot');
    expect(dots).toHaveLength(5);
    for (const dot of dots) {
      expect(Number.isFinite(Number(dot.attributes.cx))).toBe(true);
      expect(Number.isFinite(Number(dot.attributes.cy))).toBe(true);
    }
    const x = Number(dots[0].attributes.cx);
    const y = Number(dots[0].attributes.cy);
    expect(x).toBeCloseTo(704, 0);
    expect(y).toBeGreaterThan(30);
    expect(y).toBeLessThan(300);

    const scaled = chart([sample(50)], [], { untilT: 100 });
    const scaledDot = byClass(scaled, 'c-chart-dot')[0];
    expect(Number(scaledDot.attributes.cx)).toBeCloseTo(46 + 0.5 * 658, 0);
  });

  it('draws one polyline per series with N samples, in ascending time', () => {
    const samples = [0, 30, 60, 90].map((t) => sample(t, { o2: 90 - t / 3 }));
    const svg = chart(samples);
    expectNoBrokenNumbers(svg);
    expect(byTag(svg, 'polyline')).toHaveLength(5);
    const o2Line = byClass(svg, 'c-chart-line-o2')[0];
    const points = pointsOf(o2Line);
    expect(points).toHaveLength(samples.length);
    for (let index = 1; index < points.length; index += 1) {
      expect(points[index][0]).toBeGreaterThan(points[index - 1][0]);
      expect(points[index][1]).toBeGreaterThanOrEqual(points[index - 1][1]);
    }
    expect(byClass(svg, 'c-chart-line-exposure')).toHaveLength(1);
    expect(byClass(svg, 'c-chart-warning')).toHaveLength(0);
  });

  it('keeps the requested horizon on the time axis and clamps samples beyond it', () => {
    const events: MissionEvent[] = [
      { t: 90, kind: 'darkness_warning', text: 'Aviso dentro del horizonte' },
      { t: 180, kind: 'darkness_warning', text: 'Aviso fuera del horizonte' },
    ];
    const svg = chart([sample(0), sample(50), sample(120)], events, { untilT: 100 });
    expectNoBrokenNumbers(svg);
    const o2Points = pointsOf(byClass(svg, 'c-chart-line-o2')[0]);
    const lastX = o2Points[o2Points.length - 1][0];
    expect(lastX).toBeLessThanOrEqual(704);
    expect(byTag(svg, 'text').map((item) => item.textContent)).toContain('100 s');
    expect(byClass(svg, 'c-chart-warning')).toHaveLength(1);
  });

  it('overlays a second projection on the same scales', () => {
    const base = [sample(0, { energy: 50 }), sample(60, { energy: 40 })];
    const plan = [sample(0, { energy: 50 }), sample(60, { energy: 30 })];
    const svg = chart(base, [], { untilT: 60, overlay: { samples: plan } });
    expectNoBrokenNumbers(svg);
    expect(byTag(svg, 'polyline')).toHaveLength(10);
    const ghostGroups = byClass(svg, 'c-chart-ghost');
    expect(ghostGroups).toHaveLength(1);
    const ghostLines = byTag(ghostGroups[0], 'polyline');
    expect(ghostLines).toHaveLength(5);
    const baseEnergy = pointsOf(byClass(svg, 'c-chart-line-energy')[0]);
    const planEnergy = pointsOf(byClass(ghostGroups[0], 'c-chart-line-energy')[0]);
    expect(planEnergy[0][0]).toBeCloseTo(baseEnergy[0][0], 1);
    expect(planEnergy[1][0]).toBeCloseTo(baseEnergy[1][0], 1);
    expect(planEnergy[1][1]).toBeGreaterThan(baseEnergy[1][1]);
    expect(byTag(svg, 'text').some((item) => item.textContent.includes('proyección con el plan'))).toBe(true);
  });

  it('skips non-finite sample values instead of writing NaN into the SVG', () => {
    const svg = chart([sample(0), sample(30, { o2: Number.NaN }), sample(60)]);
    expectNoBrokenNumbers(svg);
    expect(pointsOf(byClass(svg, 'c-chart-line-o2')[0])).toHaveLength(2);
  });

  it('does not draw scenario bands when the scenario has no darkness or storm', () => {
    const svg = renderChart([sample(0)], [], { ...scenario, events: [] }) as unknown as FakeNode;
    expectNoBrokenNumbers(svg);
    expect(byClass(svg, 'c-chart-band')).toHaveLength(0);
  });
});
