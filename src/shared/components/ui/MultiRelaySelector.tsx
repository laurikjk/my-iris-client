import {useState, useRef, useEffect} from "react"
import {DEFAULT_RELAYS} from "@/utils/ndk"
import {RiAddLine, RiCloseLine} from "@remixicon/react"

interface MultiRelaySelectorProps {
  selectedRelays?: string[]
  onRelaysChange: (relays: string[]) => void
  placeholder?: string
  className?: string
}

const MultiRelaySelector = ({
  selectedRelays = [],
  onRelaysChange,
  placeholder = "Select relays",
  className = "",
}: MultiRelaySelectorProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [customRelay, setCustomRelay] = useState("")
  const [showCustomInput, setShowCustomInput] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const normalizeRelay = (url: string) =>
    url.replace(/^(https?:\/\/)?(wss?:\/\/)?/, "").replace(/\/$/, "")

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setShowCustomInput(false)
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  const toggleRelay = (relay: string) => {
    if (selectedRelays.includes(relay)) {
      onRelaysChange(selectedRelays.filter((r) => r !== relay))
    } else {
      onRelaysChange([...selectedRelays, relay])
    }
  }

  const handleAddCustomRelay = () => {
    if (customRelay.trim()) {
      const newRelay = customRelay.startsWith("wss://")
        ? customRelay
        : `wss://${customRelay}`
      if (!selectedRelays.includes(newRelay)) {
        onRelaysChange([...selectedRelays, newRelay])
      }
      setCustomRelay("")
      setShowCustomInput(false)
    }
  }

  let displayText = placeholder
  if (selectedRelays.length === 1) {
    displayText = normalizeRelay(selectedRelays[0])
  } else if (selectedRelays.length > 1) {
    displayText = `${selectedRelays.length} relays selected`
  }

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Main button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="btn btn-sm btn-neutral w-full justify-between normal-case font-normal"
      >
        <span className="truncate">{displayText}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-base-200 rounded-lg shadow-lg border border-base-300">
          <div className="max-h-64 overflow-y-auto">
            {/* Default relays */}
            <div className="p-2">
              <div className="text-xs font-semibold text-base-content/50 px-2 pb-1">
                Default Relays
              </div>
              {DEFAULT_RELAYS.map((relay) => (
                <label
                  key={relay}
                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-base-300 rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedRelays.includes(relay)}
                    onChange={() => toggleRelay(relay)}
                    className="checkbox checkbox-xs"
                  />
                  <span className="text-sm truncate flex-1">{normalizeRelay(relay)}</span>
                </label>
              ))}

              {/* Custom relays */}
              {selectedRelays.some((r) => !DEFAULT_RELAYS.includes(r)) && (
                <>
                  <div className="text-xs font-semibold text-base-content/50 px-2 pt-2 pb-1">
                    Custom Relays
                  </div>
                  {selectedRelays
                    .filter((r) => !DEFAULT_RELAYS.includes(r))
                    .map((relay) => (
                      <label
                        key={relay}
                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-base-300 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={true}
                          onChange={() => toggleRelay(relay)}
                          className="checkbox checkbox-xs"
                        />
                        <span className="text-sm truncate flex-1">
                          {normalizeRelay(relay)}
                        </span>
                      </label>
                    ))}
                </>
              )}
            </div>

            {/* Add custom relay section */}
            <div className="border-t border-base-300 p-2">
              {!showCustomInput ? (
                <button
                  onClick={() => setShowCustomInput(true)}
                  className="btn btn-xs btn-ghost w-full justify-start gap-1"
                >
                  <RiAddLine className="w-3 h-3" />
                  Add custom relay
                </button>
              ) : (
                <div className="flex gap-1">
                  <input
                    type="text"
                    placeholder="wss://relay.example.com"
                    value={customRelay}
                    onChange={(e) => setCustomRelay(e.target.value)}
                    className="input input-xs flex-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleAddCustomRelay()
                      } else if (e.key === "Escape") {
                        setShowCustomInput(false)
                        setCustomRelay("")
                      }
                    }}
                    autoFocus
                  />
                  <button
                    onClick={handleAddCustomRelay}
                    className="btn btn-xs btn-primary"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => {
                      setShowCustomInput(false)
                      setCustomRelay("")
                    }}
                    className="btn btn-xs btn-ghost"
                  >
                    <RiCloseLine className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            {/* Clear all button */}
            {selectedRelays.length > 0 && (
              <div className="border-t border-base-300 p-2">
                <button
                  onClick={() => onRelaysChange([])}
                  className="btn btn-xs btn-ghost w-full"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default MultiRelaySelector
