import { defineConfig } from "vite-plus";
import solidPlugin from "vite-plugin-solid";

export default defineConfig({
  fmt: {},
  lint: {
    ignorePatterns: ["dist/"],
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  pack: {
    entry: {
      index: "src/index.ts",
      "adapters/solid-js/index": "src/adapters/solid-js/index.ts",
      "adapters/react/index": "src/adapters/react/index.ts",
    },
    platform: "browser",
    plugins: [solidPlugin({ include: /solid-js/, dev: false, hot: false })],
  },
});
