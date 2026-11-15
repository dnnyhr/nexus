# Agente 4 — C: comandante e informe

Trabajás solo en `.worktrees/comandante`, rama `feat/mision-comandante`, repo NEXUS. Leer AGENTS.md, contrato, revisión y tipos. Referencias educativas locales: docs/referencias/hailmary/src/components y src/data/scenario.ts. No abrir ni importar otra repo. Commits locales propios permitidos; sin push/main/deploy.

Ownership: src/ui/mission/commander.ts, report.ts, chart.ts, report.css, commanderTexts.ts. No texts.ts de B ni motor/integración. UI en DOM, sin React ni librerías de gráficos. Sin mock.ts o previews falsas de producción. Para runtime esperar motor real y coordinar su incorporación en propia rama.

Exportar:

```ts
mountCommander(root: HTMLElement, opts: { getState(): MissionState; onClose(): void; onConfirm(plan: Command[]): void }): { destroy(): void }
mountReport(root: HTMLElement, opts: { getState(): MissionState; previous: Summary | null; onRetry(design: Design): void; onMenu(): void }): { destroy(): void }
renderChart(samples: Sample[], events: MissionEvent[], scenario: Scenario, opts?: { width?: number; height?: number; untilT?: number }): SVGSVGElement
```

Comandante abre con simulación ya pausada por integrador. Situación desde estado. Comparar project(ms, [], horizon) contra project(ms, plan, horizon) con mismo horizonte: 60 s, fin de oscuridad, fin de misión. Controles de luces, calefacción, procesador, robots, refugio; validar disponibilidad, mostrar rechazos. No despachar mientras cambia borrador. Confirmar devuelve plan; Esc/cancelar sin cambios. Integrador restaura pausa anterior. Eliminar debounce pendiente al destruir.

Mostrar mínimos vitales, energía final, exposición u, cosechas futuras calculadas del intervalo y fallo con tiempo/motivo. Declarar «Mantiene configuración; no supone riegos, ajustes ni cosechas manuales futuros». Si falla antes de horizonte, mostrar instante alcanzado. No recomendar automáticamente respuesta ni prometer causalidad.

Informe: resultado y motivo, tradeoffs medidos de summarize, gráfico SVG, tabla alternativa, timeline ordenado de comandos/eventos, diseño y coste, evaluación de soporte vital/alimentos/protección con fuentes, comparación con intento previo y reintento precargado. Explicaciones científicas sin afirmar coeficientes reales. Contrafactual desde checkpoint no forma parte de esta entrega.

Gráfico: recursos en %, exposición eje/escala u explícita; etiquetas y patrones además de color, bandas de escenario. Manejar 0/1 muestras sin NaN ni división por cero. Textos de tu carril solo en commanderTexts.ts. Estilos .c-/.r-, foco visible y scroll usable en teléfono horizontal.

Entregar firmas, commit, tests/build con motor real y QA efectuada. No ocultar fallo de proyección con cifras prefabricadas ni editar API por fuera de coordinación. Frase de pie: cifras didácticas, sin dosis médicas ni afiliación NASA.
