import {useState} from "react"
import {RiAddLine} from "@remixicon/react"
import {getEventKindInfo, COMMON_EVENT_KINDS} from "@/utils/eventKinds.tsx"

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
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [customKindInput, setCustomKindInput] = useState("")

  // Calculate ordered event kinds only on mount, keep order fixed after that
  const [orderedEventKinds] = useState(() => {
    const selectedKindsSet = new Set(selectedKinds)
    const selected = COMMON_EVENT_KINDS.filter((kind) => selectedKindsSet.has(kind))
    const unselected = COMMON_EVENT_KINDS.filter((kind) => !selectedKindsSet.has(kind))
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

  return (
    <div className={`flex flex-col gap-2 w-full ${className}`}>
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 w-full">
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
          .filter((kind) => !COMMON_EVENT_KINDS.includes(kind))
          .map((kind) => {
            const info = getEventKindInfo(kind)
            return (
              <button
                key={kind}
                onClick={() => toggleKind(kind)}
                className="btn btn-sm btn-primary whitespace-nowrap flex-shrink-0"
                title={`Custom event kind ${kind}`}
              >
                {info.label}
              </button>
            )
          })}

        {/* Common event kinds */}
        {orderedEventKinds.map((kind) => {
          const isSelected = selectedKinds.includes(kind)
          const info = getEventKindInfo(kind)
          return (
            <button
              key={kind}
              onClick={() => toggleKind(kind)}
              className={`btn btn-sm whitespace-nowrap flex-shrink-0 gap-1 ${
                isSelected ? "btn-primary" : "btn-neutral"
              }`}
              title={`${info.description || info.label} (kind ${kind})`}
            >
              {info.iconLarge && <span className={info.color}>{info.iconLarge}</span>}
              {info.label}
            </button>
          )
        })}

        {/* Spacer to ensure last item is fully visible */}
        <div className="min-w-[1rem] flex-shrink-0" />
      </div>
    </div>
  )
}

export default EventKindsSelector
