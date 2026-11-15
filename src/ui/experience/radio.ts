import { el, setText } from '../dom';
import { onLangChange, t, type StringKey } from '../i18n';
import './experience.css';

export type RadioPriority = 'routine' | 'warning' | 'critical';

export interface RadioCall {
  id?: string;
  text?: string;
  textKey?: StringKey;
  textVars?: Record<string, string | number>;
  from?: string;
  priority?: RadioPriority;
  hintKey?: StringKey;
  hintVars?: Record<string, string | number>;
  whyKey?: StringKey;
  at?: number;
}

export interface CommanderRadioOptions {
  onAck?(call: RadioCall): void;
  typewriter?: boolean;
  from?: string;
}

export interface CommanderRadioHandle {
  readonly el: HTMLElement;
  push(call: RadioCall | string): void;
  pushKey(key: StringKey, vars?: Record<string, string | number>, options?: Omit<RadioCall, 'text' | 'textKey' | 'textVars'>): void;
  clear(): void;
  hide(): void;
  destroy(): void;
}

const PRIORITY_KEY: Record<RadioPriority, StringKey> = {
  routine: 'radioPriorityRoutine',
  warning: 'radioPriorityWarning',
  critical: 'radioPriorityCritical',
};

function clockText(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

class CommanderRadio implements CommanderRadioHandle {
  readonly el: HTMLElement;
  private callsign: HTMLElement;
  private post: HTMLElement;
  private priority: HTMLElement;
  private priorityLabel: HTMLElement;
  private message: HTMLElement;
  private hintBox: HTMLElement;
  private hintLabel: HTMLElement;
  private hintText: HTMLElement;
  private whyBox: HTMLElement;
  private whyLabel: HTMLElement;
  private whyText: HTMLElement;
  private meta: HTMLElement;
  private ack: HTMLButtonElement;
  private queue: RadioCall[] = [];
  private current: RadioCall | null = null;
  private fullText = '';
  private typingTimer: number | null = null;
  private unsubscribe: () => void;
  private reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(private options: CommanderRadioOptions) {
    this.callsign = el('span.x-radio__callsign', {}, t('radioCallsign'));
    this.post = el('span.x-radio__post', {}, t('radioPost'));
    this.priorityLabel = el('span.x-radio__priority-label', {}, t('radioPriorityRoutine'));
    this.priority = el('span.x-radio__priority', { 'data-priority': 'routine' }, el('span.x-radio__priority-dot', { 'aria-hidden': 'true' }), this.priorityLabel);
    this.message = el('p.x-radio__text');
    this.hintLabel = el('span.x-radio__hint-label', {}, t('radioHintLabel'));
    this.hintText = el('p.x-radio__hint-text');
    this.hintBox = el('div.x-radio__hint', { hidden: true }, this.hintLabel, this.hintText);
    this.whyLabel = el('span.x-radio__why-label', {}, t('sciTitle'));
    this.whyText = el('p.x-radio__why-text');
    this.whyBox = el('div.x-radio__why', { hidden: true }, this.whyLabel, this.whyText);
    this.meta = el('span.x-radio__meta');
    this.ack = el('button.x-radio__ack', { type: 'button', onclick: () => this.acknowledge() }, t('ok'));

    this.message.addEventListener('click', () => this.reveal());

    this.el = el('aside.x-radio', {
      hidden: true,
      role: 'region',
      'aria-live': 'polite',
      'aria-label': t('radioCallsign'),
    },
    el('div.x-radio__head', {},
      el('div.x-radio__avatar', { 'aria-hidden': 'true' }, 'CR'),
      el('div.x-radio__identity', {}, this.callsign, this.post),
      el('span.x-radio__wave', { 'aria-hidden': 'true' }, el('i'), el('i'), el('i')),
    ),
    this.priority,
    this.message,
    this.hintBox,
    this.whyBox,
    el('div.x-radio__foot', {}, this.meta, this.ack),
    );

    this.unsubscribe = onLangChange(() => this.applyLabels());
  }

  push(call: RadioCall | string): void {
    const next: RadioCall = typeof call === 'string' ? { text: call } : call;
    if (!next.text && !next.textKey) return;
    if (this.current && !this.el.hidden) {
      this.queue.push(next);
      return;
    }
    this.start(next);
  }

  pushKey(key: StringKey, vars: Record<string, string | number> = {}, options: Omit<RadioCall, 'text' | 'textKey' | 'textVars'> = {}): void {
    this.push({ ...options, textKey: key, textVars: vars });
  }

  clear(): void {
    this.queue = [];
    this.stopTyping();
    this.current = null;
    this.el.hidden = true;
  }

  hide(): void {
    this.clear();
  }

  destroy(): void {
    this.stopTyping();
    this.unsubscribe();
    this.el.remove();
  }

  private start(call: RadioCall): void {
    this.current = call;
    this.el.hidden = false;
    this.renderCall(call, true);
    this.updateMeta();
  }

  private renderCall(call: RadioCall, animate: boolean): void {
    const priority = call.priority ?? 'routine';
    this.el.dataset.priority = priority;
    this.priority.dataset.priority = priority;
    setText(this.priorityLabel, t(PRIORITY_KEY[priority]));
    setText(this.callsign, call.from ?? this.options.from ?? t('radioCallsign'));
    this.el.setAttribute('aria-label', `${t('radioCallsign')} · ${t(PRIORITY_KEY[priority])}`);

    this.fullText = call.textKey ? t(call.textKey, call.textVars) : call.text ?? '';
    if (animate && (this.options.typewriter ?? true) && !this.reducedMotion) {
      this.type();
    } else {
      this.stopTyping();
      setText(this.message, this.fullText);
    }

    this.hintBox.hidden = !call.hintKey;
    if (call.hintKey) setText(this.hintText, t(call.hintKey, call.hintVars));

    this.whyBox.hidden = !call.whyKey;
    if (call.whyKey) setText(this.whyText, t(call.whyKey));

    setText(this.ack, t('ok'));
    this.updateMeta();
  }

  private type(): void {
    this.stopTyping();
    setText(this.message, '');
    let shown = 0;
    this.typingTimer = window.setInterval(() => {
      shown += 2;
      setText(this.message, this.fullText.slice(0, shown));
      if (shown >= this.fullText.length) this.stopTyping();
    }, 18);
  }

  private reveal(): void {
    if (this.typingTimer === null) return;
    this.stopTyping();
    setText(this.message, this.fullText);
  }

  private stopTyping(): void {
    if (this.typingTimer !== null) {
      window.clearInterval(this.typingTimer);
      this.typingTimer = null;
    }
  }

  private acknowledge(): void {
    const done = this.current;
    this.stopTyping();
    this.current = null;
    this.options.onAck?.(done ?? {});
    const next = this.queue.shift();
    if (next) this.start(next);
    else this.el.hidden = true;
  }

  private updateMeta(): void {
    const call = this.current;
    const queued = this.queue.length;
    if (call && typeof call.at === 'number' && Number.isFinite(call.at)) {
      setText(this.meta, `T+${clockText(call.at as number)}${queued > 0 ? ` · +${queued}` : ''}`);
    } else {
      setText(this.meta, queued > 0 ? `${t('radioNew')} · +${queued}` : '');
    }
  }

  private applyLabels(): void {
    this.el.setAttribute('aria-label', t('radioCallsign'));
    setText(this.post, t('radioPost'));
    setText(this.hintLabel, t('radioHintLabel'));
    setText(this.whyLabel, t('sciTitle'));
    setText(this.ack, t('ok'));
    if (this.current) {
      this.reveal();
      this.renderCall(this.current, false);
    }
  }
}

export function mountCommanderRadio(root: HTMLElement, options: CommanderRadioOptions = {}): CommanderRadioHandle {
  const radio = new CommanderRadio(options);
  root.append(radio.el);
  return radio;
}
