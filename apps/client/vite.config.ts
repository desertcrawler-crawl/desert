import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

const MODELS = fileURLToPath(new URL("./public/assets/models", import.meta.url));

/**
 * Publishes assets/models/index.json: the list of .glb files the artist has
 * dropped in. The game only requests models that are listed, so missing art
 * never causes failed requests; it simply uses the placeholder.
 */
function artIndex(): Plugin {
  const list = () => JSON.stringify(readdirSync(MODELS).filter((f) => f.toLowerCase().endsWith(".glb")));
  return {
    name: "art-index",
    configureServer(server) {
      server.middlewares.use("/assets/models/index.json", (_req, res) => {
        res.setHeader("content-type", "application/json");
        res.end(list());
      });
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "assets/models/index.json", source: list() });
    },
  };
}

export default defineConfig({
  plugins: [artIndex()],
  server: { port: 5173 },
  build: { outDir: "dist", emptyOutDir: true },
});
