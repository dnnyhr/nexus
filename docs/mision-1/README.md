# NEXUS — proyecto único y arranque de cinco agentes

## Estado

Repo y carpeta de trabajo: `dnnyhr/nexus`, `/home/sma/Documentos/Proyectos_Desarrollo/nexus`.

Baseline descargado: `01d79c69fefd739caa9be9eb1fd352673f861b5b`. HailMary de referencia: `79dacdc536acff10631a23b0a13b59096257f5bf`. Remoto único de trabajo: `origin = https://github.com/dnnyhr/nexus.git`.

Baseline verificado: `npm ci` completado, 152 tests en 15 archivos y build correctos. Son verificaciones automáticas del NEXUS actual; no acreditan nueva misión ni QA humana.

Preparado: documentos consolidados, cinco prompts, contrato de tipos compilable y referencias educativas HailMary dentro de esta repo. Pendiente: implementar motor de misión, pantallas, integración y QA. No se fusionó código de negocio ni historial Git de HailMary. No se hicieron commits, push ni deploy durante esta preparación.

HailMary original permanece intacto como respaldo. No hace falta abrirlo para desarrollar Misión 1. Referencias seleccionadas viven en [HailMary](../referencias/hailmary/README.md), fuera de `src` y sin dependencias React.

## Dirección

**Preparar base → operar tycoon 3D → pausar y proyectar → ejecutar decisión → informe → rediseñar.**

Primera misión: «Primera oscuridad», 600 segundos de simulación, 300 créditos, soporte vital, energía, cultivo y blindaje. Modo libre actual se conserva dentro del mismo producto.

## Qué leer

1. [Contrato común](00-contrato-mision-1.md).
2. [Revisión de los prompts recibidos](revision-prompts.md).
3. [Tipos compartidos](../../src/engine/types.ts).
4. Prompt del rol correspondiente.

## Cinco agentes

| Orden | Rol | Prompt | Rama |
| --- | --- | --- | --- |
| 1 | Integrador y dirección | [Integrador](agente-integrador.md) | `feat/mision-1` |
| 2 | A — motor | [Motor](agente-A-motor.md) | `feat/mision-motor` |
| 3 | B — menú, preparación, barra | [Preparación](agente-B-preparar.md) | `feat/mision-preparar` |
| 4 | C — comandante e informe | [Comandante](agente-C-comandante.md) | `feat/mision-comandante` |
| 5 | D — QA y regresión | [QA](agente-D-QA.md) | `test/mision-qa` |

## Arranque sin pisarse

Abrir **NEXUS** como workspace. Coordinación actual verificada desde esta carpeta, rama `feat/mision-1`, origin `dnnyhr/nexus`.

Primero integrador revisa preparación y registra baseline compartido en commit local cuando ejecute su encargo. Después crea cuatro worktrees desde ese commit; no son cuatro proyectos independientes ni cuatro remotos:

```sh
git worktree add .worktrees/motor -b feat/mision-motor feat/mision-1
git worktree add .worktrees/preparar -b feat/mision-preparar feat/mision-1
git worktree add .worktrees/comandante -b feat/mision-comandante feat/mision-1
git worktree add .worktrees/qa -b test/mision-qa feat/mision-1
```

Comprobar antes que ramas y rutas no existan. No sobrescribir carriles existentes. Cada agente recibe su ruta de worktree y ejecuta `npm ci` allí si faltan dependencias. B y C pueden preparar módulos contra tipos, pero no declarar build o flujo integrados antes de incorporar motor real de A.

Integración local: contrato/base → A → B → C → D y correcciones. Solo integrador fusiona ramas en `feat/mision-1`; agentes no hacen checkout ni merge sobre raíz compartida. Los prompts recibidos proponían 8 horas: referencia de alcance, no plazo confirmado ni promesa de entrega.

Mensajes cortos listos para pegar: [INICIO-5-AGENTES.txt](INICIO-5-AGENTES.txt).

## Límites

Sin merge a `main`, push ni publicación automática. Sin borrado de HailMary. Manifest existente no prueba offline: no se encontró service worker en árbol inspeccionado. Misión completa, PWA offline y QA en teléfono siguen pendientes.

## Coordinación preparada — 2026-11-15

Verificación actual: 152 tests en 15 archivos y `npm run build` pasan. Las 12 referencias coinciden con sus SHA256 documentados. Solo existe contrato en `src/engine/types.ts`: motor y fusión jugable siguen pendientes. No se realizó QA de navegador, teléfono, instalación ni offline.

El WIP recibido corresponde al paquete de preparación: `.gitignore`, `README.md`, `AGENTS.md`, `docs/mision-1/`, `docs/referencias/hailmary/` y `src/engine/types.ts`. Se conserva su contenido en baseline local compartido; no se modifica lógica existente, dependencias ni lockfile. Esta coordinación prepara carriles; no inicia implementación de los cinco encargos.

Integrador usa checkout principal. Carriles previstos desde el mismo commit de preparación:

- A: `/home/sma/Documentos/Proyectos_Desarrollo/nexus/.worktrees/motor`, `feat/mision-motor`.
- B: `/home/sma/Documentos/Proyectos_Desarrollo/nexus/.worktrees/preparar`, `feat/mision-preparar`.
- C: `/home/sma/Documentos/Proyectos_Desarrollo/nexus/.worktrees/comandante`, `feat/mision-comandante`.
- D: `/home/sma/Documentos/Proyectos_Desarrollo/nexus/.worktrees/qa`, `test/mision-qa`.

### Gates de entrega

1. Integrador registra baseline y crea carriles sin sobrescribir ramas/rutas. Comunica hash con `git log -1 --format=%H` en cada carril antes del arranque.
2. A entrega motor real compilable, API y decisiones de balance. Cambios de tipos requieren coordinación previa. B/C pueden preparar módulos contra contrato; D prepara casos y riesgos.
3. Integrador revisa e incorpora A localmente. Comunica commit concreto; coordina incorporación en B/C/D sin `pull` ni merges autónomos. B/C validan sus módulos contra motor real.
4. Integrador incorpora B y C, conecta flujo y revisa todas las rutas de mutación/guardado. D recibe commit integrado para probar producto real, sin mocks ni runner sustituto.
5. D entrega pruebas y reporte; correcciones vuelven al dueño. Tests/build y QA real se reportan por separado. Ninguna entrega habilita push, main o deploy.

Cada entrega comunica ruta, rama, commit, archivos propios, API, pruebas realizadas y bloqueos. Si solo hay cuatro agentes simultáneos disponibles, integrador ocupa un puesto y D inicia al liberarse A; se mantienen cinco roles sin compartir checkout.
