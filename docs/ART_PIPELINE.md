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
| crawler | `crawler.glb` | `crawl`, `crawl_idle`, `walk`, `walk_idle`, `stand_up`, `lie_down`, `dying_breathe`, `slap`, `slapped`, `death`, `drink` | The stranded old man. About 1.8 m tall standing. One file holds the mesh, rig and all clips. |
| well | `well.glb` | none | About 1.6 m across. Name the water surface mesh `water`: it turns dry when someone drinks, then the well fades. |
| skeleton | `skeleton.glb` | `slapped` | Lying on its back, about 1.7 m long. Name the skull mesh `skull`. |
| cross | `cross.glb` | none | Wooden grave cross, about 1.1 m tall. The name label is drawn by the game. |
| scorpion | `scorpion.glb` | `idle`, `sting` | About 0.8 m long, readable from a distance. |
| rock | `rock.glb` | none | About 2 m across and 2 m tall. Each map rock scales it to its own size. |
| wall | `ruin_wall.glb` | none | A ruin wall block 1 m long (X), 1 m thick and 1 m tall. Each map wall stretches it, so keep it a simple block with worn edges. |
| dead_tree | `dead_tree.glb` | none | Bare, sun-bleached tree, about 4.5 m tall. Not placed in the map yet. |
| shrub | `shrub.glb` | none | Dry shrub, about 1.5 m across, 0.9 m tall. Not placed in the map yet. |
| cactus | `cactus.glb` | none | About 2.4 m tall. Not placed in the map yet. |
| ruin_column | `ruin_column.glb` | none | Broken column on a plinth, about 3 m tall. Not placed in the map yet. |

Clips that are missing are fine: the game falls back to the first clip in the file, and more clips get used as later milestones add the states they belong to.

## The free placeholder pack

Most slots above currently hold a free placeholder model (CC0, so commercial use is fine) so the game looks like a desert before the real art exists. Drop your own file over any of them. Where each one came from is in [`apps/client/public/assets/CREDITS.md`](../apps/client/public/assets/CREDITS.md), and the scripts that converted, recoloured and scaled them are in `tools/free-assets/`. Delete a file to get the code placeholder back.

## Conventions

- **Scale:** 1 Blender unit = 1 metre.
- **Facing:** the model looks towards Blender's **-Y**, that is, towards you in Front view (numpad 1). This is the glTF standard, and the game turns the model to face where the character is heading.
- **Origin:** on the ground, in the centre of the footprint.
- **Style:** low-poly and flat-shaded reads best with the game's lighting, but any style works. See [ART_BRIEF.md](ART_BRIEF.md) for priorities, budgets and the palette.
- **Export settings:** "Apply modifiers" on; include animations; +Y up (the Blender default for glTF).

## Sounds

Every sound is generated in code for now, and there is no music (spec section 14). To replace a sound with a recording, drop a file named after its slot into `apps/client/public/assets/sounds/` (`.ogg`, `.mp3` or `.wav`), for example `slap.ogg`. Add variants as `slap_2.ogg`, `slap_3.ogg` and so on; one is picked at random each time. The slot list, with a note on each, is in `apps/client/src/audio/slots.ts`:

`wind` (loop), `gust`, `breath_in`, `breath_out`, `gasp`, `sand`, `footstep`, `slap`, `clatter`, `groan`, `sparkle`, `drink`, `sting`.

Placeholder recordings (synthesised, CC0) currently fill `wind`, `gust`, `breath_in` and `breath_out`; delete them to hear the generated versions again.

Sounds from other players fade with distance (silent past 30 m) and pan left or right with direction. Players can mute with M or the sound button under the minimap.
