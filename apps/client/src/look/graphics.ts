import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";

export type Quality = "high" | "low";

const KEY = "desert:quality";

export function savedQuality(): Quality {
  try {
    const q = localStorage.getItem(KEY);
    if (q === "high" || q === "low") return q;
  } catch {
    /* storage unavailable */
  }
  return "high";
}

/**
 * Final colour grade, applied after tone mapping (on screen colours):
 * a touch of contrast, warm highlights with slightly cooler shadows, a soft
 * vignette, and fine dithering so the sky gradient never shows bands.
 */
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float time;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + time) * 43758.5453); }
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      // Split toning: cool the darks a little, warm the lights.
      c += vec3(-0.012, -0.004, 0.022) * (1.0 - smoothstep(0.0, 0.45, l));
      c += vec3(0.025, 0.010, -0.02) * smoothstep(0.5, 1.0, l);
      // Gentle S-curve for contrast.
      c = mix(c, c * c * (3.0 - 2.0 * c), 0.22);
      // Saturation, a little up.
      float g = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(vec3(g), c, 1.0);
      // Vignette, warm-tinted.
      vec2 d = vUv - 0.5;
      float v = smoothstep(0.9, 0.35, length(d * vec2(1.1, 1.0)));
      c *= mix(vec3(0.84, 0.76, 0.7), vec3(1.0), v);
      c += (hash(vUv * 1000.0) - 0.5) / 255.0;
      gl_FragColor = vec4(c, 1.0);
    }`,
};

/**
 * Owns the renderer setup. High quality renders through a small post-processing
 * chain (bloom on the sun, colour grade, vignette); low quality draws straight to
 * the screen with tone mapping only, smaller shadows and a lower resolution.
 */
export class Graphics {
  readonly renderer: THREE.WebGLRenderer;
  private composer: EffectComposer | null = null;
  private renderPass: RenderPass | null = null;
  private grade: ShaderPass | null = null;
  private bloom: UnrealBloomPass | null = null;
  quality: Quality;
  private sun: THREE.DirectionalLight | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.quality = savedQuality();
  }

  attach(scene: THREE.Scene, camera: THREE.Camera, sun: THREE.DirectionalLight): void {
    this.sun = sun;
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, target);
    this.renderPass = new RenderPass(scene, camera);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.32, 0.55, 1.6);
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.composer.addPass(this.grade);
    this.setQuality(this.quality);
  }

  setCamera(camera: THREE.Camera): void {
    if (this.renderPass) this.renderPass.camera = camera;
  }

  setQuality(q: Quality): void {
    this.quality = q;
    try {
      localStorage.setItem(KEY, q);
    } catch {
      /* ignore */
    }
    const high = q === "high";
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, high ? 1.75 : 1));
    if (this.sun) {
      const n = high ? 2048 : 1024;
      if (this.sun.shadow.mapSize.x !== n) {
        this.sun.shadow.mapSize.set(n, n);
        this.sun.shadow.map?.dispose();
        this.sun.shadow.map = null;
      }
    }
    this.resize(window.innerWidth, window.innerHeight);
  }

  resize(w: number, h: number): void {
    this.renderer.setSize(w, h, false);
    const pr = this.renderer.getPixelRatio();
    this.composer?.setPixelRatio(pr);
    this.composer?.setSize(w, h);
    this.bloom?.setSize((w * pr) / 2, (h * pr) / 2);
  }

  render(scene: THREE.Scene, camera: THREE.Camera, time: number): void {
    if (this.quality === "high" && this.composer) {
      this.setCamera(camera);
      this.grade!.uniforms.time!.value = time % 10;
      this.composer.render();
    } else {
      this.renderer.render(scene, camera);
    }
  }
}
