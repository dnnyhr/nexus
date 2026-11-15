import { onLangChange, t, type StringKey } from './i18n';

export type SurfaceState = 'open' | 'closed' | 'compact';
export type RiskLevel = 'ok' | 'caution' | 'critical';

export interface DisclosureOptions {
  id: string;
  storageKey?: string;
  defaultState: SurfaceState;
  persist?: boolean;
  toggle: HTMLButtonElement;
  body: HTMLElement;
  nameKey?: StringKey;
  risk?: () => RiskLevel;
  mutexGroup?: string;
  onToggle?: (state: SurfaceState, source: 'user' | 'auto' | 'default') => void;
}

export interface DisclosureHandle {
  readonly root: HTMLElement;
  readonly toggle: HTMLButtonElement;
  readonly body: HTMLElement;
  getState(): SurfaceState;
  setState(state: SurfaceState, source?: 'user' | 'auto' | 'default'): void;
  setRisk(risk: RiskLevel): void;
  destroy(): void;
}

const STORAGE_KEY_DEFAULT = 'nx.ui.v1';
const mutexGroups = new Map<string, Set<DisclosureHandle>>();

function storageKeyFor(opts: DisclosureOptions): string {
  return opts.storageKey ?? STORAGE_KEY_DEFAULT;
}

export function isCompactViewport(): boolean {
  return window.matchMedia('(max-width: 900px), (max-height: 520px)').matches;
}

export function loadPrefs(key = STORAGE_KEY_DEFAULT): Record<string, SurfaceState> {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { v?: number; surfaces?: Record<string, SurfaceState> };
    if (!parsed || parsed.v !== 1 || !parsed.surfaces || typeof parsed.surfaces !== 'object') return {};
    const out: Record<string, SurfaceState> = {};
    for (const [k, v] of Object.entries(parsed.surfaces)) {
      if (v === 'open' || v === 'closed' || v === 'compact') out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export function savePrefs(prefs: Record<string, SurfaceState>, key = STORAGE_KEY_DEFAULT): void {
  try {
    window.localStorage.setItem(key, JSON.stringify({ v: 1, surfaces: prefs }));
  } catch {
    /* private mode / quota: keep in memory only */
  }
}

export function resetPrefs(key = STORAGE_KEY_DEFAULT): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function writeOne(id: string, state: SurfaceState, key: string): void {
  const prefs = loadPrefs(key);
  prefs[id] = state;
  savePrefs(prefs, key);
}

export function mountDisclosure(root: HTMLElement, opts: DisclosureOptions): DisclosureHandle {
  const key = storageKeyFor(opts);
  const prefs = opts.persist ? loadPrefs(key) : {};
  const initial: SurfaceState =
    opts.persist && prefs[opts.id] ? prefs[opts.id] : opts.defaultState;

  if (!opts.body.id) opts.body.id = `disc-body-${opts.id}`;
  opts.toggle.setAttribute('aria-controls', opts.body.id);

  let current: SurfaceState = initial;
  const unsubs: Array<() => void> = [];

  const handle: DisclosureHandle = {
    root,
    toggle: opts.toggle,
    body: opts.body,
    getState: () => current,
    setState: (state, source = 'user') => apply(state, source),
    setRisk: (risk) => { root.dataset.risk = risk; },
    destroy: () => {
      opts.toggle.removeEventListener('click', onClick);
      if (opts.mutexGroup) mutexGroups.get(opts.mutexGroup)?.delete(handle);
      unsubs.forEach((fn) => fn());
    },
  };

  function labelFor(collapsed: boolean): string {
    const base = collapsed
      ? (opts.nameKey ? 'uiExpand' : 'uiExpandGeneric')
      : (opts.nameKey ? 'uiCollapse' : 'uiCollapseGeneric');
    if (!opts.nameKey) return t(base as StringKey);
    return t(base as StringKey, { name: t(opts.nameKey) });
  }

  function applyHidden(state: SurfaceState): void {
    const collapsed = state === 'closed' || state === 'compact';
    opts.body.hidden = collapsed;
    opts.toggle.setAttribute('aria-expanded', String(!collapsed));
    const label = labelFor(collapsed);
    opts.toggle.setAttribute('aria-label', label);
    opts.toggle.title = label;
    root.classList.toggle('is-collapsed', collapsed);
    root.classList.toggle('is-compact', state === 'compact');
  }

  function apply(state: SurfaceState, source: 'user' | 'auto' | 'default'): void {
    if (state === 'open' && opts.mutexGroup && isCompactViewport() && source !== 'default') {
      const set = mutexGroups.get(opts.mutexGroup);
      if (set) {
        for (const other of set) {
          if (other !== handle && other.getState() !== 'closed') {
            other.setState('closed', 'auto');
          }
        }
      }
    }
    current = state;
    applyHidden(state);
    if (source === 'user' && opts.persist) writeOne(opts.id, state, key);
    opts.onToggle?.(state, source);
  }

  if (opts.mutexGroup) {
    if (!mutexGroups.has(opts.mutexGroup)) mutexGroups.set(opts.mutexGroup, new Set());
    mutexGroups.get(opts.mutexGroup)!.add(handle);
  }

  const onClick = (e: Event): void => {
    e.preventDefault();
    const next: SurfaceState = current === 'open' ? 'closed' : 'open';
    apply(next, 'user');
  };
  opts.toggle.addEventListener('click', onClick);

  unsubs.push(onLangChange(() => applyHidden(current)));

  // Initial apply: no persist, no mutex.
  current = initial;
  applyHidden(current);
  opts.onToggle?.(current, 'default');

  return handle;
}
