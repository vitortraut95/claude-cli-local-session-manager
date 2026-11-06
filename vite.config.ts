import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rolldownOptions: {
      output: {
        // Third-party code and the translation tables in their own chunks, so none of them crosses
        // Vite's 500 kB chunk-size warning.
        codeSplitting: {
          groups: [
            { name: "vendor", test: /node_modules/ },
            // The translation tables (both languages, the Guide's included) on their own.
            { name: "i18n", test: /src[\\/]i18n[\\/]/ },
          ],
        },
      },
    },
  },
  server: {
    port: 58230,
    strictPort: true,
    open: true,
    proxy: {
      "/sessions": "http://localhost:58231",
      "/system": "http://localhost:58231",
      "/tasks": "http://localhost:58231",
      "/cleanup": "http://localhost:58231",
      "/board-watcher": "http://localhost:58231",
    },
    // `.claude/` holds worktrees of this repo (full source copies); Vite ignores .gitignore, so
    // creating/removing one there would trigger a full page reload.
    watch: {
      // Backend sidecar files at the repo root: without this, every write reloads the page.
      ignored: [
        "**/.claude/**",
        "**/tasks.json",
        "**/tasks.json.*",
        "**/userPreferences.json",
        "**/userPreferences.json.*",
      ],
    },
  },
});
