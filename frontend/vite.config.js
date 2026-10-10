import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const chatbot = path.resolve(here, "../chatbot/frontend");   // chatbot lives in its own top-level folder

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: "@chatbot", replacement: chatbot },
      // let files outside /frontend (the chatbot) use this project's single copy of these packages
      { find: /^(react|react-dom|lucide-react)(\/.*)?$/, replacement: path.resolve(here, "node_modules/$1$2") },
    ],
  },
  server: { port: 5173, fs: { allow: [path.resolve(here, "..")] }, proxy: { "/api": "http://localhost:8000" } },
});
