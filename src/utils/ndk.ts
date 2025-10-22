import NDK, {
  NDKConstructorParams,
  NDKNip07Signer,
  NDKPrivateKeySigner,
  NDKRelay,
  NDKRelayAuthPolicies,
  NDKUser,
} from "@nostr-dev-kit/ndk"
import NDKCacheAdapterDexie from "@nostr-dev-kit/ndk-cache-dexie"
import {useUserStore} from "@/stores/user"
import {DEFAULT_RELAYS} from "@/shared/constants/relays"
import {isTouchDevice} from "@/shared/utils/isTouchDevice"

let ndkInstance: NDK | null = null
let privateKeySigner: NDKPrivateKeySigner | undefined
let nip07Signer: NDKNip07Signer | undefined

function normalizeRelayUrl(url: string): string {
  // Ensure URL ends with / to match NDK's internal normalization
  return url.endsWith("/") ? url : url + "/"
}

export {DEFAULT_RELAYS}

/**
 * Get a singleton "default" NDK instance to get started quickly. If you want to init NDK with e.g. your own relays, pass them on the first call.
 *
 * This needs to be called to make nip07 login features work.
 * @throws Error if NDK init options are passed after the first call
 */
export const ndk = (opts?: NDKConstructorParams): NDK => {
  if (!ndkInstance) {
    const store = useUserStore.getState()
    const relays = opts?.explicitRelayUrls || store.relays

    // Log when using test relay
    if (import.meta.env.VITE_USE_TEST_RELAY) {
      console.log("🧪 Using test relay only: wss://temp.iris.to/")
    }

    const options = opts || {
      explicitRelayUrls: relays,
      enableOutboxModel: import.meta.env.VITE_USE_LOCAL_RELAY
        ? false
        : store.ndkOutboxModel,
      cacheAdapter: new NDKCacheAdapterDexie({dbName: "treelike-nostr", saveSig: true}),
    }
    ndkInstance = new NDK(options)

    // Set up initial signer if we have a private key
    if (store.privateKey && typeof store.privateKey === "string") {
      try {
        privateKeySigner = new NDKPrivateKeySigner(store.privateKey)
        if (!store.nip07Login) {
          ndkInstance.signer = privateKeySigner
        }
      } catch (e) {
        console.error("Error setting initial private key signer:", e)
      }
    }

    // Set up NIP-07 signer if enabled
    if (store.nip07Login) {
      nip07Signer = new NDKNip07Signer()
      ndkInstance.signer = nip07Signer
    }

    watchLocalSettings(ndkInstance)
    ndkInstance.relayAuthDefaultPolicy = NDKRelayAuthPolicies.signIn({ndk: ndkInstance})
    setupVisibilityReconnection(ndkInstance)
    ndkInstance.connect()
    console.log("NDK instance initialized", ndkInstance)
  } else if (opts) {
    throw new Error("NDK instance already initialized, cannot pass options")
  }
  return ndkInstance
}

/**
 * Setup listeners for visibility changes and network status to force immediate reconnection
 */
function setupVisibilityReconnection(instance: NDK) {
  let wasHidden = false
  let wasOffline = false

  const reconnectDisconnectedRelays = (reason: string) => {
    console.log(`${reason}, checking relay connections...`)

    // Force immediate reconnection for disconnected relays
    // NDKRelayStatus: DISCONNECTED=1, RECONNECTING=2, FLAPPING=3, CONNECTING=4, CONNECTED=5+
    for (const relay of instance.pool.relays.values()) {
      if (relay.status < 5) {
        // Not connected
        console.log(`Forcing reconnection to ${relay.url} (status: ${relay.status})`)
        relay.connect()
      }
    }
  }

  // Handle visibility changes (PWA/mobile only - desktop keeps WS open)
  if (isTouchDevice) {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        wasHidden = true
        return
      }

      // App returned to foreground
      if (wasHidden) {
        wasHidden = false
        reconnectDisconnectedRelays("App returned to foreground")
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    // Handle page show event for iOS PWAs
    window.addEventListener("pageshow", (event) => {
      if (event.persisted) {
        reconnectDisconnectedRelays("Page shown from cache")
      }
    })

    // Handle focus event as fallback
    window.addEventListener("focus", () => {
      if (wasHidden) {
        wasHidden = false
        reconnectDisconnectedRelays("App focused")
      }
    })
  }

  // Handle network status changes
  const handleOnline = () => {
    if (wasOffline) {
      wasOffline = false
      reconnectDisconnectedRelays("Network connection restored")
    }
  }

  const handleOffline = () => {
    wasOffline = true
    console.log("Network connection lost")
  }

  window.addEventListener("online", handleOnline)
  window.addEventListener("offline", handleOffline)

  // Initialize offline state
  wasOffline = !navigator.onLine
}

function recreateNDKInstance() {
  if (ndkInstance) {
    // Disconnect all relays individually
    for (const relay of ndkInstance.pool.relays.values()) {
      relay.disconnect()
    }
    ndkInstance = null
    privateKeySigner = undefined
    nip07Signer = undefined
  }
  ndk()
}

function watchLocalSettings(instance: NDK) {
  useUserStore.subscribe((state, prevState) => {
    if (state.ndkOutboxModel !== prevState.ndkOutboxModel) {
      console.log("NDK outbox model setting changed, recreating NDK instance")
      recreateNDKInstance()
      return
    }
    if (state.privateKey !== prevState.privateKey) {
      const havePrivateKey = state.privateKey && typeof state.privateKey === "string"
      if (havePrivateKey) {
        try {
          privateKeySigner = new NDKPrivateKeySigner(state.privateKey)
          if (!state.nip07Login) {
            instance.signer = privateKeySigner
          }
        } catch (e) {
          console.error("Error setting private key signer:", e)
        }
      } else {
        privateKeySigner = undefined
        if (!state.nip07Login) {
          instance.signer = undefined
        }
      }
    }

    if (state.nip07Login) {
      if (!nip07Signer) {
        nip07Signer = new NDKNip07Signer()
        instance.signer = nip07Signer
        nip07Signer
          .user()
          .then((user) => {
            useUserStore.getState().setPublicKey(user.pubkey)
          })
          .catch((e) => {
            console.error("Error getting NIP-07 user:", e)
            useUserStore.getState().setNip07Login(false)
          })
      }
    } else {
      nip07Signer = undefined
      instance.signer = privateKeySigner
    }

    // Handle both legacy relays array and new relayConfigs
    const shouldUpdateRelays =
      state.relays !== prevState.relays || state.relayConfigs !== prevState.relayConfigs

    if (shouldUpdateRelays) {
      // Use relayConfigs if available, otherwise fall back to relays array
      const relayList =
        state.relayConfigs && state.relayConfigs.length > 0
          ? state.relayConfigs
          : state.relays.map((url) => ({url})) // No disabled flag means enabled

      if (Array.isArray(relayList)) {
        const normalizedPoolUrls = Array.from(instance.pool.relays.keys()).map(
          normalizeRelayUrl
        )

        // Process each relay config
        relayList.forEach((config) => {
          const relayConfig = typeof config === "string" ? {url: config} : config // No disabled flag means enabled

          const isEnabled = !("disabled" in relayConfig) || !relayConfig.disabled // If no disabled flag, it's enabled
          const normalizedUrl = normalizeRelayUrl(relayConfig.url)
          const existsInPool = normalizedPoolUrls.includes(normalizedUrl)

          if (isEnabled && !existsInPool) {
            // Add and connect to new relay
            const relay = new NDKRelay(relayConfig.url, undefined, instance)
            instance.pool.addRelay(relay)
            relay.connect()
          } else if (!isEnabled && existsInPool) {
            // Disconnect from relay but keep it in the pool
            const relay =
              instance.pool.relays.get(relayConfig.url) ||
              instance.pool.relays.get(normalizedUrl)
            if (relay) {
              relay.disconnect()
            }
          } else if (isEnabled && existsInPool) {
            // Ensure enabled relay is connected
            const relay =
              instance.pool.relays.get(relayConfig.url) ||
              instance.pool.relays.get(normalizedUrl)
            if (relay && relay.status !== 1) {
              // 1 = connected
              relay.connect()
            }
          }
        })

        // Don't remove relays from the pool - they might be discovered relays
        // We only disconnect them if they're explicitly disabled in config
      }
    }

    if (state.publicKey !== prevState.publicKey) {
      instance.activeUser = state.publicKey
        ? new NDKUser({hexpubkey: state.publicKey})
        : undefined
    }
  })
}
