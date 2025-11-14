/**
 * Cache Worker Entry Point
 *
 * This is a minimal wrapper that imports the actual cache worker implementation
 * from the ndk-cache-sqlite-wasm module. The worker.ts file contains the full
 * implementation.
 *
 * This file must be in /public so it can be loaded as a worker at runtime.
 */

// Import the actual worker implementation
// Note: In production build, this path needs to be resolved by bundler
import '/src/lib/ndk-cache-sqlite-wasm/worker.ts'
