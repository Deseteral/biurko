import react from "@vitejs/plugin-react";
import solid from "vite-plugin-solid";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    solid({ include: /solid/ }),
    react({ include: /react/ }),
  ],
});
