import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { ART_SLOTS, type ArtSlotName } from "./manifest.ts";

const loader = new GLTFLoader();
const cache = new Map<ArtSlotName, Promise<GLTF | null>>();

/** Which .glb files exist, published by the build (see vite.config.ts). */
let available: Promise<Set<string>> | null = null;
function availableModels(): Promise<Set<string>> {
  available ??= fetch(`${import.meta.env.BASE_URL}assets/models/index.json`)
    .then((r) => (r.ok ? r.json() : []))
    .then((files: string[]) => new Set(files))
    .catch(() => new Set<string>());
  return available;
}

/**
 * Load the artist's .glb for a slot, or null if there is none yet.
 * Null means "use the code placeholder"; it is not an error.
 */
export function loadArt(slot: ArtSlotName): Promise<GLTF | null> {
  let p = cache.get(slot);
  if (!p) {
    const url = `${import.meta.env.BASE_URL}assets/models/${ART_SLOTS[slot].file}`;
    p = availableModels()
      .then((files) => (files.has(ART_SLOTS[slot].file) ? loader.loadAsync(url) : null))
      .then((gltf) => {
        if (gltf) {
          gltf.scene.traverse((o) => {
            if ((o as THREE.Mesh).isMesh) o.castShadow = o.receiveShadow = true;
          });
        }
        return gltf;
      })
      .catch((err) => {
        console.warn(`[art] ${slot}: could not load ${url}, using placeholder`, err);
        return null;
      });
    cache.set(slot, p);
  }
  return p;
}
