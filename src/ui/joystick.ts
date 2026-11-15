import * as THREE from 'three';
import { el } from './dom';

// Floating joystick for touch screens. The whole left side of the screen is the move zone:
// the stick appears where the thumb lands, so a touch that misses never turns the camera
// by accident. A quick tap with no drag is passed on (onTap) so objects on the left side
// can still be tapped. `value` is in screen terms: x = right, y = up (forward), length 0-1.
// Desktop players use WASD / arrows instead.

const TAP_MS = 250;
const TAP_MOVE = 10; // px

export class Joystick {
  readonly value = new THREE.Vector2();
  onTap: ((x: number, y: number) => void) | null = null;
  private zone = el('div', { id: 'move-zone' });
  private base = el('div', { id: 'joystick' });
  private knob = el('div.knob');
  private pointer: number | null = null;
  private center = new THREE.Vector2();
  private start = { x: 0, y: 0, t: 0, moved: false };
  private radius = 48;

  constructor(parent: HTMLElement) {
    this.base.append(this.knob);
    this.zone.append(this.base);
    // First child: every other HUD control (radio, prompt, buttons) stays on top of the zone.
    parent.prepend(this.zone);
    this.zone.addEventListener('pointerdown', (e) => {
      if (this.pointer !== null) return;
      e.preventDefault();
      this.pointer = e.pointerId;
      try {
        this.zone.setPointerCapture(e.pointerId);
      } catch {
        // Some pointers cannot be captured; moves still arrive while over the zone.
      }
      this.start = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false };
      // The stick jumps under the thumb (kept fully on screen).
      const z = this.zone.getBoundingClientRect();
      const half = this.base.offsetWidth / 2 || 58;
      const cx = Math.max(z.left + half + 4, Math.min(z.right - half - 4, e.clientX));
      const cy = Math.max(z.top + half + 4, Math.min(z.bottom - half - 4, e.clientY));
      this.center.set(cx, cy);
      this.base.style.left = `${cx - z.left - half}px`;
      this.base.style.top = `${cy - z.top - half}px`;
      this.base.classList.add('active');
      this.move(e);
    });
    this.zone.addEventListener('pointermove', (e) => { if (e.pointerId === this.pointer) this.move(e); });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== this.pointer) return;
      this.pointer = null;
      this.value.set(0, 0);
      this.knob.style.transform = '';
      this.base.classList.remove('active');
      this.base.style.left = '';
      this.base.style.top = '';
      const quick = performance.now() - this.start.t < TAP_MS;
      if (e.type === 'pointerup' && quick && !this.start.moved) this.onTap?.(e.clientX, e.clientY);
    };
    this.zone.addEventListener('pointerup', end);
    this.zone.addEventListener('pointercancel', end);
  }

  reset(): void {
    if (this.pointer !== null && this.zone.hasPointerCapture(this.pointer)) this.zone.releasePointerCapture(this.pointer);
    this.pointer = null;
    this.value.set(0, 0);
    this.knob.style.transform = '';
    this.base.classList.remove('active');
    this.base.style.left = '';
    this.base.style.top = '';
  }

  private move(e: PointerEvent): void {
    if (Math.hypot(e.clientX - this.start.x, e.clientY - this.start.y) > TAP_MOVE) this.start.moved = true;
    const d = new THREE.Vector2(e.clientX - this.center.x, e.clientY - this.center.y);
    if (d.length() > this.radius) d.setLength(this.radius);
    this.knob.style.transform = `translate(${d.x}px, ${d.y}px)`;
    // A small dead zone so a resting thumb does not creep.
    const v = d.clone().divideScalar(this.radius);
    this.value.set(v.length() < 0.12 ? 0 : v.x, v.length() < 0.12 ? 0 : -v.y);
  }
}
