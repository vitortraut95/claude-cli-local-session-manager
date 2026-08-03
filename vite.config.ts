import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
    // `.claude/` (gitignored, see .gitignore) holds worktrees this app itself creates/removes —
    // for a project managed by this app that also happens to be itself (dogfooding), a worktree
    // under here is a full copy of the source tree. Vite's watcher doesn't consult .gitignore on
    // its own, so without this a bulk file removal there (e.g. the "Limpeza" modal's worktree
    // cleanup) reads as a burst of source changes and triggers a full page reload, wiping in-app
    // state like an open modal.
    watch: {
      ignored: ["**/.claude/**"],
    },
  },
});
