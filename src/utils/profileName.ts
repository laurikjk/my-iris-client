import {LRUCache} from "typescript-lru-cache"
import {getMainThreadDb, type Profile} from "@/lib/ndk-cache/db"
import {NDKUserProfile} from "@/lib/ndk"
import AnimalName from "./AnimalName"

type ProfileLike = Profile | NDKUserProfile | null | undefined

// Small in-memory cache for sync access, auto-expires after 5 minutes
const nameCache = new LRUCache<string, string>({
  maxSize: 10000,
  entryExpirationTimeInMS: 5 * 60 * 1000,
})

/**
 * Get a display name for a pubkey synchronously.
 * Returns cached name if available, otherwise AnimalName.
 * Call getProfileName first to populate the cache from Dexie.
 */
export function getCachedName(pubKey: string): string {
  if (!pubKey) return ""
  const cached = nameCache.get(pubKey)
  if (cached) return cached
  return AnimalName(pubKey)
}

/**
 * Get profile name from Dexie cache, with AnimalName fallback.
 * Also populates the sync name cache.
 */
export async function getProfileName(pubKey: string): Promise<string> {
  if (!pubKey) return ""

  // Check memory cache first
  const cached = nameCache.get(pubKey)
  if (cached) return cached

  try {
    const db = getMainThreadDb()
    const profile = await db.profiles.get(pubKey)
    const name = getNameFromProfile(profile, pubKey)
    nameCache.set(pubKey, name)
    return name
  } catch {
    return AnimalName(pubKey)
  }
}

/**
 * Extract display name from profile object
 */
export function getNameFromProfile(profile: ProfileLike, pubKey: string): string {
  if (!profile) return AnimalName(pubKey)

  const name =
    profile.name ||
    profile.displayName ||
    (typeof profile.display_name === "string" ? profile.display_name : undefined)

  return name || AnimalName(pubKey)
}

/**
 * Update the name cache when a profile is fetched
 */
export function updateNameCache(pubKey: string, profile: ProfileLike) {
  if (!pubKey) return
  const name = getNameFromProfile(profile, pubKey)
  nameCache.set(pubKey, name)
}
