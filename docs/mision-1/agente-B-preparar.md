# Agente 3 — B: menú, preparación y barra

Trabajás solo en `.worktrees/preparar`, rama `feat/mision-preparar`, repo NEXUS. Integrador comunica ruta y baseline. Leer AGENTS.md, contrato, revisión, tipos, ui/dom.ts, hud.css y panels.ts. Commits locales propios permitidos; no push/main/deploy.

Ownership exclusivo: src/ui/mission/prepare.ts, missionBar.ts, mission.css y texts.ts. No src/engine, main, hud, panels, i18n ni commanderTexts.ts. No crear mock.ts, previews falsas ni tipos duplicados. Dependés de engine real de A para validar runtime; comunicar bloqueo concreto sin afirmar prueba con mocks.

Exportar:

```ts
mountStartMenu(root: HTMLElement, opts: { onMission(): void; onFree(): void; hasFreeSave: boolean }): { destroy(): void }
mountPrepare(root: HTMLElement, opts: { initial?: Design; previous?: Summary | null; onConfirm(d: Design): void; onBack(): void }): { destroy(): void }
mountMissionBar(root: HTMLElement, opts: MissionBarOptions): { update(): void; destroy(): void }
```

MissionBarOptions: getState(): MissionState; isPaused(): boolean; getSpeed(): 1|2; onTogglePause(): void; onSpeed(s:1|2): void; onOpenCommander(): void.

Menú: «Misión 1: Primera oscuridad» y «Modo libre», con objetivo breve y continuación libre si hay save. Preparar: ocho compras del contrato, grupos por cuatro sistemas, precio, cantidad, máximo, créditos restantes y validación real con checkDesign. Explicar capacidades y costes de oportunidad usando precios/cantidades actuales, no equivalencias falsas. Permitir crédito sin gastar. Diseño previo precargado al reintentar; inicial no debe mutarse por referencia.

Informar alcance de protección: berma protege dentro de refugio y curva actual satura desde nivel 2. No prometer beneficio adicional nivel 3 sin cambio aprobado. No afirmar que comprar batería equivale a recibir carga completa si motor no lo implementa.

Barra: pausa/reanudar, 1x/2x, tiempo, eventos próximos, exposición en u, botón Comandante y rótulo de pausa. Horizonte y eventos vienen de escenario, no hardcodear equivalencia de tiempo real con simulación. Priorizar tecla P; Espacio ya se usa para salto. Evitar atajos dentro de inputs y listeners duplicados. Renderizar cambios DOM como máximo 4 veces/s sin impedir feedback de controles; destroy elimina listeners/timers.

Estilos prefijo .m-, variables existentes, teléfono horizontal/táctil, controles >=44px, foco visible, texto para estados y navegación por teclado. No añadir dependencias.

Integrador recibe firmas reales y restricciones de montaje. Tests/build tras incorporar motor real de A en propia rama con coordinación. Informar pruebas de navegador realmente realizadas y pendientes. No editar archivos de otros agentes para resolver imports.
