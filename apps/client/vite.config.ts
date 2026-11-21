import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

const MODELS = fileURLToPath(new URL("./public/assets/models", import.meta.url));
const SOUNDS = fileURLToPath(new URL("./public/assets/sounds", import.meta.url));

/**
 * Publishes assets/models/index.json and assets/sounds/index.json: the lists of
 * .glb and sound files the artist has dropped in. The game only requests files
 * that are listed, so missing art never causes failed requests; it simply uses
 * the placeholder or the generated sound.
 */
function artIndex(): Plugin {
  const indexes = [
    { dir: MODELS, url: "assets/models/index.json", match: /\.glb$/i },
    { dir: SOUNDS, url: "assets/sounds/index.json", match: /\.(ogg|mp3|wav)$/i },
  ];
  const list = (dir: string, match: RegExp) => {
    try {
      return JSON.stringify(readdirSync(dir).filter((f) => match.test(f)));
    } catch {
      return "[]";
    }
  };
  return {
    name: "art-index",
    configureServer(server) {
      for (const i of indexes) {
        server.middlewares.use(`/${i.url}`, (_req, res) => {
          res.setHeader("content-type", "application/json");
          res.end(list(i.dir, i.match));
        });
      }
    },
    generateBundle() {
      for (const i of indexes) this.emitFile({ type: "asset", fileName: i.url, source: list(i.dir, i.match) });
    },
  };
}

export default defineConfig({
  plugins: [artIndex()],
  server: { port: 5173 },
  build: { outDir: "dist", emptyOutDir: true },
});
