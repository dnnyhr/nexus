import * as THREE from 'three';

// South-pole lighting shared by the game and the model viewer.
// - Sun: low and grazing (the Sun never rises far above the horizon at the lunar south pole).
// - Bounce: regolith reflects sunlight back up, which softens the shadow side. Without it the
//   shadow side of every model turns into a flat black shape and loses its form.
// - Night: the Sun is gone; faint, cool earthshine keeps shapes readable.

export interface Lighting {
  sun: THREE.DirectionalLight;
  bounce: THREE.HemisphereLight;
  ambient: THREE.AmbientLight;
  /** 0 = full day, 1 = full night. */
  setNight(level: number): void;
}

export function createLighting(scene: THREE.Scene, shadowExtent = 12): Lighting {
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
  sun.position.set(-16, 6, 9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -shadowExtent, right: shadowExtent, top: shadowExtent, bottom: -shadowExtent, near: 1, far: 60,
  });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;

  const bounce = new THREE.HemisphereLight(0x5b6476, 0x8a8172, 0.9);
  const ambient = new THREE.AmbientLight(0xffffff, 0.12);
  scene.add(sun, sun.target, bounce, ambient);

  return {
    sun,
    bounce,
    ambient,
    setNight(level) {
      const t = THREE.MathUtils.clamp(level, 0, 1);
      sun.intensity = THREE.MathUtils.lerp(2.6, 0.0, t);
      bounce.intensity = THREE.MathUtils.lerp(0.9, 0.35, t);
      bounce.color.setHex(t > 0.5 ? 0x3c4a66 : 0x5b6476);
      bounce.groundColor.setHex(t > 0.5 ? 0x2c2a28 : 0x8a8172);
      ambient.intensity = THREE.MathUtils.lerp(0.12, 0.06, t);
    },
  };
}
