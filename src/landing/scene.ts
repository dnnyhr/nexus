import * as THREE from 'three';
import { gsap } from 'gsap';
import { animateModel } from '../models/anim';
import { MODELS } from '../models';
import { animateSharedMaterials } from '../models/palette';
import { createLighting } from '../scene/lighting';
import { mergeStatic } from '../scene/optimize';
import { createSky } from '../scene/sky';
import { createTerrain } from '../scene/terrain';

// The hero's Moon: the game's own terrain, sky, polar light and models (the whole base, as
// in the model viewer), seen from a slow, drifting camera. Built for low-end phones: capped
// resolution, small shadow map (none on weak devices), and it stops drawing whenever the
// hero is off screen or the tab is hidden.

export function startMoon(canvas: HTMLCanvasElement, opts: { reduceMotion: boolean }): void {
  const cores = navigator.hardwareConcurrency ?? 4;
  const weak = cores <= 4 || matchMedia('(pointer: coarse)').matches;
  const dpr = Math.min(window.devicePixelRatio || 1, weak ? 1 : 1.5);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: dpr <= 1, powerPreference: 'high-performance' });
  renderer.setPixelRatio(dpr);
  renderer.shadowMap.enabled = !weak;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07080b);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 400);

  const light = createLighting(scene, 16);
  light.sun.shadow.mapSize.set(1024, 1024);
  light.sun.position.set(-24, 6, 6);

  const sky = createSky(160);
  sky.rotation.y = -0.75; // Earth to the right of the base, away from the title
  scene.add(sky);
  const terrain = createTerrain(160, weak ? 48 : 80);
  terrain.traverse((o) => { o.receiveShadow = true; });
  scene.add(terrain);

  const base = MODELS.find((m) => m.id === 'lineup')!.build();
  base.position.set(7, 0, -2);
  base.traverse((o) => { o.castShadow = true; o.receiveShadow = true; });
  mergeStatic(base);
  scene.add(base);

  // Camera: starts high in orbit and comes down to the base, then drifts slowly.
  const target = new THREE.Vector3(6, 4, -4);
  const cam = { radius: 38, height: 22, angle: -0.35 };
  const mouse = { x: 0, y: 0 };
  const place = () => {
    camera.position.set(target.x + Math.sin(cam.angle) * cam.radius, cam.height + mouse.y * 0.6, target.z + Math.cos(cam.angle) * cam.radius);
    camera.lookAt(target.x + mouse.x * 0.8, target.y, target.z);
  };
  if (!opts.reduceMotion) {
    gsap.to(cam, { radius: 28, height: 6.5, duration: 3.2, ease: 'power3.out', delay: 0.1 });
    window.addEventListener('pointermove', (e) => {
      mouse.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.y = (e.clientY / window.innerHeight - 0.5) * 2;
    }, { passive: true });
  } else {
    Object.assign(cam, { radius: 28, height: 6.5 });
  }

  const resize = () => {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Narrow screens: step back so the whole base fits.
    camera.fov = w / h < 1 ? 55 : 38;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(canvas);
  resize();

  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0 }).observe(canvas);

  const clock = new THREE.Clock();
  let first = true;
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.1);
    if (!visible || document.hidden) return;
    const t = clock.elapsedTime;
    if (!opts.reduceMotion) cam.angle = -0.35 + Math.sin(t * 0.05) * 0.18;
    place();
    animateModel(base, t, dt);
    animateSharedMaterials(t);
    renderer.render(scene, camera);
    if (first) {
      first = false;
      canvas.classList.add('ready');
    }
    if (opts.reduceMotion) renderer.setAnimationLoop(null);
  });
}
