import {useState, useEffect, useMemo} from "react"
import {localState} from "irisdb"

interface Channel {
  latest?: {
    time: number
  }
  lastSeen?: number
}

export default function UnseenMessagesBadge() {
  const [channels, setChannels] = useState<Record<string, Channel>>({})

  useEffect(() => {
    localState.get("channels").put({})
    const unsub = localState.get("channels").on<Record<string, Channel>>(
      (value) => {
        setChannels({...value})
      },
      false,
      3
    )
    return unsub
  }, [])

  const hasUnread = useMemo(() => {
    return Object.values(channels).some((channel) => {
      const latest = channel?.latest?.time
      const lastSeen = channel?.lastSeen || 0
      return latest && latest > lastSeen
    })
  }, [channels])

  return (
    <>
      {hasUnread && <div className="indicator-item badge badge-primary badge-xs"></div>}
    </>
  )
}
