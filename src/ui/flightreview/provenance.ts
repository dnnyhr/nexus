import snapshot from '../../data/snapshot.json';
import { SOURCES, type SpaceWeather } from '../../data/spaceweather';
import type { MissionState } from '../../engine/types';
import { el } from '../dom';

export function dateText(value: string | undefined): string {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Fecha no disponible';
  return new Date(value).toISOString().replace('T', ' ').replace('.000Z', ' UTC');
}

export function sourceLink(label: string, href: string): HTMLElement {
  try {
    const url = new URL(href);
    if (url.protocol === 'https:' && !url.username && !url.password) {
      return el('a', { href: url.href, target: '_blank', rel: 'noopener noreferrer' }, label);
    }
  } catch {}
  return el('span', {}, `${label} (enlace no disponible)`);
}

export function renderProvenance(mission: MissionState, weather?: SpaceWeather): HTMLElement {
  const section = el('section.fr-section', {}, el('h2', {}, 'Procedencia y fechas'));
  section.append(el('h3', {}, 'Observaciones solares de referencia'));
  const flares = mission.scenario.events.flatMap(event => event.inspiredBy ? [event.inspiredBy] : []);
  if (!flares.length) section.append(el('p', {}, 'Este escenario no declara una observación solar de referencia.'));
  for (const flare of flares) {
    const match = snapshot.flares.some(item => item.id === flare.id && item.peak === flare.peak && item.class === flare.class);
    section.append(el('p', {}, `NASA DONKI · ${flare.class} · pico observado: ${dateText(flare.peak)}. ID: ${flare.id}. `,
      sourceLink('Registro de fulguración', flare.link || SOURCES.donki)),
    el('p.fr-muted', {}, `Captura del snapshot utilizado: ${match ? dateText(snapshot.fetchedAt) : 'no documentada para este registro'}. La observación es histórica; la misión no representa un pronóstico en vivo.`));
  }
  if (weather) {
    section.append(el('h3', {}, 'Contexto adicional recibido'),
      el('p', {}, `${weather.live ? 'Consulta a fuentes remotas' : 'Snapshot local'} · obtenido: ${dateText(weather.fetchedAt)}. `,
        sourceLink('NOAA GOES, flujo de protones ≥10 MeV', SOURCES.goes)),
      el('p', {}, `Observación: ${dateText(weather.protons.time)} · ${Number.isFinite(weather.protons.flux) ? weather.protons.flux : 'sin registro'} pfu. Este contexto no modifica la cronología fija ni acredita su uso como entrada del motor.`));
  }
  section.append(el('h3', {}, 'Resultados de simulación'),
    el('p', {}, `Escenario ${mission.scenario.id} · semilla ${mission.scenario.seed} · intervalo simulado 0–${mission.t} s. Recursos, decisiones, cosechas y exposición provienen del motor y sus registros. Son resultados simulados, no mediciones de una base lunar.`),
    el('p', {}, 'La clase de rayos X y el flujo de protones son magnitudes distintas. No se convierten aquí en dosis lunar. Exposición en unidades didácticas (u), sin dosis médicas ni afiliación NASA.'));
  return section;
}
