import * as THREE from "three";
import { terrainHeight, type MoveInput } from "@desert/sim";
import { loadArt } from "./art/loader.ts";
import { BodySounds, DesertAudio } from "./audio/audio.ts";
import { Avatar } from "./avatar.ts";
import { FollowCamera } from "./camera.ts";
import { drawHealth, Minimap } from "./hud.ts";
import { ChatBox, type ChatLine } from "./chat.ts";
import { KeyboardInput } from "./input.ts";
import { joinDesert } from "./net.ts";
import {
  bounceSkeleton,
  loadPropTemplates,
  placeMarker,
  placeScorpion,
  placeWell,
  DryingWell,
  Sparkle,
  type PropTemplates,
} from "./props.ts";
import { buildWorld, SUN_DIRECTION } from "./world.ts";

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const canvas = $<HTMLCanvasElement>("#scene");
const joinForm = $<HTMLFormElement>("#join");
const nameInput = $<HTMLInputElement>("#name");
const joinError = $<HTMLParagraphElement>("#join-error");
const hud = $<HTMLDivElement>("#hud");
const status = $<HTMLDivElement>("#status");
const minimapCanvas = $<HTMLCanvasElement>("#minimap");
const healthBox = $<HTMLDivElement>("#health");
const healthFill = $<HTMLDivElement>("#health .fill");
const healthLabel = $<HTMLDivElement>("#health .label");
const dyingNotice = $<HTMLDivElement>("#dying");
const deadPanel = $<HTMLDivElement>("#dead");
const rejoinButton = $<HTMLButtonElement>("#rejoin");
const chatRoot = $<HTMLDivElement>("#chat");
const soundBox = $<HTMLDivElement>("#sound");
const muteButton = $<HTMLButtonElement>("#mute");
const volumeSlider = $<HTMLInputElement>("#volume");

const audio = new DesertAudio();
function showSound() {
  muteButton.textContent = audio.isMuted ? "Sound off" : "Sound on";
  volumeSlider.value = String(audio.level);
}
muteButton.addEventListener("click", () => {
  audio.setMuted(!audio.isMuted);
  showSound();
  muteButton.blur();
});
volumeSlider.addEventListener("input", () => {
  audio.setVolume(Number(volumeSlider.value));
  if (audio.isMuted && audio.level > 0) audio.setMuted(false);
  showSound();
});
volumeSlider.addEventListener("change", () => volumeSlider.blur());
window.addEventListener("keydown", (e) => {
  if (e.code !== "KeyM" || e.repeat || document.activeElement instanceof HTMLInputElement) return;
  audio.setMuted(!audio.isMuted);
  showSound();
});
showSound();

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const follow = new FollowCamera(canvas);
const { sun } = await buildWorld(scene);

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  follow.resize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", resize);
resize();

try {
  nameInput.value = localStorage.getItem("desert:name") ?? "";
} catch {
  /* storage unavailable: fine */
}

joinForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  void audio.unlock(); // the Play click is the gesture browsers need before sound
  const button = joinForm.querySelector("button")!;
  button.disabled = true;
  joinError.hidden = true;
  const name = nameInput.value.trim();
  try {
    localStorage.setItem("desert:name", name);
  } catch {
    /* ignore */
  }
  try {
    const [room, crawlerArt, props] = await Promise.all([joinDesert(name), loadArt("crawler"), loadPropTemplates()]);
    joinForm.hidden = true;
    for (const el of [hud, minimapCanvas, healthBox, chatRoot, soundBox]) el.hidden = false;
    start(room, crawlerArt, props);
  } catch (err) {
    console.error(err);
    joinError.textContent = "Could not reach the desert server. Is it running?";
    joinError.hidden = false;
    button.disabled = false;
  }
});

/** What we draw for each player: smoothed towards the server's numbers. */
interface Shown {
  avatar: Avatar;
  sounds: BodySounds;
  pos: THREE.Vector3;
  heading: number;
}

function start(
  room: Awaited<ReturnType<typeof joinDesert>>,
  crawlerArt: Awaited<ReturnType<typeof loadArt>>,
  props: PropTemplates,
) {
  const shown = new Map<string, Shown>();
  const wells = new Map<string, THREE.Object3D>();
  const markers = new Map<string, THREE.Object3D>();
  const scorpions = new Map<string, THREE.Object3D>();
  const sparkles: Sparkle[] = [];
  const drying: DryingWell[] = [];
  const skeletonBounces = new Map<string, number>();
  const minimap = new Minimap(minimapCanvas);
  let firstFrame = true;

  const me = () => room.state.players?.get(room.sessionId);
  const twitchIfDying = () => {
    // While dying, input only causes a tiny involuntary reaction.
    if (me()?.phase === "terminal") shown.get(room.sessionId)?.avatar.twitch();
  };
  new KeyboardInput({
    move: (input: MoveInput) => room.send("input", input),
    posture: (want) => room.send("posture", want),
    slap: () => room.send("slap"),
    anyInput: twitchIfDying,
  });
  const chat = new ChatBox(chatRoot, (text) => room.send("chat", text));
  room.onMessage("chat", (line: ChatLine) => chat.add(line));
  room.onMessage("chatHistory", (lines: ChatLine[]) => lines.forEach((l) => chat.add(l)));
  const at = (id: string | undefined) => (id ? shown.get(id)?.pos : undefined);
  room.onMessage("fx", (e: { type: string; from?: string; playerId?: string; target?: { kind: string; id: string } }) => {
    if (e.type === "slap" && e.target) {
      if (e.from) shown.get(e.from)?.avatar.slapping();
      if (e.target.kind === "player") {
        shown.get(e.target.id)?.avatar.slapped();
        const p = at(e.target.id);
        if (p) audio.slap(p.x, p.z);
      } else {
        skeletonBounces.set(e.target.id, 0.9);
        const m = markers.get(e.target.id);
        if (m) {
          audio.slap(m.position.x, m.position.z);
          audio.clatter(m.position.x, m.position.z);
        }
      }
    }
    const p = at(e.playerId);
    if (e.type === "sting" && e.playerId) {
      shown.get(e.playerId)?.avatar.slapped();
      if (p) audio.sting(p.x, p.z);
    }
    if (e.type === "drink" && p) audio.drink(p.x, p.z);
    if (e.type === "death" && p) audio.groan(p.x, p.z);
  });
  canvas.addEventListener("pointerdown", twitchIfDying);
  rejoinButton.addEventListener("click", () => room.send("rejoin"));
  room.onLeave(() => {
    status.textContent = "Disconnected from the desert. Reload to play again.";
  });

  const clock = new THREE.Clock();
  const tmp = new THREE.Vector3();

  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.1);
    const st = room.state;
    // Collections arrive with the first full state; skip frames until then.
    if (!st.players || !st.wells || !st.markers || !st.scorpions) {
      renderer.render(scene, follow.camera);
      return;
    }

    // Players.
    st.players.forEach((p, id) => {
      let s = shown.get(id);
      if (!s) {
        s = { avatar: new Avatar(p.name, crawlerArt), sounds: new BodySounds(), pos: new THREE.Vector3(p.x, terrainHeight(p.x, p.z), p.z), heading: p.heading };
        scene.add(s.avatar.object);
        shown.set(id, s);
      }
      tmp.set(p.x, terrainHeight(p.x, p.z), p.z);
      const before = s.pos.clone();
      s.pos.lerp(tmp, 1 - Math.exp(-dt * 10));
      s.heading = lerpAngle(s.heading, p.heading, 1 - Math.exp(-dt * 10));
      const speed = before.distanceTo(s.pos) / Math.max(dt, 1e-3);
      s.avatar.object.position.copy(s.pos);
      // Models face +Z (glTF standard). Heading 0 = north = -Z, growing clockwise from above.
      s.avatar.object.rotation.y = Math.PI - s.heading;
      s.avatar.update(dt, speed, p.phase, p.health, p.posture);
      s.sounds.update(audio, dt, s.pos.x, s.pos.z, p.phase, p.posture, p.health, speed);
    });
    for (const [id, s] of shown) {
      if (!st.players.has(id)) {
        s.avatar.dispose();
        shown.delete(id);
      }
    }

    // Wells: an emptied well disappears for everyone.
    st.wells.forEach((w, id) => {
      if (!wells.has(id)) {
        const o = placeWell(props, w.x, w.z);
        scene.add(o);
        wells.set(id, o);
      }
    });
    for (const [id, o] of wells) {
      if (!st.wells.has(id)) {
        drying.push(new DryingWell(o));
        wells.delete(id);
      }
    }
    for (let i = drying.length - 1; i >= 0; i--) if (!drying[i]!.update(dt)) drying.splice(i, 1);

    // Skeletons and crosses stay for the session. New ones release a sparkle.
    st.markers.forEach((m, id) => {
      if (markers.has(id)) return;
      const o = placeMarker(props, m.name, m.x, m.z, m.heading);
      scene.add(o);
      markers.set(id, o);
      if (!firstFrame) {
        const sp = new Sparkle(o.position);
        audio.sparkle(o.position.x, o.position.z);
        scene.add(sp.object);
        sparkles.push(sp);
      }
    });
    for (let i = sparkles.length - 1; i >= 0; i--) if (!sparkles[i]!.update(dt)) sparkles.splice(i, 1);
    for (const [id, t] of skeletonBounces) {
      const o = markers.get(id);
      if (o) bounceSkeleton(o, t);
      if (t <= 0) skeletonBounces.delete(id);
      else skeletonBounces.set(id, t - dt);
    }

    // Scorpions: visible at their posts; gone for 10 s after stinging.
    st.scorpions.forEach((sc, id) => {
      let o = scorpions.get(id);
      if (!o) {
        o = placeScorpion(props, sc.x, sc.z);
        scene.add(o);
        scorpions.set(id, o);
      }
      o.visible = sc.present;
    });
    firstFrame = false;

    // HUD.
    const mine = me();
    if (mine) {
      drawHealth(healthFill, healthLabel, mine.health, mine.phase, mine.inShade);
      dyingNotice.hidden = mine.phase !== "terminal";
      deadPanel.hidden = mine.phase !== "dead";
    }
    const others: { x: number; z: number; heading: number; phase: string }[] = [];
    st.players.forEach((p, id) => id !== room.sessionId && others.push(p));
    const wellList: { x: number; z: number }[] = [];
    st.wells.forEach((w) => wellList.push(w));
    minimap.draw(mine, others, wellList);
    status.textContent = `${st.players.size} / 30 in this desert`;

    const mineShown = shown.get(room.sessionId);
    if (mineShown && mine) {
      follow.update(dt, mineShown.pos, mineShown.heading);
      audio.setListener({ x: mineShown.pos.x, z: mineShown.pos.z, yaw: follow.yaw });
      // Keep the character-shadow area centred on the player; the sun direction itself never changes.
      sun.target.position.copy(mineShown.pos);
      sun.position.copy(mineShown.pos).addScaledVector(SUN_DIRECTION, 80);
    }
    audio.update();
    renderer.render(scene, follow.camera);
  });
}

function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

// Before joining, show the desert slowly from above.
renderer.setAnimationLoop(() => {
  const t = performance.now() / 1000;
  follow.camera.position.set(Math.sin(t * 0.05) * 40, 14, Math.cos(t * 0.05) * 40);
  follow.camera.lookAt(0, 0, 0);
  renderer.render(scene, follow.camera);
});
