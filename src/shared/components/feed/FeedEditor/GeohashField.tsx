import {useState} from "react"
import {RiMapPinLine, RiGlobalLine} from "@remixicon/react"
import {useGeohash} from "@/shared/hooks/useGeohash"
import {GeohashMap} from "@/shared/components/geohash/GeohashMap"

interface GeohashFieldProps {
  value: string[] | undefined
  onChange: (geohashes: string[] | undefined) => void
  label?: string
  showLabel?: boolean
}

export function GeohashField({
  value = [],
  onChange,
  label = "Geohash",
  showLabel = true,
}: GeohashFieldProps) {
  const [showMap, setShowMap] = useState(false)
  const {getGeohashPrecisions, loading} = useGeohash()

  const handleInputChange = (inputValue: string) => {
    const trimmed = inputValue.trim()
    if (trimmed === "") {
      onChange(undefined)
    } else {
      const geohashes = trimmed
        .split(",")
        .map((g) => g.trim())
        .filter((g) => g.length > 0)
      onChange(geohashes.length > 0 ? geohashes : undefined)
    }
  }

  const handleAddLocation = async () => {
    const precisions = await getGeohashPrecisions(4)
    if (precisions) {
      const currentGeohashes = value || []
      const newGeohashes = precisions.filter((gh) => !currentGeohashes.includes(gh))

      if (newGeohashes.length > 0) {
        onChange([...currentGeohashes, ...newGeohashes])
      }
    }
  }

  const handleGeohashSelect = (geohash: string) => {
    // Replace current selection with clicked geohash
    onChange([geohash])
  }

  return (
    <>
      <div className="flex items-start gap-2">
        {showLabel && (
          <span className="text-sm text-base-content/70 min-w-[7rem] pt-2">{label}</span>
        )}
        <div className="flex-1">
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={value.join(", ")}
              onChange={(e) => handleInputChange(e.target.value)}
              className="input input-sm flex-1 min-w-0 text-sm"
              placeholder="e.g. u2mwdd, u2mw"
            />
            <div className="flex gap-2">
              <button
                onClick={handleAddLocation}
                disabled={loading}
                className="btn btn-sm btn-neutral"
                title="Add current location (multiple precision levels)"
              >
                {loading ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  <RiMapPinLine className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={() => setShowMap(!showMap)}
                className={`btn btn-sm ${showMap ? "btn-primary" : "btn-neutral"}`}
                title={showMap ? "Hide map" : "Show map"}
              >
                <RiGlobalLine className="w-4 h-4" />
              </button>
            </div>
          </div>
          <span className="text-xs text-base-content/50 mt-1 block">
            Filter posts by{" "}
            <a
              href="https://en.wikipedia.org/wiki/Geohash"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-base-content/80"
            >
              geohash
            </a>{" "}
            location tags. Shorter = broader area (3 chars ≈ city, 4 chars ≈ district).
          </span>
        </div>
      </div>
      {showMap && (
        <div className="mt-3">
          <GeohashMap
            geohashes={value}
            onGeohashSelect={handleGeohashSelect}
            height="24rem"
          />
        </div>
      )}
    </>
  )
}
