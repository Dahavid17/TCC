import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" permite publicar o build em qualquer subpasta do site (ex.: /fazenda-3d/).
export default defineConfig({
    plugins: [react()],
    base: "./",
    server: { port: 5179, strictPort: true },
    preview: { port: 5179, strictPort: true },
});
