import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rolldownOptions: {
      output: {
        // Third-party code in its own chunk, so neither it nor the app's own code (most of it the
        // translation tables) crosses Vite's 500 kB chunk-size warning.
        codeSplitting: { groups: [{ name: "vendor", test: /node_modules/ }] },
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
