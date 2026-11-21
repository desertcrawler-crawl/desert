import * as THREE from 'three';
import sharp from 'sharp';
import fs from 'fs';
import { io, fit, materials, save, hex, DL } from './lib.mjs';
import { transformMesh } from '@gltf-transform/functions';
const Q = `${DL}/t1/quaternius`, MK = `${Q}/stylized-nature-megakit/glTF`;
const K = `${DL}/kenney.nl`;
const KG = `${K}/kenney_graveyardkit_3/Models/GLTF format`, KN = `${K}/kenney_natureKit_2.1/Models/GLTF format`, KF = `${K}/fantasy-town-kit-1.0/Models/GLTF format`;

// rock: Quaternius rock with the pack's own desert texture
{
  const d = await io.read(`${MK}/Rock_Medium_1.gltf`);
  const img = fs.readFileSync(`${MK}/Rocks_Desert_Diffuse.png`);
  for (const t of d.getRoot().listTextures()) { t.setImage(img); t.setURI('rock_desert.png'); }
  materials(d);
  fit(d, { width: 2.2, sink: 0.05 });
  { const h = d.getRoot().listNodes().find(n => n.getName() === 'Root'); const sc = h.getScale(); h.setScale([sc[0], sc[1] * 1.3, sc[2]]); const t = h.getTranslation(); h.setTranslation([t[0], t[1] * 1.3, t[2]]); }
  await save(d, 'rock');
}
// dead tree
{
  const d = await io.read(`${MK}/DeadTree_1.gltf`);
  materials(d, {});
  // Sun-bleached: lighten the bark texture (normal map left alone).
  for (const m of d.getRoot().listMaterials()) {
    const t = m.getBaseColorTexture();
    t.setImage(await sharp(Buffer.from(t.getImage())).modulate({ brightness: 2.4, saturation: 0.55 }).png().toBuffer());
  }
  fit(d, { height: 4.5, sink: 0.1 });
  await save(d, 'dead_tree');
}
// shrub: Quaternius bush, tinted dry
{
  const d = await io.read(`${KN}/plant_bushDetailed.glb`);
  materials(d, { grass: 0x8c8450 });
  fit(d, { height: 0.9, sink: 0.05 });
  await save(d, 'shrub');
}
// cactus
{
  const d = await io.read(`${KN}/cactus_tall.glb`);
  materials(d, { leafsGreen: 0x6f8a4c });
  fit(d, { height: 2.4, sink: 0.05 });
  await save(d, 'cactus');
}
// ruins
{
  const d = await io.read(`${KN}/statue_columnDamaged.glb`);
  materials(d, { stoneDark: 0xa8774f, stone: 0xd2a676 });
  fit(d, { height: 3.0 });
  await save(d, 'ruin_column');
}
// wooden grave cross
{
  const d = await io.read(`${KG}/crossWood.glb`);
  materials(d, { wood: 0x8a6a48 });
  // Drop the stone plinth: a bare wooden cross stuck in the sand.
  for (const mesh of d.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) if (p.getMaterial()?.getName() === 'stone') p.dispose();
  fit(d, { height: 1.1 });
  await save(d, 'cross');
}
