import * as THREE from 'three';
import { el } from './dom';

// On-screen joystick for touch screens. Returns a vector in screen terms: x = right,
// y = up (forward), length 0-1. Desktop players use WASD / arrows instead.

export class Joystick {
  readonly value = new THREE.Vector2();
  private base = el('div', { id: 'joystick', class: 'interactive' });
  private knob = el('div.knob');
  private pointer: number | null = null;
  private center = new THREE.Vector2();
  private radius = 48;

  constructor(parent: HTMLElement) {
    this.base.append(this.knob);
    parent.append(this.base);
    this.base.addEventListener('pointerdown', (e) => {
      this.pointer = e.pointerId;
      this.base.setPointerCapture(e.pointerId);
      const r = this.base.getBoundingClientRect();
      this.center.set(r.left + r.width / 2, r.top + r.height / 2);
      this.move(e);
    });
    this.base.addEventListener('pointermove', (e) => { if (e.pointerId === this.pointer) this.move(e); });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== this.pointer) return;
      this.pointer = null;
      this.value.set(0, 0);
      this.knob.style.transform = '';
    };
    this.base.addEventListener('pointerup', end);
    this.base.addEventListener('pointercancel', end);
  }

  private move(e: PointerEvent): void {
    const d = new THREE.Vector2(e.clientX - this.center.x, e.clientY - this.center.y);
    if (d.length() > this.radius) d.setLength(this.radius);
    this.knob.style.transform = `translate(${d.x}px, ${d.y}px)`;
    this.value.set(d.x / this.radius, -d.y / this.radius);
  }
}
