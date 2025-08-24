import {useState} from "react"
import {getCurrentLocationGeohash} from "@/utils/geohash"
import {RiMapPinLine} from "@remixicon/react"

export function useGeohashLocation() {
  const [geohashes, setGeohashes] = useState<string[]>([])

  const handleAddLocation = async () => {
    const geohash = await getCurrentLocationGeohash(4)
    if (geohash) {
      // Add multiple precision levels for privacy
      const precisions = [
        geohash.substring(0, 1), // Continent level (~5000km)
        geohash.substring(0, 2), // Country/state level (~1250km)
        geohash.substring(0, 3), // City/region level (~150km)
        geohash.substring(0, 4), // District level (~40km)
      ]

      // Only add geohashes that aren't already present
      const newGeohashes = precisions.filter((gh) => !geohashes.includes(gh))

      if (newGeohashes.length > 0) {
        setGeohashes([...geohashes, ...newGeohashes])
      }
    }
  }

  const removeGeohash = (geohash: string) => {
    setGeohashes(geohashes.filter((g) => g !== geohash))
  }

  const resetGeohashes = () => {
    setGeohashes([])
  }

  // UI component for displaying selected geohashes
  const GeohashDisplay = () => {
    if (geohashes.length === 0) return null

    return (
      <div className="flex items-center gap-2 text-sm text-base-content/70">
        <RiMapPinLine className="w-4 h-4" />
        <div className="flex gap-2 flex-wrap">
          {geohashes.map((gh) => (
            <span key={gh} className="badge badge-sm">
              {gh}
              <button onClick={() => removeGeohash(gh)} className="ml-1 hover:text-error">
                ×
              </button>
            </span>
          ))}
        </div>
      </div>
    )
  }

  // Location button component
  const LocationButton = ({className = ""}: {className?: string}) => (
    <button
      onClick={handleAddLocation}
      className={`btn btn-ghost btn-circle btn-sm md:btn-md ${geohashes.length > 0 ? "btn-active" : ""} ${className}`}
      title="Add location"
    >
      <RiMapPinLine className="w-6 h-6" />
    </button>
  )

  return {
    geohashes,
    setGeohashes,
    handleAddLocation,
    removeGeohash,
    resetGeohashes,
    GeohashDisplay,
    LocationButton,
  }
}
