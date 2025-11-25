import {SocialGraph, NostrEvent} from "nostr-social-graph/src"
import {NDKSubscription} from "@/lib/ndk"
import {useUserStore} from "@/stores/user"
import {useSocialGraphStore} from "@/stores/socialGraph"
import {VerifiedEvent} from "nostr-tools"
import debounce from "lodash/debounce"
import throttle from "lodash/throttle"
import localForage from "localforage"
// Removed static import to avoid race condition - use dynamic import in setupSubscription
import {useEffect, useState} from "react"
import {KIND_CONTACTS, KIND_MUTE_LIST, DEBUG_NAMESPACES} from "@/utils/constants"
import {EventEmitter} from "tseep"
import {createDebugLogger} from "@/utils/createDebugLogger"

const {log, error} = createDebugLogger(DEBUG_NAMESPACES.UTILS)

export const DEFAULT_SOCIAL_GRAPH_ROOT =
  "4523be58d395b1b196a9b8c82b038b6895cb02b683d0c253a955068dba1facd0"

export const DEFAULT_CRAWL_DEGREE = 3

let instance = new SocialGraph(DEFAULT_SOCIAL_GRAPH_ROOT)
let isInitialized = false

// Event emitter for social graph changes
export const socialGraphEvents = new EventEmitter()
socialGraphEvents.setMaxListeners?.(100) // Increase limit for multiple subscribers

async function loadPreCrawledGraph(publicKey: string): Promise<SocialGraph> {
  const binaryUrl = (await import("nostr-social-graph/data/socialGraph.bin?url")).default
  const response = await fetch(binaryUrl)
  const binaryData = new Uint8Array(await response.arrayBuffer())
  const graph = await SocialGraph.fromBinary(publicKey, binaryData)
  log("loaded default binary social graph of size", graph.size())
  return graph
}

async function initializeInstance(publicKey = DEFAULT_SOCIAL_GRAPH_ROOT) {
  if (isInitialized) {
    log("setting root", publicKey)
    instance.setRoot(publicKey)
    return
  }
  isInitialized = true
  const data = await localForage.getItem("socialGraph")
  if (data) {
    try {
      instance = await SocialGraph.fromBinary(publicKey, data as Uint8Array)
      log("loaded local social graph of size", instance.size())
    } catch (err) {
      error("error deserializing", err)
      await localForage.removeItem("socialGraph")
      instance = await loadPreCrawledGraph(publicKey)
    }
  } else {
    log("no social graph found")
    await localForage.removeItem("socialGraph")
    instance = await loadPreCrawledGraph(publicKey)
  }
}

const saveToLocalForage = async () => {
  if (!isInitialized) {
    return
  }

  try {
    const serialized = await instance.toBinary()
    await localForage.setItem("socialGraph", serialized)
    log("Saved social graph of size", instance.size())
  } catch (err) {
    error("failed to serialize SocialGraph or UniqueIds", err)
    log("social graph size", instance.size())
  }
}

const throttledSave = throttle(saveToLocalForage, 15000)

const debouncedRemoveNonFollowed = debounce(() => {
  /* temp removed until better perf
  const removedCount = instance.removeMutedNotFollowedUsers()
  console.log("Removing", removedCount, "muted users not followed by anyone")
  */
  throttledSave()
}, 11000)

// Throttled mute list update event
const throttledMuteListUpdate = throttle(() => {
  socialGraphEvents.emit("muteListUpdated")
}, 1000)

export const handleSocialGraphEvent = (evs: NostrEvent | Array<NostrEvent>) => {
  const events = Array.isArray(evs) ? evs : [evs]
  const hasMuteListUpdate = events.some((e) => e.kind === KIND_MUTE_LIST)

  instance.handleEvent(evs)
  throttledSave()

  if (hasMuteListUpdate) {
    throttledMuteListUpdate()
  }
}

let sub: NDKSubscription | undefined
let isManualRecrawling = false

function getFollowListsInternal(
  myPubKey: string,
  missingOnly = true,
  upToDistance = 1,
  isManual = false
) {
  const toFetch = new Set<string>()

  const addUsersToFetch = (users: Set<string>, currentDistance: number) => {
    for (const user of users) {
      if (!missingOnly || instance.getFollowedByUser(user).size === 0) {
        toFetch.add(user)
      }
    }

    if (currentDistance < upToDistance) {
      for (const user of users) {
        const nextLevelUsers = instance.getFollowedByUser(user)
        addUsersToFetch(nextLevelUsers, currentDistance + 1)
      }
    }
  }

  const myFollows = instance.getFollowedByUser(myPubKey)
  addUsersToFetch(myFollows, 1)

  log("fetching", toFetch.size, missingOnly ? "missing" : "total", "follow lists")

  const fetchBatch = async (authors: string[]) => {
    if (isManual && !isManualRecrawling) return

    const {ndk: getNdk, initNDKAsync} = await import("@/utils/ndk")
    await initNDKAsync() // Ensure NDK is initialized
    const sub = getNdk().subscribe(
      {
        kinds: [KIND_CONTACTS, KIND_MUTE_LIST],
        authors: authors,
      },
      {closeOnEose: true}
    )

    sub.on("event", (e: unknown) => {
      handleSocialGraphEvent(e as unknown as VerifiedEvent)
      debouncedRemoveNonFollowed()
    })
  }

  const processBatch = () => {
    if (isManual && !isManualRecrawling) {
      return
    }

    const batch = [...toFetch].slice(0, 500)
    if (batch.length > 0) {
      fetchBatch(batch)
      batch.forEach((author) => toFetch.delete(author))
      if (toFetch.size > 0) {
        setTimeout(() => {
          processBatch()
        }, 1000)
      } else if (isManual) {
        isManualRecrawling = false
        useSocialGraphStore.getState().setIsRecrawling(false)
      }
    } else if (isManual) {
      isManualRecrawling = false
      useSocialGraphStore.getState().setIsRecrawling(false)
    }
  }

  processBatch()
}

export function getFollowLists(myPubKey: string, missingOnly = true, upToDistance = 1) {
  isManualRecrawling = true
  useSocialGraphStore.getState().setIsRecrawling(true)
  getFollowListsInternal(myPubKey, missingOnly, upToDistance, true)
}

function getMissingFollowLists(myPubKey: string) {
  getFollowListsInternal(myPubKey, true, 1)
}

let isLoaded = false
let resolveLoaded: ((value: boolean) => void) | null = null

export const socialGraphLoaded = new Promise<boolean>((resolve) => {
  resolveLoaded = resolve
})

// Initialize social graph (separate from subscription setup)
export const initializeSocialGraph = async () => {
  const currentPublicKey = useUserStore.getState().publicKey
  await initializeInstance(currentPublicKey || undefined)

  if (!currentPublicKey) {
    instance.setRoot(DEFAULT_SOCIAL_GRAPH_ROOT)
  }

  isLoaded = true
  resolveLoaded?.(true)
}

// Setup subscription (called after NDK is ready)
export const setupSocialGraphSubscriptions = async () => {
  const currentPublicKey = useUserStore.getState().publicKey
  if (currentPublicKey) {
    await setupSubscription(currentPublicKey)
  }

  useUserStore.subscribe((state, prevState) => {
    if (state.publicKey !== prevState.publicKey) {
      if (state.publicKey) {
        setupSubscription(state.publicKey)
      } else {
        instance.setRoot(DEFAULT_SOCIAL_GRAPH_ROOT)
      }
    }
  })
}

// Auto-initialize on module load
initializeSocialGraph()

export const useSocialGraphLoaded = () => {
  const [isSocialGraphLoaded, setIsSocialGraphLoaded] = useState(isLoaded)
  useEffect(() => {
    socialGraphLoaded.then(() => {
      setIsSocialGraphLoaded(true)
    })
  }, [])
  return isSocialGraphLoaded
}

async function setupSubscription(publicKey: string) {
  instance.setRoot(publicKey)
  await instance.recalculateFollowDistances()
  sub?.stop()

  // Import ndk lazily to avoid initialization race
  const {ndk: getNdk, initNDKAsync} = await import("@/utils/ndk")
  await initNDKAsync() // Ensure NDK is initialized
  sub = getNdk().subscribe({
    kinds: [KIND_CONTACTS, KIND_MUTE_LIST],
    authors: [publicKey],
    limit: 1,
  })
  let latestTime = 0
  sub?.on("event", (ev) => {
    if (ev.kind === KIND_MUTE_LIST) {
      handleSocialGraphEvent(ev as NostrEvent)
      return
    }
    if (typeof ev.created_at !== "number" || ev.created_at < latestTime) {
      return
    }
    latestTime = ev.created_at
    handleSocialGraphEvent(ev as NostrEvent)
    queueMicrotask(() => getMissingFollowLists(publicKey))
    instance.recalculateFollowDistances()
  })
}

export const saveToFile = async () => {
  const data = await instance.toBinary()
  const url = URL.createObjectURL(
    new File([data.slice()], "social_graph.bin", {
      type: "application/octet-stream",
    })
  )
  const a = document.createElement("a")
  a.href = url
  a.download = "social_graph.bin"
  a.click()
}

export const loadFromFile = (merge = false) => {
  const input = document.createElement("input")
  input.type = "file"
  input.accept = ".bin"
  input.multiple = false
  input.onchange = () => {
    if (input.files?.length) {
      const file = input.files[0]
      file.arrayBuffer().then((buffer) => {
        try {
          const data = new Uint8Array(buffer)
          SocialGraph.fromBinary(instance.getRoot(), data).then(async (newInstance) => {
            if (merge) {
              instance.merge(newInstance)
            } else {
              instance = newInstance
            }
            await saveToLocalForage()
          })
        } catch (err) {
          error("failed to load social graph from file:", err)
        }
      })
    }
  }
  input.click()
}

export interface DownloadGraphOptions {
  maxNodes?: number
  maxEdges?: number
  maxDistance?: number
  maxEdgesPerNode?: number
  format?: string
  onDownloaded?: (bytes: number) => void
}

export const downloadLargeGraph = (options: DownloadGraphOptions = {}) => {
  const {
    maxNodes = 50000,
    maxEdges,
    maxDistance,
    maxEdgesPerNode,
    format = "binary",
    onDownloaded,
  } = options

  const params = new URLSearchParams()
  if (maxNodes) params.append("maxNodes", String(maxNodes))
  if (maxEdges) params.append("maxEdges", String(maxEdges))
  if (maxDistance) params.append("maxDistance", String(maxDistance))
  if (maxEdgesPerNode) params.append("maxEdgesPerNode", String(maxEdgesPerNode))
  if (format) params.append("format", format)

  const url = `https://graph-api.iris.to/social-graph?${params.toString()}`

  fetch(url)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      if (!response.body) {
        throw new Error("Response body is null")
      }

      const reader = response.body.getReader()
      const chunks: Uint8Array[] = []
      let totalBytes = 0

      return new Promise<ArrayBuffer>((resolve, reject) => {
        function readChunk() {
          reader
            .read()
            .then(({done, value}) => {
              if (done) {
                // Combine all chunks into a single ArrayBuffer
                const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0)
                const result = new Uint8Array(totalLength)
                let offset = 0
                for (const chunk of chunks) {
                  result.set(chunk, offset)
                  offset += chunk.length
                }
                resolve(result.buffer)
                return
              }

              chunks.push(value)
              totalBytes += value.length
              if (onDownloaded) onDownloaded(totalBytes)
              readChunk()
            })
            .catch(reject)
        }

        readChunk()
      })
    })
    .then((data) => {
      return SocialGraph.fromBinary(instance.getRoot(), new Uint8Array(data))
    })
    .then(async (newInstance) => {
      instance = newInstance
      await instance.recalculateFollowDistances()
      throttledSave()

      setupSubscription(instance.getRoot())
      const root = instance.getRoot()
      if (root && root !== DEFAULT_SOCIAL_GRAPH_ROOT) {
        getFollowListsInternal(root, false, 1)
      }
    })
    .catch((err) => {
      error("failed to load large social graph:", err)
    })
}

export const loadAndMerge = () => loadFromFile(true)

export const clearGraph = async () => {
  instance = new SocialGraph(instance.getRoot())
  await saveToLocalForage()
  log("Cleared social graph")
}

export const resetGraph = async () => {
  const root = instance.getRoot()
  instance = await loadPreCrawledGraph(root)
  await saveToLocalForage()
  log("Reset social graph to default")
}

export const stopRecrawl = () => {
  if (isManualRecrawling) {
    isManualRecrawling = false
    useSocialGraphStore.getState().setIsRecrawling(false)
    throttledSave()
  }
}

export function getMutualFollows(pubkey?: string): string[] {
  const myPubkey = pubkey || instance.getRoot()
  if (!myPubkey) return []

  const following = Array.from(instance.getFollowedByUser(myPubkey))
  return following.filter((followedPubkey) =>
    instance.getFollowedByUser(followedPubkey).has(myPubkey)
  )
}

export default () => instance
