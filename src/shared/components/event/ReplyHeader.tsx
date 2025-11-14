import {RiReplyLine} from "@remixicon/react"
import {NDKEvent} from "@/lib/ndk"
import {useState, useEffect} from "react"
import {ndk} from "@/utils/ndk"
import {Name} from "@/shared/components/user/Name"

interface ReplyHeaderProps {
  repliedToEventId?: string
}

function ReplyHeader({repliedToEventId}: ReplyHeaderProps) {
  const [repliedToEvent, setRepliedToEvent] = useState<NDKEvent | null>(null)

  useEffect(() => {
    if (!repliedToEventId) return

    // Use NDK's built-in cache via fetchEvent
    ndk()
      .fetchEvent(repliedToEventId)
      .then((event) => {
        if (event) setRepliedToEvent(event)
      })
      .catch((err) => console.error("Error fetching replied event:", err))
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
