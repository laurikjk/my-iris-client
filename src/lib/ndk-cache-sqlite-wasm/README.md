# NDK Cache SQLite WASM

Copied from `@nostr-dev-kit/ndk/cache-sqlite-wasm` for easier development.

## Source
- Origin: `/Users/martti/src/ndk/cache-sqlite-wasm/`
- Imports modified: `@nostr-dev-kit/ndk` → `@/lib/ndk`

## Usage

```typescript
import { NDKCacheAdapterSqliteWasm } from '@/lib/ndk-cache-sqlite-wasm'

const cache = new NDKCacheAdapterSqliteWasm({
  dbName: 'iris-cache',
  wasmUrl: '/sql-wasm.wasm'  // 644KB WASM file in /public
})

await cache.initializeAsync(ndk)
```

## WASM Binary
- Location: `/public/sql-wasm.wasm` (644KB)
- Source: Copied from NDK example
- Runtime: sql.js SQLite compiled to WASM

## Structure
- `db/` - Schema, migrations, WASM loader
- `functions/` - Cache operations (25 functions)
- `index.ts` - Main adapter class
- `worker.ts` - Web worker implementation
- `types.ts` - TypeScript definitions
