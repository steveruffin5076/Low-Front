type Child = Node | string | null | undefined | false;

interface ElOptions {
  class?: string;
  text?: string;
  attrs?: Record<string, string>;
  on?: Partial<{ [K in keyof HTMLElementEventMap]: (e: HTMLElementEventMap[K]) => void }>;
}

/** Creates an element with classes, attributes, listeners and children. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  opts: ElOptions = {},
  children: Child[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (opts.class) node.className = opts.class;
  if (opts.text !== undefined) node.textContent = opts.text;
  for (const [k, v] of Object.entries(opts.attrs ?? {})) node.setAttribute(k, v);
  for (const [type, fn] of Object.entries(opts.on ?? {})) node.addEventListener(type, fn as EventListener);
  for (const c of children) if (c) node.append(c);
  return node;
}

export function button(label: string, onClick: () => void, cls = 'btn'): HTMLButtonElement {
  return el('button', { class: cls, text: label, attrs: { type: 'button' }, on: { click: onClick } });
}
