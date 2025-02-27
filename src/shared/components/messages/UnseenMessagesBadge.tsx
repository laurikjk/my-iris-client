import {getMillisecondTimestamp, Rumor} from "nostr-double-ratchet/src"
import {useState, useEffect, useMemo} from "react"
import {localState} from "irisdb/src"

interface Session {
  latest?: Rumor
  lastSeen?: number
}

export default function UnseenMessagesBadge() {
  const [sessions, setSessions] = useState<Record<string, Session>>({})

  useEffect(() => {
    localState.get("sessions").put({})
    const unsub = localState.get("sessions").on<Record<string, Session>>(
      (value) => {
        setSessions({...value})
      },
      false,
      3
    )
    return unsub
  }, [])

  const hasUnread = useMemo(() => {
    return Object.values(sessions).some((session) => {
      const latest = session?.latest ? getMillisecondTimestamp(session.latest) : 0
      const lastSeen = session?.lastSeen || 0
      return latest && latest > lastSeen
    })
  }, [sessions])

  return (
    <>
      {hasUnread && <div className="indicator-item badge badge-primary badge-xs"></div>}
    </>
  )
}
