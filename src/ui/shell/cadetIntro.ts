import { applyToGame, CADET_DESIGN, missionPowerOptions, SCENARIO_1, startMission, STEP, worldStep } from '../../engine';
import type { SpaceTelemetry } from '../../data/telemetry';
import { ENERGY, GREENHOUSE, MISSION, type Circuit } from '../../game/config';
import { resolvePower } from '../../game/sim';
import type { GameState } from '../../game/state';
import { el } from '../dom';
import { getLang, onLangChange, t, type StringKey } from '../i18n';
import './shell.css';

// Cadet briefing: three short steps before the first mission. The second one asks the player to
// rank circuits and answers with what the engine itself gives each one when darkness begins.

export interface CadetIntroOptions {
  getTelemetry(): SpaceTelemetry | null;
  onStart(priority: Circuit[]): void;
  onDesign(priority: Circuit[]): void;
  onBack(): void;
}

export interface CadetIntroHandle {
  destroy(): void;
}

type Outcome = 'heating' | 'lights' | 'risky';

const CHOICES: { key: StringKey; order: Circuit[]; outcome: Outcome }[] = [
  { key: 'nxChoiceHeating', order: ['lifeSupport', 'heating', 'processor', 'robots', 'greenhouse'], outcome: 'heating' },
  { key: 'nxChoiceLights', order: ['lifeSupport', 'greenhouse', 'heating', 'processor', 'robots'], outcome: 'lights' },
  { key: 'nxChoiceRisky', order: ['greenhouse', 'heating', 'lifeSupport', 'processor', 'robots'], outcome: 'risky' },
];

const DARK = SCENARIO_1.events.find((e) => e.kind === 'darkness')!;
const STORM = SCENARIO_1.events.find((e) => e.kind === 'storm')!;

let darkBase: GameState | null = null;

/** The cadet base as darkness begins, simulated by the engine (computed once). */
function atDarkness(): GameState {
  if (!darkBase) {
    const ms = startMission(CADET_DESIGN);
    while (ms.t < DARK.startAt) worldStep(ms);
    darkBase = ms.game;
  }
  return structuredClone(darkBase);
}

/** What each circuit gets in the first step of darkness with this order. */
export function darknessOutcome(order: Circuit[]): { lifeSupport: boolean; heating: boolean; lights: number; available: number } {
  const game = atDarkness();
  applyToGame(game, { type: 'setPriority', order });
  const r = resolvePower(game, STEP, false, missionPowerOptions(game));
  return { lifeSupport: r.lifeSupportPowered, heating: r.running.heating, lights: r.running.lights, available: r.available ?? 0 };
}

const fmt = (n: number) => String(Number(n.toFixed(2)));

function dateText(iso: string | null | undefined, withTime = false): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return withTime
    ? d.toLocaleString(getLang(), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString(getLang(), { day: 'numeric', month: 'long', year: 'numeric' });
}

function link(label: string, href: string): HTMLElement {
  return el('a', { href, target: '_blank', rel: 'noopener' }, label);
}

export function mountCadetIntro(root: HTMLElement, opts: CadetIntroOptions): CadetIntroHandle {
  const TOTAL = 3;
  let step = 1;
  let choice = 0;
  const events = new AbortController();
  const titleId = 'nx-intro-title';
  const wrap = el('section.nx-intro', { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId });
  const card = el('div.nx-intro__card');
  wrap.append(card);
  for (const type of ['keyup', 'pointerdown', 'pointerup']) wrap.addEventListener(type, (e) => e.stopPropagation(), { signal: events.signal });
  wrap.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); opts.onBack(); }
  }, { signal: events.signal });

  const lightsWant = (MISSION.initialGrowLights / 100) * ENERGY.growLightsMaxDraw * (1 + CADET_DESIGN.greenhouse) * MISSION.agriculturalDrawPerLevel;
  const wants = { ls: ENERGY.lifeSupportDraw, h: ENERGY.heatingDraw, l: lightsWant };

  function timeline(): HTMLElement {
    const band = (a: number, b: number, cls: string) => {
      const node = el(`div.nx-tl__band.${cls}`);
      node.style.left = `${(a / SCENARIO_1.duration) * 100}%`;
      node.style.width = `${((b - a) / SCENARIO_1.duration) * 100}%`;
      return node;
    };
    return el('div.nx-tl', { role: 'img', 'aria-label': `${t('nxIntroDark', { a: DARK.startAt, b: DARK.endAt })} ${t('nxIntroStorm', { a: STORM.startAt, b: STORM.endAt })}` },
      el('div.nx-tl__track', {}, band(DARK.startAt, DARK.endAt, 'is-dark'), band(STORM.startAt, STORM.endAt, 'is-storm')),
      el('div.nx-tl__ticks', {}, el('span', {}, '0 s'), el('span', {}, `${SCENARIO_1.duration} s`)));
  }

  function telemetryCard(): HTMLElement {
    const box = el('div.nx-now', { 'aria-live': 'polite' });
    const draw = () => {
      const tel = opts.getTelemetry();
      box.replaceChildren(el('p.nx-now__title', {}, t('nxNowTitle')));
      if (!tel) {
        box.append(el('p', {}, t('nxStatusLoading')));
        return;
      }
      const protons = tel.protons;
      const activity = tel.solarActivity;
      const status = (s: string, when: string | null) =>
        s === 'LIVE' ? t('nxStatusLIVE', { when: dateText(when, true) })
          : s === 'SNAPSHOT' ? t('nxStatusSNAPSHOT', { when: dateText(when, true) }) : t('nxStatusUNAVAILABLE');
      if (protons.value) {
        box.append(el('p', {}, t('nxNowProtons', { f: fmt(protons.value.flux), s: protons.value.scale }), ' ',
          el('span.nx-now__meta', {}, `${status(protons.status, protons.utc ?? tel.fetchedAt)} · ${protons.location} · `), link(protons.source.name, protons.source.url)));
      }
      if (activity.value) {
        box.append(el('p', {}, t('nxNowFlares', { days: activity.value.window.days, m: activity.value.counts.m, x: activity.value.counts.x }), ' ',
          el('span.nx-now__meta', {}, `${status(activity.status, activity.utc ?? tel.fetchedAt)} · `), link(activity.source.name, activity.source.url)));
      }
      if (!protons.value && !activity.value) box.append(el('p', {}, t('nxStatusUNAVAILABLE')));
      box.append(el('p.nx-now__note', {}, t('nxNowNote')));
    };
    draw();
    const timer = window.setInterval(draw, 1500);
    events.signal.addEventListener('abort', () => window.clearInterval(timer));
    return box;
  }

  function stepOne(): HTMLElement[] {
    return [
      el('h2', { id: titleId, tabindex: -1 }, t('nxIntro1Title')),
      el('p', {}, t('nxIntro1Body', { d: SCENARIO_1.duration })),
      timeline(),
      el('ul.nx-intro__facts', {},
        el('li.is-dark', {}, t('nxIntroDark', { a: DARK.startAt, b: DARK.endAt })),
        el('li.is-storm', {}, t('nxIntroStorm', { a: STORM.startAt, b: STORM.endAt }))),
      el('p.nx-intro__goal', {}, t('nxIntro1Goal', { d: SCENARIO_1.duration, limit: SCENARIO_1.exposureLimit, grace: SCENARIO_1.depletionGrace })),
      el('p.nx-intro__muted', {}, t('nxIntroLoadout')),
    ];
  }

  function stepTwo(): HTMLElement[] {
    const result = el('div.nx-result', { 'aria-live': 'polite' });
    const buttons = CHOICES.map((c, i) => el('button.nx-choice', {
      type: 'button',
      'aria-pressed': String(i === choice),
      onclick: () => { choice = i; render(); },
    }, t(c.key)));
    const pick = CHOICES[choice];
    const out = darknessOutcome(pick.order);
    const state = (on: boolean) => t(on ? 'nxPowered' : 'nxUnpowered');
    const lights = Math.round(out.lights);
    result.append(
      el('p.nx-result__line', {}, t('nxResultLine', { ls: state(out.lifeSupport), h: state(out.heating), l: lights })),
      el('p', {}, pick.outcome === 'heating' ? t('nxResultHeating', { l: lights })
        : pick.outcome === 'lights' ? t('nxResultLights', { l: lights, c: fmt(-GREENHOUSE.tempNightDrift) })
          : t('nxResultRisky', { hp: fmt(MISSION.unpoweredHealthLoss) })),
    );
    result.dataset.risk = !out.lifeSupport ? 'critical' : 'caution';
    return [
      el('h2', { id: titleId, tabindex: -1 }, t('nxIntro2Title')),
      el('p', {}, t('nxIntro2Body', { a: fmt(MISSION.stationDischarge), ls: fmt(wants.ls), h: fmt(wants.h), l: fmt(wants.l), total: fmt(wants.ls + wants.h + wants.l) })),
      el('p.nx-intro__ask', {}, t('nxIntro2Ask')),
      el('div.nx-choices', { role: 'group', 'aria-label': t('nxIntro2Ask') }, ...buttons),
      result,
      el('p.nx-intro__muted', {}, t('nxIntro2Keep')),
    ];
  }

  function stepThree(): HTMLElement[] {
    const flare = STORM.inspiredBy;
    return [
      el('h2', { id: titleId, tabindex: -1 }, t('nxIntro3Title')),
      el('p', {}, t('nxIntro3Body', { cls: flare?.class ?? '—', date: dateText(flare?.peak) }), ' ',
        flare ? link('NASA DONKI', flare.link) : ''),
      el('p', {}, t('nxIntro3Shelter')),
      telemetryCard(),
      el('p.nx-intro__muted', {}, t('nxControls')),
    ];
  }

  function render(): void {
    const body = step === 1 ? stepOne() : step === 2 ? stepTwo() : stepThree();
    const dots = el('ol.nx-intro__dots', { 'aria-label': t('nxIntroStep', { n: step, total: TOTAL }) },
      ...Array.from({ length: TOTAL }, (_, i) => el(`li${i + 1 === step ? '.is-current' : i + 1 < step ? '.is-done' : ''}`)));
    const back = el('button.nx-btn', { type: 'button', onclick: () => { if (step > 1) { step--; render(); focusTitle(); } else opts.onBack(); } },
      step > 1 ? t('nxBack') : t('nxToCenter'));
    const actions = step < TOTAL
      ? [el('button.nx-btn.nx-btn--primary', { type: 'button', onclick: () => { step++; render(); focusTitle(); } }, t('nxNext'))]
      : [
        el('button.nx-btn', { type: 'button', onclick: () => opts.onDesign([...CHOICES[choice].order]) }, t('nxDesignBase')),
        el('button.nx-btn.nx-btn--primary', { type: 'button', 'data-start': '', onclick: () => opts.onStart([...CHOICES[choice].order]) }, t('nxStartMission')),
      ];
    card.replaceChildren(
      el('header.nx-intro__head', {}, el('span.nx-intro__kicker', {}, 'NEXUS · ', t('nxIntroKicker')), dots,
        el('span.nx-intro__step', {}, t('nxIntroStep', { n: step, total: TOTAL }))),
      el('div.nx-intro__body', {}, ...body),
      el('footer.nx-intro__actions', {}, back, el('span.nx-intro__spacer'), ...actions),
    );
  }

  function focusTitle(): void {
    card.querySelector<HTMLElement>(`#${titleId}`)?.focus({ preventScroll: true });
  }

  const unsubscribe = onLangChange(() => render());
  render();
  root.append(wrap);
  focusTitle();
  return {
    destroy() {
      unsubscribe();
      events.abort();
      wrap.remove();
    },
  };
}

