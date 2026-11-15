import * as THREE from 'three';

// Shared materials. Models never create their own materials: changing a color here
// changes it everywhere. See docs/guia-modelos.md.

// Every material is double-sided: many parts are open surfaces (domes, fenders, nozzles,
// half tunnels) and a single-sided material makes their back look transparent. Three.js
// flips the normal of back faces, so the inside is lit correctly too.
const flat = (color: number, extra: THREE.MeshLambertMaterialParameters = {}) =>
  new THREE.MeshLambertMaterial({ color, flatShading: true, side: THREE.DoubleSide, ...extra });

export const COLORS = {
  hull: 0xeeece6,
  hullShade: 0xa6aaad,
  structure: 0x7b858c,
  darkMetal: 0x30383f,
  solarCell: 0x243d57,
  glass: 0x1e2226,
  glassLit: 0xffc98a,
  regolith: 0x77756f,
  regolithDark: 0x504f4c,
  regolithPiled: 0xa39e94,
  bandHabitat: 0xa65a45,
  bandIndustry: 0x9c8556,
  bandPower: 0x4e6a86,
  bandGreenhouse: 0x6e8b5a,
  plant: 0x6e8b5a,
  plantLight: 0x8fae6e,
  ledGrow: 0xd98ac9,
  beaconOff: 0x5a3a30,
  beaconOn: 0xff8a5c,
  suit: 0xeeebe4,
  visor: 0x3b3326,
} as const;

export const MAT = {
  hull: flat(COLORS.hull),
  hullShade: flat(COLORS.hullShade),
  /** Kept as a name for open surfaces; every material is double-sided now. */
  hullDouble: flat(COLORS.hull),
  structure: flat(COLORS.structure),
  darkMetal: flat(COLORS.darkMetal),
  solarCell: flat(COLORS.solarCell),
  glass: flat(COLORS.glass, { emissive: COLORS.glassLit, emissiveIntensity: 0 }),
  regolith: flat(COLORS.regolith),
  regolithDark: flat(COLORS.regolithDark),
  regolithPiled: flat(COLORS.regolithPiled),
  bandHabitat: flat(COLORS.bandHabitat),
  bandIndustry: flat(COLORS.bandIndustry),
  bandPower: flat(COLORS.bandPower),
  bandGreenhouse: flat(COLORS.bandGreenhouse),
  plant: flat(COLORS.plant),
  plantLight: flat(COLORS.plantLight),
  greenhouseRoof: flat(0xe9efe2, { transparent: true, opacity: 0.38, depthWrite: false }),
  ledGrow: flat(COLORS.ledGrow, { emissive: COLORS.ledGrow, emissiveIntensity: 0.6 }),
  /** Template for beacons; each beacon gets its own copy from beaconMaterial(). */
  beacon: flat(COLORS.beaconOff, { emissive: COLORS.beaconOn, emissiveIntensity: 0 }),
  /** Micrometeoroid damage: scorched surface and punctures. */
  scorch: flat(0x2b2622),
  hole: flat(0x0b0b0c),
  /** Steady lights (headlights, floodlights, helmet lamps): dim by day, on at night. */
  lamp: flat(0x6b5a44, { emissive: 0xffe2b0, emissiveIntensity: 0.2 }),
  suit: flat(COLORS.suit),
  visor: flat(COLORS.visor, { emissive: 0x7a5a2a, emissiveIntensity: 0.15 }),
} as const;

/** Status light for indicators with their own state (battery charge). One per instance. */
export function statusLight(): THREE.MeshLambertMaterial {
  return flat(0x2c3328, { emissive: 0x9fd88a, emissiveIntensity: 0 });
}

export type BandKind = 'habitat' | 'industry' | 'power' | 'greenhouse';

export const BAND: Record<BandKind, THREE.Material> = {
  habitat: MAT.bandHabitat,
  industry: MAT.bandIndustry,
  power: MAT.bandPower,
  greenhouse: MAT.bandGreenhouse,
};

let night = 0;

/** Current night level (0 day, 1 night), for models that light themselves. */
export function getNight(): number {
  return night;
}

// Every beacon has its own material with its own rhythm, so the base never blinks in
// unison. Weak references let materials of discarded models be garbage-collected.
interface BeaconEntry { ref: WeakRef<THREE.MeshLambertMaterial>; phase: number; period: number }
const beacons: BeaconEntry[] = [];
let beaconCount = 0;

export function beaconMaterial(): THREE.MeshLambertMaterial {
  const m = MAT.beacon.clone();
  const k = beaconCount++;
  // Golden-ratio spacing spreads phases evenly; periods vary between 1.3 and 2.1 s.
  beacons.push({ ref: new WeakRef(m), phase: (k * 0.618) % 1, period: 1.3 + ((k * 0.381) % 1) * 0.8 });
  return m;
}

/** Night lighting: windows and beacons glow, grow lights get brighter. 0 = day, 1 = night. */
export function setNightLevel(level: number): void {
  night = THREE.MathUtils.clamp(level, 0, 1);
  MAT.glass.emissiveIntensity = 0.9 * night;
  MAT.lamp.emissiveIntensity = 0.2 + 1.3 * night;
}

/**
 * Per-frame life for shared materials: beacons blink (a short flash every ~1.6 s, faint
 * by day and bright at night) and grow lights breathe softly.
 */
export function animateSharedMaterials(t: number): void {
  const base = 0.25 + 1.1 * night;
  for (let i = beacons.length - 1; i >= 0; i--) {
    const b = beacons[i];
    const m = b.ref.deref();
    if (!m) { beacons.splice(i, 1); continue; }
    const u = (t / b.period + b.phase) % 1;
    m.emissiveIntensity = base * (u < 0.14 ? 1 : 0.2);
  }
  MAT.lamp.emissiveIntensity = 0.2 + 1.3 * night;
  MAT.ledGrow.emissiveIntensity = (0.6 + 0.8 * night) * (0.92 + 0.08 * Math.sin(t * 1.3));
}
