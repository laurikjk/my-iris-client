import {lazy, Suspense} from "react"
import "leaflet/dist/leaflet.css"

interface GeohashMapProps {
  geohashes?: string[]
  onGeohashSelect?: (geohash: string) => void
  height?: string
  className?: string
}

const MapContent = lazy(() => import("./GeohashMapContent"))

export function GeohashMap({
  geohashes = [],
  onGeohashSelect,
  height = "24rem",
  className = "",
}: GeohashMapProps) {
  return (
    <div className={`relative ${className}`} style={{height}}>
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-full bg-base-200">
            <span className="loading loading-spinner loading-md"></span>
          </div>
        }
      >
        <MapContent
          geohashes={geohashes}
          onGeohashSelect={onGeohashSelect}
          height={height}
        />
      </Suspense>
    </div>
  )
}
