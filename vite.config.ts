import { defineConfig } from "vite-plus";
import solidPlugin from "vite-plugin-solid";

export default defineConfig({
  fmt: {},
  check: {
    lint: false,
  },
  pack: {
    entry: {
      index: "src/index.ts",
      "adapters/solid-js/index": "src/adapters/solid-js/index.ts",
      "adapters/react/index": "src/adapters/react/index.ts",
    },
    format: ["esm"],
    platform: "browser",
    dts: true,
    plugins: [solidPlugin({ include: /solid-js/, dev: false, hot: false })],
    outDir: "dist",
    inputOptions: {
      external: ["solid-js", "solid-js/web", "react", "react-dom", "react/jsx-runtime"],
    },
  },
});
