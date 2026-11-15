import { checkDesign, emptyDesign, LIMITS, MISSION_RULES, PRICES, project, SCENARIO_1, startMission, type Design, type DesignItem, type Summary } from '../../engine';
import { el, setText } from '../dom';
import { tx, type TextKey } from './texts';
import './mission.css';


export interface Mounted {
  destroy(): void;
}

export interface StartMenuOptions {
  onMission(): void;
  onFree(): void;
  hasFreeSave: boolean;
}

export interface PrepareOptions {
  initial?: Design;
  previous?: Summary | null;
  onConfirm(d: Design): void;
  onBack(): void;
}

const SCENARIO = SCENARIO_1;
const ITEMS = Object.keys(PRICES) as DesignItem[];
const ESTIMATE_DEBOUNCE_MS = 200;

const GROUPS: { title: TextKey; items: DesignItem[] }[] = [
  { title: 'groupPower', items: ['solarMasts', 'batteries'] },
  { title: 'groupLife', items: ['reserveO2', 'reserveWater', 'reserveFood', 'processor'] },
  { title: 'groupCrop', items: ['greenhouse'] },
  { title: 'groupShield', items: ['shield'] },
];

const EFFECT_VARS = {
  initial: Math.round(MISSION_RULES.initialEnergy * 100),
  pct: Math.round(MISSION_RULES.reservePerPack * 100),
};

function get(d: Design, k: DesignItem): number {
  switch (k) {
    case 'reserveO2': return d.reserves.o2;
    case 'reserveWater': return d.reserves.water;
    case 'reserveFood': return d.reserves.food;
    default: return d[k];
  }
}

function set(d: Design, k: DesignItem, v: number): void {
  switch (k) {
    case 'reserveO2': d.reserves.o2 = v; break;
    case 'reserveWater': d.reserves.water = v; break;
    case 'reserveFood': d.reserves.food = v; break;
    default: d[k] = v;
  }
}

function diffLines(prev: Design, cur: Design): string[] {
  const out: string[] = [];
  for (const key of ITEMS) {
    const delta = get(cur, key) - get(prev, key);
    if (delta !== 0) out.push(`${delta > 0 ? '+' : '−'}${Math.abs(delta)} ${tx(`item_${key}` as TextKey)}`);
  }
  return out;
}

function darknessEstimate(d: Design): string {
  try {
    const dark = SCENARIO.events.find((e) => e.kind === 'darkness')!;
    const proj = project(startMission(d, SCENARIO), [], { kind: 'endOfDarkness' });
    const cut = proj.events.find((event) => event.kind === 'power_shortage');
    if (cut && cut.t < dark.startAt) return tx('estimateBefore', { t: cut.t });
    if (cut && cut.t <= dark.endAt) return tx('estimateEmpty', { s: Math.round(cut.t - dark.startAt) });
    if (proj.until < dark.endAt) return tx('estimateStopped', { t: proj.until });
    return tx('estimateHolds', { s: dark.endAt - dark.startAt });
  } catch {
    return tx('estimateInvalid');
  }
}

export function mountStartMenu(root: HTMLElement, opts: StartMenuOptions): Mounted {
  const node = el('section.m-menu', {},
    el('h2', {}, tx('menuTitle')),
    el('p.m-objective', {}, tx('menuObjective', {
      duration: SCENARIO.duration, limit: SCENARIO.exposureLimit, grace: SCENARIO.depletionGrace,
    })),
    el('button.m-btn.m-primary', { onclick: () => opts.onMission() }, tx('menuMission')),
    el('div.m-free', {},
      el('button.m-btn', { onclick: () => opts.onFree() }, tx(opts.hasFreeSave ? 'menuFreeContinue' : 'menuFree')),
      el('p.m-hint', {}, tx('menuFreeHint'))),
  );
  root.append(node);
  return { destroy: () => node.remove() };
}

export function mountPrepare(root: HTMLElement, opts: PrepareOptions): Mounted {
  const design: Design = structuredClone(opts.initial ?? opts.previous?.design ?? emptyDesign());
  const dark = SCENARIO.events.find((e) => e.kind === 'darkness')!;
  const storm = SCENARIO.events.find((e) => e.kind === 'storm')!;
  let timer = 0;

  const wrap = el('section.m-prepare');
  const listeners = new AbortController();
  wrap.addEventListener('keydown', (event) => event.stopPropagation(), { signal: listeners.signal });
  wrap.addEventListener('keyup', (event) => event.stopPropagation(), { signal: listeners.signal });

  const briefing = el('section.m-brief', {},
    el('h2', {}, tx('briefHead')),
    el('p', {}, tx('briefSituation', { dStart: dark.startAt, dEnd: dark.endAt, sStart: storm.startAt, sEnd: storm.endAt })),
    el('p', {}, tx('briefTest')),
    el('p', {}, tx('briefWin', { duration: SCENARIO.duration, limit: SCENARIO.exposureLimit, grace: SCENARIO.depletionGrace })),
    el('div.m-actions', {},
      el('button.m-btn', { onclick: () => opts.onBack() }, tx('prepBack')),
      el('button.m-btn.m-primary', { onclick: () => show('prepare') }, tx('briefNext'))),
  );

  const budgetLine = el('p.m-budget');
  const reasonsBox = el('div.m-reasons', { role: 'alert' });
  const estimateText = el('span', {}, tx('estimatePending'));
  const diffBox = el('div.m-diffs');
  const rows = new Map<DesignItem, { qty: HTMLElement; minus: HTMLButtonElement; plus: HTMLButtonElement; note: HTMLElement }>();

  const groupNodes = GROUPS.map((group) => {
    const items = group.items.map((key) => {
      const qty = el('span.m-qty', { 'aria-live': 'polite' });
      const minus = el('button.m-btn.m-step', { 'aria-label': tx('prepMinus', { item: tx(`item_${key}` as TextKey) }), onclick: () => step(key, -1) }, '−');
      const plus = el('button.m-btn.m-step', { 'aria-label': tx('prepPlus', { item: tx(`item_${key}` as TextKey) }), onclick: () => step(key, 1) }, '+');
      const note = el('span.m-note');
      rows.set(key, { qty, minus, plus, note });
      return el('div.m-row', {},
        el('div.m-name', {}, el('strong', {}, tx(`item_${key}` as TextKey)), el('span.m-price', {}, tx('prepPrice', { p: PRICES[key] }))),
        el('p.m-effect', {}, tx(`effect_${key}` as TextKey, EFFECT_VARS)),
        el('div.m-stepper', {}, minus, qty, plus),
        note,
      );
    });
    const extra = group.title === 'groupPower'
      ? el('p.m-estimate', {}, el('strong', {}, tx('estimateTitle')), ' · ', estimateText)
      : null;
    return el('section.m-group', {}, el('h3', {}, tx(group.title)), extra, ...items);
  });

  const confirm = el('button.m-btn.m-primary', { onclick: () => confirmDesign() }, tx('prepConfirm')) as HTMLButtonElement;
  const back = el('button.m-btn', { onclick: () => opts.onBack() }, tx('prepBack'));

  const prepare = el('div.m-prepare-body', {},
    el('h2', {}, tx('prepTitle')),
    budgetLine,
    reasonsBox,
    ...groupNodes,
    opts.previous ? el('section.m-prev', {},
      el('h3', {}, tx('prevTitle')),
      el('p', {}, tx('prevReached', {
        phase: opts.previous.phase === 'victory' ? tx('prevVictory') : tx('prevFailed'),
        t: Math.floor(opts.previous.duration),
        h: opts.previous.harvests,
      })),
      opts.previous.failure ? el('p.m-hint', {}, opts.previous.failure.explanation) : null,
      el('h4', {}, tx('prevChanges')),
      diffBox,
    ) : null,
    el('p.m-hint', {}, tx('prepSkipCredit')),
    el('div.m-actions', {}, back, confirm),
  );

  const show = (view: 'brief' | 'prepare') => {
    briefing.classList.toggle('m-hidden', view !== 'brief');
    prepare.classList.toggle('m-hidden', view !== 'prepare');
    if (view === 'prepare') {
      render();
      const heading = prepare.querySelector('h2')!;
      heading.tabIndex = -1;
      heading.focus();
    }
  };
  prepare.classList.add('m-hidden');
  wrap.append(briefing, prepare);
  root.append(wrap);

  function step(key: DesignItem, dir: 1 | -1): void {
    const next = get(design, key) + dir;
    if (next < 0 || next > LIMITS[key]) return;
    if (dir > 0 && checkDesign(design, SCENARIO).spent + PRICES[key] > SCENARIO.budget) return;
    set(design, key, next);
    render();
  }

  function confirmDesign(): void {
    if (!checkDesign(design, SCENARIO).ok) return;
    opts.onConfirm(structuredClone(design));
  }

  function scheduleEstimate(): void {
    window.clearTimeout(timer);
    const snapshot = structuredClone(design);
    setText(estimateText, tx('estimatePending'));
    timer = window.setTimeout(() => setText(estimateText, darknessEstimate(snapshot)), ESTIMATE_DEBOUNCE_MS);
  }

  function render(): void {
    const c = checkDesign(design, SCENARIO);
    const left = SCENARIO.budget - c.spent;
    setText(budgetLine, tx('prepBudget', { spent: c.spent, budget: SCENARIO.budget, left }));
    reasonsBox.replaceChildren(...(c.ok ? [] : [el('span', {}, tx('prepInvalid')), ...c.reasons.map((r) => el('span', {}, r))]));
    for (const key of ITEMS) {
      const row = rows.get(key)!;
      const v = get(design, key);
      const room = LIMITS[key] - v;
      const fits = Math.floor(left / PRICES[key]);
      setText(row.qty, String(v));
      row.minus.disabled = v === 0;
      row.plus.disabled = room <= 0 || PRICES[key] > left;
      const hint = room > 0 ? (fits > 0 ? tx('prepAddMore', { n: Math.min(room, fits) }) : tx('prepNoRoom')) : '';
      setText(row.note, [tx('prepMax', { max: LIMITS[key] }), hint].filter(Boolean).join(' · '));
    }
    confirm.disabled = !c.ok;
    diffBox.replaceChildren(...(opts.previous ? diffLinesOrNone(opts.previous.design) : []));
    scheduleEstimate();
  }

  function diffLinesOrNone(prev: Design): HTMLElement[] {
    const lines = diffLines(prev, design);
    if (lines.length === 0) return [el('p', {}, tx('prevNoChanges'))];
    return lines.map((line) => el('p', {}, line));
  }

  show('brief');

  return {
    destroy() {
      window.clearTimeout(timer);
      listeners.abort();
      wrap.remove();
    },
  };
}
