import NDK, {
  NDKConstructorParams,
  NDKNip07Signer,
  NDKPrivateKeySigner,
  NDKRelay,
  NDKRelayAuthPolicies,
  NDKUser,
  NDKEvent,
  NDKSubscription,
} from "@/lib/ndk"
import NDKCacheAdapterDexie from "@/lib/ndk-cache"
import {useUserStore} from "@/stores/user"
import {DEFAULT_RELAYS} from "@/shared/constants/relays"
import {isTouchDevice} from "@/shared/utils/isTouchDevice"
import {relayLogger} from "@/utils/relay/RelayLogger"
import {WebRTCTransportPlugin} from "@/utils/chat/webrtc/WebRTCTransportPlugin"
import {setWebRTCPlugin} from "@/utils/chat/webrtc/p2pMessages"
import {useSettingsStore} from "@/stores/settings"

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

    // Only include enabled relays
    const enabledRelays =
      store.relayConfigs?.filter((c) => !c.disabled).map((c) => c.url) || []
    const relays = opts?.explicitRelayUrls || enabledRelays

    console.log("Initializing NDK with enabled relays:", relays)

    // Log when using test relay
    if (import.meta.env.VITE_USE_TEST_RELAY) {
      console.log("🧪 Using test relay only: wss://temp.iris.to/")
    }

    const enableOutbox = import.meta.env.VITE_USE_LOCAL_RELAY
      ? false
      : store.ndkOutboxModel

    const autoConnectUserRelays = import.meta.env.VITE_USE_LOCAL_RELAY
      ? false
      : store.autoConnectUserRelays

    console.log(
      "Initializing NDK with outbox model:",
      enableOutbox,
      "autoConnectUserRelays:",
      autoConnectUserRelays
    )

    // Check relay connection filter - always check current state from store
    const relayConnectionFilter = (relayUrl: string) => {
      const currentStore = useUserStore.getState()
      const normalizedUrl = normalizeRelayUrl(relayUrl)

      // Check if relay is in current config
      const relayConfig = currentStore.relayConfigs?.find(
        (c) => normalizeRelayUrl(c.url) === normalizedUrl
      )

      // If relay is in config and disabled, block it
      if (relayConfig?.disabled) {
        console.log("Blocking disabled relay:", relayUrl)
        return false
      }

      // If relay is in config and enabled, allow it
      if (relayConfig && !relayConfig.disabled) {
        return true
      }

      // If relay not in config, check outbox/autoConnect settings
      const currentEnableOutbox = import.meta.env.VITE_USE_LOCAL_RELAY
        ? false
        : currentStore.ndkOutboxModel
      const currentAutoConnect = import.meta.env.VITE_USE_LOCAL_RELAY
        ? false
        : currentStore.autoConnectUserRelays

      if (!currentEnableOutbox && !currentAutoConnect) {
        console.log("Blocking discovered relay:", relayUrl)
        return false
      }

      // Otherwise allow (outbox/autoConnect will handle discovery)
      return true
    }

    const options = opts || {
      explicitRelayUrls: relays,
      enableOutboxModel: enableOutbox,
      autoConnectUserRelays,
      relayConnectionFilter,

      cacheAdapter: new NDKCacheAdapterDexie({
        dbName: "treelike-nostr",
        saveSig: true,
      }) as any, // eslint-disable-line @typescript-eslint/no-explicit-any
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
    attachRelayLogger(ndkInstance)
    setupWebRTCTransport(ndkInstance)
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
        // Check if this relay is explicitly disabled in config before reconnecting
        const store = useUserStore.getState()
        const relayConfig = store.relayConfigs?.find(
          (c) => normalizeRelayUrl(c.url) === normalizeRelayUrl(relay.url)
        )
        if (relayConfig?.disabled) {
          console.log(`Skipping reconnection to disabled relay: ${relay.url}`)
          continue
        }

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

/**
 * Setup WebRTC transport plugin for P2P event distribution
 */
function setupWebRTCTransport(instance: NDK) {
  const plugin = new WebRTCTransportPlugin()
  plugin.initialize(instance)
  setWebRTCPlugin(plugin)

  // Hook into NDK event publishing
  const originalEventPublish = NDKEvent.prototype.publish
  NDKEvent.prototype.publish = async function (...args) {
    // Call original publish
    const result = await originalEventPublish.apply(this, args)

    // Notify WebRTC plugin after successful relay publish
    plugin.onPublish?.(this)

    return result
  }

  // Hook into NDK subscriptions
  const originalSubscribe = instance.subscribe.bind(instance)
  instance.subscribe = (...args) => {
    const subscription = originalSubscribe(...args)
    const filters = Array.isArray(args[0]) ? args[0] : [args[0]]
    const opts = args[1]

    // Notify WebRTC plugin about new subscription
    plugin.onSubscribe?.(subscription, filters, opts)

    return subscription
  }

  // Watch for P2P-only mode changes
  useSettingsStore.subscribe((state, prevState) => {
    if (state.network.p2pOnlyMode !== prevState.network.p2pOnlyMode) {
      plugin.setP2POnlyMode(state.network.p2pOnlyMode)
    }
  })

  console.log("WebRTC transport plugin initialized")
}

function attachRelayLogger(instance: NDK) {
  // Attach to existing relays
  for (const relay of instance.pool.relays.values()) {
    relayLogger.attachToRelay(relay)
  }

  // Attach to new relays as they're added
  const originalAddRelay = instance.pool.addRelay.bind(instance.pool)
  instance.pool.addRelay = (relay: NDKRelay) => {
    relayLogger.attachToRelay(relay)
    return originalAddRelay(relay)
  }
}

function watchLocalSettings(instance: NDK) {
  useUserStore.subscribe((state, prevState) => {
    // Outbox model changes are handled by page reload in Network.tsx
    // No need to recreate NDK instance here
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
            // Remove disabled relay from pool entirely
            // removeRelay handles disconnect internally
            const removed =
              instance.pool.removeRelay(relayConfig.url) ||
              instance.pool.removeRelay(normalizedUrl)
            if (removed) {
              console.log("Removed disabled relay from pool:", relayConfig.url)
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
      }
    }

    if (state.publicKey !== prevState.publicKey) {
      instance.activeUser = state.publicKey
        ? new NDKUser({hexpubkey: state.publicKey})
        : undefined
    }
  })
}
