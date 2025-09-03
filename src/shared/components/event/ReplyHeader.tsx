import {RiReplyLine} from "@remixicon/react"
import {NDKEvent} from "@nostr-dev-kit/ndk"
import {useState, useEffect} from "react"
import {eventsByIdCache} from "@/utils/memcache.ts"
import {ndk} from "@/utils/ndk"
import {Name} from "@/shared/components/user/Name"

interface ReplyHeaderProps {
  repliedToEventId?: string
}

function ReplyHeader({repliedToEventId}: ReplyHeaderProps) {
  const [repliedToEvent, setRepliedToEvent] = useState<NDKEvent | null>(null)

  useEffect(() => {
    if (!repliedToEventId) return

    const cached = eventsByIdCache.get(repliedToEventId)
    if (cached) {
      setRepliedToEvent(cached)
      return
    }

    const sub = ndk().subscribe({ids: [repliedToEventId]}, {closeOnEose: true})

    sub.on("event", (event: NDKEvent) => {
      if (event && event.id === repliedToEventId) {
        setRepliedToEvent(event)
        eventsByIdCache.set(repliedToEventId, event)
        sub.stop()
      }
    })

    return () => {
      sub.stop()
    }
  }, [repliedToEventId])

  return (
    <div className="flex items-center font-bold text-sm text-base-content/50">
      <RiReplyLine className="w-4 h-4 mr-1" />
      <span>
        {repliedToEvent ? (
          <>
            Replying to <Name pubKey={repliedToEvent.pubkey} />
          </>
        ) : (
          "Reply"
        )}
      </span>
    </div>
  )
}

export default ReplyHeader
