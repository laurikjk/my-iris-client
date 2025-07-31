import React, {useEffect, useRef, useState} from "react"
import {
  RiAddLine,
  RiChat1Fill,
  RiHeartFill,
  RiRepeatFill,
  RiFlashlightFill,
  RiArticleFill,
  RiStoreFill,
} from "@remixicon/react"
import {
  KIND_TEXT_NOTE,
  KIND_REPOST,
  KIND_REACTION,
  KIND_ZAP_RECEIPT,
  KIND_LONG_FORM_CONTENT,
  KIND_CHANNEL_MESSAGE,
  KIND_CLASSIFIED,
} from "@/utils/constants"

interface EventKind {
  kind: number
  name: string
  description: string
  icon: React.ReactNode
  color: string
}

const COMMON_EVENT_KINDS: EventKind[] = [
  {
    kind: KIND_TEXT_NOTE,
    name: "Post",
    description: "Text notes",
    icon: <RiChat1Fill className="w-4 h-4" />,
    color: "text-blue-500",
  },
  {
    kind: KIND_REPOST,
    name: "Repost",
    description: "Reposts",
    icon: <RiRepeatFill className="w-4 h-4" />,
    color: "text-green-500",
  },
  {
    kind: KIND_REACTION,
    name: "Like",
    description: "Reactions",
    icon: <RiHeartFill className="w-4 h-4" />,
    color: "text-pink-500",
  },
  {
    kind: KIND_ZAP_RECEIPT,
    name: "Zap",
    description: "Lightning zaps",
    icon: <RiFlashlightFill className="w-4 h-4" />,
    color: "text-yellow-500",
  },
  {
    kind: KIND_LONG_FORM_CONTENT,
    name: "Article",
    description: "Long-form content",
    icon: <RiArticleFill className="w-4 h-4" />,
    color: "text-purple-500",
  },
  {
    kind: KIND_CHANNEL_MESSAGE,
    name: "Chat",
    description: "Channel messages",
    icon: <RiChat1Fill className="w-4 h-4" />,
    color: "text-cyan-500",
  },
  {
    kind: KIND_CLASSIFIED,
    name: "Market",
    description: "Classified listings",
    icon: <RiStoreFill className="w-4 h-4" />,
    color: "text-orange-500",
  },
]

interface EventKindsSelectorProps {
  selectedKinds: number[]
  onKindsChange: (kinds: number[]) => void
  className?: string
}

function EventKindsSelector({
  selectedKinds,
  onKindsChange,
  className = "",
}: EventKindsSelectorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [maxWidth, setMaxWidth] = useState<number | null>(400) // Start with reasonable default
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [customKindInput, setCustomKindInput] = useState("")

  // Calculate ordered event kinds only on mount, keep order fixed after that
  const [orderedEventKinds] = useState(() => {
    const selectedKindsSet = new Set(selectedKinds)
    const selected = COMMON_EVENT_KINDS.filter((kind) => selectedKindsSet.has(kind.kind))
    const unselected = COMMON_EVENT_KINDS.filter(
      (kind) => !selectedKindsSet.has(kind.kind)
    )
    return [...selected, ...unselected]
  })

  const toggleKind = (kind: number) => {
    const isSelected = selectedKinds.includes(kind)
    if (isSelected) {
      onKindsChange(selectedKinds.filter((k) => k !== kind))
    } else {
      // Deduplicate kinds
      const newKinds = [...selectedKinds, kind]
      onKindsChange([...new Set(newKinds)])
    }
  }

  const handleCustomKindOk = () => {
    const kindNumber = parseInt(customKindInput.trim())
    if (!isNaN(kindNumber) && kindNumber >= 0) {
      toggleKind(kindNumber)
    }
    setCustomKindInput("")
    setShowCustomInput(false)
  }

  const handleCustomKindCancel = () => {
    setCustomKindInput("")
    setShowCustomInput(false)
  }

  // Calculate max width for container based on available space
  useEffect(() => {
    const calculateMaxWidth = () => {
      if (containerRef.current) {
        const parentWidth = containerRef.current.parentElement?.clientWidth || 0
        // Reserve some space for the label (w-20 = 80px) + gap + padding
        const reservedSpace = 100
        setMaxWidth(Math.max(200, parentWidth - reservedSpace))
      }
    }

    calculateMaxWidth()
    window.addEventListener("resize", calculateMaxWidth)
    return () => window.removeEventListener("resize", calculateMaxWidth)
  }, [])

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div
        ref={containerRef}
        className="flex gap-2 overflow-x-auto scrollbar-hide pb-2"
        style={{maxWidth: maxWidth ? `${maxWidth}px` : undefined}}
      >
        {/* Custom event kind input */}
        {showCustomInput ? (
          <div className="flex items-center gap-1 flex-shrink-0">
            <input
              type="number"
              value={customKindInput}
              onChange={(e) => setCustomKindInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCustomKindOk()
                if (e.key === "Escape") handleCustomKindCancel()
              }}
              className="input input-sm w-20 text-sm"
              placeholder="Kind"
              autoFocus
            />
            <button
              onClick={handleCustomKindOk}
              className="btn btn-sm btn-success"
              title="Add custom kind"
            >
              OK
            </button>
            <button
              onClick={handleCustomKindCancel}
              className="btn btn-sm btn-error"
              title="Cancel"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowCustomInput(true)}
            className="btn btn-sm btn-info whitespace-nowrap flex-shrink-0"
            title="Add custom event kind"
          >
            <RiAddLine className="w-4 h-4" />
            New
          </button>
        )}

        {/* Show selected custom kinds (that aren't in common kinds) */}
        {selectedKinds
          .filter((kind) => !COMMON_EVENT_KINDS.some((ek) => ek.kind === kind))
          .map((kind) => (
            <button
              key={kind}
              onClick={() => toggleKind(kind)}
              className="btn btn-sm btn-primary whitespace-nowrap flex-shrink-0"
              title={`Custom event kind ${kind}`}
            >
              {kind}
            </button>
          ))}

        {/* Common event kinds */}
        {orderedEventKinds.map((eventKind) => {
          const isSelected = selectedKinds.includes(eventKind.kind)
          return (
            <button
              key={eventKind.kind}
              onClick={() => toggleKind(eventKind.kind)}
              className={`btn btn-sm whitespace-nowrap flex-shrink-0 gap-1 ${
                isSelected ? "btn-primary" : "btn-neutral"
              }`}
              title={`${eventKind.description} (kind ${eventKind.kind})`}
            >
              <span className={eventKind.color}>{eventKind.icon}</span>
              {eventKind.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default EventKindsSelector
