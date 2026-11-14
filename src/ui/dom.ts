// Tiny DOM helper: el('div.cls', { onclick }, child, child...).

type Attrs = Partial<Record<string, string | number | boolean | ((e: Event) => void)>>;

export function el<K extends keyof HTMLElementTagNameMap>(
  spec: K | `${K}.${string}`,
  attrs: Attrs = {},
  ...children: (Node | string | null | undefined)[]
): HTMLElementTagNameMap[K] {
  const [tag, ...classes] = spec.split('.') as [K, ...string[]];
  const node = document.createElement(tag);
  if (classes.length) node.className = classes.join(' ');
  for (const [k, v] of Object.entries(attrs)) {
    if (typeof v === 'function') node.addEventListener(k.replace(/^on/, ''), v as EventListener);
    else if (v === true) node.setAttribute(k, '');
    else if (v !== false && v !== undefined) node.setAttribute(k, String(v));
  }
  for (const c of children) if (c !== null && c !== undefined) node.append(c);
  return node;
}

/** Set text only when it changed (avoids layout work every frame). */
export function setText(node: HTMLElement, text: string): void {
  if (node.textContent !== text) node.textContent = text;
}
