import { SCENARIO_1, type MissionState } from '../../engine';
import { capacity } from '../../game/sim';
import { el, setText } from '../dom';
import { tx } from './texts';
import './mission.css';

export interface MissionBarOptions {
  getState(): MissionState;
  isPaused(): boolean;
  getSpeed(): 1 | 2;
  onTogglePause(): void;
  onSpeed(s: 1 | 2): void;
  onOpenCommander(): void;
}

export function mountMissionBar(root: HTMLElement, opts: MissionBarOptions): { update(): void; destroy(): void } {
  const listeners = new AbortController();
  const signal = listeners.signal;
  let destroyed = false;
  let lastRender = -Infinity;
  const pause = el('button.m-btn', { type: 'button' });
  const speeds = ([1, 2] as const).map((speed) => {
    const button = el('button.m-btn', { type: 'button', 'aria-pressed': 'false' }, `${speed}x`);
    button.addEventListener('click', () => {
      if (opts.getState().phase !== 'running') return;
      opts.onSpeed(speed);
      update();
    }, { signal });
    return button;
  });
  const commander = el('button.m-btn', { type: 'button' }, tx('barCommander'));
  const status = el('strong.m-status', { role: 'status' });
  const clock = el('span.m-clock');
  const exposure = el('span.m-exposure');
  const next = el('p.m-next');
  const cursor = el('span.m-cursor');
  const timeline = el('div.m-timeline', { role: 'img', 'aria-label': tx('barTimeline') });
  const windows = SCENARIO_1.events.map((event) => {
    const label = tx(event.kind === 'darkness' ? 'evDarkness' : 'evStorm');
    const text = tx('barEventWindow', { label, warn: event.warnAt, start: event.startAt, end: event.endAt });
    const band = el(`span.m-window.m-${event.kind}`, { title: text });
    band.style.left = `${event.startAt / SCENARIO_1.duration * 100}%`;
    band.style.width = `${(event.endAt - event.startAt) / SCENARIO_1.duration * 100}%`;
    timeline.append(band);
    return el('span', {}, text);
  });
  timeline.append(cursor);
  const generation = el('meter.m-meter', { min: 0, max: 1, value: 0, 'aria-label': tx('powerMake') });
  const demand = el('meter.m-meter', { min: 0, max: 1, value: 0, 'aria-label': tx('powerUse') });
  const powerText = el('p.m-power-text');
  const shortage = el('p.m-shortage');
  const node = el('section.m-bar', {},
    el('div.m-controls', {}, pause, ...speeds, commander, status, clock, exposure),
    next, timeline,
    el('div.m-windows', {}, ...windows),
    el('div.m-power', {},
      el('strong', {}, tx('powerMeterTitle')),
      el('label', {}, tx('powerMake'), generation),
      el('label', {}, tx('powerUse'), demand), powerText, shortage),
  );
  const toggle = () => {
    if (opts.getState().phase !== 'running') return;
    opts.onTogglePause();
    update();
  };
  pause.addEventListener('click', toggle, { signal });
  commander.addEventListener('click', () => {
    if (opts.getState().phase === 'running') opts.onOpenCommander();
  }, { signal });
  node.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() !== 'p') event.stopPropagation();
  }, { signal });
  node.addEventListener('keyup', (event) => event.stopPropagation(), { signal });
  window.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || event.repeat || event.isComposing || event.ctrlKey || event.altKey || event.metaKey || event.key.toLowerCase() !== 'p') return;
    const editable = event.composedPath().some((target) => target instanceof HTMLElement &&
      (target.matches('input, textarea, select, [role="textbox"]') || target.isContentEditable));
    if (editable) return;
    event.preventDefault();
    toggle();
  }, { signal });
  root.append(node);

  function update(): void {
    if (destroyed || performance.now() - lastRender < 250) return;
    lastRender = performance.now();
    const ms = opts.getState();
    const ended = ms.phase !== 'running';
    const paused = opts.isPaused();
    setText(pause, tx(paused ? 'barResume' : 'barPause'));
    pause.setAttribute('aria-pressed', String(paused));
    pause.disabled = ended;
    commander.disabled = ended;
    speeds.forEach((button, i) => {
      button.setAttribute('aria-pressed', String(opts.getSpeed() === i + 1));
      button.disabled = ended;
    });
    setText(status, tx(ended ? 'barEnded' : paused ? 'barPaused' : 'barRunning'));
    node.classList.toggle('m-paused', paused && !ended);
    setText(clock, tx('barClock', { t: Math.floor(ms.t), d: SCENARIO_1.duration }));
    setText(exposure, tx('barExposure', { x: ms.exposure.toFixed(1), limit: ms.scenario.exposureLimit }));
    const boundaries = SCENARIO_1.events.flatMap((event) => [
      { at: event.warnAt, key: 'nextWarn' as const, event },
      { at: event.startAt, key: 'nextStarts' as const, event },
      { at: event.endAt, key: 'nextRunning' as const, event },
    ]).filter((entry) => entry.at > ms.t).sort((a, b) => a.at - b.at);
    const upcoming = boundaries[0];
    setText(next, ended || !upcoming ? tx('barNoEvents') : tx(upcoming.key, {
      label: tx(upcoming.event.kind === 'darkness' ? 'evDarkness' : 'evStorm'),
      s: Math.ceil(upcoming.at - ms.t),
    }));
    cursor.style.left = `${Math.max(0, Math.min(100, ms.t / SCENARIO_1.duration * 100))}%`;
    const power = ms.lastPower;
    const max = Math.max(1, power.generation, power.demand);
    generation.max = demand.max = max;
    generation.value = power.generation;
    demand.value = power.demand;
    setText(powerText, tx('powerBalance', {
      g: power.generation.toFixed(1), d: power.demand.toFixed(1),
      b: (ms.game.res.energy / capacity(ms.game).energy * 100).toFixed(0),
      net: (power.generation - power.demand).toFixed(1),
    }));
    setText(shortage, power.shortage ? tx('powerShortage') : '');
  }

  update();
  const timer = window.setInterval(update, 250);
  return {
    update,
    destroy() {
      destroyed = true;
      window.clearInterval(timer);
      listeners.abort();
      node.remove();
    },
  };
}
