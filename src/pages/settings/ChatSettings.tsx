import {useState, useEffect} from "react"
import {useUserStore} from "@/stores/user"
import {RiDeleteBin6Line} from "@remixicon/react"
import {SettingsGroup} from "@/shared/components/settings/SettingsGroup"
import {SettingsGroupItem} from "@/shared/components/settings/SettingsGroupItem"
import {getSessionManager} from "@/shared/services/PrivateChats"
import {ndk} from "@/utils/ndk"
import {Invite} from "nostr-double-ratchet/src"
import {NDKFilter, NDKSubscriptionCacheUsage} from "@/lib/ndk"
import {confirm, alert} from "@/utils/utils"

interface DeviceInfo {
  id: string
  isCurrent: boolean
  notYetPropagated?: boolean
  timestamp?: number
}

const INVITE_EVENT_KIND = 30078

const ChatSettings = () => {
  const {publicKey} = useUserStore()
  const [devices, setDevices] = useState<DeviceInfo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadDeviceInfo = async () => {
      if (!publicKey) {
        setDevices([])
        setLoading(false)
        return
      }

      setLoading(true)

      const manager = getSessionManager()
      if (!manager) {
        console.error("SessionManager not available")
        setDevices([])
        setLoading(false)
        return
      }

      // Ensure SessionManager is initialized (creates invite if needed)
      await manager.init()

      const currentDeviceId = manager.getDeviceId()

      // Query Nostr for device invites published by current user
      const filter: NDKFilter = {
        kinds: [INVITE_EVENT_KIND],
        authors: [publicKey],
        "#l": ["double-ratchet/invites"],
      }

      const ndkInstance = ndk()
      const events = await ndkInstance.fetchEvents(filter)

      const deviceList: DeviceInfo[] = []
      let foundCurrentDevice = false

      console.warn("Fetched invite events:", events)

      for (const event of events) {
        try {
          const invite = Invite.fromEvent(
            event as unknown as Parameters<typeof Invite.fromEvent>[0]
          )
          if (!invite.deviceId) continue

          const isCurrent = invite.deviceId === currentDeviceId
          if (isCurrent) foundCurrentDevice = true

          deviceList.push({
            id: invite.deviceId,
            isCurrent,
            timestamp: event.created_at,
          })
        } catch (error) {
          console.error("Failed to parse invite event:", error)
        }
      }

      // If current device not found in relay events, add it with warning
      if (!foundCurrentDevice) {
        deviceList.push({
          id: currentDeviceId,
          isCurrent: true,
          notYetPropagated: true,
        })
      }

      // Sort: current device first, then by timestamp descending
      deviceList.sort((a, b) => {
        if (a.isCurrent) return -1
        if (b.isCurrent) return 1
        // Sort by timestamp descending (newest first)
        return (b.timestamp || 0) - (a.timestamp || 0)
      })

      setDevices(deviceList)
      setLoading(false)
    }

    loadDeviceInfo()
  }, [publicKey])

  const handleDeleteDevice = async (deviceId: string) => {
    if (!(await confirm(`Delete invite for device ${deviceId.slice(0, 8)}?`))) {
      return
    }

    try {
      const {deleteDeviceInvite} = await import("@/shared/services/PrivateChats")
      await deleteDeviceInvite(deviceId)

      // Wait for relay propagation
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Reload list from relays to confirm deletion
      setLoading(true)
      const manager = getSessionManager()
      if (!manager) return

      const currentDeviceId = manager.getDeviceId()

      const filter: NDKFilter = {
        kinds: [INVITE_EVENT_KIND],
        authors: [publicKey],
        "#l": ["double-ratchet/invites"],
      }

      // Force fresh fetch from relays, bypass cache
      const ndkInstance = ndk()
      const events = await ndkInstance.fetchEvents(filter, {
        closeOnEose: true,
        cacheUsage: NDKSubscriptionCacheUsage.ONLY_RELAY,
      })

      const deviceList: DeviceInfo[] = []
      let foundCurrentDevice = false

      for (const event of events) {
        try {
          const invite = Invite.fromEvent(
            event as unknown as Parameters<typeof Invite.fromEvent>[0]
          )
          if (!invite.deviceId) continue

          const isCurrent = invite.deviceId === currentDeviceId
          if (isCurrent) foundCurrentDevice = true

          deviceList.push({
            id: invite.deviceId,
            isCurrent,
            timestamp: event.created_at,
          })
        } catch (error) {
          console.error("Failed to parse invite event:", error)
        }
      }

      if (!foundCurrentDevice) {
        deviceList.push({
          id: currentDeviceId,
          isCurrent: true,
          notYetPropagated: true,
        })
      }

      deviceList.sort((a, b) => {
        if (a.isCurrent) return -1
        if (b.isCurrent) return 1
        return (b.timestamp || 0) - (a.timestamp || 0)
      })

      setDevices(deviceList)
      setLoading(false)
    } catch (error) {
      console.error("Failed to delete invite:", error)
      await alert(`Failed to delete invite: ${error}`)
      setLoading(false)
    }
  }

  if (!publicKey) {
    return (
      <div className="bg-base-200 min-h-full">
        <div className="p-4">
          <div className="text-center py-8 text-base-content/70">
            Please sign in to manage your chat settings.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-base-200 min-h-full">
      <div className="p-4">
        <div className="mb-6">
          <p className="text-base-content/70">
            Your devices / apps for private messaging. Each device / app has a unique
            invite that allows other users to establish secure sessions.
          </p>
        </div>

        <div className="space-y-6">
          <SettingsGroup title="Your Devices / Apps">
            {loading && (
              <SettingsGroupItem isLast>
                <div className="text-center py-4">
                  <p className="text-base-content/70">Loading devices / apps...</p>
                </div>
              </SettingsGroupItem>
            )}
            {!loading && devices.length === 0 && (
              <SettingsGroupItem isLast>
                <div className="text-center py-4">
                  <p className="text-base-content/70">No device / app invites found.</p>
                </div>
              </SettingsGroupItem>
            )}
            {!loading && devices.length > 0 && (
              <>
                {devices.map((device, index) => (
                  <SettingsGroupItem
                    key={device.id}
                    isLast={index === devices.length - 1}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium font-mono text-sm">
                            {device.id}
                          </span>
                          {device.isCurrent && (
                            <span className="badge badge-primary badge-sm">Current</span>
                          )}
                          {device.notYetPropagated && (
                            <span className="badge badge-warning badge-sm">
                              Not yet on relays
                            </span>
                          )}
                        </div>
                        {device.timestamp && (
                          <div className="text-xs text-base-content/50">
                            {new Date(device.timestamp * 1000).toLocaleString()}
                          </div>
                        )}
                      </div>
                      {!device.isCurrent && (
                        <button
                          onClick={() => handleDeleteDevice(device.id)}
                          className="btn btn-ghost btn-sm text-error hover:bg-error/20 ml-4"
                          title="Delete device / app invite"
                        >
                          <RiDeleteBin6Line size={16} />
                        </button>
                      )}
                    </div>
                  </SettingsGroupItem>
                ))}
              </>
            )}
          </SettingsGroup>
        </div>
      </div>
    </div>
  )
}

export default ChatSettings
