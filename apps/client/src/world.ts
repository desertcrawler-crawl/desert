import * as THREE from "three";
import { GREYBOX, terrainHeight } from "@desert/sim";
import { buildRock } from "./art/placeholders.ts";
import { loadArt } from "./art/loader.ts";

/** Warm haze colour; also the sky, so distant ground fades into it. */
export const HAZE = new THREE.Color(0xe9c99a);

/**
 * Fixed afternoon sun, low in the south-west (spec working proposal).
 * In Three.js, west is -x and south is +z.
 */
export const SUN_DIRECTION = new THREE.Vector3(-0.62, 0.42, 0.66).normalize();

export async function buildWorld(scene: THREE.Scene): Promise<{ sun: THREE.DirectionalLight }> {
  scene.background = HAZE;
  // Haze: near things clear, softened by ~150-200 m (spec working target).
  scene.fog = new THREE.Fog(HAZE, 35, 190);

  scene.add(new THREE.HemisphereLight(0xfff1d6, 0xb07a45, 0.9));
  const sun = new THREE.DirectionalLight(0xffd9a0, 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const s = 45;
  Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 200 });
  sun.shadow.bias = -0.0008;
  scene.add(sun, sun.target);

  scene.add(buildTerrain());

  const rockArt = await loadArt("rock");
  GREYBOX.rocks.forEach((r, i) => {
    const rock = rockArt ? rockArt.scene.clone() : buildRock(i + 1);
    // Art and placeholder are both ~2 m across and 2 m tall at scale 1.
    rock.scale.set(r.radius, r.height / 2, r.radius);
    rock.position.set(r.x, terrainHeight(r.x, r.z) - 0.2, r.z);
    rock.rotation.y = i * 1.7;
    scene.add(rock);
  });

  return { sun };
}

/** Ground mesh from the shared height function, extended past the greybox edge as scenery. */
function buildTerrain(): THREE.Mesh {
  const size = GREYBOX.halfSize * 2 + 300;
  const seg = 180;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.getAttribute("position");
  const colors = new Float32Array(pos.count * 3);
  const a = new THREE.Color(0xe3b878);
  const b = new THREE.Color(0xd49c5c);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = terrainHeight(x, z);
    pos.setY(i, h);
    c.copy(a).lerp(b, THREE.MathUtils.clamp(0.5 + h * 0.35 + 0.15 * Math.sin(x * 0.7 + z * 0.3), 0, 1));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  mesh.receiveShadow = true;
  mesh.name = "terrain";
  return mesh;
}
