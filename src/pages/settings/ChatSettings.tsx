import {useState, useEffect} from "react"
import {useUserStore} from "@/stores/user"
import {RiDeleteBin6Line} from "@remixicon/react"
import {SettingsGroup} from "@/shared/components/settings/SettingsGroup"
import {SettingsGroupItem} from "@/shared/components/settings/SettingsGroupItem"
import {getSessionManager} from "@/shared/services/PrivateChats"
import {confirm, alert} from "@/utils/utils"

interface DeviceInfo {
  id: string
  isCurrent: boolean
  notYetPropagated?: boolean
  timestamp?: number
}

const ChatSettings = () => {
  const {publicKey} = useUserStore()
  const [devices, setDevices] = useState<DeviceInfo[]>([])
  const [loading, setLoading] = useState(true)

  type SessionManagerInstance = NonNullable<ReturnType<typeof getSessionManager>>

  const buildDeviceList = (manager: SessionManagerInstance): DeviceInfo[] => {
    if (!publicKey) return []

    const currentDeviceId = manager.getDeviceId()
    const userRecord = manager.getUserRecords().get(publicKey)

    if (!userRecord) return []

    const currentDevice = userRecord.devices.get(currentDeviceId)
    const otherDevices = Array.from(userRecord.devices.entries()).filter(
      ([deviceId]) => deviceId !== currentDeviceId
    )

    const deviceList = [currentDevice, ...otherDevices.map(([, d]) => d)]
      .filter((device) => device !== undefined)
      .map((device) => ({
        id: device.deviceId,
        isCurrent: device.deviceId === currentDeviceId,
        notYetPropagated: false, // TODO change
      }))

    return deviceList
  }

  const refreshDeviceList = async (manager: SessionManagerInstance) => {
    const list = buildDeviceList(manager)
    setDevices(list)
  }

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

      try {
        await manager.init()
        await refreshDeviceList(manager)
      } catch (error) {
        console.error("Failed to load devices:", error)
        setDevices([])
      } finally {
        setLoading(false)
      }
    }

    loadDeviceInfo()
  }, [publicKey])

  const handleDeleteDevice = async (deviceId: string) => {
    if (!(await confirm(`Delete invite for device ${deviceId.slice(0, 8)}?`))) {
      return
    }

    try {
      const manager = getSessionManager()
      if (!manager) {
        alert("Session manager unavailable. Please try again later.")
        return
      }

      await manager.revokeDevice(deviceId)

      setLoading(true)
      await refreshDeviceList(manager)
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
