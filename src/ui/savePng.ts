import { decodeSavePng, encodeSavePng, MAX_SAVE_PNG_BYTES, type PortableSave } from '../game/savePng';
import { el } from './dom';
import { getLang } from './i18n';
import './savePng.css';

export function openPngSave(options: { current: PortableSave | null; image: HTMLCanvasElement; close(): void; load(save: PortableSave): void }): void {
  const en = getLang() === 'en';
  const text = (es: string, english: string) => en ? english : es;
  const previous = document.activeElement as HTMLElement | null;
  const dialog = el('dialog.png-save');
  const status = el('p', { role: 'status', 'aria-live': 'polite' });
  const preview = el('img', { alt: text('Tarjeta de partida', 'Save card'), hidden: true });
  const input = el('input', { type: 'file', accept: '.png,image/png', 'aria-label': text('Seleccionar partida PNG', 'Select PNG save') });
  const confirm = el('button', { type: 'button', disabled: true }, text('Cargar esta partida', 'Load this save'));
  const download = el('button', { type: 'button', disabled: !options.current }, text('Guardar partida en PNG', 'Save game as PNG'));
  const close = el('button', { type: 'button' }, text('Volver', 'Back'));
  const urls: string[] = [];
  let pending: PortableSave | null = null, alive = true, generation = 0;
  function finish() {
    if (!alive) return;
    alive = false;
    dialog.close(); dialog.remove(); urls.forEach(url => URL.revokeObjectURL(url)); options.close();
    if (previous?.isConnected) previous.focus();
  }
  close.onclick = finish;
  dialog.addEventListener('cancel', event => { event.preventDefault(); finish(); });
  for (const kind of ['keydown', 'keyup', 'pointerdown', 'pointerup']) dialog.addEventListener(kind, event => event.stopPropagation());
  const title = el('h2', { id: 'png-save-title' }, text('Archivo de partidas', 'Save archive'));
  dialog.setAttribute('aria-labelledby', 'png-save-title');
  // From the title menu there is no game in progress: only the loading half is shown.
  const saving = options.current ? [el('p', {}, text('La imagen contiene tu progreso. Conserva el PNG original para recuperar la partida.', 'The image contains your progress. Keep the original PNG to restore your game.')), download, el('hr')] : [];
  dialog.append(title, ...saving,
    el('label', {}, text('Recuperar desde PNG', 'Restore from PNG'), input), preview, status,
    el('p', {}, text('Cargar reemplaza la partida de ese modo. Cadete se recupera en pausa; Modo libre vuelve al instante guardado.', 'Loading replaces the game in that mode. Cadet resumes paused; Free mode restores the saved moment.')),
    el('div.png-save-actions', {}, close, confirm));
  document.body.append(dialog); dialog.showModal(); close.focus();
  download.onclick = async () => {
    if (!options.current) return;
    download.disabled = true;
    try {
      const card = document.createElement('canvas'); card.width = 1200; card.height = 750;
      const ctx = card.getContext('2d'); if (!ctx) throw new Error();
      ctx.fillStyle = '#080e13'; ctx.fillRect(0, 0, 1200, 750);
      ctx.drawImage(options.image, 0, 0, 1200, 560);
      ctx.fillStyle = 'rgba(4,9,14,.85)'; ctx.fillRect(0, 0, 1200, 100);
      ctx.fillStyle = '#f2b54a'; ctx.fillRect(32, 560, 1136, 2);
      ctx.font = '600 42px "Barlow Semi Condensed", sans-serif'; ctx.fillText('NEXUS · LAST HORIZON', 36, 65);
      ctx.fillStyle = '#eef4f3'; ctx.font = '600 38px "Barlow Semi Condensed", sans-serif';
      const save = options.current, cp = save.checkpoint;
      ctx.fillText(save.name || text('Astronauta', 'Astronaut'), 36, 620, 680);
      ctx.font = '24px "Barlow Semi Condensed", sans-serif';
      const time = cp.mode === 'free' ? cp.game.time : cp.mission.t;
      ctx.fillText(cp.mode === 'free' ? text(`Modo libre · Misión ${cp.game.mission + 1}`, `Free mode · Mission ${cp.game.mission + 1}`) : text('Cadete · Primera oscuridad', 'Cadet · First darkness'), 36, 665);
      ctx.fillText(`${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, '0')} · ${new Date(save.createdAt).toLocaleString(save.lang)}`, 36, 709);
      ctx.textAlign = 'right'; ctx.fillStyle = '#8fe0e8'; ctx.fillText(text('PARTIDA GUARDADA', 'SAVED GAME'), 1164, 620);
      const blob = await new Promise<Blob>((resolve, reject) => card.toBlob(b => b ? resolve(b) : reject(), 'image/png'));
      const png = encodeSavePng(new Uint8Array(await blob.arrayBuffer()), save);
      if (!alive) return;
      const url = URL.createObjectURL(new Blob([png.buffer as ArrayBuffer], { type: 'image/png' })); urls.push(url);
      const link = el('a', { href: url, download: `nexus-${cp.mode}-${save.createdAt}.png` }); link.click();
      preview.src = url; preview.hidden = false; status.textContent = text('PNG preparado. Guarda el archivo descargado.', 'PNG ready. Keep the downloaded file.');
    } catch { if (alive) status.textContent = text('No se pudo guardar. Vuelve a intentarlo.', 'Could not save. Please try again.'); }
    finally { download.disabled = false; }
  };
  input.onchange = async () => {
    const id = ++generation, file = input.files?.[0]; pending = null; confirm.disabled = true; preview.hidden = true;
    if (!file) return;
    status.textContent = text('Comprobando partida…', 'Checking save…');
    try {
      if (file.size > MAX_SAVE_PNG_BYTES) throw new Error();
      const save = decodeSavePng(new Uint8Array(await file.arrayBuffer()));
      if (!alive || id !== generation) return;
      const url = URL.createObjectURL(file); urls.push(url);
      const image = new Image(); image.src = url; await image.decode();
      if (!alive || id !== generation) return;
      pending = save; preview.src = url; preview.hidden = false; confirm.disabled = false;
      status.textContent = `${save.name || text('Astronauta', 'Astronaut')} · ${save.checkpoint.mode === 'free' ? text('Modo libre', 'Free mode') : 'Cadete'} · ${new Date(save.createdAt).toLocaleString(save.lang)}`;
    } catch { if (alive && id === generation) status.textContent = text('PNG sin partida compatible, dañado o demasiado grande. Tu progreso actual sigue intacto.', 'PNG has no compatible save, is damaged or too large. Your current progress is unchanged.'); }
  };
  confirm.onclick = () => { if (pending) { const save = pending; finish(); options.load(save); } };
}
