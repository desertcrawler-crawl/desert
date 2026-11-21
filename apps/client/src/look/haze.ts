import * as THREE from "three";
import { SUN } from "@desert/sim";

/**
 * The warm dusty haze and the sky share one colour function, so distant ground
 * melts into the horizon in every direction. Looking towards the low sun the
 * haze glows brighter and warmer, the way dust scatters light.
 *
 * Colours are written in linear space here (that is what the shaders work in).
 */
const hex = (h: number) => new THREE.Color(h); // THREE.Color converts sRGB hex to linear
const v3 = (c: THREE.Color) => `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`;

/** Haze where it is away from the sun: warm sand, not grey. */
export const HAZE = hex(0xe8c497);
const HAZE_SUNWARD = hex(0xf9d29c);
const ZENITH = hex(0x8fc0d4);
const SKY_MID = hex(0xf2cfa2);
const SUN_DISC = new THREE.Color(1.0, 0.86, 0.62).multiplyScalar(14);

const SUN_GLSL = `normalize(vec3(${SUN.x.toFixed(5)}, ${SUN.y.toFixed(5)}, ${SUN.z.toFixed(5)}))`;

/** GLSL: hazeColor(dir) and skyColor(dir) for a world-space view direction. */
export const HAZE_GLSL = /* glsl */ `
vec3 hazeColor(vec3 dir) {
  vec3 sunDir = ${SUN_GLSL};
  float s = max(dot(normalize(vec3(dir.x, max(dir.y, 0.0) * 0.4, dir.z)), normalize(vec3(sunDir.x, 0.0, sunDir.z))), 0.0);
  vec3 c = mix(${v3(HAZE)}, ${v3(HAZE_SUNWARD)}, pow(s, 3.0));
  return c * (1.0 + 0.15 * pow(s, 12.0));
}
vec3 skyColor(vec3 dir) {
  vec3 sunDir = ${SUN_GLSL};
  float h = clamp(dir.y, 0.0, 1.0);
  vec3 c = hazeColor(dir);
  c = mix(c, ${v3(SKY_MID)}, smoothstep(0.02, 0.2, h) * 0.6);
  c = mix(c, ${v3(ZENITH)}, smoothstep(0.25, 0.95, h) * 0.85);
  float s = max(dot(dir, sunDir), 0.0);
  c += vec3(1.0, 0.75, 0.45) * (0.25 * pow(s, 24.0) + 1.2 * pow(s, 600.0));
  c += ${v3(SUN_DISC)} * smoothstep(0.99955, 0.99975, s);
  return c;
}
`;

let patched = false;

/**
 * Replace three.js's flat fog with the directional dusty haze. Done once, before
 * any material compiles. Fog distances still come from scene.fog (near/far).
 */
export function installHaze(): void {
  if (patched) return;
  patched = true;
  const C = THREE.ShaderChunk as Record<string, string>;
  C.fog_pars_vertex = `#ifdef USE_FOG
  varying float vFogDepth;
  varying vec3 vFogViewPos;
#endif`;
  C.fog_vertex = `#ifdef USE_FOG
  vFogDepth = - mvPosition.z;
  vFogViewPos = mvPosition.xyz;
#endif`;
  C.fog_pars_fragment = `#ifdef USE_FOG
  uniform vec3 fogColor;
  varying float vFogDepth;
  varying vec3 vFogViewPos;
  #ifdef FOG_EXP2
    uniform float fogDensity;
  #else
    uniform float fogNear;
    uniform float fogFar;
  #endif
  ${HAZE_GLSL}
#endif`;
  // The haze colour is computed in linear space, then sent through the same tone
  // mapping and colour conversion the surface already went through.
  C.fog_fragment = `#ifdef USE_FOG
  #ifdef FOG_EXP2
    float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
  #else
    float fogX = clamp( ( length( vFogViewPos ) - fogNear ) / ( fogFar - fogNear ), 0.0, 1.0 );
    float fogFactor = 1.0 - exp( -4.0 * fogX * fogX );
  #endif
  vec3 fogDir = normalize( transpose( mat3( viewMatrix ) ) * vFogViewPos );
  vec3 hazeCol = hazeColor( fogDir );
  #ifdef TONE_MAPPING
    hazeCol = toneMapping( hazeCol );
  #endif
  hazeCol = linearToOutputTexel( vec4( hazeCol, 1.0 ) ).rgb;
  gl_FragColor.rgb = mix( gl_FragColor.rgb, hazeCol, fogFactor );
#endif`;
}

/** A large dome around the camera with the sky gradient and the sun. */
export function buildSky(): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww; // always at the far plane
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vDir;
      ${HAZE_GLSL}
      void main() {
        gl_FragColor = vec4(skyColor(normalize(vDir)), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), mat);
  sky.name = "sky";
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  // Follow the camera so the sky is always "infinitely" far away.
  sky.onBeforeRender = (_r, _s, camera) => sky.position.copy(camera.position);
  return sky;
}
