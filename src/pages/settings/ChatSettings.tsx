import {useState, useEffect} from "react"
import {useUserStore} from "@/stores/user"
import {useUserRecordsStore} from "@/stores/userRecords"
import {useSessionsStore} from "@/stores/sessions"
import {RiDeleteBin6Line, RiRefreshLine} from "@remixicon/react"
import {SettingsGroup} from "@/shared/components/settings/SettingsGroup"
import {SettingsGroupItem} from "@/shared/components/settings/SettingsGroupItem"

interface DeviceInfo {
  id: string
  label: string
  isCurrent: boolean
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
    getOwnDeviceInvites,
    deviceId: currentDeviceId,
  } = useUserRecordsStore()
  const {publicKey} = useUserStore()
  const [devices, setDevices] = useState<DeviceInfo[]>([])

  useEffect(() => {
    const loadDeviceInfo = async () => {
      if (!publicKey) return

      // Get session counts and last seen per device for our own sessions
      const deviceSessions = new Map<string, number>()
      const deviceLastSeen = new Map<string, number>()

      Array.from(sessions.entries()).forEach(([sessionId]) => {
        const sessionData = useSessionsStore.getState().sessions.get(sessionId)
        const userPubKey = sessionData?.userPubKey || sessionId.split(":")[0]
        const deviceId = sessionData?.deviceId || sessionId.split(":", 2)[1] || "unknown"
        if (userPubKey === publicKey) {
          // This is a session with one of our own devices
          const actualDeviceId = deviceId
          deviceSessions.set(
            actualDeviceId,
            (deviceSessions.get(actualDeviceId) || 0) + 1
          )

          const sessionLastSeen = lastSeen.get(sessionId)
          if (sessionLastSeen) {
            const currentLastSeen = deviceLastSeen.get(actualDeviceId) || 0
            if (sessionLastSeen > currentLastSeen) {
              deviceLastSeen.set(actualDeviceId, sessionLastSeen)
            }
          }
        }
      })

      // Only show devices that have local invites that belong to us
      // These are the legitimate devices we control
      const ownInvites = getOwnDeviceInvites()
      const deviceList: DeviceInfo[] = Array.from(ownInvites.entries()).map(
        ([deviceId]) => ({
          id: deviceId,
          label: `Device ${deviceId.slice(0, 8)}`,
          isCurrent: deviceId === currentDeviceId,
          sessionCount: deviceSessions.get(deviceId) || 0,
          lastSeen: deviceLastSeen.get(deviceId),
        })
      )

      // Sort: current device first, then by connection status, then by last seen
      deviceList.sort((a, b) => {
        if (a.isCurrent) return -1
        if (b.isCurrent) return 1
        return (b.lastSeen || 0) - (a.lastSeen || 0)
      })

      setDevices(deviceList)
    }

    loadDeviceInfo()

    // Debug functions removed
  }, [invites, sessions, lastSeen, publicKey, currentDeviceId])

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
            Manage your devices for private messaging. Each device gets a unique invite
            that allows other users to establish secure sessions.
          </p>
        </div>

        <div className="space-y-6">
          <SettingsGroup title="Your Devices">
            {devices.length === 0 ? (
              <SettingsGroupItem isLast>
                <div className="text-center py-4">
                  <p className="text-base-content/70 mb-3">No device invites found.</p>
                  <button
                    onClick={handleRefreshInvites}
                    className="btn btn-primary btn-sm"
                  >
                    Create Device Invite
                  </button>
                </div>
              </SettingsGroupItem>
            ) : (
              <>
                <SettingsGroupItem>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-base-content/70">
                      {devices.length} device{devices.length !== 1 ? "s" : ""}
                    </span>
                    <button
                      onClick={handleRefreshInvites}
                      className="btn btn-ghost btn-sm"
                      title="Refresh invites"
                    >
                      <RiRefreshLine size={16} />
                    </button>
                  </div>
                </SettingsGroupItem>

                {devices.map((device, index) => (
                  <SettingsGroupItem
                    key={device.id}
                    isLast={index === devices.length - 1}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{device.label}</span>
                          {device.isCurrent && (
                            <span className="badge badge-primary badge-sm">Current</span>
                          )}
                        </div>
                        <div className="text-sm text-base-content/60 space-y-1">
                          <p>ID: {device.id}</p>
                          <p>Active sessions: {device.sessionCount}</p>
                          <p>Last activity: {formatLastSeen(device.lastSeen)}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleNullifyDevice(device.id)}
                        className="btn btn-ghost btn-sm text-error hover:bg-error/20 ml-4"
                        title="Nullify device invite"
                      >
                        <RiDeleteBin6Line size={16} />
                      </button>
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
