# Debug Tool

This is a mini debug application built alongside the main Iris client.

## Development

1. **Run the debug tool in development:**

   ```bash
   npm run dev:debug
   ```

   Then visit `http://localhost:5174/debug.html`

2. **Run alongside main app:**
   ```bash
   npm run dev  # Main app on :5173
   npm run dev:debug  # Debug tool on :5174
   ```

## Building & Deployment

1. **Build for production:**

   ```bash
   npm run build:debug-tool
   ```

   This creates:
   - `dist/debug.html` - Debug tool entry point
   - `dist/debug-tool/index.html` - Deployment-ready debug tool
   - Shared assets in `dist/assets/`

2. **Deploy to Cloudflare:**
   - Deploy the entire `dist/` folder to Cloudflare Pages
   - The debug tool will be available at `/debug-tool/`
   - Redirects are handled via `public/_redirects`

## Structure

- `debug.html` - HTML entry point
- `src/debug/main.tsx` - React entry point
- `src/debug/DebugApp.tsx` - Main debug component
- `scripts/build-debug.ts` - Build script

## Adding Features

Edit `src/debug/DebugApp.tsx` to add new debug features:

- Environment inspection
- Local storage management
- API testing
- Performance monitoring
- Nostr event debugging
