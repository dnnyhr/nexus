# HailMary — referencias incorporadas a NEXUS

Origen: https://github.com/MiguelSalmeron/HailMary, commit `79dacdc536acff10631a23b0a13b59096257f5bf`. Archivos copiados del checkout local limpio, sin cambios de contenido. Créditos originales del proyecto LifePlants conservados en README-original.md.

Finalidad: adaptar balances, proyección, explicación científica, timeline, gráfico, informe y validación por replay al motor NEXUS. Estas fuentes React y su motor de siete ciclos **no se ejecutan** dentro de NEXUS. No importar desde esta carpeta ni añadir dependencias para compilarlas.

No se copió .git, node_modules, dist, credenciales, configuración local ni una segunda aplicación ejecutable. La repo activa y su origin siguen siendo NEXUS. HailMary original se conserva como respaldo, sin dependencia de desarrollo sobre su ruta.

Esta referencia es puntual; no implica sincronización automática entre proyectos ni QA actual de HailMary. NASA y demás enlaces se conservan como fuentes del contenido original, sin afirmar revisión web nueva.

## Integridad de fuentes

- `README-original.md` — SHA256 `4c576f420911814cbce4d67fad5ac51c060f106742cb345a059b2a6d2b0eb14a`
- `src/engine/simulation.ts` — SHA256 `6800da89666f5b4687a698a67e4161470a937cd81866973d4894a9b74442b5d4`
- `src/engine/types.ts` — SHA256 `110ae8961176847b9af28666130cf3057a0a048c8ae6651e8b05aca284d1ab26`
- `src/engine/simulation.test.ts.txt` — SHA256 `026786c9a9f7a3ec96487737b936b97fb0af482b572cdae310aed5991d94442f`
- `src/data/scenario.ts` — SHA256 `cc534b6ffa1543e0b2df195d5ee15398972d4cbb9a5628d5dfc2483b568d1572`
- `src/storage/persistence.ts` — SHA256 `fb0f91dabd2c49472dc2dc5b515ded0de3788326fc5c0f3a418f1c32943420e6`
- `src/components/CycleBalance.tsx` — SHA256 `bbefcab8bd9563105172c5f9d3045a96108601cef5175e5ba0595ebef59e1297`
- `src/components/CounterfactualPanel.tsx` — SHA256 `87a080afb762e0b1927f6f5d623e020746b14c95ddb5adfafaf6a9bcea96b4be`
- `src/components/DecisionTimeline.tsx` — SHA256 `b93bccb7e5d9d6ddfb93ad60ac36b7f45aff8c84c91b740b4874c267be70a933`
- `src/components/DebriefScreen.tsx` — SHA256 `e661b28b87fe913262b499dd22277e5c245984e6e2c11c1a50bdf62713c735f4`
- `src/components/ResourceChart.tsx` — SHA256 `f4c769b77117c7fe63bada7183e140631ea3c025ca0723d443b97e9f0d2acf96`
- `src/components/BriefingScreen.tsx` — SHA256 `3378ef3d7b8de3443be0896c665b984df4ad592fe3c093be2498bab14dd93530`
