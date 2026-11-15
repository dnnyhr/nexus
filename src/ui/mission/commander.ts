import { project } from '../../engine';
import type { Command, Horizon, MissionState, Projection, Sample } from '../../engine/types';
import { capacity, lifeSupportPercent } from '../../game/sim';
import { el } from '../dom';
import { renderChart } from './chart';
import { commandText, commanderTexts, horizonLabel, signed } from './commanderTexts';

export interface CommanderOptions {
  getState(): MissionState;
  onClose(): void;
  onConfirm(plan: Command[]): void;
}

export interface CommanderHandle {
  destroy(): void;
}

interface Draft {
  lights: number;
  heating: boolean;
  processor: boolean;
  robots: boolean;
  sheltered: boolean;
}

export function mountCommander(root: HTMLElement, opts: CommanderOptions): CommanderHandle {
  const initial = opts.getState();
  let horizon: Horizon = { kind: 'seconds', value: 60 };
  let draft: Draft = {
    lights: initial.game.power.growLights,
    heating: initial.game.power.heating,
    processor: initial.game.power.processor,
    robots: initial.game.power.robots,
    sheltered: initial.game.sheltered,
  };
  let pending: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;
  let projectionFailed = false;

  const closeButton = el('button.c-icon', { type: 'button', 'aria-label': commanderTexts.close }, '×');
  const title = el('h2', {}, commanderTexts.title);
  const lede = el('p.c-lede', {}, commanderTexts.lede);
  const situationList = el('ul.c-situation-list');
  const situation = el('section.c-situation', { 'aria-label': commanderTexts.situation }, el('h3', {}, commanderTexts.situation), situationList);

  const lightsOutput = el('output.c-lights-value', {}, commanderTexts.lightsValue(initial.game.power.growLights));
  const lightsInput = el('input.c-lights', {
    type: 'range',
    min: 0,
    max: 100,
    step: 5,
    value: initial.game.power.growLights,
    'aria-label': commanderTexts.lights,
  });
  const lightsRow = el(
    'div.c-control',
    {},
    el('label.c-control-label', {}, el('span', {}, commanderTexts.lights), lightsOutput),
    lightsInput,
  );

  const toggles = new Map<keyof Omit<Draft, 'lights' | 'sheltered'>, HTMLButtonElement>();
  const toggleRow = el('div.c-toggle-row');
  for (const key of ['heating', 'processor', 'robots'] as const) {
    const button = el('button.c-toggle', { type: 'button', 'aria-pressed': String(draft[key]) }, '');
    toggles.set(key, button);
    toggleRow.appendChild(button);
  }
  const shelterButton = el('button.c-toggle.c-toggle-shelter', { type: 'button', 'aria-pressed': String(draft.sheltered) });
  toggleRow.appendChild(shelterButton);

  const controls = el(
    'section.c-controls',
    { 'aria-label': commanderTexts.controls },
    el('h3', {}, commanderTexts.controls),
    el('p.c-hint', {}, commanderTexts.controlsHint),
    lightsRow,
    toggleRow,
  );

  const horizonRow = el('div.c-horizon-row', { role: 'group', 'aria-label': commanderTexts.horizonAria });
  const horizonButtons: { horizon: Horizon; button: HTMLButtonElement }[] = [];
  const horizonChoices: Horizon[] = [
    { kind: 'seconds', value: 60 },
    { kind: 'endOfDarkness' },
    { kind: 'endOfMission' },
  ];
  for (const choice of horizonChoices) {
    const button = el('button.c-horizon-button', { type: 'button', 'aria-pressed': 'false' }, horizonLabel(choice));
    horizonButtons.push({ horizon: choice, button });
    horizonRow.appendChild(button);
  }
  const horizonSection = el(
    'section.c-horizon',
    { 'aria-label': commanderTexts.horizon },
    el('h3', {}, commanderTexts.horizon),
    horizonRow,
  );

  const tableHost = el('div.c-table-host');
  const deltaText = el('p.c-delta', { 'aria-live': 'polite' });
  const rejections = el('ul.c-rejections');
  const rejectionSection = el(
    'section.c-rejection-box',
    { 'aria-label': commanderTexts.rejectedTitle },
    el('h4', {}, commanderTexts.rejectedTitle),
    rejections,
  );
  const chartHost = el('div.c-chart-host');
  const policyText = el('p.c-policy', {}, commanderTexts.policy);
  const projection = el(
    'section.c-projection',
    { 'aria-label': commanderTexts.comparison },
    el('h3', {}, commanderTexts.comparison),
    el('p.c-hint', {}, commanderTexts.rowsHelp.minLife),
    tableHost,
    deltaText,
    chartHost,
    rejectionSection,
    policyText,
  );

  const confirmButton = el('button.c-primary', { type: 'button' }, commanderTexts.confirm);
  const cancelButton = el('button.c-secondary', { type: 'button' }, commanderTexts.cancel);
  const actions = el('footer.c-actions', {}, cancelButton, confirmButton);

  const dialog = el(
    'div.c-commander',
    { role: 'dialog', 'aria-modal': 'true', 'aria-label': commanderTexts.title },
    el('header.c-head', {}, el('div', {}, title, lede), closeButton),
    el('div.c-body', {}, el('div.c-column', {}, situation, controls, horizonSection), el('div.c-column', {}, projection)),
    actions,
  );

  root.appendChild(dialog);

  function draftPlan(ms: MissionState): Command[] {
    const plan: Command[] = [];
    if (Math.round(draft.lights) !== Math.round(ms.game.power.growLights)) {
      plan.push({ type: 'setGrowLights', value: Math.round(draft.lights) });
    }
    for (const key of ['heating', 'processor', 'robots'] as const) {
      if (draft[key] !== ms.game.power[key]) plan.push({ type: 'setPower', system: key, on: draft[key] });
    }
    if (draft.sheltered !== ms.game.sheltered) {
      plan.push({ type: draft.sheltered ? 'enterShelter' : 'leaveShelter' });
    }
    return plan;
  }

  function horizonTarget(ms: MissionState): number {
    if (horizon.kind === 'seconds') return Math.min(ms.scenario.duration, ms.t + horizon.value);
    if (horizon.kind === 'endOfDarkness') {
      const darkness = ms.scenario.events.find((event) => event.kind === 'darkness');
      return darkness ? darkness.endAt : ms.scenario.duration;
    }
    return ms.scenario.duration;
  }

  function minLife(samples: Sample[]): number | null {
    const values = samples.flatMap((sample) => [sample.o2, sample.water, sample.food]).filter(Number.isFinite);
    return values.length ? Math.min(...values) : null;
  }

  function lastSample(samples: Sample[]): Sample | null {
    return samples.length ? samples[samples.length - 1] : null;
  }

  function harvestCount(projectionResult: Projection, ms: MissionState): number {
    return projectionResult.events.filter(
      (event) => event.kind === 'harvest' && event.t > ms.t && event.t <= projectionResult.until + 0.001,
    ).length;
  }

  function percent(value: number | null): string {
    return value === null ? '—' : `${Math.round(value)} %`;
  }

  function exposure(value: number | null): string {
    return value === null ? '—' : `${value.toFixed(1)} u`;
  }

  function outcome(result: Projection): string {
    if (result.failure) return commanderTexts.failureLine(result.failure);
    return commanderTexts.noFailure(result.until);
  }

  function renderTable(ms: MissionState, base: Projection, alt: Projection): void {
    const baseSample = lastSample(base.samples);
    const altSample = lastSample(alt.samples);
    const baseMin = minLife(base.samples);
    const altMin = minLife(alt.samples);
    const baseHarvests = harvestCount(base, ms);
    const altHarvests = harvestCount(alt, ms);

    const rows: { label: string; current: string; plan: string; delta: string }[] = [
      {
        label: commanderTexts.rows.minLife,
        current: percent(baseMin),
        plan: percent(altMin),
        delta: baseMin !== null && altMin !== null ? `${signed(altMin - baseMin, 0)} %` : '—',
      },
      {
        label: commanderTexts.rows.energy,
        current: percent(baseSample ? baseSample.energy : null),
        plan: percent(altSample ? altSample.energy : null),
        delta:
          baseSample && altSample ? `${signed(altSample.energy - baseSample.energy, 1)} %` : '—',
      },
      {
        label: commanderTexts.rows.exposure,
        current: exposure(baseSample ? baseSample.exposure : null),
        plan: exposure(altSample ? altSample.exposure : null),
        delta:
          baseSample && altSample ? `${signed(altSample.exposure - baseSample.exposure, 1)} u` : '—',
      },
      {
        label: commanderTexts.rows.harvests,
        current: `${baseHarvests}`,
        plan: `${altHarvests}`,
        delta: signed(altHarvests - baseHarvests, 0),
      },
      {
        label: commanderTexts.rows.outcome,
        current: outcome(base),
        plan: outcome(alt),
        delta: '—',
      },
    ];

    const table = el(
      'table.c-table',
      {},
      el(
        'thead',
        {},
        el(
          'tr',
          {},
          el('th', { scope: 'col' }, ''),
          el('th', { scope: 'col' }, commanderTexts.columns.current),
          el('th', { scope: 'col' }, commanderTexts.columns.plan),
          el('th', { scope: 'col' }, commanderTexts.columns.delta),
        ),
      ),
      el(
        'tbody',
        {},
        ...rows.map((row) =>
          el(
            'tr',
            {},
            el('th', { scope: 'row' }, row.label),
            el('td.c-mono', {}, row.current),
            el('td.c-mono', {}, row.plan),
            el('td.c-mono', {}, row.delta),
          ),
        ),
      ),
    );

    tableHost.replaceChildren(table);
    if (!base.samples.length || !alt.samples.length) tableHost.appendChild(el('p.c-hint', {}, commanderTexts.noSamples));

    const parts: string[] = [];
    if (baseMin !== null && altMin !== null && Math.abs(altMin - baseMin) >= 0.5) {
      parts.push(commanderTexts.differenceParts.minLife(signed(altMin - baseMin, 0)));
    }
    if (baseSample && altSample && Math.abs(altSample.energy - baseSample.energy) >= 0.5) {
      parts.push(commanderTexts.differenceParts.energy(signed(altSample.energy - baseSample.energy, 1)));
    }
    if (baseSample && altSample && Math.abs(altSample.exposure - baseSample.exposure) >= 0.1) {
      parts.push(commanderTexts.differenceParts.exposure(signed(altSample.exposure - baseSample.exposure, 1)));
    }
    if (altHarvests !== baseHarvests) {
      parts.push(commanderTexts.differenceParts.harvests(signed(altHarvests - baseHarvests, 0)));
    }
    deltaText.textContent = parts.length
      ? `${commanderTexts.difference}: ${parts.join(' · ')}.`
      : commanderTexts.noDifference;
  }

  function renderRejections(alt: Projection): void {
    rejections.replaceChildren();
    if (alt.rejected.length === 0) {
      rejections.appendChild(el('li.c-none', {}, commanderTexts.noRejections));
      return;
    }
    for (const item of alt.rejected) {
      rejections.appendChild(el('li.c-rejection', {}, el('strong', {}, commandText(item.cmd)), ` · ${item.reason}`));
    }
  }

  function renderSituation(ms: MissionState): void {
    situationList.replaceChildren(
      el('li', {}, commanderTexts.time(ms.t)),
      el('li', {}, commanderTexts.life(lifeSupportPercent(ms.game))),
      el('li', {}, commanderTexts.energy((ms.game.res.energy / capacity(ms.game).energy) * 100)),
      el('li', {}, commanderTexts.exposure(ms.exposure, ms.scenario.exposureLimit)),
      el('li', {}, commanderTexts.crop(ms.game.plant.growth)),
      el('li', {}, commanderTexts.sheltered(ms.game.sheltered)),
    );
  }

  function renderControlLabels(): void {
    lightsOutput.textContent = commanderTexts.lightsValue(draft.lights);
    for (const [key, button] of toggles) {
      button.textContent = `${commanderTexts[key]} · ${draft[key] ? commanderTexts.on : commanderTexts.off}`;
      button.setAttribute('aria-pressed', String(draft[key]));
    }
    shelterButton.textContent = draft.sheltered ? commanderTexts.leaveShelter : commanderTexts.enterShelter;
    shelterButton.setAttribute('aria-pressed', String(draft.sheltered));
    for (const entry of horizonButtons) {
      const active =
        entry.horizon.kind === horizon.kind &&
        (entry.horizon.kind !== 'seconds' ||
          (horizon.kind === 'seconds' && Math.round(entry.horizon.value) === Math.round(horizon.value)));
      entry.button.setAttribute('aria-pressed', String(active));
      entry.button.classList.toggle('is-active', active);
    }
  }

  function showProjectionError(error: unknown): void {
    projectionFailed = true;
    tableHost.replaceChildren(
      el('p.c-error', {}, `${commanderTexts.projectionError} ${error instanceof Error ? error.message : String(error)}`),
    );
    deltaText.textContent = '';
    rejections.replaceChildren();
    chartHost.replaceChildren();
    confirmButton.disabled = true;
    confirmButton.setAttribute('aria-disabled', 'true');
    policyText.hidden = true;
  }

  function render(): void {
    if (disposed) return;
    const ms = opts.getState();
    renderSituation(ms);
    const plan = draftPlan(ms);
    let base: Projection;
    let alt: Projection;
    try {
      base = project(ms, [], horizon);
      alt = project(ms, plan, horizon);
    } catch (error) {
      showProjectionError(error);
      return;
    }
    projectionFailed = false;
    confirmButton.disabled = false;
    confirmButton.removeAttribute('aria-disabled');
    policyText.hidden = false;
    renderControlLabels();
    renderTable(ms, base, alt);
    renderRejections(alt);
    deltaText.textContent += plan.length === 0 ? ` ${commanderTexts.emptyPlan}` : '';
    chartHost.replaceChildren(
      renderChart(base.samples, ms.events, ms.scenario, {
        untilT: Math.max(base.until, alt.until, horizonTarget(ms)),
        overlay: { samples: alt.samples },
      }),
    );
  }

  function scheduleRender(): void {
    if (disposed) return;
    if (pending !== null) clearTimeout(pending);
    pending = setTimeout(() => {
      pending = null;
      render();
    }, 120);
  }

  function onLightsInput(): void {
    draft = { ...draft, lights: Number(lightsInput.value) };
    renderControlLabels();
    scheduleRender();
  }

  function toggle(key: keyof Omit<Draft, 'lights' | 'sheltered'>): void {
    draft = { ...draft, [key]: !draft[key] };
    renderControlLabels();
    render();
  }

  function toggleShelter(): void {
    draft = { ...draft, sheltered: !draft.sheltered };
    renderControlLabels();
    render();
  }

  function chooseHorizon(choice: Horizon): void {
    horizon = choice;
    renderControlLabels();
    render();
  }

  function onConfirm(): void {
    if (projectionFailed || disposed) return;
    if (pending !== null) {
      clearTimeout(pending);
      pending = null;
    }
    opts.onConfirm(draftPlan(opts.getState()));
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      opts.onClose();
    }
  }

  lightsInput.addEventListener('input', onLightsInput);
  for (const [key, button] of toggles) button.addEventListener('click', () => toggle(key));
  shelterButton.addEventListener('click', toggleShelter);
  for (const entry of horizonButtons) entry.button.addEventListener('click', () => chooseHorizon(entry.horizon));
  confirmButton.addEventListener('click', onConfirm);
  cancelButton.addEventListener('click', () => opts.onClose());
  closeButton.addEventListener('click', () => opts.onClose());
  document.addEventListener('keydown', onKeyDown);

  render();

  return {
    destroy(): void {
      if (disposed) return;
      disposed = true;
      if (pending !== null) {
        clearTimeout(pending);
        pending = null;
      }
      document.removeEventListener('keydown', onKeyDown);
      dialog.remove();
    },
  };
}
