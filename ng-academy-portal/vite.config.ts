import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vitest/config";

/**
 * NG Academy portal (parent + admin). Served under /portal/ so ng-academy-api
 * can host the built files next to the JSON API in production; in dev, vite
 * proxies /ng to the API (override the target with NG_API_PROXY, e.g. inside
 * docker-compose where the API hostname is ng-academy-api).
 */
export default defineConfig({
  base: "/portal/",
  plugins: [svelte()],
  server: {
    host: "0.0.0.0",
    // Allow preview/dev hostnames (e2b sandbox, *.localhost via traefik…).
    allowedHosts: true,
    port: Number(process.env.PORTAL_PORT ?? 3200),
    proxy: {
      "/ng": process.env.NG_API_PROXY ?? "http://localhost:3100",
    },
  },
  build: {
    outDir: "dist",
  },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.ts"],
  },
});
