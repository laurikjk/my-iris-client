import {RiMapPinLine} from "@remixicon/react"
import {useDraftStore} from "@/stores/draft"
import {useGeohash} from "@/shared/hooks/useGeohash"

interface GeohashManagerProps {
  disabled?: boolean
  displayInline?: boolean
}

export function GeohashManager({
  disabled = false,
  displayInline = false,
}: GeohashManagerProps) {
  const {gTags, addGeohash, removeGeohash} = useDraftStore()
  const {getGeohashPrecisions, loading} = useGeohash()

  const handleAddLocation = async () => {
    const precisions = await getGeohashPrecisions(4)
    if (precisions) {
      // Add all precision levels for privacy
      precisions.forEach((gh) => addGeohash(gh))
    }
  }

  if (displayInline) {
    return (
      <button
        onClick={handleAddLocation}
        disabled={disabled || loading}
        className="btn btn-ghost btn-circle btn-sm md:btn-md"
        title="Add location"
      >
        {loading ? (
          <span className="loading loading-spinner loading-sm" />
        ) : (
          <RiMapPinLine className="w-6 h-6" />
        )}
      </button>
    )
  }

  return (
    <>
      {/* Location button */}
      <button
        onClick={handleAddLocation}
        disabled={disabled || loading}
        className="btn btn-ghost btn-circle btn-sm md:btn-md"
        title="Add location"
      >
        {loading ? (
          <span className="loading loading-spinner loading-sm" />
        ) : (
          <RiMapPinLine className="w-6 h-6" />
        )}
      </button>

      {/* Display geohashes */}
      {gTags.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-base-content/70">
          <RiMapPinLine className="w-4 h-4" />
          <div className="flex gap-2 flex-wrap">
            {gTags.map((gh) => (
              <span key={gh} className="badge badge-sm">
                {gh}
                <button
                  onClick={() => removeGeohash(gh)}
                  className="ml-1 hover:text-error"
                  disabled={disabled}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
