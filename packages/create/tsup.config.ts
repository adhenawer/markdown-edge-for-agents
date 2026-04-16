import { cpSync } from "node:fs";
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: false,
  clean: true,
  target: "node22",
  banner: { js: "#!/usr/bin/env node" },
  sourcemap: true,
  onSuccess: async () => {
    cpSync("src/templates", "dist/templates", { recursive: true });
  },
});
