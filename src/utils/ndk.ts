import NDK, {
  NDKConstructorParams,
  NDKNip07Signer,
  NDKPrivateKeySigner,
  NDKRelay,
  NDKRelayAuthPolicies,
  NDKUser,
  NDKEvent,
} from "@nostr-dev-kit/ndk"
import {generateSecretKey, getPublicKey, nip19} from "nostr-tools"
import NDKCacheAdapterDexie from "@nostr-dev-kit/ndk-cache-dexie"
import {bytesToHex, hexToBytes} from "@noble/hashes/utils"
import {useUserStore} from "@/stores/user"
import {KIND_METADATA} from "@/utils/constants"

let ndkInstance: NDK | null = null
let privateKeySigner: NDKPrivateKeySigner | undefined
let nip07Signer: NDKNip07Signer | undefined

function normalizeRelayUrl(url: string): string {
  // Ensure URL ends with / to match NDK's internal normalization
  return url.endsWith("/") ? url : url + "/"
}

const LOCAL_RELAY = ["ws://localhost:7777"]

const PRODUCTION_RELAYS = [
  "wss://temp.iris.to/",
  "wss://vault.iris.to/",
  "wss://relay.damus.io/",
  "wss://relay.nostr.band/",
  "wss://relay.snort.social/",
]

const TEST_RELAY = ["wss://temp.iris.to/"]

export const DEFAULT_RELAYS = import.meta.env.VITE_USE_TEST_RELAY
  ? TEST_RELAY
  : import.meta.env.VITE_USE_LOCAL_RELAY
    ? LOCAL_RELAY
    : PRODUCTION_RELAYS

/**
 * Get a singleton "default" NDK instance to get started quickly. If you want to init NDK with e.g. your own relays, pass them on the first call.
 *
 * This needs to be called to make nip07 login features work.
 * @throws Error if NDK init options are passed after the first call
 */
export const ndk = (opts?: NDKConstructorParams): NDK => {
  if (!ndkInstance) {
    const store = useUserStore.getState()
    const relays = opts?.explicitRelayUrls || DEFAULT_RELAYS

    // Log when using test relay
    if (relays === TEST_RELAY) {
      console.log("🧪 Using test relay only: wss://temp.iris.to/")
    }

    const options = opts || {
      explicitRelayUrls: relays,
      enableOutboxModel: store.ndkOutboxModel,
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
    ndkInstance.connect()
    console.log("NDK instance initialized", ndkInstance)
  } else if (opts) {
    throw new Error("NDK instance already initialized, cannot pass options")
  }
  return ndkInstance
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

    if (state.relays !== prevState.relays) {
      if (Array.isArray(state.relays)) {
        // Normalize relay URLs for consistent comparison
        const normalizedNewRelays = state.relays.map(normalizeRelayUrl)
        const normalizedPoolUrls = Array.from(instance.pool.relays.keys()).map(
          normalizeRelayUrl
        )

        // Add new relays
        state.relays.forEach((url) => {
          const normalizedUrl = normalizeRelayUrl(url)
          if (!normalizedPoolUrls.includes(normalizedUrl)) {
            const relay = new NDKRelay(url, undefined, instance)
            instance.pool.addRelay(relay)
            // Explicitly connect to the new relay
            relay.connect()
          }
        })

        // Remove relays not in the new list
        for (const poolUrl of instance.pool.relays.keys()) {
          const normalizedPoolUrl = normalizeRelayUrl(poolUrl)
          if (!normalizedNewRelays.includes(normalizedPoolUrl)) {
            instance.pool.removeRelay(poolUrl)
          }
        }
      }
    }

    if (state.publicKey !== prevState.publicKey) {
      instance.activeUser = state.publicKey
        ? new NDKUser({hexpubkey: state.publicKey})
        : undefined
    }
  })
}

/**
 * Create a new account (keypair), login with it and publish a profile event with the given name
 * @param name
 */
export function newUserLogin(name: string) {
  ndk()
  const sk = generateSecretKey() // `sk` is a Uint8Array
  const pk = getPublicKey(sk) // `pk` is a hex string
  const privateKeyHex = bytesToHex(sk)

  const store = useUserStore.getState()
  store.setPrivateKey(privateKeyHex)
  store.setPublicKey(pk)

  privateKeySigner = new NDKPrivateKeySigner(privateKeyHex)
  ndkInstance!.signer = privateKeySigner
  const profileEvent = new NDKEvent(ndkInstance!)
  profileEvent.kind = KIND_METADATA
  profileEvent.content = JSON.stringify({name})
  profileEvent.publish()
}

/**
 * Login with a private key
 * @param privateKey - hex or nsec format
 */
export function privateKeyLogin(privateKey: string) {
  ndk()
  if (privateKey && typeof privateKey === "string") {
    const bytes =
      privateKey.indexOf("nsec1") === 0
        ? (nip19.decode(privateKey).data as Uint8Array)
        : hexToBytes(privateKey)
    const hex = bytesToHex(bytes)
    privateKeySigner = new NDKPrivateKeySigner(hex)
    ndkInstance!.signer = privateKeySigner
    const publicKey = getPublicKey(bytes)

    const store = useUserStore.getState()
    store.setPrivateKey(hex)
    store.setPublicKey(publicKey)
  }
}
