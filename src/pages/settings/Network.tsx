import {useMemo} from "react"
import {DEFAULT_RELAYS} from "@/utils/ndk"
import {useUserStore} from "@/stores/user"
import {useUIStore} from "@/stores/ui"
import {useSettingsStore} from "@/stores/settings"
import {RelayList} from "@/shared/components/RelayList"
import {SettingsGroup} from "@/shared/components/settings/SettingsGroup"
import {SettingsGroupItem} from "@/shared/components/settings/SettingsGroupItem"
import {PeerConnectionList} from "@/shared/components/connection/PeerConnectionList"
import {WebRTCLogViewer} from "@/shared/components/connection/WebRTCLogViewer"
import {RelayLogViewer} from "@/shared/components/connection/RelayLogViewer"
import {OnlinePresence} from "@/shared/components/connection/OnlinePresence"
import {peerConnectionManager} from "@/utils/chat/webrtc/PeerConnectionManager"

export function Network() {
  const {
    relayConfigs,
    setRelayConfigs,
    ndkOutboxModel,
    setNdkOutboxModel,
    autoConnectUserRelays,
    setAutoConnectUserRelays,
  } = useUserStore()
  const {showRelayIndicator, setShowRelayIndicator} = useUIStore()
  const {network, updateNetwork} = useSettingsStore()

  const appVersion = import.meta.env.VITE_APP_VERSION || "dev"
  const buildTime = import.meta.env.VITE_BUILD_TIME || "development"

  const formatBuildTime = (timestamp: string) => {
    if (timestamp === "development") return timestamp
    try {
      const date = new Date(timestamp)
      return new Intl.DateTimeFormat("default", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date)
    } catch {
      return timestamp
    }
  }

  const resetDefaults = () => {
    const defaultConfigs = DEFAULT_RELAYS.map((url) => ({url})) // No disabled flag means enabled
    setRelayConfigs(defaultConfigs)
  }

  const handleWebRTCToggle = (enabled: boolean) => {
    updateNetwork({webrtcEnabled: enabled})
    if (enabled) {
      peerConnectionManager.start()
    } else {
      peerConnectionManager.stop()
    }
  }

  const handleOutboxModelToggle = async (enabled: boolean) => {
    try {
      setNdkOutboxModel(enabled)
      // Reload app to reinitialize NDK with new setting
      await new Promise((resolve) => setTimeout(resolve, 100))
      window.location.reload()
    } catch (error) {
      console.error("Error toggling outbox model:", error)
    }
  }

  const handleAutoConnectUserRelaysToggle = async (enabled: boolean) => {
    try {
      setAutoConnectUserRelays(enabled)
      // Reload app to reinitialize NDK with new setting
      await new Promise((resolve) => setTimeout(resolve, 100))
      window.location.reload()
    } catch (error) {
      console.error("Error toggling auto-connect user relays:", error)
    }
  }

  const hasDefaultRelays = useMemo(() => {
    const enabledUrls = relayConfigs?.filter((c) => !c.disabled).map((c) => c.url) || []
    return (
      enabledUrls.every((url) => DEFAULT_RELAYS.includes(url)) &&
      enabledUrls.length === DEFAULT_RELAYS.length
    )
  }, [relayConfigs])

  return (
    <div className="bg-base-200 min-h-full">
      <div className="p-4">
        <div className="space-y-6">
          <SettingsGroup title="Connection">
            <SettingsGroupItem>
              <div className="flex justify-between items-center">
                <span>Show Relay Indicator</span>
                <input
                  type="checkbox"
                  checked={showRelayIndicator}
                  onChange={(e) => setShowRelayIndicator(e.target.checked)}
                  className="toggle toggle-primary"
                />
              </div>
            </SettingsGroupItem>

            <SettingsGroupItem>
              <div className="flex justify-between items-center">
                <div className="flex flex-col">
                  <span>Enable Outbox Model</span>
                  <span className="text-sm text-base-content/60">
                    Connects to other people&apos;s relays for better event sync
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={ndkOutboxModel}
                  onChange={(e) => handleOutboxModelToggle(e.target.checked)}
                  className="toggle toggle-primary"
                />
              </div>
            </SettingsGroupItem>

            <SettingsGroupItem isLast>
              <div className="flex justify-between items-center">
                <div className="flex flex-col">
                  <span>Auto-connect to Your Relays</span>
                  <span className="text-sm text-base-content/60">
                    Automatically fetch and connect to your own relay list
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={autoConnectUserRelays}
                  onChange={(e) => handleAutoConnectUserRelaysToggle(e.target.checked)}
                  className="toggle toggle-primary"
                />
              </div>
            </SettingsGroupItem>
          </SettingsGroup>

          <SettingsGroup title="Relays">
            <SettingsGroupItem>
              <div className="flex flex-col space-y-4">
                <RelayList
                  compact={false}
                  showDelete={true}
                  showAddRelay={true}
                  showDiscovered={true}
                  maxHeight="max-h-none"
                />
                {!hasDefaultRelays && (
                  <button className="btn btn-secondary" onClick={resetDefaults}>
                    Reset to defaults
                  </button>
                )}
              </div>
            </SettingsGroupItem>
            <SettingsGroupItem isLast>
              <RelayLogViewer />
            </SettingsGroupItem>
          </SettingsGroup>

          <SettingsGroup title="WebRTC Peer Connections">
            <SettingsGroupItem>
              <div className="flex justify-between items-center">
                <div className="flex flex-col">
                  <span>Enable WebRTC P2P</span>
                  <span className="text-sm text-base-content/60">
                    Direct peer-to-peer connections with mutual follows
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={network.webrtcEnabled}
                  onChange={(e) => handleWebRTCToggle(e.target.checked)}
                  className="toggle toggle-primary"
                />
              </div>
            </SettingsGroupItem>
            <SettingsGroupItem>
              <PeerConnectionList />
            </SettingsGroupItem>
            <SettingsGroupItem>
              <div className="flex flex-col gap-2">
                <span className="text-sm font-semibold">Mutual Follows</span>
                <span className="text-xs text-base-content/60">
                  Online users shown with green indicator
                </span>
                <OnlinePresence />
              </div>
            </SettingsGroupItem>
            <SettingsGroupItem isLast>
              <WebRTCLogViewer />
            </SettingsGroupItem>
          </SettingsGroup>

          <SettingsGroup title="Maintenance">
            <SettingsGroupItem isLast>
              <div className="flex flex-col space-y-2">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => window.location.reload()}
                    className="text-info text-left"
                  >
                    Refresh Application
                  </button>
                  <div className="flex flex-col items-end text-xs text-base-content/60">
                    <span>{appVersion}</span>
                    <span>{formatBuildTime(buildTime)}</span>
                  </div>
                </div>
                <p className="text-xs text-base-content/60">
                  Reload the application to apply any pending updates or fix issues.
                </p>
              </div>
            </SettingsGroupItem>
          </SettingsGroup>
        </div>
      </div>
    </div>
  )
}
