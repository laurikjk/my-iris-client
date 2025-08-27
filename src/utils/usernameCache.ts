import {LRUCache} from "typescript-lru-cache"
import {nip19} from "nostr-tools"

interface CachedUsername {
  username: string
  verified: boolean
}

// Cache for pubkey (hex) -> username mapping
// Stores iris.to usernames with verification status
const usernameCache = new LRUCache<string, CachedUsername>({maxSize: 1000})

// Reverse lookup: username -> pubkey (only for verified usernames)
const usernameToPubkey = new Map<string, string>()

/**
 * Add a username to cache if it's a valid iris.to address
 * @param verified - Whether the NIP-05 has been verified
 */
export const addUsernameToCache = (
  pubkey: string,
  nip05: string | undefined,
  verified = false
) => {
  if (!nip05) return

  // Check if it's an iris.to address
  const match = nip05.match(/^([^@]+)@iris\.to$/i)
  if (match) {
    const username = match[1].toLowerCase()

    // Remove old reverse mapping if exists
    const oldCache = usernameCache.get(pubkey)
    if (oldCache?.verified && oldCache.username) {
      usernameToPubkey.delete(oldCache.username.toLowerCase())
    }

    // Set new cache
    usernameCache.set(pubkey, {username, verified})

    // Add reverse mapping if verified
    if (verified) {
      usernameToPubkey.set(username, pubkey)
    }
  }
}

/**
 * Get cached username for a pubkey (only returns verified usernames for routing)
 */
export const getCachedUsername = (pubkey: string): string | undefined => {
  const cached = usernameCache.get(pubkey)
  // Only return verified usernames for routing purposes
  return cached?.verified ? cached.username : undefined
}

/**
 * Convert any user identifier to the best route
 * @param identifier - Can be npub, hex pubkey, or username
 * @returns The best route for this user
 */
export const getUserRoute = (identifier: string): string => {
  let pubkey: string

  // Convert npub to hex if needed
  if (identifier.startsWith("npub")) {
    try {
      const decoded = nip19.decode(identifier)
      if (decoded.type === "npub") {
        pubkey = decoded.data as string
      } else {
        return `/${identifier}`
      }
    } catch {
      return `/${identifier}`
    }
  } else if (/^[0-9a-f]{64}$/i.test(identifier)) {
    // It's already a hex pubkey
    pubkey = identifier
  } else {
    // It's likely a username or something else
    return `/${identifier}`
  }

  // Check if we have a cached username for this pubkey
  const username = getCachedUsername(pubkey)
  if (username) {
    return `/${username}`
  }

  // Fall back to npub
  return `/${nip19.npubEncode(pubkey)}`
}

/**
 * Check if two user routes refer to the same user
 * @param route1 - First route (can be /username, /npub..., or /hexkey)
 * @param route2 - Second route
 * @returns true if they refer to the same user
 */
export const isSameUserRoute = (route1: string, route2: string): boolean => {
  const id1 = route1.replace(/^\//, "")
  const id2 = route2.replace(/^\//, "")

  // Quick check - if they're identical, they're the same
  if (id1 === id2) return true

  // Convert both to pubkeys for comparison
  const pubkey1 = toPubkey(id1)
  const pubkey2 = toPubkey(id2)

  return pubkey1 !== null && pubkey2 !== null && pubkey1 === pubkey2
}

/**
 * Convert any identifier to hex pubkey
 */
export const toPubkey = (identifier: string): string | null => {
  // Remove leading slash if present
  identifier = identifier.replace(/^\//, "")

  // Check if it's npub
  if (identifier.startsWith("npub")) {
    try {
      const decoded = nip19.decode(identifier)
      if (decoded.type === "npub") {
        return decoded.data as string
      }
    } catch {
      // Invalid npub
    }
  }

  // Check if it's hex
  if (/^[0-9a-f]{64}$/i.test(identifier)) {
    return identifier.toLowerCase()
  }

  // It might be a username - check reverse index
  const pubkeyFromUsername = usernameToPubkey.get(identifier.toLowerCase())
  if (pubkeyFromUsername) {
    return pubkeyFromUsername
  }

  return null
}
