# Art pipeline: replacing the placeholders

The game ships with code-built low-poly placeholders. Every placeholder sits in an **art slot**, and any slot can be replaced with your own `.glb` file without touching code.

## Steps

1. Model and animate in Blender (or any tool that exports glTF).
2. Export as **glTF Binary (.glb)** into `apps/client/public/assets/models/`, using the slot's file name from the table below.
3. Reload the game. If the file is there and valid, it is used; if not, the placeholder appears and the browser console says why.

## Slots

The list lives in `apps/client/src/art/manifest.ts`. Add new slots there as the game grows.

| Slot | File | Animation clips the game looks for | Notes |
| --- | --- | --- | --- |
| crawler | `crawler.glb` | `crawl`, `crawl_idle` now; later `walk`, `walk_idle`, `stand_up`, `lie_down`, `dying_breathe`, `slapped`, `death`, `drink` | The stranded old man. About 1.8 m tall standing. One file holds the mesh, rig and all clips. |
| rock | `rock.glb` | none | About 2 m across and 2 m tall. Each map rock scales it to its own size. |
| dead_tree | `dead_tree.glb` | none | Bare, sun-bleached tree, about 4.5 m tall. |
| shrub | `shrub.glb` | none | Dry shrub, about 1.5 m across, 0.9 m tall. |
| cactus | `cactus.glb` | none | About 2.4 m tall. |
| ruin_column | `ruin_column.glb` | none | Broken column on a plinth, about 3 m tall. |
| ruin_wall | `ruin_wall.glb` | none | Crumbling wall section, about 2.6 m long and high. |
| well | `well.glb` | none | Stone well with posts, rope and bucket, about 2 m across. |
| skeleton | `skeleton.glb` | none | Lying on its back, head towards +Z, about 1.7 m long. |
| cross | `cross.glb` | none | Wooden grave cross, about 1.3 m tall. |
| scorpion | `scorpion.glb` | `idle`, `walk`, `attack` | About 1.4 m long with the tail (game-sized). |

Clips that are missing are fine: the game falls back to the first clip in the file, and more clips get used as later milestones add the states they belong to.

## The free placeholder pack

Every slot above currently holds a free placeholder (CC0, so commercial use is fine) so the game looks like a desert before the real art exists. They are stand-ins to be replaced: drop your own file over any of them. Where each one came from is in [`apps/client/public/assets/CREDITS.md`](../apps/client/public/assets/CREDITS.md). The scripts that converted, recoloured and scaled them are in `tools/free-assets/`.

## Sounds

Sound files live in `apps/client/public/assets/audio/` (Ogg Vorbis). Replace any of them by saving a file with the same name.

| File | Use |
| --- | --- |
| `wind_loop.ogg` | Constant desert wind bed, 40 s, loops seamlessly. |
| `wind_gust.ogg` | One 7 s gust to layer on top now and then. |
| `breathing_loop.ogg` | The old man's laboured breathing, 21 s, loops. |
| `breathing_dying.ogg` | Slower, weaker, rattling breaths for the dying state, 25 s, loops. |

## Conventions

- **Scale:** 1 Blender unit = 1 metre.
- **Facing:** the model looks towards Blender's **-Y**, that is, towards you in Front view (numpad 1). This is the glTF standard, and the game turns the model to face where the character is heading.
- **Origin:** on the ground, in the centre of the footprint.
- **Style:** low-poly and flat-shaded reads best with the game's lighting, but any style works.
- **Export settings:** "Apply modifiers" on; include animations; +Y up (the Blender default for glTF).
