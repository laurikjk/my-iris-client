import {useUserStore} from "@/stores/user"

export function useRelays() {
  const {relayConfigs, toggleRelayConnection, addRelay, removeRelay, setRelayConfigs} =
    useUserStore()

  const addConnectToRelayUrl = (url: string, disabled: boolean = false) => {
    let normalizedUrl = url.trim()
    if (!normalizedUrl) return

    if (!normalizedUrl.startsWith("wss://") && !normalizedUrl.startsWith("ws://")) {
      normalizedUrl = `wss://${normalizedUrl}`
    }

    // Ensure trailing slash for consistency with NDK normalization
    if (!normalizedUrl.endsWith("/")) {
      normalizedUrl = normalizedUrl + "/"
    }

    addRelay(normalizedUrl, disabled)
  }

  const removeConnectToRelayUrl = (url: string) => {
    removeRelay(url)
  }

  // Get enabled relay URLs for backward compatibility
  const connectToRelayUrls =
    relayConfigs?.filter((c) => !c.disabled).map((c) => c.url) || []

  return {
    connectToRelayUrls,
    relayConfigs,
    addConnectToRelayUrl,
    removeConnectToRelayUrl,
    toggleRelayConnection,
    setRelayConfigs,
  }
}
