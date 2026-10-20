import { defineConfig } from "astro/config";
import preact from "@astrojs/preact";
import tailwindcss from "@tailwindcss/vite";
import Icons from "unplugin-icons/vite";

export default defineConfig({
  site: "https://ab-test.iago.wtf",
  output: "static",
  trailingSlash: "never",
  build: { format: "file" },
  integrations: [preact()],
  vite: {
    plugins: [tailwindcss(), Icons({ compiler: "jsx", jsx: "preact" })],
  },
});
