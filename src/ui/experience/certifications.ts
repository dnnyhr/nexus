import { el } from '../dom';
import { onLangChange, t, type StringKey } from '../i18n';
import {
  certificationStatus,
  type CertificationState,
  type CertificationStatus,
  type MissionStepStatus,
} from './certificationStatus';

export { CERTIFICATIONS, certificationStatus, missionTitleKey } from './certificationStatus';
export type {
  CertificationId,
  CertificationSpec,
  CertificationState,
  CertificationStatus,
  MissionStep,
  MissionStepStatus,
} from './certificationStatus';

const STEP_STATUS: Record<MissionStepStatus, StringKey> = {
  done: 'certMissionDone',
  current: 'certMissionCurrent',
  pending: 'certMissionPending',
};

const CERT_STATUS: Record<CertificationState, StringKey> = {
  done: 'certComplete',
  current: 'certCurrent',
  pending: 'certPending',
};

export interface CertificationsViewOptions {
  onSelect?(index: number): void;
}

export class CertificationsView {
  readonly el = el('div.x-cert');
  private missionIndex = 0;
  private unsubscribe: () => void;

  constructor(private options: CertificationsViewOptions = {}) {
    this.unsubscribe = onLangChange(() => this.render());
    this.render();
  }

  update(missionIndex: number): void {
    if (missionIndex === this.missionIndex) return;
    this.missionIndex = missionIndex;
    this.render();
  }

  destroy(): void {
    this.unsubscribe();
    this.el.remove();
  }

  private render(): void {
    this.el.setAttribute('aria-label', t('ccCertifications'));
    this.el.replaceChildren(
      el('div.x-cert__head', {},
        el('div', {},
          el('h2.x-cert__heading', {}, t('ccCertifications')),
          el('p.x-cert__hint', {}, t('ccCertificationsHint')),
        ),
      ),
      el('div.x-cert__grid', {}, ...certificationStatus(this.missionIndex).map((status, i) => this.group(status, i))),
    );
  }

  private group(status: CertificationStatus, order: number): HTMLElement {
    const { spec, completed, total, state } = status;
    const count = t('certMissions', { done: completed, total });
    const bar = el('div.x-cert__bar', {
      role: 'progressbar',
      'aria-valuemin': 0,
      'aria-valuemax': total,
      'aria-valuenow': completed,
      'aria-valuetext': count,
    });
    const fill = el('i');
    fill.style.width = `${(completed / total) * 100}%`;
    bar.append(fill);

    const missions = el('ol.x-cert__missions', {},
      ...status.missions.map((step) => {
        const content = [
          el('span.x-cert__dot', { 'aria-hidden': 'true' }),
          el('span.x-cert__index', {}, String(step.index + 1).padStart(2, '0')),
          el('span.x-cert__name', {}, t(step.titleKey)),
          el('span.x-sr-only', {}, t(STEP_STATUS[step.status])),
        ];
        const attrs: Record<string, string | number> = { 'data-status': step.status };
        if (step.status === 'current') attrs['aria-current'] = 'step';
        if (this.options.onSelect) {
          return el('li', {},
            el('button.x-cert__mission', {
              ...attrs,
              type: 'button',
              onclick: () => this.options.onSelect?.(step.index),
            }, ...content),
          );
        }
        return el('li', { ...attrs }, el('div.x-cert__mission', {}, ...content));
      }),
    );

    return el(`section.x-cert__group.x-cert__group--${spec.id}`, { 'data-state': state },
      el('div.x-cert__group-head', {},
        el('div.x-cert__title', {},
          el('span.x-cert__num', { 'aria-hidden': 'true' }, String(order + 1).padStart(2, '0')),
          el('div', {},
            el('h3', {}, t(spec.titleKey)),
            el('p', {}, t(spec.descriptionKey)),
          ),
        ),
        el('div.x-cert__score', {},
          el('span.x-cert__state', {}, t(CERT_STATUS[state])),
          el('span.x-cert__count', {}, count),
        ),
      ),
      bar,
      missions,
    );
  }
}

export function mountCertifications(root: HTMLElement, options: CertificationsViewOptions = {}): CertificationsView {
  const view = new CertificationsView(options);
  root.append(view.el);
  return view;
}
