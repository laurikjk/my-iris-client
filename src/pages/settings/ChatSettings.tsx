import {useState, useEffect} from "react"
import {useSessionsStore} from "@/stores/sessions"
import {useUserStore} from "@/stores/user"
import {RiDeleteBin6Line, RiRefreshLine} from "@remixicon/react"
import localforage from "localforage"

interface DeviceInfo {
  id: string
  label: string
  isCurrent: boolean
  hasInvite: boolean
  sessionCount: number
  lastSeen?: number
}

const ChatSettings = () => {
  const {
    invites,
    sessions,
    lastSeen,
    deleteInvite,
    createDefaultInvites,
    debugMultiDevice,
  } = useSessionsStore()
  const {publicKey} = useUserStore()
  const [devices, setDevices] = useState<DeviceInfo[]>([])
  const [currentDeviceId, setCurrentDeviceId] = useState<string>("")

  useEffect(() => {
    const loadDeviceInfo = async () => {
      if (!publicKey) return

      const deviceId = await localforage.getItem<string>("deviceId")
      setCurrentDeviceId(deviceId || "")

      // Get all device invites
      const deviceInvites = Array.from(invites.entries())

      // Get session counts per device
      const deviceSessions = new Map<string, number>()
      const deviceLastSeen = new Map<string, number>()

      Array.from(sessions.keys()).forEach((sessionId) => {
        const deviceIdFromSession = sessionId.split(":")[1] || "unknown"
        deviceSessions.set(
          deviceIdFromSession,
          (deviceSessions.get(deviceIdFromSession) || 0) + 1
        )

        const sessionLastSeen = lastSeen.get(sessionId)
        if (sessionLastSeen) {
          const currentLastSeen = deviceLastSeen.get(deviceIdFromSession) || 0
          if (sessionLastSeen > currentLastSeen) {
            deviceLastSeen.set(deviceIdFromSession, sessionLastSeen)
          }
        }
      })

      const deviceList: DeviceInfo[] = deviceInvites.map(([id]) => ({
        id,
        label: `Device ${id.slice(0, 8)}`,
        isCurrent: id === deviceId,
        hasInvite: true,
        sessionCount: deviceSessions.get(id) || 0,
        lastSeen: deviceLastSeen.get(id),
      }))

      // Sort: current device first, then by last seen
      deviceList.sort((a, b) => {
        if (a.isCurrent) return -1
        if (b.isCurrent) return 1
        return (b.lastSeen || 0) - (a.lastSeen || 0)
      })

      setDevices(deviceList)
    }

    loadDeviceInfo()

    // Expose debug function globally for easy access
    ;(window as typeof window & {debugMultiDevice: () => void}).debugMultiDevice =
      debugMultiDevice
  }, [invites, sessions, lastSeen, publicKey, debugMultiDevice])

  const handleNullifyDevice = async (deviceId: string) => {
    if (
      window.confirm(
        `Are you sure you want to nullify the invite for device ${deviceId.slice(
          0,
          8
        )}? This will prevent other users from connecting to this device for private messaging.`
      )
    ) {
      deleteInvite(deviceId)
      // Refresh the device list
      const updatedDevices = devices.filter((device) => device.id !== deviceId)
      setDevices(updatedDevices)
    }
  }

  const handleRefreshInvites = () => {
    createDefaultInvites()
  }

  const formatLastSeen = (timestamp?: number) => {
    if (!timestamp) return "Never"
    const date = new Date(timestamp)
    return date.toLocaleString()
  }

  if (!publicKey) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Chat Settings</h2>
        <p className="text-base-content/70">
          Please sign in to manage your chat settings.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Chat Settings</h2>
        <p className="text-base-content/70">
          Manage your devices for private messaging. Each device gets a unique invite that
          allows other users to establish secure sessions.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Your Devices</h3>
          <div className="flex gap-2">
            <button
              onClick={handleRefreshInvites}
              className="btn btn-ghost btn-sm"
              title="Refresh invites"
            >
              <RiRefreshLine size={16} />
            </button>
          </div>
        </div>

        {devices.length === 0 ? (
          <div className="text-center py-8 text-base-content/70">
            <p>No device invites found.</p>
            <button
              onClick={handleRefreshInvites}
              className="btn btn-primary btn-sm mt-2"
            >
              Create Device Invite
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {devices.map((device) => (
              <div
                key={device.id}
                className={`card bg-base-200 p-4 ${
                  device.isCurrent ? "ring-2 ring-primary" : ""
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{device.label}</h4>
                      {device.isCurrent && (
                        <span className="badge badge-primary badge-sm">Current</span>
                      )}
                    </div>
                    <div className="text-sm text-base-content/70 space-y-1">
                      <p>ID: {device.id}</p>
                      <p>Active sessions: {device.sessionCount}</p>
                      <p>Last activity: {formatLastSeen(device.lastSeen)}</p>
                    </div>
                  </div>
                  <div className="ml-4">
                    <button
                      onClick={() => handleNullifyDevice(device.id)}
                      className="btn btn-ghost btn-sm text-error hover:bg-error/20"
                      title="Nullify device invite"
                    >
                      <RiDeleteBin6Line size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-medium">Debug Information</h3>
        <div className="text-sm">
          <p>Current Device ID: {currentDeviceId || "Not set"}</p>
          <p>Total Invites: {invites.size}</p>
          <p>Total Sessions: {sessions.size}</p>
        </div>
        <button
          onClick={debugMultiDevice}
          className="btn btn-outline btn-sm"
          title="Print debug info to console"
        >
          Debug Multi-Device State
        </button>
      </div>
    </div>
  )
}

export default ChatSettings
