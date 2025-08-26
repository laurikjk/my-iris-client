import {useState, useRef, useEffect} from "react"
import {RiTimeLine} from "@remixicon/react"
import {EXPIRATION_OPTIONS} from "@/utils/expiration"

interface ExpirationSelectorProps {
  onExpirationChange: (expirationDelta: number | null) => void
  disabled?: boolean
  currentExpirationDelta?: number | null
}

export function ExpirationSelector({
  onExpirationChange,
  disabled = false,
  currentExpirationDelta = null,
}: ExpirationSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      document.addEventListener("keydown", handleEscKey)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleEscKey)
    }
  }, [isOpen])

  const handleSelect = (delta: number | null) => {
    onExpirationChange(delta)
    setIsOpen(false)
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={`btn btn-ghost btn-circle btn-sm md:btn-md ${
          currentExpirationDelta ? "text-primary" : ""
        }`}
        type="button"
        title="Set expiration"
      >
        <RiTimeLine className="w-6 h-6" />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 left-0 z-50">
          <div className="bg-base-100 border border-base-300 rounded-lg shadow-lg min-w-[140px]">
            <div className="px-3 py-2 text-xs font-semibold text-base-content/70 border-b border-base-300">
              Expiration
            </div>
            <div className="p-1">
              {currentExpirationDelta && (
                <>
                  <button
                    onClick={() => handleSelect(null)}
                    className="block w-full text-left px-3 py-2 text-sm hover:bg-base-200 rounded transition-colors"
                    type="button"
                  >
                    No expiration
                  </button>
                  <div className="border-b border-base-300 my-1" />
                </>
              )}
              {EXPIRATION_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleSelect(option.value)}
                  className="block w-full text-left px-3 py-2 text-sm hover:bg-base-200 rounded transition-colors"
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
