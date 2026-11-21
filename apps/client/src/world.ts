import * as THREE from "three";
import { shadeFor, SUN, WORLD, terrainHeight } from "@desert/sim";
import { buildRock, buildWall } from "./art/placeholders.ts";
import { loadArt } from "./art/loader.ts";
import { buildSky, HAZE, installHaze } from "./look/haze.ts";

export { HAZE };

/** Fixed afternoon sun from the shared rules (low in the south-west). */
export const SUN_DIRECTION = new THREE.Vector3(SUN.x, SUN.y, SUN.z);

/** Wind direction across the map (x, z), used by sand ripples and blowing dust. */
export const WIND = new THREE.Vector2(0.86, 0.5).normalize();

export async function buildWorld(scene: THREE.Scene): Promise<{ sun: THREE.DirectionalLight }> {
  installHaze();
  scene.background = HAZE;
  // Haze: near things clear, softened by ~150-200 m (spec working target).
  scene.fog = new THREE.Fog(HAZE, 25, 230);
  scene.add(buildSky());

  // Sky light is a dusty blue so anything out of the sun turns cool; the ground
  // bounces warm orange light back up into shadowed faces.
  scene.add(new THREE.HemisphereLight(0xa9c4e0, 0xd08a4a, 1.25));
  // The live sun light only gives characters their small shadow; map shade is drawn
  // from the same precomputed grid the server uses, so what you see is what counts.
  const sun = new THREE.DirectionalLight(0xffcf94, 3.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const s = 14;
  Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 200 });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 3;
  // Until a player joins and the light starts following them, aim it from the fixed sun direction.
  sun.position.copy(SUN_DIRECTION).multiplyScalar(80);
  scene.add(sun, sun.target);

  scene.add(buildTerrain());

  const [rockArt, wallArt] = await Promise.all([loadArt("rock"), loadArt("wall")]);
  WORLD.rocks.forEach((r, i) => {
    const rock = rockArt ? rockArt.scene.clone() : buildRock(i + 1, r.height / r.radius);
    // Art and placeholder are both ~2 m across and 2 m tall at scale 1.
    rock.scale.set(r.radius, r.height / 2, r.radius);
    rock.position.set(r.x, WORLD.height(r.x, r.z) - 0.3, r.z);
    rock.rotation.y = i * 1.7;
    rock.traverse((o) => (o.castShadow = false)); // map shade comes from the shade grid
    scene.add(rock);
  });
  WORLD.walls.forEach((w, i) => {
    const wall = wallArt ? wallArt.scene.clone() : buildWall(i + 1, w.length, w.height);
    wall.scale.set(w.length, w.height, w.thickness);
    wall.position.set(w.x, WORLD.height(w.x, w.z) - 0.3, w.z);
    // Map angle runs from +x towards +z; three.js rotation.y runs from +x towards -z.
    wall.rotation.y = -w.angle;
    wall.traverse((o) => (o.castShadow = false));
    scene.add(wall);
  });

  return { sun };
}

/** How far the visible dunes continue past the invisible limit, as scenery. */
const SCENERY_MARGIN = 260;
/** Ground triangle size, metres. */
const GROUND_STEP = 3;

/** Sand palette (sRGB): pale crests, golden flanks, deeper ochre hollows, rust on steep slopes. */
const SAND_CREST = new THREE.Color(0xf3d29c);
const SAND_MID = new THREE.Color(0xe8b677);
const SAND_LOW = new THREE.Color(0xd59e62);
const SAND_STEEP = new THREE.Color(0xc98a58);

/**
 * Ground mesh from the shared height function. The map's shade grid is applied
 * inside the ground's own lighting, so shade looks exactly like a real shadow
 * (cool and soft) and costs no extra draw.
 */
function buildTerrain(): THREE.Mesh {
  const w = WORLD.extent.x * 2 + SCENERY_MARGIN * 2;
  const d = WORLD.extent.z * 2 + SCENERY_MARGIN * 2;
  const geo = new THREE.PlaneGeometry(w, d, Math.round(w / GROUND_STEP), Math.round(d / GROUND_STEP));
  geo.rotateX(-Math.PI / 2);
  const pos = geo.getAttribute("position");
  for (let i = 0; i < pos.count; i++) pos.setY(i, terrainHeight(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();
  const normal = geo.getAttribute("normal");
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = pos.getY(i);
    // Height relative to the local average: crests vs hollows.
    const local = h - (terrainHeight(x + 9, z) + terrainHeight(x - 9, z) + terrainHeight(x, z + 9) + terrainHeight(x, z - 9)) / 4;
    const t = THREE.MathUtils.clamp(0.5 + local * 0.9 + h * 0.04, 0, 1);
    c.copy(SAND_LOW).lerp(SAND_MID, Math.min(1, t * 2)).lerp(SAND_CREST, Math.max(0, t * 2 - 1));
    const steep = THREE.MathUtils.smoothstep(1 - normal.getY(i), 0.02, 0.12);
    c.lerp(SAND_STEEP, steep * 0.6);
    // Large, soft wind streaks so open sand is never one flat colour.
    const streak = Math.sin(x * 0.045 + z * 0.08 + Math.sin(z * 0.02) * 2) * Math.sin(x * 0.013 - z * 0.021);
    c.offsetHSL(0, 0.02 * streak, 0.035 * streak);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const grid = shadeFor(WORLD);
  const pixels = new Uint8Array(grid.cols * grid.rows);
  for (let i = 0; i < grid.data.length; i++) pixels[i] = grid.data[i] ? 255 : 0;
  const shadeTex = new THREE.DataTexture(pixels, grid.cols, grid.rows, THREE.RedFormat);
  shadeTex.magFilter = THREE.LinearFilter;
  shadeTex.minFilter = THREE.LinearFilter;
  shadeTex.unpackAlignment = 1;
  shadeTex.needsUpdate = true;

  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.shadeMap = { value: shadeTex };
    shader.uniforms.shadeTexel = { value: new THREE.Vector2(1 / grid.cols, 1 / grid.rows) };
    shader.uniforms.shadeRect = {
      value: new THREE.Vector4(grid.originX, grid.originZ, grid.cols * grid.cellSize, grid.rows * grid.cellSize),
    };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWPos;")
      .replace("#include <project_vertex>", "#include <project_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        /* glsl */ `#include <common>
        varying vec3 vWPos;
        uniform sampler2D shadeMap;
        uniform vec4 shadeRect;
        uniform vec2 shadeTexel;
        float sandHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float sandNoise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(sandHash(i), sandHash(i + vec2(1, 0)), f.x), mix(sandHash(i + vec2(0, 1)), sandHash(i + vec2(1, 1)), f.x), f.y);
        }`,
      )
      .replace(
        "#include <color_fragment>",
        /* glsl */ `#include <color_fragment>
        float camDist = length(vWPos - cameraPosition);
        // Fine grain and patchy mottling, fading out with distance.
        float grain = sandNoise(vWPos.xz * 6.0) - 0.5;
        float mottle = sandNoise(vWPos.xz * 0.35) - 0.5;
        diffuseColor.rgb *= 1.0 + grain * 0.06 * (1.0 - smoothstep(6.0, 30.0, camDist)) + mottle * 0.08;`,
      )
      .replace(
        "#include <normal_fragment_begin>",
        /* glsl */ `#include <normal_fragment_begin>
        {
          // Wind ripples: asymmetric ridges across the wind, slightly wavy.
          vec2 wind = vec2(${WIND.x.toFixed(4)}, ${WIND.y.toFixed(4)});
          float warp = sandNoise(vWPos.xz * 0.25) * 4.0;
          float p = dot(vWPos.xz, wind) * 9.0 + warp;
          float fw = fwidth(p);
          float fade = (1.0 - smoothstep(0.6, 2.2, fw)) * (1.0 - smoothstep(14.0, 40.0, camDist));
          float slope = cos(p) + 0.45 * cos(2.0 * p);
          vec2 g = wind * slope * 0.17 * fade;
          // Broader dune ripples that read further away.
          float p2 = dot(vWPos.xz, wind) * 1.6 + sandNoise(vWPos.xz * 0.05) * 6.0;
          g += wind * cos(p2) * 0.1 * (1.0 - smoothstep(0.8, 2.5, fwidth(p2)));
          normal = normalize(normal + mat3(viewMatrix) * vec3(-g.x, 0.0, -g.y));
        }`,
      )
      .replace(
        "#include <lights_fragment_end>",
        /* glsl */ `#include <lights_fragment_end>
        {
          vec2 suv = (vWPos.xz - shadeRect.xy) / shadeRect.zw;
          // Soft edges: a small blur over the shade cells.
          vec2 px = shadeTexel * 0.9;
          float shade = texture2D(shadeMap, suv).r * 0.28
            + 0.18 * (texture2D(shadeMap, suv + vec2(px.x, 0.0)).r + texture2D(shadeMap, suv - vec2(px.x, 0.0)).r
            + texture2D(shadeMap, suv + vec2(0.0, px.y)).r + texture2D(shadeMap, suv - vec2(0.0, px.y)).r);
          shade = smoothstep(0.05, 0.9, shade);
          reflectedLight.directDiffuse *= 1.0 - 0.9 * shade;
        }`,
      );
  };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = "terrain";
  return mesh;
}
