# Model style guide

Every 3D model in NEXUS is built from code with the same rules, so the base reads as one coherent set of hardware.

## Scale and placement
- **1 unit = 1 meter.** The build grid is made of 2 m tiles, and every building takes up a whole number of tiles.
- The origin is the center of the footprint at ground level (y = 0), and the front faces **+Z**.
- Humans are 1.8 m tall. Doors are 2 m, and windows sit at 1.5 m.

## Geometry
- Flat shading only, with no textures and no smooth normals.
- **Fixed segment counts:** use 8 sides for anything thinner than 1 m across (legs, pipes, wheels, tanks), 12 sides for
  hulls and big round bodies, and 12 × 6 for domes. Never mix counts on the same kind of part.
- No bevels: edges stay hard. Details come from separate pieces (bands, hatches, ribs), not from denser meshes.
- Use as few triangles as possible: a building should stay below about 1,500 triangles per level (a level-5 station is about 8,500).

## Shared language (src/models/kit.ts)
Every structure is built from the same parts:
- **Pad:** an octagonal leveling plate under each building, because nothing sits directly on loose regolith.
- **Feet:** adjustable legs with round footpads.
- **Function band:** a thin colored ring that identifies the system (see the colors below).
- **Hatch:** a rounded-rectangle door with a dark frame.
- **Window:** a dark pane that glows warm at night.
- **Beacon:** a small lamp on top of each building, unlit by day and lit at night.

## Color (src/models/palette.ts)
Materials are shared and never created inside a model, so changing one color changes it everywhere.

| Role | Color | Used for |
|---|---|---|
| Hull | #F5F2EC bone white | Main body of every building |
| Hull shade | #BDB8AE | Secondary panels and end caps |
| Structure | #8A8780 | Frames, legs, masts |
| Dark metal | #3A3B3D | Joints, wheels, hatch frames |
| Solar cell | #2B3440 | Solar panels |
| Glass | #1E2226 | Windows, which turn warm #FFC98A at night |
| Regolith | #8E8A82 | Shielding berms and terrain |

**Function bands** are muted on purpose, so they never compete with the interface's state colors (amber and brick):

| System | Color |
|---|---|
| Habitat and life support | #A65A45 muted brick |
| Industry (ISRU, regolith) | #9C8556 ochre |
| Power | #4E6A86 steel blue |
| Greenhouse | #6E8B5A olive green |

## Real hardware each model is based on
- **Habitat:** a horizontal cylindrical module on legs, as in NASA surface-habitat studies. A regolith berm against it
  works as radiation shielding, and the berm grows when the player upgrades shielding.
- **Solar mast:** a tall vertical array that turns to follow the Sun, because at the south pole the Sun stays near the
  horizon (based on NASA's vertical solar array technology work).
- **Regolith processor:** a hopper, a reactor, and an oxygen tank, following the idea of extracting oxygen from regolith.
- **Greenhouse:** a tunnel with LED growth lights, inspired by plant growth experiments on the ISS.
- **Rover:** an open two-seat vehicle, like the lunar terrain vehicle planned for Artemis.

## Model list
| Model | Tiles | Band | Notes |
|---|---|---|---|
| Station, levels 1–5 | 4 × 3 → 9 × 9 | Habitat (lab: Industry) | `station(level, shield)`. 1 core module with airlock · 2 + node with cupola · 3 + crew quarters, roof handrails · 4 + lab with radiator wings, solar blankets, observation tower · 5 + inflatable habitat, floodlights, comms mast. Berms grow with shielding 0–3 |
| Regolith processor | 2 × 2 | Industry | Robots unload at the bottom of the conveyor |
| Solar mast | 1 × 1 | Power | `userData.tracker` turns to face the Sun |
| Battery | 1 × 1 | Power | Status window on the front |
| Greenhouse, levels 1–5 | 3 × 2 → 12 × 5 | Greenhouse | `greenhouse(level)`. 1 short tunnel · 2 long tunnel, two tanks · 3 two tunnels + service module · 4 + vertical farm tower · 5 + geodesic biodome with trees. `userData.plants` + `setPlantGrowth()` |
| Collector robot | 1 × 1 | Industry | Front bucket |
| Harvester robot | 1 × 1 | Greenhouse | Arm and crop basket |
| Expedition rover | 2 × 1 | Industry | Goes to the ice crater |
| Comms antenna | 1 × 1 | Habitat | Dish aimed low, where Earth sits |
| Lander | 3 × 3 | Habitat | Arrival set piece |
| Commander | — | Habitat (arm band, backpack) | 1.8 m, relaxed stance |

The terrain (`src/scene/terrain.ts`) keeps a flat building area with a 16 m radius. It also has a permanently shadowed
crater with ice glints at (34, −30). `heightAt(x, z)` gives the ground height, so anything can sit on the surface.

Review every model in `viewer.html`. The "Conjunto" (lineup) view puts all of them together to check scale.
