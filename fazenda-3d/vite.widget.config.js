import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Pacote único (IIFE) para usar a cena em páginas sem React.
// Saída: ../frontend/vendor/fazenda-3d/fazenda-3d.js e fazenda-3d.css
export default defineConfig({
    plugins: [react()],
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
    build: {
        outDir: "../frontend/vendor/fazenda-3d",
        emptyOutDir: true,
        chunkSizeWarningLimit: 1500,
        lib: {
            entry: "src/widget.jsx",
            name: "FazendaInteligente3DPacote",
            formats: ["iife"],
            fileName: () => "fazenda-3d.js",
        },
        rollupOptions: {
            output: {
                assetFileNames: (arquivo) => (arquivo.name?.endsWith(".css") ? "fazenda-3d.css" : "[name][extname]"),
            },
        },
    },
});
