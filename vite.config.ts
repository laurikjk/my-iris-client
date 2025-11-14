import {nodePolyfills} from "vite-plugin-node-polyfills"
import {visualizer} from "rollup-plugin-visualizer"
import react from "@vitejs/plugin-react"
import {VitePWA} from "vite-plugin-pwa"
import {defineConfig} from "vite"
import config from "config"

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    nodePolyfills(),
    react({
      fastRefresh: true,
    }),
    VitePWA({
      injectManifest: {
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        globPatterns: ["**/*"],
      },
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
    visualizer({
      open: false,
      gzipSize: true,
      filename: "build/stats-list.txt",
      template: "list",
    }),
  ],
  resolve: {
    alias: {
      "@": "/src",
      "@core": "/src/lib/cashu/core",
    },
  },
  build: {
    reportCompressedSize: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      input: {
        main: "index.html",
        debug: "debug.html",
        "relay-worker": "src/workers/relay-worker.ts",
      },
      external: [],
      onLog(level, log, handler) {
        if (log.code === "CIRCULAR_DEPENDENCY") return
        handler(level, log)
      },
      output: {
        assetFileNames: (assetInfo) => {
          // Keep WASM files in assets root with original name
          if (assetInfo.name?.endsWith(".wasm")) {
            return "assets/[name][extname]"
          }
          return "assets/[name]-[hash][extname]"
        },
        manualChunks: (id) => {
          if (id.includes("nostr-social-graph/data/profileData.json")) {
            return "profileData"
          }
          if (
            id.includes("utils/AnimalName") ||
            id.includes("utils/data/animals") ||
            id.includes("utils/data/adjectives")
          ) {
            return "animalname"
          }
          // Cashu core wrapper - separate chunk (only loaded on wallet pages)
          if (id.includes("/src/lib/cashu/")) {
            return "cashu-core"
          }

          // NDK from local sources - keep in main (used everywhere)
          if (id.includes("/src/lib/ndk/") || id.includes("/src/lib/ndk-cache/")) {
            return "main"
          }

          // Bundle small shared components into main (avoid over-splitting)
          if (
            id.includes("/src/shared/components/button/") ||
            id.includes("/src/shared/components/user/Name")
          ) {
            return "main"
          }

          // SQLite WASM cache - lazy load separate chunk
          if (id.includes("@nostr-dev-kit/ndk-cache-sqlite-wasm")) {
            return "ndk-cache-sqlite"
          }

          const vendorLibs = [
            "react",
            "react-dom/client",
            "react-helmet",
            "markdown-to-jsx",
            "@remixicon/react",
            "minidenticons",
            "nostr-tools",
            "nostr-social-graph",
            "lodash",
            "lodash/debounce",
            "lodash/throttle",
            "localforage",
            "dexie",
            "@noble/hashes",
            "@noble/curves",
            "@scure/base",
            "@scure/bip32",
            "@scure/bip39",
            "classnames",
            "fuse.js",
            "react-string-replace",
            "tseep",
            "typescript-lru-cache",
            "zustand",
            "blurhash",
            "debug",
            "@cashu/cashu-ts",
            "nostr-double-ratchet",
          ]
          if (vendorLibs.some((lib) => id.includes(`node_modules/${lib}`))) {
            return "vendor"
          }
        },
      },
    },
    assetsDir: "assets",
    copyPublicDir: true,
  },
  define: {
    CONFIG: config,
    global: {}, // needed for custom-event lib
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(process.env.npm_package_version),
    "import.meta.env.VITE_BUILD_TIME": JSON.stringify(new Date().toISOString()),
  },
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["tests/**/*", "node_modules/**/*"],
  },
  server: {
    hmr: {
      overlay: true,
      port: 5173,
    },
    proxy: {
      "/user": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      "/subscriptions": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      "/invoices": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      "/.well-known": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    exclude: ["@vite/client", "@vite/env"],
    include: ["react", "react-dom"],
  },
  assetsInclude: ["**/*.wasm"],
})
