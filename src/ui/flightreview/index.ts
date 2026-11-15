import type { Design, MissionState } from '../../engine/types';
import type { SpaceWeather } from '../../data/spaceweather';
import { el } from '../dom';
import { renderResourceChart } from './chart';
import { commandText, comparisonMatches, numberText, phaseText, projectionValues, resourceRows, validSamples, type FlightComparison } from './model';
import { renderProvenance } from './provenance';
import './review.css';

export { compareFlightPlans, comparisonMatches } from './model';
export type { FlightComparison, ProjectMission } from './model';

export interface FlightReviewOptions {
  getState(): MissionState;
  comparison?: FlightComparison;
  weather?: SpaceWeather;
  onRetry(design: Design): void;
  onMenu(): void;
  onPassport?(): void;
}

let reviewCount = 0;

function table(caption: string, headings: string[], rows: (string | Node)[][]): HTMLElement {
  const body = el('tbody');
  for (const values of rows) body.append(el('tr', {}, ...values.map((value, i) => el(i === 0 ? 'th' : 'td', i === 0 ? { scope: 'row' } : {}, value))));
  return el('div.fr-table-wrap', { tabindex: 0, role: 'region', 'aria-label': caption }, el('table', {},
    el('caption', {}, caption), el('thead', {}, el('tr', {}, ...headings.map(label => el('th', { scope: 'col' }, label)))), body));
}

function renderComparison(mission: MissionState, comparison?: FlightComparison): HTMLElement {
  const section = el('section.fr-section', {}, el('h2', {}, 'Comparar alternativas'));
  if (!comparison) {
    section.append(el('p', {}, 'Sin comparación calculada desde un checkpoint común. En el siguiente intento, pausa y proyecta dos configuraciones antes de decidir. No se estiman resultados de vuelos que no se ejecutaron.'));
    return section;
  }
  if (!comparisonMatches(mission, comparison)) {
    section.append(el('p', {}, 'Comparación omitida: escenario, diseño o historial no coincide con este vuelo. Vuelve a calcularla desde un checkpoint del mismo intento.'));
    return section;
  }
  const baseline = projectionValues(comparison.baseline, comparison.fromT);
  const alternative = projectionValues(comparison.alternative, comparison.fromT);
  const horizon = comparison.horizon.kind === 'seconds' ? `${numberText(comparison.horizon.value, 's')} adicionales`
    : comparison.horizon.kind === 'endOfDarkness' ? 'fin de la oscuridad' : 'fin de misión';
  section.append(el('p', {}, `Proyecciones simuladas desde t=${numberText(comparison.fromT, 's')} hasta ${horizon}. Mismo checkpoint, escenario, horizonte solicitado y reglas. No son dos vuelos observados.`),
    el('p', {}, 'Mantiene configuración; no supone riegos, ajustes ni cosechas manuales futuros. Un fallo puede detener una proyección antes del horizonte.'),
    table('Alternativas calculadas', ['Indicador', 'Mantener configuración', 'Aplicar alternativa ahora'], [
      ['Resultado', phaseText(baseline.phase), phaseText(alternative.phase)],
      ['Instante alcanzado', numberText(baseline.until, 's'), numberText(alternative.until, 's')],
      ['Energía final', numberText(baseline.energy, '%'), numberText(alternative.energy, '%')],
      ['Soporte vital mínimo muestreado', numberText(baseline.minLifeSupport, '%'), numberText(alternative.minLifeSupport, '%')],
      ['Exposición final', numberText(baseline.exposure, 'u'), numberText(alternative.exposure, 'u')],
      ['Cosechas del intervalo proyectado', String(baseline.harvests), String(alternative.harvests)],
      ['Motivo de fallo', comparison.baseline.failure?.explanation ?? 'Sin fallo registrado', comparison.alternative.failure?.explanation ?? 'Sin fallo registrado'],
    ]));
  const plan = el('ul');
  for (const command of comparison.plan) plan.append(el('li', {}, commandText(command)));
  section.append(el('h3', {}, 'Plan de la alternativa'), comparison.plan.length ? plan : el('p', {}, 'Plan vacío: ambas columnas mantienen configuración.'));
  for (const [label, projection] of [['Mantener configuración', comparison.baseline], ['Alternativa', comparison.alternative]] as const) {
    for (const rejected of projection.rejected) section.append(el('p', {}, `${label} · comando rechazado: ${commandText(rejected.cmd)}. ${rejected.reason}`));
  }
  return section;
}

export function mountFlightReview(root: HTMLElement, opts: FlightReviewOptions): { destroy(): void } {
  const mission = structuredClone(opts.getState());
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const controller = new AbortController();
  const id = `flight-review-${++reviewCount}`;
  const article = el('article.flight-review', { tabindex: -1, 'aria-labelledby': id },
    el('header.fr-header', {}, el('h1', { id }, 'Flight Readiness Review'),
      el('p.fr-result', {}, phaseText(mission.phase)),
      el('p', {}, `${numberText(mission.t, 's')} de ${numberText(mission.scenario.duration, 's')} simulados · escenario ${mission.scenario.id}`)));
  for (const type of ['keydown', 'keyup', 'pointerdown', 'pointerup', 'click']) article.addEventListener(type, event => event.stopPropagation(), { signal: controller.signal });
  let leaving = false;
  const actions = el('nav.fr-actions', { 'aria-label': 'Continuar después del vuelo' });
  const action = (label: string, callback: () => void) => {
    const button = el('button', { type: 'button' }, label);
    button.addEventListener('click', () => {
      if (leaving) return;
      leaving = true;
      for (const item of actions.querySelectorAll('button')) item.disabled = true;
      callback();
    }, { signal: controller.signal });
    actions.append(button);
  };
  if (mission.phase !== 'running') action('Rediseñar y reintentar', () => opts.onRetry(structuredClone(mission.design)));
  if (opts.onPassport) action('Ver Pasaporte de Astronauta', opts.onPassport);
  action('Volver al menú', opts.onMenu);
  article.append(actions);
  if (mission.failure) article.append(el('p.fr-failure', {}, `${mission.failure.title} · t=${numberText(mission.failure.t, 's')}. ${mission.failure.explanation}`));
  if (mission.phase === 'running') article.append(el('p', {}, 'El vuelo sigue en curso. Evaluación e insignias definitivas disponibles al finalizar.'));

  const resources = el('section.fr-section', {}, el('h2', {}, 'Recursos y continuidad'),
    table('Reservas simuladas, porcentaje de capacidad', ['Recurso', 'Inicial', 'Final', 'Mínimo muestreado'], resourceRows(mission).map(row => [
      row.label, numberText(row.initial, '%'), numberText(row.final, '%'), numberText(row.sampledMinimum, '%'),
    ])), el('p.fr-muted', {}, 'Los mínimos por recurso proceden de muestras; pueden omitir variaciones entre muestras. El mínimo vital global y las duraciones siguientes son acumulados del motor por paso.'),
    el('dl.fr-metrics', {},
      el('dt', {}, 'Mínimo vital global'), el('dd', {}, numberText(mission.metrics.minLifeSupport, '%')),
      el('dt', {}, 'Potencia insuficiente'), el('dd', {}, numberText(mission.metrics.secondsShortage, 's')),
      el('dt', {}, 'Luces reducidas por decisión'), el('dd', {}, numberText(mission.metrics.secondsLightsReduced, 's')),
      el('dt', {}, 'Tiempo en refugio'), el('dd', {}, numberText(mission.metrics.secondsSheltered, 's')),
      el('dt', {}, 'Exposición recibida'), el('dd', {}, `${numberText(mission.exposure, 'u')} / límite ${numberText(mission.scenario.exposureLimit, 'u')}`),
      el('dt', {}, 'Cosechas registradas'), el('dd', {}, String(mission.game.stats.harvests))));
  article.append(resources);

  const history = el('section.fr-section', {}, el('h2', {}, 'Evolución de las reservas'), renderResourceChart(mission.samples),
    el('p.fr-legend', {}, 'Oxígeno: línea continua · Agua: trazos · Alimentos: puntos · Energía: trazo y punto. Exposición se consulta en su propia columna, en u.'));
  const samples = el('details', {}, el('summary', {}, 'Consultar tabla de muestras'));
  samples.append(table('Muestras del motor', ['t (s)', 'O₂ (%)', 'Agua (%)', 'Alimentos (%)', 'Energía (%)', 'Exposición (u)'], validSamples(mission.samples).map(sample => [
    numberText(sample.t), numberText(sample.o2), numberText(sample.water), numberText(sample.food), numberText(sample.energy), numberText(sample.exposure),
  ])));
  history.append(samples);
  article.append(history);

  const decisions = el('section.fr-section', {}, el('h2', {}, 'Decisiones y consecuencias registradas'));
  if (mission.log.length) decisions.append(table('Comandos en orden de ejecución', ['Orden', 't (s)', 'Decisión', 'Aplicación'], mission.log.map((entry, i) => [
    String(i + 1), numberText(entry.t), commandText(entry.cmd), entry.ok ? 'Aceptada por motor' : 'Rechazada; sin efecto de ese comando',
  ])));
  else decisions.append(el('p', {}, 'Sin comandos registrados.'));
  const events = el('ol.fr-timeline');
  for (const event of mission.events) events.append(el('li', {}, el('span.fr-time', {}, numberText(event.t, 's')), ` ${event.text}`));
  decisions.append(events, el('p.fr-muted', {}, 'Orden temporal no demuestra causalidad individual. No se atribuye un cambio a una decisión sin una comparación calculada.'));
  article.append(decisions, renderComparison(mission, opts.comparison));

  article.append(el('section.fr-section', {}, el('h2', {}, 'Aprendizajes STEM para el próximo diseño'),
    el('h3', {}, 'Energía: potencia y reserva son distintas'),
    el('p', {}, `Potencia insuficiente durante ${numberText(mission.metrics.secondsShortage, 's')}; energía final ${numberText(resourceRows(mission).find(row => row.key === 'energy')?.final, '%')}. Una batería aumenta capacidad de almacenamiento; no genera potencia solar. ¿Qué cambiarías para atravesar la oscuridad?`),
    el('h3', {}, 'Cultivo: un sistema acoplado'),
    el('p', {}, `${mission.game.stats.harvests} cosechas; luces reducidas por decisión durante ${numberText(mission.metrics.secondsLightsReduced, 's')}. Luz, agua, temperatura y energía interactúan. Este registro no demuestra cuánto se habría retrasado una cosecha con otra decisión.`),
    el('h3', {}, 'Protección: medir restricciones y costes'),
    el('p', {}, `Refugio durante ${numberText(mission.metrics.secondsSheltered, 's')}; exposición ${numberText(mission.exposure, 'u')}. El blindaje y el tiempo fuera del refugio afectan el modelo. ¿Qué producción suspendiste al refugiarte y qué reserva necesitabas?`),
    el('h3', {}, 'Comparar antes de concluir'),
    el('p', {}, 'Formula una hipótesis, cambia una decisión y compara desde el mismo checkpoint y horizonte. Si una alternativa falla antes, compara también el instante alcanzado. Un resultado distinto puede depender de varias variables.')),
    renderProvenance(mission, opts.weather));
  root.append(article);
  article.focus({ preventScroll: true });
  return { destroy() {
    const restore = article.contains(document.activeElement);
    controller.abort();
    article.remove();
    if (restore && previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  } };
}
