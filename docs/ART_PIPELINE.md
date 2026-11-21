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
| crawler | `crawler.glb` | `crawl`, `crawl_idle` now; later `walk`, `walk_idle`, `stand_up`, `lie_down`, `dying_breathe`, `slapped` | The stranded old man. About 1.8 m tall standing. One file holds the mesh, rig and all clips. |
| rock | `rock.glb` | none | About 2 m across and 2 m tall. Each map rock scales it to its own size. |

Clips that are missing are fine: the game falls back to the first clip in the file, and more clips get used as later milestones add the states they belong to.

## Conventions

- **Scale:** 1 Blender unit = 1 metre.
- **Facing:** the model looks towards Blender's **-Y**, that is, towards you in Front view (numpad 1). This is the glTF standard, and the game turns the model to face where the character is heading.
- **Origin:** on the ground, in the centre of the footprint.
- **Style:** low-poly and flat-shaded reads best with the game's lighting, but any style works.
- **Export settings:** "Apply modifiers" on; include animations; +Y up (the Blender default for glTF).
