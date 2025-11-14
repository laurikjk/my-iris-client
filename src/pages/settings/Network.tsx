import {useMemo, useState, useEffect} from "react"
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
import {peerConnectionManager} from "@/utils/chat/webrtc/PeerConnectionManager"
import {getP2PStats, resetP2PStats} from "@/utils/chat/webrtc/p2pNostr"

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

  const [p2pStats, setP2pStats] = useState({
    eventsSent: 0,
    eventsReceived: 0,
    subscriptionsServed: 0,
    blobsSent: 0,
    blobsReceived: 0,
    blobBytesSent: 0,
    blobBytesReceived: 0,
    eventBytesSent: 0,
    eventBytesReceived: 0,
  })

  useEffect(() => {
    const loadStats = async () => {
      const stats = await getP2PStats()
      setP2pStats(stats)
    }
    loadStats()

    // Update stats periodically
    const interval = setInterval(loadStats, 2000)
    return () => clearInterval(interval)
  }, [])

  const handleResetP2PStats = async () => {
    await resetP2PStats()
    setP2pStats({
      eventsSent: 0,
      eventsReceived: 0,
      subscriptionsServed: 0,
      blobsSent: 0,
      blobsReceived: 0,
      blobBytesSent: 0,
      blobBytesReceived: 0,
      eventBytesSent: 0,
      eventBytesReceived: 0,
    })
  }

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
    setNdkOutboxModel(enabled)
    // Outbox model requires pool reinitialization - reload required
    await new Promise((resolve) => setTimeout(resolve, 100))
    window.location.reload()
  }

  const handleAutoConnectUserRelaysToggle = async (enabled: boolean) => {
    setAutoConnectUserRelays(enabled)
    // Auto-connect changes require pool reinitialization - reload required
    await new Promise((resolve) => setTimeout(resolve, 100))
    window.location.reload()
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
              <div className="flex justify-between items-center">
                <div className="flex flex-col">
                  <span>Connect to Own Devices</span>
                  <span className="text-sm text-base-content/60">
                    Always connect to your other devices (bypasses connection limits)
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={network.webrtcConnectToOwnDevices}
                  onChange={(e) =>
                    updateNetwork({webrtcConnectToOwnDevices: e.target.checked})
                  }
                  className="toggle toggle-primary"
                />
              </div>
            </SettingsGroupItem>
            <SettingsGroupItem>
              <div className="flex justify-between items-center">
                <div className="flex flex-col">
                  <span>P2P Only Mode</span>
                  <span className="text-sm text-base-content/60">
                    Experimental: receive events only from peers, not relays (still
                    publish to relays)
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={network.p2pOnlyMode}
                  onChange={(e) => updateNetwork({p2pOnlyMode: e.target.checked})}
                  className="toggle toggle-primary"
                  disabled={!network.webrtcEnabled}
                />
              </div>
            </SettingsGroupItem>
            <SettingsGroupItem>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span>Max Outbound Connections</span>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={network.webrtcMaxOutbound}
                    onChange={(e) =>
                      updateNetwork({webrtcMaxOutbound: parseInt(e.target.value) || 0})
                    }
                    className="input input-sm w-20"
                  />
                </div>
                <span className="text-sm text-base-content/60">
                  Maximum outgoing peer connections to mutual follows
                </span>
              </div>
            </SettingsGroupItem>
            <SettingsGroupItem>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span>Max Inbound Connections</span>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={network.webrtcMaxInbound}
                    onChange={(e) =>
                      updateNetwork({webrtcMaxInbound: parseInt(e.target.value) || 0})
                    }
                    className="input input-sm w-20"
                  />
                </div>
                <span className="text-sm text-base-content/60">
                  Maximum incoming peer connections from mutual follows
                </span>
              </div>
            </SettingsGroupItem>
            <SettingsGroupItem>
              <div className="flex justify-between items-center">
                <div className="flex flex-col">
                  <span>Enable Calls</span>
                  <span className="text-sm text-base-content/60">
                    Allow audio and video calls with connected peers
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={network.webrtcCallsEnabled}
                  onChange={(e) => updateNetwork({webrtcCallsEnabled: e.target.checked})}
                  className="toggle toggle-primary"
                  disabled={!network.webrtcEnabled}
                />
              </div>
            </SettingsGroupItem>
            <SettingsGroupItem>
              <div className="flex justify-between items-center">
                <div className="flex flex-col">
                  <span>Enable File Receiving</span>
                  <span className="text-sm text-base-content/60">
                    Allow receiving files from connected peers
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={network.webrtcFileReceivingEnabled}
                  onChange={(e) =>
                    updateNetwork({webrtcFileReceivingEnabled: e.target.checked})
                  }
                  className="toggle toggle-primary"
                  disabled={!network.webrtcEnabled}
                />
              </div>
            </SettingsGroupItem>
            <SettingsGroupItem>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span>Log Level</span>
                  <select
                    value={network.webrtcLogLevel}
                    onChange={(e) =>
                      updateNetwork({
                        webrtcLogLevel: e.target.value as
                          | "debug"
                          | "info"
                          | "warn"
                          | "error",
                      })
                    }
                    className="select select-sm select-bordered"
                  >
                    <option value="debug">Debug</option>
                    <option value="info">Info</option>
                    <option value="warn">Warn</option>
                    <option value="error">Error</option>
                  </select>
                </div>
                <span className="text-sm text-base-content/60">
                  Info: connection events, Warn/Error: problems only, Debug: all activity
                </span>
              </div>
            </SettingsGroupItem>
            <SettingsGroupItem>
              <PeerConnectionList />
            </SettingsGroupItem>
            <SettingsGroupItem>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold">P2P Statistics</span>
                  <button onClick={handleResetP2PStats} className="btn btn-xs btn-ghost">
                    Reset
                  </button>
                </div>
                <div className="flex gap-4 text-sm flex-wrap">
                  <span>
                    Events sent: <span className="font-mono">{p2pStats.eventsSent}</span>{" "}
                    ({(p2pStats.eventBytesSent / 1024).toFixed(1)} KB)
                  </span>
                  <span>
                    Events received:{" "}
                    <span className="font-mono">{p2pStats.eventsReceived}</span> (
                    {(p2pStats.eventBytesReceived / 1024).toFixed(1)} KB)
                  </span>
                  <span>
                    Blobs sent: <span className="font-mono">{p2pStats.blobsSent}</span> (
                    {(p2pStats.blobBytesSent / 1024 / 1024).toFixed(1)} MB)
                  </span>
                  <span>
                    Blobs received:{" "}
                    <span className="font-mono">{p2pStats.blobsReceived}</span> (
                    {(p2pStats.blobBytesReceived / 1024 / 1024).toFixed(1)} MB)
                  </span>
                  <span>
                    Subs served:{" "}
                    <span className="font-mono">{p2pStats.subscriptionsServed}</span>
                  </span>
                </div>
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
