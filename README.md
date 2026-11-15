# NEXUS: Last Horizon

A 3D lunar-base tycoon that trains junior astronauts to make real mission trade-offs, driven by live space-weather data.

Built by team **LifePlants** (Managua local event) for the **NASA Space Apps Challenge 2026**, challenge
[*Build a Junior Astronaut Mission Trainer*](https://www.spaceappschallenge.org/2026/challenges/junior-astronaut-mission-trainer/).

**Play it:** https://nexus.xinocore.com · [Español más abajo](#español)

> **Status:** early development. This README describes what we are building; features are added in small steps.

## The story

In 2039, Earth is going through a severe environmental and energy crisis. Project Nexus is launched to build a
scientific base on the Moon's south pole, where people can live and work, and to prepare the way to Mars. You are the
astronaut on the surface: you explore, build, keep the systems running, repair what space weather breaks, and grow the
food. Commander Rivera, on Earth, sends you orders and real measurements by radio, but she is 1.3 light-seconds away,
and the decisions are yours.

## What the player learns

Every choice costs something, just like in real mission planning:

- **Shelter or keep working?** A solar storm is coming. Sending the crew to the shelter protects them from radiation,
  but robots and the greenhouse stop.
- **Where does the power go in the dark?** On the ridges near the south pole the Sun shines more than 80% of the year, but darkness still comes (near the equator a lunar night lasts about 14 Earth days). Battery energy has to be split
  between life support, heating, and the greenhouse lights.
- **Grow or protect?** Regolith can become building material or radiation shielding, but not both.

## Real data in the game

| Source | What it drives in the game |
|---|---|
| [NASA DONKI](https://ccmc.gsfc.nasa.gov/tools/DONKI/) (solar flares and CMEs) | Each in-game solar storm recreates a real recent flare; its class (C, M, X) sets strength and warning time |
| [NOAA GOES proton flux](https://www.swpc.noaa.gov/products/goes-proton-flux) (live) | Background radiation level reported by Mission Control |
| [IMO meteor shower calendar](https://www.imo.net/resources/calendar/) | More micrometeoroid impacts on the base while a real shower is active |

Every number is attributed inside the game, on the "NASA Data" screen. When the device is offline, the game uses a dated
snapshot and says so: static data is never shown as live.

## Design goals

- **Audience:** easy to start for ages 7–12, with enough depth for teens and young adults.
- **Plays in the browser:** no download and no account, landscape layout, runs on low-end phones.
- **Bilingual:** Spanish and English.
- **Persistent base:** progress is saved on the device, and robots keep producing while you are away (up to 8 hours).

## Tech

Three.js, TypeScript, and Vite. Low-poly models are built from code, so no heavy assets are needed.

## Use of SI (AI) tools

We used Claude Code (Anthropic) as a coding assistant to scaffold and write parts of the code. The game concept,
story, and design decisions come from the team. Following the Space Apps rules, SI-generated content is identified
here, and no NASA logos or branding are used in the game.

---

## Español

**NEXUS: Último Horizonte** es un tycoon 3D de una base lunar, hecho para entrenar a astronautas junior en decisiones
reales de misión, con datos de clima espacial en vivo. Lo hace el equipo **LifePlants** (evento local de Managua) para el
**NASA Space Apps Challenge 2026**.

> **Estado:** en desarrollo. Las funciones se agregan poco a poco.

### La historia

En el año 2039, la Tierra atraviesa una grave crisis ambiental y energética. Se pone en marcha el Proyecto Nexus para
construir una base científica en el polo sur de la Luna, donde vivir y trabajar, y para preparar el camino a Marte. Tú
eres el astronauta en la superficie: exploras, construyes, mantienes los sistemas, reparas lo que daña el clima espacial
y cultivas la comida. Desde la Tierra, la comandante Rivera te envía órdenes y mediciones reales por radio, pero las
decisiones son tuyas.

### Lo que se aprende

- **¿Refugio o seguir trabajando?** Si llega una tormenta solar, el refugio protege de la radiación, pero los robots y
  el invernadero se detienen.
- **¿A qué va la energía en la oscuridad?** En las crestas del polo sur el Sol ilumina más del 80 % del año, pero la oscuridad llega igual (cerca del ecuador la noche dura unos 14 días terrestres), y la batería se reparte entre el
  soporte vital, la calefacción y las luces del invernadero.
- **¿Crecer o protegerse?** El regolito sirve como material de construcción o como blindaje, pero no para las dos cosas.

### Datos reales

Las tormentas recrean fulguraciones reales registradas en NASA DONKI. La radiación de fondo viene de los satélites
GOES de NOAA, y los impactos de micrometeoritos aumentan durante las lluvias de meteoros reales del calendario de la
IMO. Cada dato se cita dentro del juego, en la pantalla "Datos NASA".

### Tecnología

Three.js, TypeScript y Vite. Se juega en el navegador, en horizontal y en español o inglés.
