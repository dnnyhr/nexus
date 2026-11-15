import { el } from '../ui/dom';
import { TacticalCamera, type CameraMode } from './camera';
import './camera.css';

export function mountCameraControl(root: HTMLElement, camera: TacticalCamera): { update(): void; destroy(): void } {
  const modes: [CameraMode, string][] = [['follow', 'Seguir astronauta'], ['isometric', 'Vista isométrica'], ['top', 'Vista cenital']];
  const group = el('div.nx-camera', { role: 'group', 'aria-label': 'Cámara de la base' });
  const events = new AbortController();
  for (const type of ['keydown', 'keyup']) group.addEventListener(type, event => event.stopPropagation(), { signal: events.signal });
  const buttons = modes.map(([mode, label]) => {
    const button = el('button', { type: 'button', 'aria-pressed': String(camera.mode === mode) }, label);
    const click = () => { camera.setMode(mode); update(); };
    button.addEventListener('click', click, { signal: events.signal });
    group.append(button);
    return button;
  });
  function update(): void {
    buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(camera.mode === modes[i][0])));
  }
  root.append(group);
  return { update, destroy() { events.abort(); group.remove(); } };
}
