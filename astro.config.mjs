import { defineConfig } from "astro/config";
import react from "@astrojs/react";

export default defineConfig({
  output: "static",
  integrations: [react()],
  vite: {
    server: {
      proxy: {
        "/api": "http://127.0.0.1:8088",
      },
    },
  },
});
