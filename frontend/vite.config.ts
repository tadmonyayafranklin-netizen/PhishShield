import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    allowedHosts: true, // allow trycloudflare/ngrok tunnels for PayUnit checkout testing
    proxy: {
      "/api": "http://localhost:8000",
      "/sim": "http://localhost:8000",
    },
  },
});
