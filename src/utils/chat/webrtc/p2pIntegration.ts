import {NDKEvent, type NDKFilter, NDKRelaySet} from "@nostr-dev-kit/ndk"
import {ndk} from "@/utils/ndk"
import {useSettingsStore} from "@/stores/settings"
import {KIND_APP_DATA} from "@/utils/constants"
import {sendEventToWebRTC, relayEventToWebRTC} from "./p2pEvents"
import {sendSubscriptionToPeersBatched} from "./p2pSubscriptions"

/**
 * Check if subscription filter is for WebRTC signaling
 */
function isSignalingSubscription(filters: NDKFilter | NDKFilter[]): boolean {
  const filterArray = Array.isArray(filters) ? filters : [filters]
  return filterArray.some(
    (filter) => filter.kinds?.includes(KIND_APP_DATA) && filter["#l"]?.includes("webrtc")
  )
}

/**
 * Wrap NDK publish to include WebRTC forwarding
 */
export function wrapNDKPublish() {
  const originalPublish = NDKEvent.prototype.publish
  NDKEvent.prototype.publish = async function (...args) {
    // Publish to relays normally
    const result = await originalPublish.apply(this, args)

    // Send to WebRTC peers
    sendEventToWebRTC(this)

    return result
  }
}

/**
 * Hook into all NDK subscriptions to relay events to WebRTC peers
 */
export function wrapNDKSubscribe() {
  const ndkInstance = ndk()

  // Wrap subscribe to attach our relay handler to all subscriptions
  const originalSubscribe = ndkInstance.subscribe.bind(ndkInstance)
  ndkInstance.subscribe = (...args) => {
    const p2pOnlyMode = useSettingsStore.getState().network.p2pOnlyMode
    const [filters] = args

    // Send REQ to WebRTC peers to get cached data (batched)
    if (!isSignalingSubscription(filters)) {
      const filterArray = Array.isArray(filters) ? filters : [filters]
      sendSubscriptionToPeersBatched(filterArray)
    }

    // In P2P-only mode, only subscribe to signaling events on relays
    if (p2pOnlyMode && !isSignalingSubscription(filters)) {
      // Create subscription with empty relay set (no relay traffic)
      const emptyRelaySet = new NDKRelaySet(new Set(), ndkInstance)
      const subscription = originalSubscribe(filters, {
        closeOnEose: false,
        relaySet: emptyRelaySet,
      })
      subscription.on("event", relayEventToWebRTC)
      return subscription
    }

    const subscription = originalSubscribe(...args)
    subscription.on("event", relayEventToWebRTC)
    return subscription
  }
}

/**
 * Initialize WebRTC integration with NDK
 * Wraps publish and subscribe methods to include WebRTC forwarding
 */
export function initializeWebRTCIntegration() {
  wrapNDKPublish()
  wrapNDKSubscribe()
}
