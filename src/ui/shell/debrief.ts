import { el } from '../dom';
import { onLangChange, t, type StringKey } from '../i18n';
import './shell.css';

// End-of-mission debrief: one place with tabs for the result, the flight review and the
// passport. Each tab mounts its own module on demand and destroys it when another is chosen.

export interface DebriefTab {
  id: string;
  labelKey: StringKey;
  mount(root: HTMLElement): { destroy(): void };
}

export interface DebriefHandle {
  show(id: string): void;
  destroy(): void;
}

export function mountDebrief(root: HTMLElement, tabs: DebriefTab[], initial = tabs[0]?.id): DebriefHandle {
  const events = new AbortController();
  const wrap = el('section.nx-debrief', { 'aria-label': t('nxDebrief') });
  const list = el('div.nx-debrief__tabs', { role: 'tablist', 'aria-label': t('nxDebrief') });
  const panel = el('div.nx-debrief__panel', { role: 'tabpanel', tabindex: -1 });
  for (const type of ['keydown', 'keyup', 'pointerdown', 'pointerup']) wrap.addEventListener(type, (e) => e.stopPropagation(), { signal: events.signal });
  const buttons = tabs.map((tab) => {
    const button = el('button.nx-debrief__tab', { type: 'button', role: 'tab', id: `nx-tab-${tab.id}`, 'aria-selected': 'false' }, t(tab.labelKey));
    button.addEventListener('click', () => show(tab.id), { signal: events.signal });
    button.addEventListener('keydown', (e) => {
      const i = tabs.indexOf(tab);
      const next = e.key === 'ArrowRight' ? tabs[(i + 1) % tabs.length] : e.key === 'ArrowLeft' ? tabs[(i - 1 + tabs.length) % tabs.length] : null;
      if (!next) return;
      e.preventDefault();
      show(next.id);
      buttons[tabs.indexOf(next)].focus();
    }, { signal: events.signal });
    return button;
  });
  list.append(...buttons);
  wrap.append(list, panel);
  root.append(wrap);

  let current: { id: string; handle: { destroy(): void } } | null = null;
  function show(id: string): void {
    const tab = tabs.find((x) => x.id === id);
    if (!tab || current?.id === id) return;
    current?.handle.destroy();
    panel.replaceChildren();
    buttons.forEach((b, i) => {
      const on = tabs[i].id === id;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
    });
    panel.setAttribute('aria-labelledby', `nx-tab-${id}`);
    current = { id, handle: tab.mount(panel) };
    wrap.scrollIntoView({ block: 'start' });
  }

  const unsubscribe = onLangChange(() => buttons.forEach((b, i) => { b.textContent = t(tabs[i].labelKey); }));
  if (initial) show(initial);
  return {
    show,
    destroy() {
      unsubscribe();
      current?.handle.destroy();
      current = null;
      events.abort();
      wrap.remove();
    },
  };
}
