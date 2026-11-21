# Free placeholder pack: build scripts

How the placeholder models and sounds in `apps/client/public/assets/` were made, so they can be rebuilt or tweaked. Sources and licenses are in `apps/client/public/assets/CREDITS.md`.

These scripts are not part of the game build. To run them, put them in a folder with `npm i @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions three sharp` (and `pip install numpy scipy` plus `ffmpeg` for the sounds), and put the source packs in `../dl/` as the paths at the top of each script expect.

- `props.mjs`: rock, dead tree, shrub, cactus, ruins, skeleton, cross (fit to size, origin on the ground, desert recolour, lit materials, small textures).
- `crawler.mjs`: the mannequin with its clips renamed to the game's names, hair and beard added.
- `custom.mjs`: the well and the animated scorpion, built from simple shapes.
- `synth.py`: wind and breathing sounds.
