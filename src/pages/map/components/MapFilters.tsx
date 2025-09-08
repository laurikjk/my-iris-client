import {useParams} from "@/navigation"
import {useRef, useState, useEffect} from "react"
import SearchTabSelector from "@/shared/components/search/SearchTabSelector"
import Icon from "@/shared/components/Icons/Icon"
import MapWithEvents from "@/shared/components/map/MapWithEvents"

export default function MapFilters() {
  const {query} = useParams()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [searchTerm, setSearchTerm] = useState(query || "")
  const [selectedGeohashes, setSelectedGeohashes] = useState<string[]>(
    query ? [query.toLowerCase()] : []
  )

  // Update state when route parameter changes
  useEffect(() => {
    if (query) {
      setSelectedGeohashes([query.toLowerCase()])
      setSearchTerm(query)
    } else {
      setSelectedGeohashes([])
      setSearchTerm("")
    }
  }, [query])

  const handleInputChange = (value: string) => {
    setSearchTerm(value)
    // Update map instantly as user types
    if (value.trim()) {
      const geohash = value.toLowerCase().replace(/[^0-9bcdefghjkmnpqrstuvwxyz]/g, "")
      if (geohash) {
        setSelectedGeohashes((current) => {
          // Only update if different to prevent unnecessary re-renders
          if (current.length === 1 && current[0] === geohash) return current
          return [geohash]
        })
      }
    } else {
      setSelectedGeohashes([])
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0">
        <SearchTabSelector activeTab="map" />
      </div>

      <div className="w-full p-2 flex-shrink-0">
        <label className="input input-bordered flex items-center gap-2 w-full">
          <input
            ref={searchInputRef}
            type="text"
            className="grow"
            placeholder="Search geohash area..."
            value={searchTerm}
            onChange={(e) => handleInputChange(e.target.value)}
          />
          <Icon name="search-outline" className="text-neutral-content/60" />
        </label>
      </div>

      <div className="flex-1 min-h-0">
        <MapWithEvents
          selectedGeohashes={selectedGeohashes}
          height="calc(100vh - 200px)"
          className="w-full"
        />
      </div>
    </div>
  )
}
