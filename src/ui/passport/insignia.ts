import type { BadgeId } from './badges';

const NS = 'http://www.w3.org/2000/svg';
const SYMBOLS: Record<BadgeId, string> = {
  mission: 'M29 48V30Q40 14 51 30V48M29 39L22 48V54L32 49M51 39L58 48V54L48 49M35 55L40 64L45 55M35 33H45V41H35Z',
  life: 'M40 20V39M36 29Q21 30 22 48Q24 61 35 54V38M44 29Q59 30 58 48Q56 61 45 54V38',
  energy: 'M26 24H50V60H26ZM33 19H43M40 29L32 43H44L36 55',
  harvest: 'M40 62V40M40 48Q18 48 24 28Q44 26 40 48M40 40Q60 40 57 22Q39 22 40 40',
  shelter: 'M18 59H62M23 59V43A17 17 0 0 1 34 27V22H46V27A17 17 0 0 1 57 43V59M34 59V44H46V59M17 24L23 28M63 24L57 28M40 12V16',
};

export function renderInsignia(id: BadgeId, unlocked: boolean): SVGSVGElement {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 80 80');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const circle = document.createElementNS(NS, 'circle');
  for (const [key, value] of Object.entries({ cx: '40', cy: '40', r: '36', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' })) circle.setAttribute(key, value);
  if (!unlocked) circle.setAttribute('stroke-dasharray', '3 4');
  const path = document.createElementNS(NS, 'path');
  for (const [key, value] of Object.entries({ d: SYMBOLS[id], fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' })) path.setAttribute(key, value);
  svg.append(circle, path);
  return svg;
}
