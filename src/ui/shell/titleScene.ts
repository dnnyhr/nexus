import * as THREE from 'three';

// Title backdrop: deep space, the Moon large and slowly turning, the Earth small in the distance,
// a low sun that leaves a hard terminator (no air to soften it) and a slow camera drift.
// Reuses the local NASA maps of the cinematics and the game's renderer and camera.

export interface TitleScene {
  readonly scene: THREE.Scene;
  /** Place the shared camera on the title shot. */
  frame(camera: THREE.PerspectiveCamera): void;
  update(dt: number, camera: THREE.PerspectiveCamera): void;
  dispose(): void;
}

const MOON_AT = new THREE.Vector3(9, -1.5, 0);
const LOOK_AT = new THREE.Vector3(4.5, 0, 0);

function stars(count: number, radius: number, size: number, color: number, seed: number): THREE.Points {
  const points = new Float32Array(count * 3);
  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < count; i++) {
    const u = rand() * 2 - 1;
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(1 - u * u);
    points.set([Math.cos(a) * r * radius, u * radius, Math.sin(a) * r * radius - 60], i * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(points, 3));
  return new THREE.Points(geometry, new THREE.PointsMaterial({ color, size, sizeAttenuation: false, transparent: true, opacity: 0.9, depthWrite: false }));
}

export function createTitleScene(reducedMotion: () => boolean): TitleScene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x010204);
  const loader = new THREE.TextureLoader();
  const texture = (file: string) => {
    const map = loader.load(`${import.meta.env.BASE_URL}cinematics/${file}`);
    map.colorSpace = THREE.SRGBColorSpace;
    return map;
  };

  const sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
  sun.position.set(-60, 18, 34);
  scene.add(sun, new THREE.AmbientLight(0x6f86a8, 0.035));

  const moon = new THREE.Mesh(new THREE.SphereGeometry(8.6, 64, 40), new THREE.MeshLambertMaterial({ map: texture('moon.jpg') }));
  moon.position.copy(MOON_AT);
  moon.rotation.set(0.12, -1.1, 0.06);

  const earth = new THREE.Mesh(new THREE.SphereGeometry(2.6, 40, 24), new THREE.MeshLambertMaterial({ map: texture('earth.png') }));
  earth.position.set(76, 33, -90);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(2.95, 48, 24), new THREE.MeshBasicMaterial({ color: 0x5aa7ff, transparent: true, opacity: 0.16, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.position.copy(earth.position);

  scene.add(moon, earth, glow, stars(1400, 520, 1, 0xb9c6d5, 7), stars(180, 500, 2, 0xf2efe6, 91));

  let time = 0;
  const base = new THREE.Vector3(-1.5, 1.2, 30);
  return {
    scene,
    frame(camera) {
      time = 0;
      camera.position.copy(base);
      camera.lookAt(LOOK_AT);
    },
    update(dt, camera) {
      const still = reducedMotion();
      if (!still) {
        time += dt;
        moon.rotation.y += dt * 0.018;
        earth.rotation.y += dt * 0.05;
      }
      camera.position.set(base.x + Math.sin(time * 0.07) * 1.2, base.y + Math.sin(time * 0.05) * 0.5, base.z - Math.sin(time * 0.04) * 1.5);
      camera.lookAt(LOOK_AT);
    },
    dispose() {
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
          object.geometry.dispose();
          const material = object.material as THREE.Material & { map?: THREE.Texture | null };
          material.map?.dispose();
          material.dispose();
        }
      });
      scene.clear();
    },
  };
}
