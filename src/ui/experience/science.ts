import { el, setText } from '../dom';
import { onLangChange, t, type StringKey } from '../i18n';
import { clamp } from './logic';
import './experience.css';

export interface ScienceCapsule {
  id: string;
  titleKey: StringKey;
  whyKey: StringKey;
  sourceKey: StringKey;
}

export const SCIENCE_CAPSULES: readonly ScienceCapsule[] = [
  { id: 'regolith', titleKey: 'sciRegolithTitle', whyKey: 'sciRegolithWhy', sourceKey: 'sciSourceRegolith' },
  { id: 'polar', titleKey: 'sciPolarTitle', whyKey: 'sciPolarWhy', sourceKey: 'sciSourcePolar' },
  { id: 'shield', titleKey: 'sciShieldTitle', whyKey: 'sciShieldWhy', sourceKey: 'sciSourceShield' },
  { id: 'plants', titleKey: 'sciPlantsTitle', whyKey: 'sciPlantsWhy', sourceKey: 'sciSourcePlants' },
  { id: 'storm', titleKey: 'sciStormTitle', whyKey: 'sciStormWhy', sourceKey: 'sciSourceStorm' },
  { id: 'ice', titleKey: 'sciIceTitle', whyKey: 'sciIceWhy', sourceKey: 'sciSourceIce' },
];

export interface ScienceCapsulesOptions {
  initialIndex?: number;
  closable?: boolean;
  onClose?(): void;
}

export interface ScienceCapsulesHandle {
  readonly el: HTMLElement;
  show(index: number): void;
  next(): void;
  prev(): void;
  destroy(): void;
}

class ScienceCapsules implements ScienceCapsulesHandle {
  readonly el: HTMLElement;
  private index: number;
  private kicker: HTMLElement;
  private title: HTMLElement;
  private why: HTMLElement;
  private sourceLabel: HTMLElement;
  private source: HTMLElement;
  private counter: HTMLElement;
  private disclaimer: HTMLElement;
  private prevButton: HTMLButtonElement;
  private nextButton: HTMLButtonElement;
  private unsubscribe: () => void;

  constructor(private options: ScienceCapsulesOptions = {}) {
    this.index = clamp(Math.trunc(options.initialIndex ?? 0), 0, SCIENCE_CAPSULES.length - 1);
    this.kicker = el('span.x-sci__kicker', {}, t('sciTitle'));
    this.title = el('h3.x-sci__title');
    this.why = el('p.x-sci__why');
    this.sourceLabel = el('span.x-sci__source-label', {}, t('sciSource'));
    this.source = el('span.x-sci__source-value');
    this.counter = el('span.x-sci__counter');
    this.disclaimer = el('p.x-sci__disclaimer', {}, t('sciDisclaimer'));
    this.prevButton = el('button.x-sci__nav', {
      type: 'button',
      'aria-label': t('sciPrev'),
      title: t('sciPrev'),
      onclick: () => this.prev(),
    }, '‹');
    this.nextButton = el('button.x-sci__nav', {
      type: 'button',
      'aria-label': t('sciNext'),
      title: t('sciNext'),
      onclick: () => this.next(),
    }, '›');

    const head = el('div.x-sci__head', {},
      el('div.x-sci__mark', { 'aria-hidden': 'true' }, 'i'),
      el('div', {}, this.kicker, this.title),
    );
    const nav = el('div.x-sci__navbox', {}, this.prevButton, this.counter, this.nextButton);
    const root = el('section.x-sci', { 'aria-label': t('sciTitle') },
      head,
      el('div.x-sci__content', { 'aria-live': 'polite' }, this.why),
      el('div.x-sci__foot', {},
        el('div.x-sci__source', {}, this.sourceLabel, this.source),
        nav,
      ),
      this.disclaimer,
    );

    if (options.closable) {
      const close = el('button.x-sci__close', {
        type: 'button',
        'aria-label': t('sciClose'),
        title: t('sciClose'),
        onclick: () => {
          this.el.hidden = true;
          this.options.onClose?.();
        },
      }, '×');
      head.append(close);
    }

    this.el = root;
    this.unsubscribe = onLangChange(() => this.applyLabels());
    this.render();
  }

  show(index: number): void {
    this.index = clamp(Math.trunc(index), 0, SCIENCE_CAPSULES.length - 1);
    this.el.hidden = false;
    this.render();
  }

  next(): void {
    this.index = (this.index + 1) % SCIENCE_CAPSULES.length;
    this.render();
  }

  prev(): void {
    this.index = (this.index - 1 + SCIENCE_CAPSULES.length) % SCIENCE_CAPSULES.length;
    this.render();
  }

  destroy(): void {
    this.unsubscribe();
    this.el.remove();
  }

  private render(): void {
    const capsule = SCIENCE_CAPSULES[this.index];
    setText(this.title, t(capsule.titleKey));
    setText(this.why, t(capsule.whyKey));
    setText(this.source, t(capsule.sourceKey));
    setText(this.counter, t('sciCapsuleOf', { n: this.index + 1, total: SCIENCE_CAPSULES.length }));
  }

  private applyLabels(): void {
    this.el.setAttribute('aria-label', t('sciTitle'));
    setText(this.kicker, t('sciTitle'));
    setText(this.sourceLabel, t('sciSource'));
    setText(this.disclaimer, t('sciDisclaimer'));
    this.prevButton.setAttribute('aria-label', t('sciPrev'));
    this.prevButton.title = t('sciPrev');
    this.nextButton.setAttribute('aria-label', t('sciNext'));
    this.nextButton.title = t('sciNext');
    this.render();
  }
}

export function mountScienceCapsules(root: HTMLElement, options: ScienceCapsulesOptions = {}): ScienceCapsulesHandle {
  const capsules = new ScienceCapsules(options);
  root.append(capsules.el);
  return capsules;
}
