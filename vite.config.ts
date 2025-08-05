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
    react(),
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
  ],
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        debug: "debug.html",
      },
      output: {
        manualChunks: {
          vendor: [
            "react",
            "react-dom/client",
            "react-helmet",
            "@nostr-dev-kit/ndk",
            "@nostr-dev-kit/ndk-wallet",
            "markdown-to-jsx",
            "@nostr-dev-kit/ndk-cache-dexie",
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
          ],
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
  server: {
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
})
