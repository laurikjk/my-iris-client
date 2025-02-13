import {nodePolyfills} from "vite-plugin-node-polyfills"
import {visualizer} from "rollup-plugin-visualizer"
import {defineConfig} from "vitest/config"
import react from "@vitejs/plugin-react"
import {VitePWA} from "vite-plugin-pwa"
import config from "config"

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    nodePolyfills(),
    react(),
    VitePWA({
      injectManifest: {
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      },
      includeAssets: ["cashu/**/*"],
      strategies: "injectManifest",
      injectRegister: "script",
      manifest: false,
      srcDir: "src",
      filename: "service-worker.ts",
      registerType: "autoUpdate",
      devOptions: {
        enabled: true,
        type: "module",
      },
    }),
    visualizer({
      open: true,
      gzipSize: true,
      filename: "build/stats.html",
    }),
  ],
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor": [
            "react", 
            "react-router-dom",
            "react-helmet",
            "react-markdown",
            "@nostr-dev-kit/ndk",
            "nostr-tools",
            "irisdb",
            "irisdb-hooks",
            "irisdb-nostr",
            "bolt11",
            "lodash",
            "localforage",
            "@noble/hashes",
            "debug",
            "@nostr-dev-kit/ndk-cache-dexie",
            "nostr-double-ratchet",
            "nostr-social-graph",
            "classnames",
            "fuse.js",
            "qrcode",
            "react-string-replace",
            "react-swipeable",
            "uuid"
          ],
        },
      },
    },
  },
  test: {
    environment: "jsdom",
  },
  define: {
    CONFIG: config,
    global: {}, // needed for custom-event lib
  },
  publicDir: config.get("publicDir"),
  server: {
    proxy: {
      "/cashu": {
        target: "http://127.0.0.1:8080", // Serve cashu.me here for development
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/cashu/, ""),
      },
    },
  },
})
