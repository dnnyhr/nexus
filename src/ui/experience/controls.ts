import { el } from '../dom';
import { onLangChange, t } from '../i18n';
import './experience.css';

export type ControlsMode = 'keyboard' | 'touch';

export interface ControlsGuideOptions {
  initialMode?: 'auto' | ControlsMode;
  showPause?: boolean;
  autoShow?: boolean;
  persistKey?: string | null;
  onClose?(): void;
}

export interface ControlsGuideHandle {
  readonly el: HTMLElement;
  show(focus?: boolean): void;
  hide(): void;
  toggle(): void;
  isOpen(): boolean;
  destroy(): void;
}

let uid = 0;

class ControlsGuide implements ControlsGuideHandle {
  readonly el: HTMLElement;
  private titleId: string;
  private mode: ControlsMode;
  private visible = false;
  private closeButton: HTMLButtonElement | null = null;
  private keyboardPanel: HTMLElement | null = null;
  private touchPanel: HTMLElement | null = null;
  private tabs = new Map<ControlsMode, HTMLButtonElement>();
  private landscapeNote: HTMLElement | null = null;
  private autoTimer: number | null = null;
  private unsubscribe: () => void;

  constructor(private options: ControlsGuideOptions) {
    this.titleId = `x-guide-title-${++uid}`;
    const requested = options.initialMode ?? 'auto';
    this.mode = requested === 'auto'
      ? matchMedia('(pointer: coarse)').matches ? 'touch' : 'keyboard'
      : requested;
    this.el = el('section.x-guide', {
      hidden: true,
      role: 'dialog',
      'aria-modal': 'false',
      'aria-labelledby': this.titleId,
    });
    this.render();
    this.el.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        this.hide();
      } else if (event.key !== 'Tab') {
        event.stopPropagation();
      }
    });
    this.unsubscribe = onLangChange(() => this.render());
    if (options.autoShow && !this.dismissed()) {
      this.autoTimer = window.setTimeout(() => {
        this.autoTimer = null;
        this.show();
      }, 600);
    }
  }

  show(focus = false): void {
    this.visible = true;
    this.el.hidden = false;
    if (focus) this.closeButton?.focus();
  }

  hide(): void {
    this.visible = false;
    this.el.hidden = true;
    if (this.options.persistKey) {
      try {
        localStorage.setItem(this.options.persistKey, '1');
      } catch {
        // Storage can be blocked; the guide still closes for this session.
      }
    }
    this.options.onClose?.();
  }

  toggle(): void {
    if (this.visible) this.hide();
    else this.show(true);
  }

  isOpen(): boolean {
    return this.visible;
  }

  destroy(): void {
    if (this.autoTimer !== null) window.clearTimeout(this.autoTimer);
    this.unsubscribe();
    this.el.remove();
  }

  private dismissed(): boolean {
    if (!this.options.persistKey) return false;
    try {
      return localStorage.getItem(this.options.persistKey) === '1';
    } catch {
      return false;
    }
  }

  private render(): void {
    const title = el('h2.x-guide__title', { id: this.titleId }, t('ctlTitle'));
    this.closeButton = el('button.x-guide__close', { type: 'button', 'aria-label': t('ccClose'), onclick: () => this.hide() }, '×');
    const tabs = el('div.x-guide__tabs', { role: 'group', 'aria-label': t('ctlTitle') });
    this.tabs.clear();
    for (const mode of ['keyboard', 'touch'] as const) {
      const button = el('button.x-guide__tab', {
        type: 'button',
        'aria-pressed': String(this.mode === mode),
        onclick: () => this.setMode(mode),
      }, t(mode === 'keyboard' ? 'ctlKeyboard' : 'ctlTouch'));
      this.tabs.set(mode, button);
      tabs.append(button);
    }

    this.keyboardPanel = this.keyboard();
    this.touchPanel = this.touch();
    this.landscapeNote = el('span.x-guide__note', {}, t('ctlLandscape'));
    const dismiss = el('button.x-guide__dismiss', { type: 'button', onclick: () => this.hide() }, t('ctlDismiss'));

    this.el.replaceChildren(
      el('div.x-guide__head', {},
        el('div', {}, title, el('p.x-guide__intro', {}, t('ctlIntro'))),
        this.closeButton,
      ),
      tabs,
      this.keyboardPanel,
      this.touchPanel,
      el('p.x-guide__hint', {}, t('ctlActionHint')),
      el('div.x-guide__foot', {}, this.landscapeNote, dismiss),
    );
    this.applyMode();
  }

  private keyboard(): HTMLElement {
    const rows = [
      this.row([this.key('W'), this.key('A'), this.key('S'), this.key('D')], t('ctlMove')),
      this.row([this.mouse(), el('span.x-guide__plus', {}, '+'), this.verb(t('ctlDrag'))], t('ctlLook')),
      this.row([this.mouse(), this.verb(t('ctlWheel'))], t('ctlZoom')),
      this.row([this.key(t('ctlSpace'))], t('jump')),
      this.row([this.key('F')], t('ctlUse')),
      this.row([this.mouse(), this.verb(t('ctlRightClick'))], t('dig')),
      this.row([this.key('Q'), this.key('E')], t('ctlTurn')),
    ];
    if (this.options.showPause) rows.push(this.row([this.key('P')], t('ctlPauseKey')));
    return el('div.x-guide__panel', {}, ...rows);
  }

  private touch(): HTMLElement {
    return el('div.x-guide__panel', {},
      this.row([this.stick()], t('ctlMove')),
      this.row([this.verb(t('ctlDrag'))], t('ctlLook')),
      this.row([this.verb(t('ctlPrompt'))], t('ctlTouchPrompt')),
      this.row([el('span.x-guide__touchbtns', {}, el('span.x-guide__touchbtn', {}, t('jump')), el('span.x-guide__touchbtn', {}, t('dig')))], t('ctlButtons')),
    );
  }

  private row(keys: HTMLElement[], label: string): HTMLElement {
    return el('div.x-guide__row', {}, el('div.x-guide__keys', {}, ...keys), el('span.x-guide__label', {}, label));
  }

  private key(label: string): HTMLElement {
    return el('kbd.x-guide__key', {}, label);
  }

  private verb(label: string): HTMLElement {
    return el('span.x-guide__verb', {}, label);
  }

  private mouse(): HTMLElement {
    return el('span.x-guide__mouse', { 'aria-hidden': 'true' });
  }

  private stick(): HTMLElement {
    return el('span.x-guide__stick', { 'aria-hidden': 'true' }, el('i'));
  }

  private setMode(mode: ControlsMode): void {
    this.mode = mode;
    this.applyMode();
  }

  private applyMode(): void {
    if (this.keyboardPanel) this.keyboardPanel.hidden = this.mode !== 'keyboard';
    if (this.touchPanel) this.touchPanel.hidden = this.mode !== 'touch';
    for (const [mode, button] of this.tabs) {
      button.setAttribute('aria-pressed', String(mode === this.mode));
      button.classList.toggle('is-on', mode === this.mode);
    }
    if (this.landscapeNote) this.landscapeNote.hidden = this.mode !== 'touch';
  }
}

export function mountControlsGuide(root: HTMLElement, options: ControlsGuideOptions = {}): ControlsGuideHandle {
  const guide = new ControlsGuide(options);
  root.append(guide.el);
  return guide;
}
