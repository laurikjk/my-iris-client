# Private Chats Store Migration Guide

This guide explains how to migrate from the old private chat stores to the new centralized store.

## Overview

We've consolidated three separate private chat stores into a single, more efficient store that directly integrates with the SessionManager:

- **Old Stores (Deprecated):**
  - `usePrivateChatsStore` from `./stores/privateChats`
  - `usePrivateMessagesStore` from `./stores/privateMessages`  
  - `usePrivateChatsStore` from `./stores/privateChatsNew`

- **New Store:**
  - `usePrivateChatsStoreNew` from `./stores/privateChats.new`

## Key Benefits

1. **Direct SessionManager Integration**: No more dependency on external stores for session management
2. **Self-contained Architecture**: All private chat functionality in one place
3. **Better TypeScript Support**: Improved type safety and IntelliSense
4. **Unified API**: Single store handles both messages and chat metadata
5. **Improved Performance**: Optimized persistence and state management

## Migration Steps

### 1. Update Imports

**Before:**
```typescript
import {usePrivateChatsStore} from "@/stores/privateChats"
import {usePrivateMessagesStore} from "@/stores/privateMessages"
```

**After:**
```typescript
import {usePrivateChatsStoreNew} from "@/stores/privateChats.new"
```

### 2. Initialize the Store

The new store requires initialization before use:

```typescript
import {useEffect} from 'react'
import {usePrivateChatsStoreNew} from "@/stores/privateChats.new"

function MyComponent() {
  const {initialize, isInitialized} = usePrivateChatsStoreNew()
  
  useEffect(() => {
    if (!isInitialized) {
      initialize()
    }
  }, [initialize, isInitialized])
  
  // ... rest of component
}
```

### 3. Update API Calls

#### Sending Messages
**Before:**
```typescript
const {sendToUser} = usePrivateChatsStore()
await sendToUser(userPubKey, message)
```

**After:**
```typescript
const {sendToUser} = usePrivateChatsStoreNew()
await sendToUser(userPubKey, message)
```

#### Getting Messages
**Before:**
```typescript
const eventsMap = usePrivateMessagesStore((state) => state.events)
const messages = eventsMap.get(chatId)
```

**After:**
```typescript
const messages = usePrivateChatsStoreNew((state) => state.messages.get(chatId))
```

#### Getting Chat List
**Before:**
```typescript
const {getChatsList} = usePrivateChatsStore()
const chats = getChatsList()
```

**After:**
```typescript
const {getChatsList} = usePrivateChatsStoreNew()
const chats = getChatsList()
```

#### Updating Last Seen
**Before:**
```typescript
const {updateLastSeen} = usePrivateChatsStore()
updateLastSeen(userPubKey)
```

**After:**
```typescript
const {updateLastSeen} = usePrivateChatsStoreNew()
updateLastSeen(userPubKey)
```

### 4. Message Operations

#### Adding Messages
**Before:**
```typescript
const {upsert} = usePrivateMessagesStore()
await upsert(chatId, message)
```

**After:**
```typescript
const {upsertMessage} = usePrivateChatsStoreNew()
await upsertMessage(chatId, message)
```

#### Updating Messages
**Before:**
```typescript
const {updateMessage} = usePrivateMessagesStore()
await updateMessage(chatId, messageId, updates)
```

**After:**
```typescript
const {updateMessage} = usePrivateChatsStoreNew()
await updateMessage(chatId, messageId, updates)
```

#### Removing Messages
**Before:**
```typescript
const {removeMessage} = usePrivateMessagesStore()
await removeMessage(chatId, messageId)
```

**After:**
```typescript
const {removeMessage} = usePrivateChatsStoreNew()
await removeMessage(chatId, messageId)
```

### 5. Session Management

The new store handles session management internally via SessionManager. You no longer need to:
- Manually manage UserRecord instances
- Call userRecords store methods
- Handle session persistence separately

To start listening to a user:
```typescript
const {startListeningToUser} = usePrivateChatsStoreNew()
startListeningToUser(userPubKey)
```

### 6. Cleanup

**Before:**
```typescript
const privateChatsStore = usePrivateChatsStore()
const privateMessagesStore = usePrivateMessagesStore()
// Manual cleanup of multiple stores
```

**After:**
```typescript
const {reset} = usePrivateChatsStoreNew()
reset() // Cleans up everything including SessionManager
```

## Breaking Changes

1. **Initialization Required**: The new store must be initialized before use
2. **Different State Shape**: Messages are stored differently - check your selectors
3. **Unified Message Operations**: Some operations have different method names
4. **SessionManager Integration**: Session management is now internal - don't access sessions directly

## Compatibility Notes

- The new store maintains the same message format and SortedMap structure
- Chat metadata structure remains the same
- All existing message repository integrations continue to work
- Persistence format is compatible but stored under a different key

## Testing

The new store includes comprehensive tests. Run them with:

```bash
yarn test:unit src/stores/privateChats.new.test.ts
```

## Rollout Plan

1. **Phase 1**: Deploy new store alongside old stores (current)
2. **Phase 2**: Update components to use new store
3. **Phase 3**: Remove old stores once migration is complete

## Support

If you encounter issues during migration, check:

1. Store initialization in your components
2. Updated import paths
3. Method name changes in the API section above
4. Console for any SessionManager errors

The old stores will continue to work but will show deprecation warnings.