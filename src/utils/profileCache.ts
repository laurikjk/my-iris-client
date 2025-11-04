import {NDKUserProfile} from "@/lib/ndk"
import {LRUCache} from "typescript-lru-cache"
import throttle from "lodash/throttle"
import localforage from "localforage"
import AnimalName from "./AnimalName"
import {addUsernameToCache} from "./usernameCache"

// Constants for profile data sanitization
const PROFILE_NAME_MAX_LENGTH = 50
const PROFILE_PICTURE_URL_MAX_LENGTH = 500
const MAX_SIZE = 100000

export const profileCache = new LRUCache<string, NDKUserProfile>({maxSize: MAX_SIZE})

// Track if we've loaded profiles from storage (localforage or JSON)
let profilesLoaded = false

// Profile update listeners
type ProfileUpdateListener = (pubkey: string, profile: NDKUserProfile) => void
const profileUpdateListeners = new Set<ProfileUpdateListener>()

export const subscribeToProfileUpdates = (listener: ProfileUpdateListener) => {
  profileUpdateListeners.add(listener)
  return () => {
    profileUpdateListeners.delete(listener)
  }
}

const notifyProfileUpdate = (pubkey: string, profile: NDKUserProfile) => {
  profileUpdateListeners.forEach((listener) => listener(pubkey, profile))
}

// Helper functions for profile data sanitization
const shouldRejectNip05 = (nip05: string, name: string): boolean => {
  return (
    nip05.length === 1 ||
    nip05.startsWith("npub1") ||
    name.toLowerCase().replace(/\s+/g, "").includes(nip05)
  )
}

const sanitizeName = (name: string): string => {
  return name.trim().slice(0, PROFILE_NAME_MAX_LENGTH)
}

const sanitizeNip05 = (nip05: string, name: string): string | undefined => {
  if (!nip05) return undefined
  const sanitized = nip05
    .split("@")[0]
    .trim()
    .toLowerCase()
    .slice(0, PROFILE_NAME_MAX_LENGTH)
  return shouldRejectNip05(sanitized, name) ? undefined : sanitized
}

const sanitizePicture = (picture: string): string | undefined => {
  if (!picture || picture.length > PROFILE_PICTURE_URL_MAX_LENGTH) return undefined
  return picture.trim().replace(/^https:\/\//, "")
}

// Convert condensed array to NDKUserProfile
const arrayToProfile = (item: string[], pubkey?: string): NDKUserProfile => {
  const [, name, nip05, picture] = item
  const profile: NDKUserProfile = {}

  // Add to username cache if we have pubkey and nip05
  // Assume profiles loaded from cache were previously verified
  if (pubkey && nip05) {
    addUsernameToCache(pubkey, nip05, true)
  }

  if (name) {
    profile.name = name
    profile.username = name
  }
  if (nip05) {
    profile.nip05 = nip05
  }
  if (picture) {
    profile.picture = picture.startsWith("http") ? picture : `https://${picture}`
  }

  return profile
}

// Convert NDKUserProfile to condensed array format
const profileToArray = (pubkey: string, profile: NDKUserProfile): string[] => {
  const name = sanitizeName((profile.name || profile.username || "").toString())
  if (!name) return [] // Skip profiles without names

  const nip05 = sanitizeNip05(profile.nip05 || "", name)
  const picture = sanitizePicture(profile.picture || "")

  const item = [pubkey, name]
  if (nip05) {
    item.push(nip05)
  } else if (picture) {
    item.push("") // Placeholder for nip05 if picture exists
  }
  if (picture) {
    item.push(picture)
  }

  return item
}

const throttledSaveProfiles = throttle(() => {
  // Don't save if profiles haven't been loaded yet
  if (!profilesLoaded) {
    return
  }

  const profileData: string[][] = []
  profileCache.forEach((profile, pubkey) => {
    const arrayData = profileToArray(String(pubkey), profile)
    if (arrayData.length > 0) {
      profileData.push(arrayData)
    }
  })

  // Don't save if we have too few profiles (likely an error or data loss)
  if (profileData.length < 10) {
    console.warn(
      `Not saving profile cache with only ${profileData.length} profiles (minimum: 10)`
    )
    return
  }

  localforage.setItem("profileCache", profileData)
  console.log("Saved", profileData.length, "profiles")
}, 5000)

// Load profileCache from localForage
export const loadProfileCache = (): Promise<void> => {
  return localforage
    .getItem("profileCache")
    .then(async (savedData: unknown) => {
      let validData = false

      // Try to load new condensed format
      if (Array.isArray(savedData) && savedData.length > 0) {
        const firstItem = savedData[0]
        if (
          Array.isArray(firstItem) &&
          typeof firstItem[0] === "string" &&
          typeof firstItem[1] === "string"
        ) {
          // New format: string[][]
          let loadedCount = 0
          savedData.forEach((item: string[]) => {
            if (item.length >= 2 && item[0] && item[1]) {
              profileCache.set(item[0], arrayToProfile(item, item[0]))
              loadedCount++
            }
          })
          console.log(`Loaded ${loadedCount} profiles from localforage cache`)
          validData = true
          profilesLoaded = true
        } else if (
          Array.isArray(firstItem) &&
          firstItem.length === 2 &&
          typeof firstItem[1] === "object"
        ) {
          // Old format: [string, NDKUserProfile][] - delete it
          console.log("Found old format profile cache, deleting...")
          await localforage.removeItem("profileCache")
        }
      }

      if (!validData) {
        // No valid cached profiles, load from profileData.json
        console.log("No cached profiles found, loading from profileData.json")
        const {default: profileJson} = await import(
          "nostr-social-graph/data/profileData.json"
        )
        profileJson.forEach((v) => {
          if (v[0] && v[1]) {
            let pictureUrl = v[3]
            if (pictureUrl && !pictureUrl.startsWith("http://")) {
              pictureUrl = `https://${pictureUrl}`
            }
            addCachedProfile(v[0], {username: v[1], picture: pictureUrl || undefined})
          }
        })
        profilesLoaded = true
      }
    })
    .catch((e) => {
      console.error("failed to load profileCache:", e)
      throw e
    })
}

export const addCachedProfile = (pubkey: string, profile: NDKUserProfile) => {
  // Only cache profiles with names
  const name = sanitizeName(
    (profile.name || profile.display_name || profile.username || "").toString()
  )
  if (name) {
    profileCache.set(pubkey, profile)
    // Add to username cache if it's an iris.to address
    // Mark as verified since we're getting it from nostr events
    if (profile.nip05) {
      addUsernameToCache(pubkey, profile.nip05, true)
    }
    // Only trigger save if profiles have been loaded
    if (profilesLoaded) {
      throttledSaveProfiles()
    }
    // Notify listeners of the update
    notifyProfileUpdate(pubkey, profile)
  }
}

export const getCachedName = (pubKey: string): string => {
  const profile = profileCache.get(pubKey)

  let name = ""
  if (profile) {
    if (profile.name) {
      name = profile.name
    } else if (!profile.name && profile.displayName) {
      name = profile.displayName
    } else if (
      !profile.name &&
      !profile.displayName &&
      profile.display_name &&
      typeof profile.display_name === "string" // can be number for some reason
    ) {
      name = profile.display_name
    }
  }

  return name || AnimalName(pubKey)
}

// Initialize profile cache on module load
loadProfileCache().catch(() => {
  // Error already logged in loadProfileCache
})
