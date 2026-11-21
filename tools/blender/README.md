# Blender scripts

`old_man.py` builds the old man (`crawler.glb`) from scratch: low-poly mesh with vertex colours, a 20-bone rig and every clip the crawler slot uses (`crawl`, `crawl_idle`, `walk`, `walk_idle`, `stand_up`, `lie_down`, `dying_breathe`, `death`, `slap`, `slapped`, `drink`). It follows niclas's character sheet. Everything is made in code, so it is safe to commit.

Rebuild the model (Blender 4.2 or newer, or `pip install bpy`):

```
blender -b -P tools/blender/old_man.py -- apps/client/public/assets/models/crawler.glb old_man.blend
```

The second path is optional and saves a `.blend` you can open and edit by hand.

`render_previews.py` renders stills from that `.blend`, for example:

```
blender -b old_man.blend -P tools/blender/render_previews.py -- previews front:rest:1:front crawl:crawl:1:side
```

Each shot is `name:clip:frame:view`, where view is `front`, `side`, `back`, `threeq` or `threeq_back`, and clip `rest` means the unposed model.
