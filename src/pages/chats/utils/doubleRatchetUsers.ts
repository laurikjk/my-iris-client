import {NDKUserProfile} from "@/lib/ndk"
import {profileCache, addCachedProfile} from "@/utils/profileCache"
import {handleProfile} from "@/utils/profileSearch"
import {ndk} from "@/utils/ndk"
import debounce from "lodash/debounce"
import Fuse from "fuse.js"
import {KIND_METADATA, DEBUG_NAMESPACES} from "@/utils/constants"
import {shouldHideUser} from "@/utils/visibility"
import {createDebugLogger} from "@/utils/createDebugLogger"

const {log, warn} = createDebugLogger(DEBUG_NAMESPACES.UI_CHAT)

export interface DoubleRatchetUser {
  pubkey: string
  profile: NDKUserProfile
}

// Fuse.js search index
let fuse: Fuse<DoubleRatchetUser> | null = null

const doubleRatchetUsers: Set<string> = new Set()
const userData: Map<string, DoubleRatchetUser> = new Map()

// Subscription system for reactive updates
const subscribers: Set<() => void> = new Set()

const notifySubscribers = () => {
  subscribers.forEach((callback) => callback())
}

// Subscribe to doubleRatchetUsers changes
export const subscribeToDoubleRatchetUsersChanges = (callback: () => void) => {
  subscribers.add(callback)
  return () => {
    subscribers.delete(callback)
  }
}

// Recreate the Fuse.js search index
const recreateSearchIndex = () => {
  fuse = new Fuse(Array.from(userData.values()), {
    keys: ["profile.name", "profile.display_name", "profile.username", "profile.nip05"],
    threshold: 0.3,
    includeScore: true,
  })
}

// Track if we're currently fetching profiles to prevent infinite loops
let isFetchingProfiles = false

// Update user data map from profile cache
const updateUserDataFromCache = () => {
  const updatedUsers = new Map<string, DoubleRatchetUser>()
  doubleRatchetUsers.forEach((userPubkey) => {
    const profile = profileCache.get(userPubkey)
    if (profile) {
      updatedUsers.set(userPubkey, {
        pubkey: userPubkey,
        profile,
      })
    }
  })

  userData.clear()
  updatedUsers.forEach((user) => userData.set(user.pubkey, user))
  recreateSearchIndex()
}

// Update the search index with new user data (internal)
const updateDoubleRatchetSearchIndexImmediate = () => {
  updateUserDataFromCache()
  log("Updated double ratchet search index", userData.size)

  // If we have users without profiles and we're not already fetching, fetch them
  const usersWithoutProfiles = Array.from(doubleRatchetUsers).filter(
    (pubkey) => !profileCache.get(pubkey)
  )

  if (usersWithoutProfiles.length > 0 && !isFetchingProfiles) {
    log("Fetching profiles for", usersWithoutProfiles.length, "users")
    isFetchingProfiles = true

    const sub = ndk().subscribe(
      {kinds: [KIND_METADATA], authors: usersWithoutProfiles},
      {closeOnEose: true}
    )

    sub.on("event", (event) => {
      if (event.kind === KIND_METADATA) {
        try {
          const profile = JSON.parse(event.content)
          profile.created_at = event.created_at
          addCachedProfile(event.pubkey, profile)
          handleProfile(event.pubkey, profile)
        } catch (e) {
          warn("Failed to parse profile for", event.pubkey, e)
        }
      }
    })

    // Update index once when subscription ends, without triggering new lookups
    sub.on("eose", () => {
      isFetchingProfiles = false
      updateUserDataFromCache()
      notifySubscribers()
    })
  }

  // Notify subscribers
  notifySubscribers()
}

// Debounced version to prevent excessive rebuilds
const updateDoubleRatchetSearchIndex = debounce(
  updateDoubleRatchetSearchIndexImmediate,
  300
)

// Add a user to the doubleRatchetUsers set
export const addDoubleRatchetUser = (pubkey: string) => {
  doubleRatchetUsers.add(pubkey)
  updateDoubleRatchetSearchIndex()
}

// Remove a user from the doubleRatchetUsers set
export const removeDoubleRatchetUser = (pubkey: string) => {
  doubleRatchetUsers.delete(pubkey)
  userData.delete(pubkey)
  updateDoubleRatchetSearchIndex()
}

// Search for double ratchet users using the Fuse.js index
export const searchDoubleRatchetUsers = (query: string): DoubleRatchetUser[] => {
  if (!fuse || !query.trim()) {
    return []
  }

  const results = fuse.search(query)
  // Filter out hidden users from search results
  return results
    .map((result) => result.item)
    .filter((user) => !shouldHideUser(user.pubkey))
}

// Get all double ratchet users
export const getAllDoubleRatchetUsers = (): DoubleRatchetUser[] => {
  return Array.from(userData.values()).filter((user) => !shouldHideUser(user.pubkey))
}

// Get all pubkeys from the doubleRatchetUsers Set (for cleanup)
export const getAllDoubleRatchetUserPubkeys = (): string[] => {
  return Array.from(doubleRatchetUsers)
}

export const getDoubleRatchetUsersCount = () => {
  return doubleRatchetUsers.size
}
