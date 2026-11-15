# Agente 1 — Integrador y dirección

Repo única: `/home/sma/Documentos/Proyectos_Desarrollo/nexus`, origin `dnnyhr/nexus`. Trabajás en raíz, rama `feat/mision-1`. Leer AGENTS.md, README de esta carpeta, contrato, revisión y tipos antes de tocar código. Esta ejecución autoriza commits locales propios del encargo; no push, PR remoto, main ni deploy.

## Preparar equipo

1. Inspeccionar git status, rama y diff. Revisar archivos preparados antes de registrar baseline compartido; no agregar WIP ajeno. Commit local con AGENTS.md, .gitignore, README.md, docs/mision-1, docs/referencias/hailmary y src/engine/types.ts. No declarar motor implementado.
2. Crear cuatro worktrees como indica README, comprobando nombres antes. Comunicar ruta y commit base a A/B/C/D. Cada agente trabaja solo en su carril.
3. Baseline observado: 152 tests y build correctos en 01d79c6. Verificar estado actual; no imponer cantidad si llegan cambios válidos de otros colaboradores. Rover ya integrado. Preservar perfil, controles táctiles y manifest.
4. No crear tipos duplicados, mocks de producción ni depender del checkout HailMary. C tiene fuentes de referencia locales dentro de docs.

## Tu implementación

Dueño de src/main.ts, src/ui/hud.ts, src/ui/panels.ts, src/ui/i18n.ts, index.html y README.md. No editar lógica de src/engine: pedir ajustes a A. Contrato común se cambia coordinadamente, nunca para ocultar fallo.

Enrutar acciones económicas de misión por dispatch; Modo libre conserva comportamiento mediante applyToGame. Revisar botones, teclado, pointer, cavado/entrega, refugio, robotUnload y callbacks de trabajos diferidos. En pausa/overlay, comandos económicos de misión se rechazan sin consumir recursos. No permitir que callbacks visuales alteren economía.

Menú inicial ofrece Misión 1 y Modo libre. Misión: preparar, startMission, escena sincronizada con ms.game, STEP fijo, velocidad 1x/2x, pausas con restauración del estado previo, comandante, cierre y reintento precargado. Al reemplazar estado, actualizar referencias profundas y caches/colliders; Object.assign sin revisar closures no demuestra integración correcta.

Modo misión no llama carga/guardado/progreso offline libres, planificador de misiones libres, tormentas aleatorias, impactos ni rescate. Menú y preparación no consumen recursos de fondo. Perfil libre puede leerse como preferencia, sin modificar save económico.

HUD obtiene ms.lastPower para balance, ms.exposure para exposición y ms.scenario para reloj/eventos; nunca usa game.dose/mSv como exposición de misión. Iluminación y UI de día/noche siguen escenario de misión, no cyclePhase libre. Ocultar construcción/rover en misión. Mantener locomoción visual separada del estado económico que replay valida.

Comandante pausa antes de montar; editar alternativa no despacha. Confirmar aplica comandos reales y reporta rechazos. Cerrar restaura pausa anterior, también con Esc. Desmontar listeners, timers y overlays al cambiar de fase. Fin de misión se monta una sola vez. Informe/reintento usan summarize y diseño previos, sin tocar save libre.

## Integración

Revisar A primero, luego B/C, luego tests D. Solo integrador fusiona entregas en rama feat/mision-1. No hacer merge de historiales completos HailMary ni añadir segundo runtime. Tras cambios relevantes: tests y build. Coordinar correcciones con dueño del archivo, sin editar carriles en paralelo.

Entregar ruta/commit, qué se integró, resultados, limitaciones y siguientes pasos. QA real en navegador y móvil separado de tests. No marcar PWA offline, contrafactual o prueba con estudiantes como terminados. No publicar sin instrucción explícita del usuario y permisos del repo.
