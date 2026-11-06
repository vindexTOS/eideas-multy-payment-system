import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    host: true,
    // Dev-only: in docker the emulator server serves this bundle itself.
    proxy: {
      "/api": {
        target: process.env.EMULATOR_API ?? "http://localhost:8095",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    // antd alone is ~1 MB minified; it is split out and cached, not a problem.
    chunkSizeWarningLimit: 1100,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          antd: ["antd", "@ant-design/icons"],
          query: ["@tanstack/react-query", "axios"],
        },
      },
    },
  },
});
