# Iris

Highly performant and normie-friendly offline-first Nostr web client that is not dependent on any single relay or other server. Featuring a Cashu wallet, secure DMs and social graph based content filtering. Can be packaged as a Tauri app for desktop/android/ios.

Source code for [iris.to](https://iris.to)

[![Checks](https://github.com/irislib/iris-client/actions/workflows/checks.yml/badge.svg)](https://github.com/irislib/iris-client/actions/workflows/checks.yml)
[![Tests](https://github.com/irislib/iris-client/actions/workflows/tests.yml/badge.svg)](https://github.com/irislib/iris-client/actions/workflows/tests.yml)
[![Tauri Build](https://github.com/irislib/iris-client/actions/workflows/tauri.yml/badge.svg)](https://github.com/irislib/iris-client/actions/workflows/tauri.yml)

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/irislib/iris-client)

## Development

```bash
# Install dependencies
yarn

# Start development server
yarn dev

# Build for production
yarn build

# Run tests
yarn test    # Run all tests
yarn test:ui # E2E tests with UI mode
```

### Tauri

```bash
# Desktop
yarn tauri dev
yarn tauri build

# Mobile
yarn tauri [android|ios] init
yarn tauri [android|ios] dev

# App Store builds
yarn tauri ios build --open        # Opens Xcode → Archive → Distribute
yarn tauri android build --aab     # Requires keystore setup: https://v2.tauri.app/distribute/sign/android/
```
