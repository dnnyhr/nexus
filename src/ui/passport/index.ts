import type { MissionState } from '../../engine/types';
import { el } from '../dom';
import { collectBadges } from './badges';
import { renderInsignia } from './insignia';
import './passport.css';

export { evaluateBadges, collectBadges, verifiedCompletion } from './badges';
export type { BadgeId, BadgeProgress, PassportEvidence } from './badges';

export interface PassportOptions {
  name: string;
  missions: readonly MissionState[];
  onBack(): void;
}

let passportCount = 0;

export function mountPassport(root: HTMLElement, opts: PassportOptions): { destroy(): void } {
  const badges = collectBadges(opts.missions);
  const controller = new AbortController();
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const id = `passport-${++passportCount}`;
  const article = el('article.astronaut-passport', { tabindex: -1, 'aria-labelledby': id },
    el('header', {}, el('h1', { id }, 'Pasaporte de Astronauta'),
      el('p.ap-name', {}, opts.name.trim() || 'Astronauta'),
      el('p', {}, `${badges.filter(badge => badge.unlocked).length} de ${badges.length} insignias desbloqueadas. Evidencia procedente de vuelos simulados.`)));
  for (const type of ['keydown', 'keyup', 'pointerdown', 'pointerup', 'click']) article.addEventListener(type, event => event.stopPropagation(), { signal: controller.signal });
  const back = el('button', { type: 'button' }, 'Volver al informe');
  back.addEventListener('click', () => {
    if (back.disabled) return;
    back.disabled = true;
    opts.onBack();
  }, { signal: controller.signal });
  article.append(back);
  if (!opts.missions.length) article.append(el('p', {}, 'Aún no hay vuelos registrados. Cada insignia muestra qué resultado debes demostrar.'));
  const list = el('ul.ap-badges');
  for (const badge of badges) {
    list.append(el(`li.${badge.unlocked ? 'ap-unlocked' : 'ap-locked'}`, {}, renderInsignia(badge.id, badge.unlocked),
      el('div', {}, el('h2', {}, badge.title), el('p.ap-status', {}, badge.unlocked ? 'Desbloqueada' : 'Bloqueada'),
        el('p', {}, badge.criterion), el('p.ap-evidence', {}, badge.evidence || 'Sin evidencia de un vuelo completado.'))));
  }
  article.append(list, el('p.ap-note', {}, 'Registro didáctico local basado en estado, métricas, comandos y eventos del motor. No constituye certificación profesional ni verificación externa. La conservación de vuelos depende del historial que proporcione la aplicación.'));
  root.append(article);
  article.focus({ preventScroll: true });
  return { destroy() {
    const restore = article.contains(document.activeElement);
    controller.abort();
    article.remove();
    if (restore && previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  } };
}
