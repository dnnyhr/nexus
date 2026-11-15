import * as THREE from 'three';

let maps: (HTMLImageElement | null)[] = [];
let loading: Promise<void> | null = null;

export function preloadOrbitalMaps(): Promise<void> {
  if (loading) return loading;
  loading = Promise.all(['earth.png', 'moon.jpg'].map(file => new Promise<HTMLImageElement | null>(resolve => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = `${import.meta.env.BASE_URL}cinematics/${file}`;
  }))).then(images => { maps = images; });
  return loading;
}

export function createOrbitalScene(): { scene: THREE.Scene; dispose(): void } {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020306);
  const sun = new THREE.DirectionalLight(0xfff2df, 2.5);
  sun.position.set(-100, 80, 90);
  scene.add(sun, new THREE.AmbientLight(0x8195b6, 0.12));
  const planet = (radius: number, earth: boolean) => {
    const geometry = new THREE.SphereGeometry(radius, 64, 32);
    const pos = geometry.getAttribute('position');
    const colors = new Float32Array(pos.count * 3);
    const color = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) / radius, y = pos.getY(i) / radius, z = pos.getZ(i) / radius;
      const land = Math.sin(x * 8 + z * 3) + Math.cos(z * 10 - y * 5) + Math.sin(y * 12 + x * 4);
      const clouds = Math.sin(x * 39 + y * 14) * Math.cos(z * 33 - y * 16);
      if (earth) color.setHex(Math.abs(y) > 0.88 || clouds > 0.68 ? 0xd9e4e8 : land > 0.8 ? 0x657560 : 0x164e7b);
      else color.setScalar(0.25 + 0.05 * land);
      colors.set([color.r, color.g, color.b], i * 3);
    }
    const image = maps[earth ? 0 : 1];
    const map = image ? new THREE.Texture(image) : null;
    if (map) { map.colorSpace = THREE.SRGBColorSpace; map.needsUpdate = true; }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ map, vertexColors: !map }));
  };
  const earth = planet(6.371, true);
  const moon = planet(1.737, false);
  moon.position.x = 384.4;
  scene.add(earth, moon);
  const points = new Float32Array(600 * 3);
  for (let i = 0; i < 600; i++) {
    const a = i * 2.399963;
    const y = 1 - 2 * (i + 0.5) / 600;
    const r = Math.sqrt(1 - y * y);
    points.set([Math.cos(a) * r * 700, y * 700, Math.sin(a) * r * 700], i * 3);
  }
  const stars = new THREE.BufferGeometry();
  stars.setAttribute('position', new THREE.BufferAttribute(points, 3));
  scene.add(new THREE.Points(stars, new THREE.PointsMaterial({ color: 0xb9c6d5, size: 1, sizeAttenuation: false })));
  return { scene, dispose() {
    scene.traverse(object => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach(material => {
          if (material instanceof THREE.MeshLambertMaterial) material.map?.dispose();
          material.dispose();
        });
      }
    });
    scene.clear();
  } };
}
