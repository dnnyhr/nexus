import { PRICES, summarize } from '../../engine';
import type { Design, Failure, MissionState, Summary } from '../../engine/types';
import { el } from '../dom';
import { renderChart } from './chart';
import {
  assessmentScience,
  commandText,
  designItemLabels,
  designLabel,
  foodFinding,
  lifeSupportFinding,
  NASA_SOURCES,
  protectionFinding,
  ratingLabels,
  reportTexts,
  type Rating,
} from './commanderTexts';

export interface ReportOptions {
  getState(): MissionState;
  previous: Summary | null;
  onRetry(design: Design): void;
  onMenu(): void;
}

export interface ReportHandle {
  destroy(): void;
}

interface Assessment {
  id: 'lifeSupport' | 'food' | 'protection';
  rating: Rating;
  finding: string;
  explanation: string;
  source: { title: string; url: string };
}

interface EnergyLedgerRow {
  cause: 'darkness' | 'storm';
  lost: number;
}

interface TimelineEntry {
  t: number;
  order: number;
  index: number;
  kind: 'command' | 'event';
  text: string;
  rejected: boolean;
  reason: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function designCost(design: Design): number {
  return (
    design.solarMasts * PRICES.solarMasts +
    design.batteries * PRICES.batteries +
    design.greenhouse * PRICES.greenhouse +
    design.processor * PRICES.processor +
    design.shield * PRICES.shield +
    design.reserves.o2 * PRICES.reserveO2 +
    design.reserves.water * PRICES.reserveWater +
    design.reserves.food * PRICES.reserveFood
  );
}

function readEnergyLedger(ms: MissionState): EnergyLedgerRow[] | null {
  const raw = (ms as unknown as { ledger?: unknown }).ledger;
  const rows = Array.isArray(raw)
    ? raw
    : isRecord(raw) && Array.isArray(raw.entries)
      ? raw.entries
      : isRecord(raw) && Array.isArray(raw.rows)
        ? raw.rows
        : null;
  if (!rows) return null;
  const totals = { darkness: 0, storm: 0 };
  let found = false;
  for (const item of rows) {
    if (!isRecord(item)) continue;
    const cause = item.cause ?? item.kind;
    if (cause !== 'darkness' && cause !== 'storm') continue;
    const value = item.delta ?? item.energy ?? item.lost ?? item.deficit;
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    totals[cause] += Math.abs(value);
    found = true;
  }
  if (!found) return null;
  return [
    { cause: 'darkness', lost: totals.darkness },
    { cause: 'storm', lost: totals.storm },
  ].filter((row) => row.lost > 0) as EnergyLedgerRow[];
}

function minFood(ms: MissionState): { min: number; final: number } {
  const values = ms.samples.map((sample) => sample.food).filter(Number.isFinite);
  if (!values.length) return { min: Number.NaN, final: Number.NaN };
  return { min: Math.min(...values), final: values[values.length - 1] };
}

function buildAssessments(ms: MissionState, summary: Summary): Assessment[] {
  const food = minFood(ms);
  const lifeRating: Rating =
    summary.minLifeSupport >= 60 && summary.secondsShortage === 0
      ? 'optimal'
      : summary.minLifeSupport >= 30 && summary.secondsShortage < 60
        ? 'adequate'
        : 'critical';
  const foodRating: Rating =
    summary.harvests >= 2 && food.min >= 30 ? 'optimal' : summary.harvests >= 1 || food.min >= 15 ? 'adequate' : 'critical';
  const ratio = ms.scenario.exposureLimit > 0 ? summary.exposure / ms.scenario.exposureLimit : 1;
  const protectionRating: Rating = ratio <= 0.5 ? 'optimal' : ratio <= 0.85 ? 'adequate' : 'critical';

  return [
    {
      id: 'lifeSupport',
      rating: lifeRating,
      finding: lifeSupportFinding(summary.minLifeSupport, summary.secondsShortage, ms.scenario.depletionGrace),
      explanation: assessmentScience.lifeSupport,
      source: NASA_SOURCES.eclss,
    },
    {
      id: 'food',
      rating: foodRating,
      finding: foodFinding(summary.harvests, food.min, food.final),
      explanation: assessmentScience.food,
      source: NASA_SOURCES.plants,
    },
    {
      id: 'protection',
      rating: protectionRating,
      finding: protectionFinding(summary.exposure, ms.scenario.exposureLimit, summary.secondsSheltered, summary.design.shield),
      explanation: assessmentScience.protection,
      source: NASA_SOURCES.shielding,
    },
  ];
}

function timelineEntries(ms: MissionState): TimelineEntry[] {
  const commands: TimelineEntry[] = ms.log.map((entry, index) => ({
    t: entry.t,
    order: 1,
    index,
    kind: 'command',
    text: commandText(entry.cmd),
    rejected: !entry.ok,
    reason: entry.ok ? null : ((entry as { reason?: string }).reason ?? null),
  }));
  const events: TimelineEntry[] = ms.events.map((entry, index) => ({
    t: entry.t,
    order: 0,
    index,
    kind: 'event',
    text: entry.text,
    rejected: false,
    reason: null,
  }));
  return [...events, ...commands].sort((a, b) => a.t - b.t || a.order - b.order || a.index - b.index);
}

function resultText(summary: Summary): string {
  if (summary.phase === 'victory') return reportTexts.resultVictory;
  return reportTexts.resultFailed(summary.failure);
}

function formatSeconds(value: number): string {
  return `${Math.round(Number.isFinite(value) ? value : 0)} s`;
}

export function mountReport(root: HTMLElement, opts: ReportOptions): ReportHandle {
  const ms = opts.getState();
  const summary = summarize(ms);
  const failure: Failure | null = ms.failure;
  const cost = designCost(summary.design);

  const head = el(
    'header.r-hero',
    { class: summary.phase === 'victory' ? 'r-hero r-hero-victory' : 'r-hero r-hero-failed' },
    el('p.r-kicker', {}, summary.phase === 'victory' ? reportTexts.victoryKicker : reportTexts.failureKicker),
    el('h2', {}, summary.phase === 'victory' ? reportTexts.victoryHeadline : (failure?.title ?? reportTexts.failureKicker)),
    el(
      'p.r-lede',
      {},
      summary.phase === 'victory'
        ? reportTexts.victoryLede(summary.duration, summary.harvests)
        : reportTexts.failureLede(failure ? failure.explanation : ''),
    ),
    el('p.r-meta', {}, reportTexts.duration(summary.duration)),
  );

  const tradeoffs =
    summary.tradeoffs.length > 0
      ? el(
          'section.r-section',
          {},
          el('h3', {}, reportTexts.tradeoffsTitle),
          el('ul.r-list', {}, ...summary.tradeoffs.map((line: string) => el('li', {}, line))),
        )
      : null;

  const ledgerRows = readEnergyLedger(ms);
  let energySection: HTMLElement | null = null;
  if (ledgerRows) {
    const maxLost = Math.max(...ledgerRows.map((row) => row.lost));
    energySection = el(
      'section.r-section.r-energy',
      { 'aria-label': reportTexts.energyTitle },
      el('h3', {}, reportTexts.energyTitle),
      el(
        'ul.r-energy-list',
        {},
        ...ledgerRows.map((row) => {
          const width = maxLost > 0 ? Math.max(2, (row.lost / maxLost) * 100) : 0;
          return el(
            'li.r-energy-row',
            {},
            el('span.r-energy-label', {}, reportTexts.energyCauses[row.cause]),
            el(
              'span.r-energy-track',
              {},
              el('span.r-energy-bar', { style: `width:${width.toFixed(1)}%`, 'aria-hidden': 'true' }),
            ),
            el('span.r-energy-value.c-mono', {}, reportTexts.energyValue(row.lost)),
          );
        }),
      ),
      el('p.r-note', {}, reportTexts.energyNote),
    );
  }

  const chartHost = el('div.r-chart-scroll', { tabindex: 0, role: 'region', 'aria-label': reportTexts.chartTitle });
  chartHost.appendChild(renderChart(ms.samples, ms.events, ms.scenario));
  const samplesTable = el(
    'details.r-details',
    {},
    el('summary', {}, reportTexts.chartTable),
    el(
      'div.r-table-scroll',
      {},
      el(
        'table.r-table.r-samples-table',
        {},
        el(
          'thead',
          {},
          el(
            'tr',
            {},
            el('th', { scope: 'col' }, reportTexts.columns.time),
            el('th', { scope: 'col' }, reportTexts.columns.o2),
            el('th', { scope: 'col' }, reportTexts.columns.water),
            el('th', { scope: 'col' }, reportTexts.columns.food),
            el('th', { scope: 'col' }, reportTexts.columns.energy),
            el('th', { scope: 'col' }, reportTexts.columns.exposure),
          ),
        ),
        el(
          'tbody',
          {},
          ...ms.samples.map((sample) =>
            el(
              'tr',
              {},
              el('th', { scope: 'row' }, formatSeconds(sample.t)),
              el('td.c-mono', {}, `${Math.round(sample.o2)}`),
              el('td.c-mono', {}, `${Math.round(sample.water)}`),
              el('td.c-mono', {}, `${Math.round(sample.food)}`),
              el('td.c-mono', {}, `${Math.round(sample.energy)}`),
              el('td.c-mono', {}, `${sample.exposure.toFixed(1)}`),
            ),
          ),
        ),
      ),
    ),
  );
  const chartSection = el(
    'section.r-section.r-chart-section',
    {},
    el('h3', {}, reportTexts.chartTitle),
    el('p.r-hint', {}, reportTexts.chartHint),
    chartHost,
    samplesTable,
  );

  const entries = timelineEntries(ms);
  const timelineList = el('ol.r-timeline');
  const allButton = el('button.r-filter', { type: 'button', 'aria-pressed': 'true' }, reportTexts.timelineAll);
  const ownButton = el('button.r-filter', { type: 'button', 'aria-pressed': 'false' }, reportTexts.timelineOwn);
  function renderTimeline(onlyOwn: boolean): void {
    timelineList.replaceChildren();
    const visible = onlyOwn ? entries.filter((entry) => entry.kind === 'command') : entries;
    if (!visible.length) {
      timelineList.appendChild(el('li.r-timeline-empty', {}, reportTexts.timelineEmpty));
      return;
    }
    for (const entry of visible) {
      const chips = el(
        'span.r-timeline-chips',
        {},
        el('span.r-chip', {}, entry.kind === 'command' ? reportTexts.timelineCommand : reportTexts.timelineEvent),
        entry.rejected ? el('span.r-chip.r-chip-rejected', {}, reportTexts.rejected) : null,
      );
      const body = el(
        'div.r-timeline-body',
        {},
        el('strong', {}, entry.text),
        entry.rejected ? el('span.r-timeline-reason', {}, entry.reason ?? reportTexts.rejectedNoReason) : null,
      );
      timelineList.appendChild(
        el('li.r-timeline-item', { class: entry.rejected ? 'r-timeline-item is-rejected' : 'r-timeline-item' }, el('span.r-timeline-time.c-mono', {}, formatSeconds(entry.t)), body, chips),
      );
    }
    allButton.setAttribute('aria-pressed', String(!onlyOwn));
    ownButton.setAttribute('aria-pressed', String(onlyOwn));
    allButton.classList.toggle('is-active', !onlyOwn);
    ownButton.classList.toggle('is-active', onlyOwn);
  }
  allButton.addEventListener('click', () => renderTimeline(false));
  ownButton.addEventListener('click', () => renderTimeline(true));
  renderTimeline(false);
  const timelineSection = el(
    'section.r-section.r-timeline-section',
    {},
    el('h3', {}, reportTexts.timelineTitle),
    el('p.r-hint', {}, reportTexts.timelineHint),
    el('div.r-filter-row', { role: 'group' }, allButton, ownButton),
    timelineList,
  );

  let comparisonSection: HTMLElement;
  if (opts.previous) {
    const previous = opts.previous;
    const rows: { label: string; previous: string; current: string }[] = [
      { label: reportTexts.comparisonRows.result, previous: resultText(previous), current: resultText(summary) },
      {
        label: reportTexts.comparisonRows.exposure,
        previous: `${previous.exposure.toFixed(1)} u`,
        current: `${summary.exposure.toFixed(1)} u`,
      },
      {
        label: reportTexts.comparisonRows.harvests,
        previous: `${previous.harvests}`,
        current: `${summary.harvests}`,
      },
      {
        label: reportTexts.comparisonRows.minLifeSupport,
        previous: `${Math.round(previous.minLifeSupport)} %`,
        current: `${Math.round(summary.minLifeSupport)} %`,
      },
      {
        label: reportTexts.comparisonRows.lights,
        previous: `${Math.round(previous.secondsLightsReduced)} s`,
        current: `${Math.round(summary.secondsLightsReduced)} s`,
      },
      {
        label: reportTexts.comparisonRows.design,
        previous: designLabel(previous.design),
        current: designLabel(summary.design),
      },
    ];
    comparisonSection = el(
      'section.r-section.r-comparison',
      {},
      el('h3', {}, reportTexts.comparisonTitle),
      el(
        'div.r-table-scroll',
        {},
        el(
          'table.r-table',
          {},
          el(
            'thead',
            {},
            el(
              'tr',
              {},
              el('th', { scope: 'col' }, ''),
              el('th', { scope: 'col' }, reportTexts.comparisonPrevious),
              el('th', { scope: 'col' }, reportTexts.comparisonCurrent),
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
                el('td', {}, row.previous),
                el('td', {}, row.current),
              ),
            ),
          ),
        ),
      ),
    );
  } else {
    comparisonSection = el(
      'section.r-section.r-comparison',
      {},
      el('h3', {}, reportTexts.comparisonTitle),
      el('p.r-note', {}, reportTexts.comparisonEmpty),
    );
  }

  const designItems = (Object.keys(designItemLabels) as (keyof typeof designItemLabels)[])
    .map((key) => {
      const count =
        key === 'reserveO2'
          ? summary.design.reserves.o2
          : key === 'reserveWater'
            ? summary.design.reserves.water
            : key === 'reserveFood'
              ? summary.design.reserves.food
              : summary.design[key];
      return { label: designItemLabels[key], count };
    })
    .filter((item) => item.count > 0);
  const designSection = el(
    'section.r-section.r-design',
    {},
    el('h3', {}, reportTexts.designTitle),
    designItems.length
      ? el(
          'ul.r-list.r-design-list',
          {},
          ...designItems.map((item) => el('li', {}, `${item.label} × ${item.count}`)),
        )
      : el('p.r-note', {}, reportTexts.designBase),
    el('p.r-meta', {}, reportTexts.designBudget(cost, ms.scenario.budget, ms.scenario.budget - cost)),
    summary.design.shield >= 2 ? el('p.r-note', {}, reportTexts.shieldNote) : null,
  );

  const assessments = buildAssessments(ms, summary);
  const assessmentSection = el(
    'section.r-section.r-assessments',
    {},
    el('h3', {}, reportTexts.assessmentsTitle),
    ...assessments.map((assessment) =>
      el(
        'article.r-assessment',
        {},
        el('h4', {}, reportTexts.ratingTitles[assessment.id]),
        el('span.r-rating', { class: `r-rating r-rating-${assessment.rating}` }, ratingLabels[assessment.rating]),
        el('p', {}, assessment.finding),
        el('p.r-science', {}, assessment.explanation),
        el('a.r-source', { href: assessment.source.url, target: '_blank', rel: 'noreferrer' }, `${reportTexts.sourcePrefix} ${assessment.source.title}`),
      ),
    ),
  );

  const retry = el('button.r-primary', { type: 'button' }, reportTexts.retry);
  const menu = el('button.r-secondary', { type: 'button' }, reportTexts.menu);
  retry.addEventListener('click', () => opts.onRetry(summary.design));
  menu.addEventListener('click', () => opts.onMenu());
  const actions = el('footer.r-actions', {}, retry, menu);
  const disclaimer = el('p.r-disclaimer', {}, reportTexts.disclaimer);

  const container = el(
    'div.r-report',
    {},
    head,
    tradeoffs,
    energySection,
    chartSection,
    timelineSection,
    comparisonSection,
    designSection,
    assessmentSection,
    actions,
    disclaimer,
  );
  root.appendChild(container);

  return {
    destroy(): void {
      container.remove();
    },
  };
}
