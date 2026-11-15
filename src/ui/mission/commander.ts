import { project, type Command, type Horizon, type MissionState, type Projection } from '../../engine';
import { el } from '../dom';
import { cx, type CommanderKey } from './commanderTexts';
import './report.css';

// The lunar commander: with the mission paused, compare a few decisions side by side.
// Each row applies one decision now and projects with the real engine, assuming nothing
// else is done; «Do it» sends the same commands to the mission.

export interface CommanderOptions {
  getState(): MissionState;
  onApply(plan: Command[]): void;
  onClose(): void;
}

interface Plan { key: CommanderKey; plan: Command[] }

function plans(ms: MissionState): Plan[] {
  const g = ms.game;
  const out: Plan[] = [{ key: 'planKeep', plan: [] }];
  out.push(g.power.growLights > 0 ? { key: 'planLightsOff', plan: [{ type: 'setGrowLights', value: 0 }] } : { key: 'planLightsOn', plan: [{ type: 'setGrowLights', value: 50 }] });
  out.push(g.power.heating ? { key: 'planHeatOff', plan: [{ type: 'setPower', system: 'heating', on: false }] } : { key: 'planHeatOn', plan: [{ type: 'setPower', system: 'heating', on: true }] });
  // The real lesson of the dark: everything that is not vital off, together.
  if (g.power.growLights > 0 && g.power.heating) {
    out.push({ key: 'planSaveAll', plan: [{ type: 'setGrowLights', value: 0 }, { type: 'setPower', system: 'heating', on: false }] });
  }
  out.push(g.sheltered ? { key: 'planLeave', plan: [{ type: 'leaveShelter' }] } : { key: 'planShelter', plan: [{ type: 'enterShelter' }] });
  return out;
}

const LOWEST: { key: 'o2' | 'water' | 'food' | 'energy'; label: CommanderKey }[] = [
  { key: 'o2', label: 'serO2' }, { key: 'water', label: 'serWater' }, { key: 'food', label: 'serFood' }, { key: 'energy', label: 'serEnergy' },
];

function result(p: Projection, endOfMission: number): string {
  if (p.rejected.length) return cx('resRejected');
  if (p.phase === 'failed' && p.failure) return cx('resFail', { t: Math.round(p.failure.t), why: cx(`fail_${p.failure.code}` as CommanderKey) });
  if (p.phase === 'victory' || p.until >= endOfMission) return cx('resWin');
  return cx('resOk', { t: Math.round(p.until) });
}

/** One plain detail: what drops the most, and the radiation if any came in. */
function detail(p: Projection, limit: number): string {
  const lows = LOWEST.map((l) => ({ ...l, v: Math.min(...p.samples.map((s) => s[l.key])) })).sort((a, b) => a.v - b.v);
  const parts = [cx('resLowest', { what: cx(lows[0].label).toLowerCase(), v: Math.max(0, Math.round(lows[0].v)) })];
  const rad = p.samples[p.samples.length - 1].exposure;
  if (rad >= 0.05) parts.push(cx('resRadiation', { x: rad.toFixed(1), limit }));
  return parts.join(' ');
}

export function mountCommander(root: HTMLElement, opts: CommanderOptions): { destroy(): void } {
  const wrap = el('section.m-screen.m-commander', { role: 'dialog', 'aria-modal': 'true' });
  const listeners = new AbortController();
  wrap.addEventListener('keydown', (e) => { if (e.key !== 'Escape') e.stopPropagation(); else opts.onClose(); }, { signal: listeners.signal });
  let horizon: Horizon['kind'] = 'endOfDarkness';

  function render(): void {
    const ms = opts.getState();
    const dark = ms.scenario.events.find((e) => e.kind === 'darkness' && e.endAt > ms.t);
    const kind: Horizon['kind'] = horizon === 'endOfDarkness' && !dark ? 'endOfMission' : horizon;
    const cards = plans(ms).map(({ key, plan }) => {
      const p = project(ms, plan, { kind } as Horizon);
      const bad = p.phase === 'failed' || p.rejected.length > 0;
      return el(`div.m-option${bad ? '.m-bad' : '.m-good'}`, {},
        el('h3', {}, cx(key)),
        el('p.m-result', {}, el('span.m-mark', { 'aria-hidden': 'true' }, bad ? '✗' : '✓'), ' ', result(p, ms.scenario.duration)),
        p.rejected.length ? null : el('p.m-hint', {}, detail(p, ms.scenario.exposureLimit)),
        plan.length && !p.rejected.length
          ? el('button.m-btn', { onclick: () => { opts.onApply(plan); render(); } }, cx('cmdApply'))
          : el('p.m-hint', {}, plan.length ? '' : cx('cmdCurrent')),
      );
    });
    const toggle = (k: Horizon['kind'], label: CommanderKey) => el('button.m-btn', {
      'aria-pressed': String(kind === k), onclick: () => { horizon = k; render(); },
    }, cx(label));
    wrap.replaceChildren(el('div.m-panel', {},
      el('h2', {}, cx('cmdTitle')),
      el('p', {}, cx('cmdPaused', { t: Math.floor(ms.t) })),
      el('div.m-actions', {}, el('span', {}, cx('cmdHorizon')), toggle('endOfDarkness', 'cmdToDark'), toggle('endOfMission', 'cmdToEnd')),
      !dark ? el('p.m-hint', {}, cx('cmdNoDark')) : null,
      el('div.m-options', {}, ...cards),
      el('p.m-hint', {}, cx('cmdAssume')),
      el('div.m-actions', {}, el('button.m-btn.m-primary', { onclick: () => opts.onClose() }, cx('cmdResume'))),
    ));
  }

  render();
  root.append(wrap);
  (wrap.querySelector('h2') as HTMLElement | null)?.setAttribute('tabindex', '-1');
  (wrap.querySelector('h2') as HTMLElement | null)?.focus();
  return { destroy: () => { listeners.abort(); wrap.remove(); } };
}
