import * as THREE from 'three';

// Shared materials. Models never create their own materials: changing a color here
// changes it everywhere. See docs/guia-modelos.md.

const flat = (color: number, extra: THREE.MeshLambertMaterialParameters = {}) =>
  new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra });

export const COLORS = {
  hull: 0xf5f2ec,
  hullShade: 0xbdb8ae,
  structure: 0x8a8780,
  darkMetal: 0x3a3b3d,
  solarCell: 0x2b3440,
  glass: 0x1e2226,
  glassLit: 0xffc98a,
  regolith: 0x8e8a82,
  regolithDark: 0x6b6862,
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
  structure: flat(COLORS.structure),
  darkMetal: flat(COLORS.darkMetal),
  solarCell: flat(COLORS.solarCell, { side: THREE.DoubleSide }),
  glass: flat(COLORS.glass, { emissive: COLORS.glassLit, emissiveIntensity: 0 }),
  regolith: flat(COLORS.regolith),
  regolithDark: flat(COLORS.regolithDark),
  bandHabitat: flat(COLORS.bandHabitat),
  bandIndustry: flat(COLORS.bandIndustry),
  bandPower: flat(COLORS.bandPower),
  bandGreenhouse: flat(COLORS.bandGreenhouse),
  plant: flat(COLORS.plant),
  plantLight: flat(COLORS.plantLight),
  greenhouseRoof: flat(0xe9efe2, { transparent: true, opacity: 0.38, depthWrite: false, side: THREE.DoubleSide }),
  ledGrow: flat(COLORS.ledGrow, { emissive: COLORS.ledGrow, emissiveIntensity: 0.6 }),
  beacon: flat(COLORS.beaconOff, { emissive: COLORS.beaconOn, emissiveIntensity: 0 }),
  suit: flat(COLORS.suit),
  visor: flat(COLORS.visor, { emissive: 0x7a5a2a, emissiveIntensity: 0.15 }),
} as const;

export type BandKind = 'habitat' | 'industry' | 'power' | 'greenhouse';

export const BAND: Record<BandKind, THREE.Material> = {
  habitat: MAT.bandHabitat,
  industry: MAT.bandIndustry,
  power: MAT.bandPower,
  greenhouse: MAT.bandGreenhouse,
};

/** Night lighting: windows and beacons glow, grow lights get brighter. 0 = day, 1 = night. */
export function setNightLevel(level: number): void {
  const t = THREE.MathUtils.clamp(level, 0, 1);
  MAT.glass.emissiveIntensity = 0.9 * t;
  MAT.beacon.emissiveIntensity = 1.2 * t;
  MAT.ledGrow.emissiveIntensity = 0.6 + 0.8 * t;
}
