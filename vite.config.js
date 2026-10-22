
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ command }) => {
  const base = command === "build" ? "/indigo/" : "/";

  return {
    base,
    plugins: [
      solid(),
      VitePWA({
        base,
        registerType: "autoUpdate",
        manifest: {
          id: base,
          name: "Indigo",
          short_name: "Indigo",
          description: "Indigo application",
          theme_color: "#171717",
          background_color: "#171717",
          display: "standalone",
          start_url: base,
          scope: base,
          icons: [
            {
              src: `${base}icon_small.svg`,
              sizes: "any",
              type: "image/svg+xml",
              purpose: "any"
            },
            {
              src: `${base}icon_small.png`,
              sizes: "192x192",
              type: "image/png",
              purpose: "any"
            }
          ]
        }
      })
    ]
  };
});
