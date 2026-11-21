import * as THREE from "three";

/** Soft round dot in a point sprite, with its own distance fade (no scene fog). */
const pointVertex = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  varying float vAlpha;
  uniform float pixelScale;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float d = -mv.z;
    vAlpha = aAlpha * smoothstep(0.6, 2.5, d) * (1.0 - smoothstep(18.0, 34.0, d));
    gl_PointSize = aSize * pixelScale / max(d, 0.1);
    gl_Position = projectionMatrix * mv;
  }`;
const pointFragment = /* glsl */ `
  uniform vec3 color;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float a = smoothstep(0.5, 0.15, length(c)) * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(color, a);
  }`;

function pointsMaterial(color: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(color) }, pixelScale: { value: 300 } },
    vertexShader: pointVertex,
    fragmentShader: pointFragment,
    transparent: true,
    depthWrite: false,
    fog: false,
  });
}

/**
 * Fine dust drifting on the wind around the camera. The particles live in a box
 * that wraps around the camera, so there are always some nearby and none are
 * ever created or destroyed.
 */
export class AmbientDust {
  readonly object: THREE.Points;
  private readonly base: Float32Array;
  private readonly phase: Float32Array;
  private t = 0;
  private static readonly BOX = 36;

  constructor(
    private readonly wind: THREE.Vector2,
    count = 420,
  ) {
    const B = AmbientDust.BOX;
    this.base = new Float32Array(count * 3);
    this.phase = new Float32Array(count);
    const size = new Float32Array(count);
    const alpha = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      this.base[i * 3] = Math.random() * B;
      this.base[i * 3 + 1] = Math.pow(Math.random(), 2.2) * 7; // most dust hugs the ground
      this.base[i * 3 + 2] = Math.random() * B;
      this.phase[i] = Math.random() * 100;
      size[i] = 0.012 + Math.random() * 0.03;
      alpha[i] = 0.12 + Math.random() * 0.3;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    geo.setAttribute("aAlpha", new THREE.BufferAttribute(alpha, 1));
    this.object = new THREE.Points(geo, pointsMaterial(0xffe4bd));
    this.object.frustumCulled = false;
    this.object.renderOrder = 2;
  }

  setPixelScale(heightPx: number, fovDeg: number): void {
    (this.object.material as THREE.ShaderMaterial).uniforms.pixelScale!.value = heightPx / (2 * Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2));
  }

  update(dt: number, camera: THREE.Vector3, groundY: number): void {
    this.t += dt;
    const B = AmbientDust.BOX;
    const pos = this.object.geometry.getAttribute("position") as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const drift = this.t * 1.6;
    const ox = camera.x - B / 2;
    const oz = camera.z - B / 2;
    for (let i = 0; i < this.phase.length; i++) {
      const ph = this.phase[i]!;
      const bx = this.base[i * 3]! + this.wind.x * drift * (0.6 + (ph % 1));
      const bz = this.base[i * 3 + 2]! + this.wind.y * drift * (0.6 + (ph % 1));
      // Wrap into the box around the camera.
      arr[i * 3] = ox + ((((bx - ox) % B) + B) % B);
      arr[i * 3 + 2] = oz + ((((bz - oz) % B) + B) % B);
      arr[i * 3 + 1] = groundY + this.base[i * 3 + 1]! + 0.25 * Math.sin(this.t * 0.7 + ph);
    }
    pos.needsUpdate = true;
  }
}

/** Little sand puffs kicked up by hands and knees. A fixed pool, reused. */
export class SandPuffs {
  readonly object: THREE.Points;
  private readonly vel: Float32Array;
  private readonly life: Float32Array;
  private next = 0;
  private static readonly LIFE = 1.1;

  constructor(count = 160) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array(count), 1));
    geo.setAttribute("aAlpha", new THREE.BufferAttribute(new Float32Array(count), 1));
    this.vel = new Float32Array(count * 3);
    this.life = new Float32Array(count);
    const mat = pointsMaterial(0xe0b27a);
    this.object = new THREE.Points(geo, mat);
    this.object.frustumCulled = false;
    this.object.renderOrder = 2;
  }

  setPixelScale(heightPx: number, fovDeg: number): void {
    (this.object.material as THREE.ShaderMaterial).uniforms.pixelScale!.value = heightPx / (2 * Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2));
  }

  /** A puff at a point on the ground. */
  spawn(x: number, y: number, z: number, strength = 1): void {
    const n = this.life.length;
    for (let k = 0; k < 3; k++) {
      const i = this.next;
      this.next = (this.next + 1) % n;
      const pos = this.object.geometry.getAttribute("position") as THREE.BufferAttribute;
      pos.setXYZ(i, x + (Math.random() - 0.5) * 0.3, y + 0.05, z + (Math.random() - 0.5) * 0.3);
      this.vel[i * 3] = (Math.random() - 0.5) * 0.6;
      this.vel[i * 3 + 1] = 0.2 + Math.random() * 0.35;
      this.vel[i * 3 + 2] = (Math.random() - 0.5) * 0.6;
      this.life[i] = SandPuffs.LIFE * strength;
    }
  }

  update(dt: number): void {
    const pos = this.object.geometry.getAttribute("position") as THREE.BufferAttribute;
    const size = this.object.geometry.getAttribute("aSize") as THREE.BufferAttribute;
    const alpha = this.object.geometry.getAttribute("aAlpha") as THREE.BufferAttribute;
    for (let i = 0; i < this.life.length; i++) {
      const l = this.life[i]!;
      if (l <= 0) {
        if (alpha.getX(i) !== 0) alpha.setX(i, 0);
        continue;
      }
      const t = 1 - l / SandPuffs.LIFE; // 0 -> 1 over the puff's life
      this.life[i] = l - dt;
      const drag = Math.exp(-dt * 2.5);
      this.vel[i * 3]! *= drag;
      this.vel[i * 3 + 1]! *= drag;
      this.vel[i * 3 + 2]! *= drag;
      pos.setXYZ(i, pos.getX(i) + this.vel[i * 3]! * dt, pos.getY(i) + this.vel[i * 3 + 1]! * dt, pos.getZ(i) + this.vel[i * 3 + 2]! * dt);
      size.setX(i, 0.25 + t * 0.9);
      alpha.setX(i, 0.5 * Math.sin(Math.min(1, t * 1.3) * Math.PI) * (1 - t));
    }
    pos.needsUpdate = size.needsUpdate = alpha.needsUpdate = true;
  }
}
