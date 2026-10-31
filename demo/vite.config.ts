import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import solid from "vite-plugin-solid";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [solid({ include: /solid.*\.[jt]sx$/ }), react({ include: /react.*\.[jt]sx$/ })],
  build: {
    rolldownOptions: {
      input: {
        vanilla: resolve(import.meta.dirname, "index.html"),
        react: resolve(import.meta.dirname, "react.html"),
        solid: resolve(import.meta.dirname, "solid.html"),
      },
    },
  },
});
