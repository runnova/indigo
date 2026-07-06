import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

export default defineConfig(({ command }) => ({
  plugins: [solid()],
  base: command === "build" ? "/indigo/" : "/",
}));