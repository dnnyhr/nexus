import { capacity, lifeSupportPercent } from '../game/sim';
import type { MissionState, Sample, ScenarioEvent } from './types';

export const figure = (value: number): string => String(Number(value.toFixed(2)));

export function darknessAt(ms: MissionState): { isDark: boolean; secondsLeft: number } {
  const active = ms.scenario.events.find(e => e.kind === 'darkness' && e.startAt <= ms.t && ms.t < e.endAt);
  const next = ms.scenario.events.find(e => e.kind === 'darkness' && e.startAt > ms.t);
  return { isDark: !!active, secondsLeft: Math.max(0, (active?.endAt ?? next?.startAt ?? ms.scenario.duration) - ms.t) };
}

export function nextEvent(ms: MissionState): ScenarioEvent | null {
  return [...ms.scenario.events].filter(e => e.endAt > ms.t)
    .sort((a, b) => Math.max(ms.t, a.startAt) - Math.max(ms.t, b.startAt))[0] ?? null;
}

export function sample(ms: MissionState): Sample {
  const s = ms.game;
  const cap = capacity(s);
  return {
    t: ms.t, o2: s.res.o2 / cap.o2 * 100, water: s.res.water / cap.water * 100,
    food: s.res.food / cap.food * 100, energy: s.res.energy / cap.energy * 100,
    exposure: ms.exposure, crewHealth: s.crewHealth, lights: ms.lastPower.running.lights,
    plantGrowth: s.plant.growth, sheltered: s.sheltered, isDark: darknessAt(ms).isDark,
  };
}

export function updateMinimum(ms: MissionState): void {
  ms.metrics.minLifeSupport = Math.min(ms.metrics.minLifeSupport, lifeSupportPercent(ms.game));
}

export function syncStorm(ms: MissionState): void {
  const event = ms.scenario.events.find(e => e.kind === 'storm' && e.warnAt <= ms.t && ms.t < e.endAt);
  ms.game.storm = {
    phase: !event ? 'none' : ms.t < event.startAt ? 'warning' : 'active',
    timeLeft: event ? (ms.t < event.startAt ? event.startAt : event.endAt) - ms.t : 0,
    nextIn: Math.max(0, (ms.scenario.events.find(e => e.kind === 'storm' && e.warnAt > ms.t)?.warnAt ?? ms.scenario.duration) - ms.t),
    strength: event?.strength ?? 0, flare: event?.inspiredBy ? { ...event.inspiredBy } : null,
    used: ms.scenario.events.filter(e => e.kind === 'storm' && e.warnAt <= ms.t).length, live: false,
  };
}

export function scenarioEvents(ms: MissionState, previous: number): void {
  for (const event of ms.scenario.events) {
    for (const [at, suffix] of [[event.warnAt, 'warning'], [event.startAt, 'start'], [event.endAt, 'end']] as const) {
      if (previous >= at || ms.t < at) continue;
      const text = event.kind === 'darkness'
        ? suffix === 'end'
          ? `Fin de la oscuridad: batería ${figure(sample(ms).energy)} %, luces reducidas ${figure(ms.metrics.secondsLightsReduced)} s`
          : suffix === 'warning' ? `Oscuridad prevista en ${figure(event.startAt - ms.t)} s` : 'Comienza la oscuridad'
        : suffix === 'end'
          ? `Fin de tormenta: exposición ${figure(ms.exposure)} u; refugio ${figure(ms.metrics.secondsSheltered)} s`
          : suffix === 'warning' ? `Tormenta prevista en ${figure(event.startAt - ms.t)} s` : 'Comienza la tormenta';
      ms.events.push({ t: at, kind: `${event.kind}_${suffix}`, text });
    }
  }
}
