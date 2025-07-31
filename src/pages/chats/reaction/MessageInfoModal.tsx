import {useState, useEffect} from "react"
import {RiFileCopyLine, RiCheckLine, RiRadioLine} from "@remixicon/react"
import classNames from "classnames"
import Modal from "@/shared/components/ui/Modal"
import {ndk} from "@/utils/ndk"
import {nip19} from "nostr-tools"
import {useRebroadcast} from "@/shared/hooks/useRebroadcast"

type MessageInfoModalProps = {
  isOpen: boolean
  onClose: () => void
  nostrEventId?: string
  message?: {
    created_at?: number
    tags?: string[][]
  }
}

export const MessageInfoModal = ({
  isOpen,
  onClose,
  nostrEventId,
  message,
}: MessageInfoModalProps) => {
  const [copiedEventId, setCopiedEventId] = useState(false)
  const [relayStatus, setRelayStatus] = useState<Record<string, boolean>>({})
  const [showRawMessage, setShowRawMessage] = useState(false)
  const {rebroadcast, isRebroadcasting, rebroadcastSuccess} = useRebroadcast()

  const handleCopyEventId = async () => {
    if (nostrEventId) {
      try {
        await navigator.clipboard.writeText(nip19.noteEncode(nostrEventId))
        setCopiedEventId(true)
        setTimeout(() => setCopiedEventId(false), 2000)
      } catch (error) {
        console.error("Failed to copy event ID:", error)
      }
    }
  }

  const handleRebroadcast = async () => {
    if (!nostrEventId) return
    await rebroadcast(nostrEventId)
  }

  const getTimestampInfo = () => {
    if (!message) return null

    // Look for ms tag first (millisecond timestamp)
    const msTag = message.tags?.find((tag) => tag[0] === "ms")
    const msTime = msTag ? parseInt(msTag[1], 10) : null

    // Use created_at as fallback (seconds timestamp)
    const createdAt = message.created_at

    if (msTime) {
      return {
        timestamp: msTime,
        source: "ms tag",
        date: new Date(msTime),
        precision: "milliseconds",
      }
    } else if (createdAt) {
      return {
        timestamp: createdAt * 1000,
        source: "created_at",
        date: new Date(createdAt * 1000),
        precision: "seconds",
      }
    }

    return null
  }

  const timestampInfo = getTimestampInfo()

  const checkRelayStatus = async () => {
    if (!nostrEventId) return

    const relays = ndk().pool.relays
    const status: Record<string, boolean> = {}

    // Use NDK subscription to check if event exists on relays
    const sub = ndk().subscribe({ids: [nostrEventId]}, {closeOnEose: true})

    sub.on("event", (event) => {
      if (event.onRelays) {
        event.onRelays.forEach((relay) => {
          status[relay.url] = true
        })
      }
    })

    sub.on("eose", () => {
      // Fill in false for relays that didn't have the event
      for (const [url] of relays) {
        if (!(url in status)) {
          status[url] = false
        }
      }
      setRelayStatus(status)
      sub.stop()
    })

    // Timeout after 3 seconds
    setTimeout(() => {
      sub.stop()
      setRelayStatus(status)
    }, 3000)
  }

  // Check relay status when modal opens
  useEffect(() => {
    if (isOpen && nostrEventId) {
      checkRelayStatus()
    }
  }, [isOpen, nostrEventId])

  if (!isOpen) return null

  return (
    <Modal onClose={onClose}>
      <div className="p-6">
        <h3 className="text-lg font-semibold mb-4">Message Info</h3>
        {nostrEventId ? (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-base-content/60 mb-2">Nostr Event ID:</p>
              <div className="flex items-center gap-2">
                <p className="text-xs font-mono bg-base-200 p-2 rounded break-all flex-1">
                  {nip19.noteEncode(nostrEventId)}
                </p>
                <button
                  onClick={handleCopyEventId}
                  className="btn btn-ghost btn-sm btn-square"
                  title="Copy event ID"
                >
                  {copiedEventId ? (
                    <RiCheckLine className="w-4 h-4 text-success" />
                  ) : (
                    <RiFileCopyLine className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
            {timestampInfo && (
              <div>
                <p className="text-sm text-base-content/60 mb-2">Message Time:</p>
                <p className="text-sm font-mono">{timestampInfo.date.toLocaleString('en-US', { 
                  year: 'numeric', 
                  month: '2-digit', 
                  day: '2-digit', 
                  hour: '2-digit', 
                  minute: '2-digit', 
                  second: '2-digit',
                  fractionalSecondDigits: 3,
                  hour12: false 
                })}</p>
              </div>
            )}
            <div>
              <button
                onClick={handleRebroadcast}
                disabled={isRebroadcasting}
                className={classNames(
                  "btn btn-sm",
                  rebroadcastSuccess ? "btn-success" : "btn-primary"
                )}
              >
                {(() => {
                  if (isRebroadcasting) {
                    return (
                      <>
                        <span className="loading loading-spinner loading-xs"></span>
                        Rebroadcasting...
                      </>
                    )
                  }

                  if (rebroadcastSuccess) {
                    return (
                      <>
                        <RiCheckLine className="w-4 h-4" />
                        Rebroadcast Successful
                      </>
                    )
                  }

                  return (
                    <>
                      <RiRadioLine className="w-4 h-4" />
                      Rebroadcast Message
                    </>
                  )
                })()}
              </button>
            </div>
            <div>
              <p className="text-sm text-base-content/60 mb-2">Found on Relays:</p>
              <div className="space-y-1">
                {(() => {
                  const foundRelays = Object.entries(relayStatus).filter(
                    ([, found]) => found
                  )

                  if (foundRelays.length === 0) {
                    return (
                      <p className="text-xs text-base-content/50 italic">
                        Not found on any connected relays
                      </p>
                    )
                  }

                  return foundRelays.map(([relay]) => (
                    <div key={relay} className="flex items-center text-xs">
                      <span className="text-success mr-2">✓</span>
                      <span className="truncate">{relay}</span>
                    </div>
                  ))
                })()}
              </div>
            </div>
            {message && (
              <div>
                <button
                  onClick={() => setShowRawMessage(!showRawMessage)}
                  className="btn btn-ghost btn-sm"
                >
                  {showRawMessage ? "Hide" : "Show"} Raw Message
                </button>
                {showRawMessage && (
                  <div className="mt-2">
                    <pre className="text-xs bg-base-200 p-3 rounded overflow-auto max-h-60 whitespace-pre-wrap break-all">
                      {JSON.stringify(message, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-base-content/60">
            No nostr event ID available for this message.
          </p>
        )}
      </div>
    </Modal>
  )
}
