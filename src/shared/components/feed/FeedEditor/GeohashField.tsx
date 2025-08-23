import {useState} from "react"
import {RiMapPinLine, RiGlobalLine} from "@remixicon/react"
import {getCurrentLocationGeohash} from "@/utils/geohash"

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
  const [showIframe, setShowIframe] = useState(false)
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
    const geohash = await getCurrentLocationGeohash(4)
    if (geohash) {
      const currentGeohashes = value || []

      // Add multiple precision levels for privacy
      const precisions = [
        geohash.substring(0, 3), // City/region level
        geohash.substring(0, 4), // District level
      ]

      const newGeohashes = precisions.filter((gh) => !currentGeohashes.includes(gh))

      if (newGeohashes.length > 0) {
        onChange([...currentGeohashes, ...newGeohashes])
      }
    }
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
                className="btn btn-sm btn-neutral"
                title="Add current location (multiple precision levels)"
              >
                <RiMapPinLine className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowIframe(!showIframe)}
                className={`btn btn-sm ${showIframe ? "btn-primary" : "btn-neutral"}`}
                title={showIframe ? "Hide geohash explorer" : "Show geohash explorer"}
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
      {showIframe && (
        <div className="mt-3 border border-base-300 rounded-lg overflow-hidden">
          <iframe
            src="http://geohash.softeng.co/"
            className="w-full h-96"
            title="Geohash Explorer"
          />
        </div>
      )}
    </>
  )
}
