import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRMaterialsUnlit } from '@gltf-transform/extensions';
import { prune, dedup, textureCompress, weld } from '@gltf-transform/functions';
import sharp from 'sharp';
export const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
export const DL = '../dl';
export const OUT = '../out/models';

export function hex(c) { return [((c>>16)&255)/255, ((c>>8)&255)/255, (c&255)/255].map(v => Math.pow(v, 2.2)); }

/** Wrap the scene in one root, fit it to a size, put origin on the ground at footprint centre. */
export function fit(doc, { height, width, rotX = 0, rotY = 0, rotZ = 0, sink = 0 }) {
  const root = doc.getRoot();
  const scene = root.getDefaultScene() || root.listScenes()[0];
  for (const s of root.listScenes()) if (s !== scene) s.dispose();
  const holder = doc.createNode('Root');
  const inner = doc.createNode('Fit');
  for (const c of scene.listChildren()) { scene.removeChild(c); inner.addChild(c); }
  holder.addChild(inner); scene.addChild(holder);
  // rotation as quaternion from euler XYZ
  const q = eulerQ(rotX, rotY, rotZ);
  inner.setRotation(q);
  let b = getBounds(scene);
  const size = [b.max[0]-b.min[0], b.max[1]-b.min[1], b.max[2]-b.min[2]];
  let s = 1;
  if (height) s = height / size[1];
  else if (width) s = width / Math.max(size[0], size[2]);
  holder.setScale([s, s, s]);
  b = getBounds(scene);
  const cx = (b.min[0]+b.max[0])/2, cz = (b.min[2]+b.max[2])/2;
  holder.setTranslation([-cx, -b.min[1] - sink * s, -cz]);
  b = getBounds(scene);
  return b;
}
export function eulerQ(x, y, z) {
  const c1=Math.cos(x/2), c2=Math.cos(y/2), c3=Math.cos(z/2), s1=Math.sin(x/2), s2=Math.sin(y/2), s3=Math.sin(z/2);
  return [s1*c2*c3 + c1*s2*s3, c1*s2*c3 - s1*c2*s3, c1*c2*s3 + s1*s2*c3, c1*c2*c3 - s1*s2*s3];
}
/** Lit, matte materials; optional recolour by material name. */
export function materials(doc, colors = {}) {
  for (const m of doc.getRoot().listMaterials()) {
    m.setExtension('KHR_materials_unlit', null);
    m.setMetallicFactor(0); m.setRoughnessFactor(1);
    const c = colors[m.getName()];
    if (c !== undefined) m.setBaseColorFactor([...hex(c), 1]);
  }
  for (const e of doc.getRoot().listExtensionsUsed()) if (e.extensionName === 'KHR_materials_unlit') e.dispose();
}
export async function save(doc, name, { tex = 256 } = {}) {
  await doc.transform(dedup(), prune(), textureCompress({ encoder: sharp, resize: [tex, tex] }));
  const path = `${OUT}/${name}.glb`;
  await io.write(path, doc);
  const b = getBounds(doc.getRoot().getDefaultScene());
  const fs = await import('fs');
  console.log(name.padEnd(14), (fs.statSync(path).size/1024).toFixed(0).padStart(5)+' KB', 'size', [0,1,2].map(i => (b.max[i]-b.min[i]).toFixed(2)).join(' x '), 'minY', b.min[1].toFixed(2));
}
