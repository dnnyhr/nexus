import { currentMission } from '../../game/missions';
import type { GameState } from '../../game/state';
import { el, setText } from '../dom';
import { getLang, getPlayerName, onLangChange, setLang, t, type StringKey } from '../i18n';
import { CertificationsView, missionTitleKey } from './certifications';
import { LAB_SCENARIOS, type LabScenarioId } from './labs';
import { mountScienceCapsules, SCIENCE_CAPSULES, type ScienceCapsulesHandle } from './science';
import './experience.css';

export type ControlCenterView = 'home' | 'lab';

export interface ControlCenterOptions {
  getGame(): GameState;
  hasFreeSave(): boolean;
  missionReady: boolean;
  labReady: boolean;
  onCadet(): void;
  onSimulator(): void;
  onLab(id: LabScenarioId): void;
  onOpenControls?(): void;
  onClose?(): void;
  initialOpen?: boolean;
  closable?: boolean;
}

export interface ControlCenterHandle {
  readonly el: HTMLElement;
  open(): void;
  close(): void;
  toggle(): void;
  isOpen(): boolean;
  refresh(): void;
  showView(view: ControlCenterView): void;
  destroy(): void;
}

interface CardOptions {
  order: string;
  tone: 'cadet' | 'simulator' | 'lab';
  kickerKey: StringKey;
  titleKey: StringKey;
  descriptionKey: StringKey;
  metaKey: StringKey;
  ready: boolean;
  actionLabel(): string;
  onAction(): void;
  disabled?: boolean;
  noteKey?: StringKey;
  stats?: HTMLElement[];
}

class ControlCenter implements ControlCenterHandle {
  readonly el: HTMLElement;
  private view: ControlCenterView = 'home';
  private visible = false;
  private lastFocus: Element | null = null;
  private dynamic: (() => void)[] = [];
  private certifications: CertificationsView | null = null;
  private science: ScienceCapsulesHandle | null = null;
  private pendingFocus: string | null = null;
  private timer: number;
  private unsubscribe: () => void;

  constructor(private options: ControlCenterOptions) {
    this.el = el('div.x-cc', {
      hidden: true,
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'x-cc-title',
      tabindex: -1,
    });
    this.el.addEventListener('keydown', (event) => this.handleKey(event));
    this.unsubscribe = onLangChange(() => this.render());
    this.render();
    this.timer = window.setInterval(() => {
      if (this.visible) this.refresh();
    }, 1000);
  }

  open(): void {
    if (this.visible) return;
    this.visible = true;
    this.lastFocus = document.activeElement;
    this.view = 'home';
    this.render();
    this.el.hidden = false;
    document.body.classList.add('x-cc-open');
    this.el.focus({ preventScroll: true });
    this.el.scrollTop = 0;
  }

  close(): void {
    if (!this.visible) return;
    this.visible = false;
    this.el.hidden = true;
    this.view = 'home';
    document.body.classList.remove('x-cc-open');
    if (this.lastFocus instanceof HTMLElement && this.lastFocus.isConnected) this.lastFocus.focus();
    this.options.onClose?.();
  }

  toggle(): void {
    if (this.visible) this.close();
    else this.open();
  }

  isOpen(): boolean {
    return this.visible;
  }

  refresh(): void {
    if (!this.visible) return;
    for (const update of this.dynamic) update();
  }

  showView(view: ControlCenterView): void {
    if (view === this.view) return;
    this.view = view;
    this.render();
    const target = this.el.querySelector<HTMLElement>('.x-cc__back') ?? this.el;
    target.focus({ preventScroll: true });
    this.el.scrollTop = 0;
  }

  destroy(): void {
    window.clearInterval(this.timer);
    this.unsubscribe();
    this.certifications?.destroy();
    this.science?.destroy();
    document.body.classList.remove('x-cc-open');
    this.el.remove();
  }

  private handleKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      if (this.view === 'lab') {
        this.showView('home');
        return;
      }
      if (this.options.closable !== false) this.close();
      return;
    }
    if (event.key === 'Tab') {
      const focusable = this.focusable();
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
      event.stopPropagation();
      return;
    }
    event.stopPropagation();
  }

  private focusable(): HTMLElement[] {
    return [...this.el.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
      .filter((node) => !node.hidden && node.offsetParent !== null);
  }

  private render(): void {
    this.certifications?.destroy();
    this.certifications = null;
    this.science?.destroy();
    this.science = null;
    this.dynamic = [];

    const panel = el('div.x-cc__panel', {},
      this.header(),
      this.view === 'home' ? this.homeBody() : this.labBody(),
      this.footer(),
    );
    this.el.replaceChildren(panel);
    this.refresh();

    if (this.pendingFocus) {
      const key = this.pendingFocus;
      this.pendingFocus = null;
      this.el.querySelector<HTMLElement>(`[data-focus="${key}"]`)?.focus({ preventScroll: true });
    }
  }

  private header(): HTMLElement {
    const languages = (['es', 'en'] as const).map((lang) => el('button.x-cc__lang', {
      type: 'button',
      'aria-pressed': String(getLang() === lang),
      'data-focus': `lang-${lang}`,
      onclick: () => {
        if (getLang() === lang) return;
        this.pendingFocus = `lang-${lang}`;
        setLang(lang);
      },
    }, lang.toUpperCase()));

    const tools = el('div.x-cc__tools', {},
      el('span.x-cc__profile', { title: t('ccProfile') }, `${t('ccProfile')} · ${getPlayerName() || t('defaultName')}`),
      el('div.x-cc__langs', { role: 'group', 'aria-label': t('ccLanguage') }, ...languages),
    );

    if (this.options.closable !== false) {
      tools.append(el('button.x-cc__close', {
        type: 'button',
        'aria-label': t('ccClose'),
        title: t('ccClose'),
        'data-focus': 'close',
        onclick: () => this.close(),
      }, '×'));
    }

    return el('header.x-cc__head', {},
      el('div.x-cc__brand', {},
        el('span.x-cc__kicker', {}, t('ccKicker')),
        el('h1.x-cc__title', { id: 'x-cc-title' }, 'NEXUS', el('span', {}, t('ccTitle'))),
        el('p.x-cc__subtitle', {}, t('ccSubtitle')),
      ),
      tools,
    );
  }

  private homeBody(): HTMLElement {
    const game = this.options.getGame();
    const missionValue = el('span.x-cc__stat-value.x-cc__stat-value--wide');
    const goalValue = el('span.x-cc__stat-sub');
    const materialsValue = el('span.x-cc__stat-value');
    const crewValue = el('span.x-cc__stat-value');
    const saveValue = el('span.x-cc__stat-value');

    const stats = [
      el('div.x-cc__stat.x-cc__stat--wide', {},
        el('span.x-cc__stat-label', {}, t('ccProgressTitle')),
        missionValue,
        goalValue,
      ),
      el('div.x-cc__stat', {}, el('span.x-cc__stat-label', {}, t('materials')), materialsValue),
      el('div.x-cc__stat', {}, el('span.x-cc__stat-label', {}, t('crewHealth')), crewValue),
      el('div.x-cc__stat', {}, el('span.x-cc__stat-label', {}, t('ccSaved')), saveValue),
    ];

    this.dynamic.push(() => {
      const state = this.options.getGame();
      const mission = currentMission(state);
      const progress = mission.progress(state);
      setText(missionValue, `${t('missionN', { n: String(state.mission + 1).padStart(2, '0') })} · ${t(missionTitleKey(mission))}`);
      setText(goalValue, t(`m_${mission.id}_goal` as StringKey, { have: progress.have, need: progress.need }));
      setText(materialsValue, String(Math.floor(state.res.materials)));
      setText(crewValue, `${Math.round(state.crewHealth)}%`);
      setText(saveValue, this.options.hasFreeSave() ? t('ccSaved') : t('ccNoSave'));
      saveValue.dataset.ready = String(this.options.hasFreeSave());
      this.certifications?.update(state.mission);
    });

    const cadet = this.card({
      order: '01',
      tone: 'cadet',
      kickerKey: 'ccCadet',
      titleKey: 'ccCadetTitle',
      descriptionKey: 'ccCadetDesc',
      metaKey: 'ccCadetMeta',
      ready: this.options.missionReady,
      actionLabel: () => t('ccStart'),
      onAction: () => this.launch(() => this.options.onCadet()),
      disabled: !this.options.missionReady,
      noteKey: this.options.missionReady ? undefined : 'ccNotReadyHint',
    });

    const simulator = this.card({
      order: '02',
      tone: 'simulator',
      kickerKey: 'ccSimulator',
      titleKey: 'ccSimulatorTitle',
      descriptionKey: 'ccSimulatorDesc',
      metaKey: 'ccSimulatorMeta',
      ready: true,
      actionLabel: () => t(this.options.hasFreeSave() ? 'ccContinue' : 'ccOpen'),
      onAction: () => this.launch(() => this.options.onSimulator()),
      stats,
    });

    const lab = this.card({
      order: '03',
      tone: 'lab',
      kickerKey: 'ccLab',
      titleKey: 'ccLabTitle',
      descriptionKey: 'ccLabDesc',
      metaKey: 'ccLabMeta',
      ready: this.options.labReady,
      actionLabel: () => t('ccOpen'),
      onAction: () => this.showView('lab'),
    });

    const indexCadet = el('button.x-cc__index-item.x-cc__index-item--cadet', {
      type: 'button',
      onclick: () => {
        if (this.options.missionReady) this.launch(() => this.options.onCadet());
      },
    }, el('span', { 'aria-hidden': 'true' }, '01'), t('ccCadet'));
    indexCadet.disabled = !this.options.missionReady;
    const indexSimulator = el('button.x-cc__index-item.x-cc__index-item--simulator', {
      type: 'button',
      onclick: () => this.launch(() => this.options.onSimulator()),
    }, el('span', { 'aria-hidden': 'true' }, '02'), t('ccSimulator'));
    const indexLab = el('button.x-cc__index-item.x-cc__index-item--lab', {
      type: 'button',
      onclick: () => this.showView('lab'),
    }, el('span', { 'aria-hidden': 'true' }, '03'), t('ccLab'));
    const index = el('nav.x-cc__index', { 'aria-label': t('ccTitle') }, indexCadet, indexSimulator, indexLab);

    const certBox = el('div.x-cc__certifications');
    this.certifications = new CertificationsView();
    this.certifications.update(game.mission);
    certBox.append(this.certifications.el);

    const scienceBox = el('div.x-cc__science');
    this.science = mountScienceCapsules(scienceBox, {
      initialIndex: game.mission % SCIENCE_CAPSULES.length,
    });

    return el('div.x-cc__body', {},
      el('section.x-cc__access', { 'aria-label': t('ccTitle') }, index, cadet, simulator, lab),
      el('div.x-cc__lower', {}, certBox, scienceBox),
    );
  }

  private labBody(): HTMLElement {
    const back = el('button.x-cc__back', {
      type: 'button',
      onclick: () => this.showView('home'),
    }, `‹ ${t('ccBack')}`);

    const head = el('div.x-cc__viewhead', {},
      back,
      el('div', {},
        el('h2.x-cc__viewtitle', {}, t('labTitle')),
        el('p.x-cc__viewsub', {}, t('labSubtitle')),
      ),
    );

    const ready = this.options.labReady;
    const banner = ready
      ? el('p.x-cc__note', {}, t('ccLabIntro'))
      : el('p.x-cc__note.x-cc__note--warn', {}, t('ccLabLocked'));

    const grid = el('div.x-cc__labgrid', {},
      ...LAB_SCENARIOS.map((scenario, index) => {
        const launch = el('button.x-cc__action', {
          type: 'button',
          onclick: () => {
            if (!ready) return;
            this.launch(() => this.options.onLab(scenario.id));
          },
        }, t('ccLabLaunch'));
        launch.disabled = !ready;
        return el(`article.x-cc__lab.x-cc__lab--${scenario.accent}`, {},
          el('div.x-cc__lab-top', {},
            el('span.x-cc__num', { 'aria-hidden': 'true' }, String(index + 1).padStart(2, '0')),
            el('span.x-cc__lab-fixed', {}, t('ccLabFixed', { s: scenario.seconds })),
          ),
          el('h3.x-cc__lab-title', {}, t(scenario.titleKey)),
          el('p.x-cc__lab-desc', {}, t(scenario.descriptionKey)),
          el('div.x-cc__lab-goal', {},
            el('span.x-cc__stat-label', {}, t('ccLabGoal')),
            el('span', {}, t(scenario.goalKey)),
          ),
          launch,
          ready ? null : el('p.x-cc__note.x-cc__note--warn', {}, t('ccLabLocked')),
        );
      }),
    );

    const scienceBox = el('div.x-cc__science');
    this.science = mountScienceCapsules(scienceBox, {
      initialIndex: this.options.getGame().mission % SCIENCE_CAPSULES.length,
    });

    return el('div.x-cc__body.x-cc__body--lab', {},
      head,
      banner,
      grid,
      el('p.x-cc__teacher', {}, t('ccLabTeacher')),
      scienceBox,
    );
  }

  private footer(): HTMLElement {
    const coarse = matchMedia('(pointer: coarse)').matches;
    const quick = coarse
      ? el('div.x-cc__quick', {},
        el('span.x-cc__quick-label', {}, t('ccControlsTitle')),
        el('span.x-cc__quick-text', {}, t('ccControlsTouch')),
      )
      : el('div.x-cc__quick', {},
        el('span.x-cc__quick-label', {}, t('ccControlsTitle')),
        el('div.x-cc__quick-keys', {},
          el('kbd.x-cc__key', {}, 'W'), el('kbd.x-cc__key', {}, 'A'), el('kbd.x-cc__key', {}, 'S'), el('kbd.x-cc__key', {}, 'D'),
          el('span.x-cc__quick-text', {}, t('ctlMove')),
          el('kbd.x-cc__key', {}, t('ctlSpace')),
          el('span.x-cc__quick-text', {}, t('jump')),
          el('kbd.x-cc__key', {}, 'F'),
          el('span.x-cc__quick-text', {}, t('ctlUse')),
          el('span.x-guide__mouse', { 'aria-hidden': 'true' }),
          el('span.x-cc__quick-text', {}, t('dig')),
        ),
      );
    const guide = this.options.onOpenControls
      ? el('button.x-cc__guide', {
        type: 'button',
        onclick: () => this.options.onOpenControls?.(),
      }, t('ccShowGuide'))
      : null;
    return el('footer.x-cc__foot', {}, quick, guide);
  }

  private card(options: CardOptions): HTMLElement {
    const status = el('span.x-cc__status', { 'data-ready': String(options.ready) },
      t(options.ready ? 'ccReady' : 'ccNotReady'),
    );
    const action = el('button.x-cc__action', {
      type: 'button',
      onclick: () => {
        if (options.disabled) return;
        options.onAction();
      },
    }, options.actionLabel());
    action.disabled = options.disabled === true;
    this.dynamic.push(() => setText(action, options.actionLabel()));

    return el(`article.x-cc__card.x-cc__card--${options.tone}`, {},
      el('div.x-cc__card-top', {},
        el('span.x-cc__num', { 'aria-hidden': 'true' }, options.order),
        status,
      ),
      el('span.x-cc__kicker', {}, t(options.kickerKey)),
      el('h2.x-cc__card-title', {}, t(options.titleKey)),
      el('p.x-cc__card-desc', {}, t(options.descriptionKey)),
      el('span.x-cc__meta', {}, t(options.metaKey)),
      options.stats && options.stats.length ? el('div.x-cc__stats', {}, ...options.stats) : null,
      el('div.x-cc__card-foot', {}, action),
      options.noteKey ? el('p.x-cc__note', {}, t(options.noteKey)) : null,
    );
  }

  private launch(action: () => void): void {
    this.close();
    action();
  }
}

export function mountControlCenter(root: HTMLElement, options: ControlCenterOptions): ControlCenterHandle {
  const center = new ControlCenter(options);
  root.append(center.el);
  if (options.initialOpen) center.open();
  return center;
}
