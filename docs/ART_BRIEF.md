# Art brief: models that match the new look

The game now draws its own sky, haze, lighting, sand and dust. The remaining job is the **models**. This brief says what to make first, and how to make it sit well in the scene. How to export and where to put the files is covered in [ART_PIPELINE.md](ART_PIPELINE.md).

## The look in one line

Late-90s low-poly shapes, lit like a modern game: a fixed low afternoon sun from the **south-west**, long shadows, warm dusty haze, and **cool violet-blue shade**. No photorealism.

## What the engine already gives your models

- **Sun:** warm orange-white, about 25° above the horizon, from the south-west. It never moves.
- **Shade:** sky light is a dusty blue and the ground bounces warm orange back up. So faces turned away from the sun go cool, and undersides pick up a warm glow. You don't need to paint lighting into textures.
- **Haze:** objects fade into warm sand colour with distance, so silhouettes matter more than small detail beyond about 40 m.
- **Tone mapping and grading:** very bright colours are gently compressed. Mid-saturated colours read best, and pure fully saturated colours come out harsh.

## Priorities

1. **The old man (`crawler.glb`).** He is on screen all the time, so he matters most. Make him readable from behind and from 5 m away: long white hair and beard, ragged clothes, a thin and hunched body. A clear silhouette while crawling is more important than a detailed face.
2. **Landmarks.** These are the places players navigate by. Today they are built from the generic rock and wall. Each one deserves its own model, with a shape you can recognise from 150 m:
   - **Split Spire** (map centre): two tall sandstone fingers about 16 m high, with a gap between them.
   - **Twin Teeth** (west): a pair of jagged ridges on raised ground.
   - **Crescent Crest** (north): a sweeping dune ridge. This one may need only a few wind-carved rocks along the crest.
   - **Buried Gate** (east): an ancient gateway, half sunk in sand.
   - **Fallen Dome** (south): a collapsed dome, with broken ribs showing.
3. **Rock kit (`rock.glb`):** 2 or 3 variations would already break up the repetition.
4. **Well, skeleton, scorpion and cross.** Small, but players look at them up close.

For landmarks, tell me when you start. They will need new art slots and a little map code so each one is placed as a single model. Their collision and shade shapes have to keep matching the map, so we'll agree the footprint first.

## Budgets (triangles)

| Model | Triangles | Texture |
| --- | --- | --- |
| Old man, with rig | 1,500 to 4,000 | one 512 px texture, or vertex colours |
| Landmark | 2,000 to 8,000 | one 512 to 1024 px texture |
| Rock | 150 to 600 | shared 256 px texture, or vertex colours |
| Well, skeleton, scorpion, cross | 200 to 1,200 | 256 px |

These are generous for the style. Fewer triangles with a strong shape will look better than more.

## Surface style

- **Flat or lightly smoothed shading.** Flat faces catch the low sun and give the N64 feel.
- **Colour from vertex colours or small hand-painted textures.** Use nearest or soft filtering. Don't use photo textures or normal maps.
- **Sandstone:** horizontal bands (strata) in the palette below. The placeholder rocks show the idea.
- **Keep values a bit lighter than you think.** The haze and the grade darken the edges of the screen slightly.

## Palette (sRGB)

| Use | Colours |
| --- | --- |
| Sand crest, mid, hollow | `#f3d29c`, `#e8b677`, `#d59e62` |
| Sandstone strata | `#c9845a`, `#dc9e6e`, `#efc18f`, `#d08c60`, `#b8704c` |
| Mud-brick ruins | `#cf9a68`, `#bf8657`, base stain `#9a6640` |
| Haze and horizon | `#e8c497` |
| Old man skin, rags, hair | around `#c98e62`, `#8a7458`, `#f4f1ea` |
| Water | around `#2f6d8c` |
| Accents (UI, danger) | `#e0793a`, `#d2412f` |

## Licences

Only CC0 or properly licensed assets go into the repository. Mixamo animations and characters can be used to test locally, but they must not be committed. Your own models are of course fine.
